"""Construct and solve textbook LP duals using our handwritten tableau Simplex.

All integer restrictions are relaxed in duality. Lower bounds are shifted and upper
bounds become explicit primal rows. These transformations are reversible and their
objective constant is retained for the strong-duality comparison.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from .domain import Constraint, InvalidModel, LinearProgram, Variable, is_feasible
from .simplex import solve_simplex


@dataclass(slots=True)
class DualityResult:
    status: str
    primal: dict
    dual_model: dict
    dual: dict | None
    objective_offset: float
    primal_objective: float | None
    dual_objective: float | None
    duality_gap: float | None
    complementary_slackness: bool | None
    message: str

    def to_dict(self) -> dict:
        return asdict(self)


def _row_sign(sense: str, operator: str) -> tuple[float | None, float | None]:
    # Dual of max: <= row has y >=0; >= row has y <=0.
    # Dual of min: >= row has y >=0; <= row has y <=0.
    if operator == 'eq':
        return (None, None)
    positive = (sense == 'max' and operator == 'le') or (sense == 'min' and operator == 'ge')
    return (0.0, None) if positive else (None, 0.0)


def build_dual(primal: LinearProgram) -> tuple[LinearProgram, float, list[dict]]:
    """Return dual LP, additive objective offset and transformed primal row metadata.

    For x_j >= l_j, substitute x_j = l_j + z_j with z_j >= 0. For free
    variables, z_j is free. Upper bounds become explicit <= rows; each new row
    has a dual variable, so strong duality remains correct for bounded variables.
    """
    n = len(primal.variables)
    offset = sum(cost * (var.lower_bound or 0.0)
                 for cost, var in zip(primal.objective, primal.variables, strict=True))
    rows: list[dict] = []
    for con in primal.constraints:
        rhs = con.rhs - sum(a * (var.lower_bound or 0.0)
                            for a, var in zip(con.coefficients, primal.variables, strict=True))
        rows.append({'id': con.id, 'operator': con.operator,
                     'coefficients': con.coefficients, 'rhs': rhs, 'origin': 'constraint'})
    for index, var in enumerate(primal.variables):
        if var.upper_bound is None:
            continue
        coeffs = tuple(1.0 if j == index else 0.0 for j in range(n))
        rhs = var.upper_bound - (var.lower_bound or 0.0)
        rows.append({'id': f'upper_{var.id}', 'operator': 'le',
                     'coefficients': coeffs, 'rhs': rhs, 'origin': 'upper_bound'})
    if not rows:
        # No dual decision variables would violate our domain constraint. The
        # unconstrained dual is handled by solve_dual instead of a dummy row.
        raise InvalidModel('Dual construction requires at least one primal row or upper bound')
    dual_variables = []
    for i, row in enumerate(rows):
        lower, upper = _row_sign(primal.sense, row['operator'])
        dual_variables.append(Variable(id=f'y{i + 1}', lower_bound=lower, upper_bound=upper))
    dual_constraints = []
    for i, variable in enumerate(primal.variables):
        sign = 'eq' if variable.lower_bound is None else ('ge' if primal.sense == 'max' else 'le')
        dual_constraints.append(Constraint(tuple(row['coefficients'][i] for row in rows),
                                           sign, primal.objective[i], id=f'dual_{variable.id}'))
    dual_program = LinearProgram(
        name=f'Dual — {primal.name}', sense='min' if primal.sense == 'max' else 'max',
        objective=tuple(row['rhs'] for row in rows),
        variables=tuple(dual_variables), constraints=tuple(dual_constraints),
    )
    return dual_program, offset, rows


def solve_dual(primal: LinearProgram, *, max_iterations: int = 500,
               time_limit: float = 3.0, tolerance: float = 1e-9,
               include_trace: bool = True) -> DualityResult:
    """Independently solve primal and constructed dual using our pure-Python Simplex."""
    primal_result = solve_simplex(primal, max_iterations=max_iterations,
                                  time_limit=time_limit, tolerance=tolerance,
                                  include_trace=include_trace)
    if not primal.constraints and not any(v.upper_bound is not None for v in primal.variables):
        return DualityResult('not_applicable', primal_result.to_dict(), {}, None, 0.0,
                             primal_result.objective_value, None, None, None,
                             'Dual display requires at least one linear constraint or upper bound')
    dual_program, offset, transformed_rows = build_dual(primal)
    dual_result = solve_simplex(dual_program, max_iterations=max_iterations,
                                time_limit=time_limit, tolerance=tolerance,
                                include_trace=include_trace)
    meta = {
        'name': dual_program.name,
        'sense': dual_program.sense,
        'variables': [{'id': v.id, 'lower_bound': v.lower_bound,
                       'upper_bound': v.upper_bound} for v in dual_program.variables],
        'objective': list(dual_program.objective),
        'constraints': [{'id': c.id, 'coefficients': list(c.coefficients),
                         'operator': c.operator, 'rhs': c.rhs} for c in dual_program.constraints],
        'source_rows': [{'id': row['id'], 'origin': row['origin'],
                         'operator': row['operator']} for row in transformed_rows],
    }
    pval = primal_result.objective_value
    dval = dual_result.objective_value + offset if dual_result.objective_value is not None else None
    gap = abs(pval - dval) if pval is not None and dval is not None else None
    complementary = None
    if (primal_result.status == 'optimal' and dual_result.status == 'optimal'
            and primal_result.variables is not None and dual_result.variables is not None):
        # Complementarity for each transformed primal row and dual variable,
        # and each transformed primal variable vs the corresponding dual row.
        x = tuple(primal_result.variables[v.id] for v in primal.variables)
        y = tuple(dual_result.variables[v.id] for v in dual_program.variables)
        primal_slacks = []
        for row in transformed_rows:
            z = [x[j] - (primal.variables[j].lower_bound or 0.0) for j in range(len(x))]
            lhs = sum(a * value for a, value in zip(row['coefficients'], z, strict=True))
            primal_slacks.append(abs(row['rhs'] - lhs))
        row_complementarity = all(abs(price * slack) <= 1e-6 * (1 + abs(price) + abs(slack))
                                    for price, slack in zip(y, primal_slacks, strict=True))
        dual_slacks = [abs(sum(a * price for a, price in zip(c.coefficients, y, strict=True)) - c.rhs)
                       for c in dual_program.constraints]
        variable_complementarity = all(
            (var.lower_bound is None or abs((value - var.lower_bound) * slack) <=
             1e-6 * (1 + abs(value) + abs(slack)))
            for var, value, slack in zip(primal.variables, x, dual_slacks, strict=True)
        )
        complementary = row_complementarity and variable_complementarity
    verified = (pval is not None and dval is not None and gap is not None
                and gap <= max(1e-7, tolerance * 100) * (1 + abs(pval) + abs(dval))
                and complementary is True)
    status = 'optimal' if verified else ('verification_failed' if pval is not None and dval is not None
                                         else 'not_certified')
    message = ('Primal and dual objectives agree; complementary slackness verified'
               if verified else 'Strong duality not certified; inspect individual solver statuses')
    return DualityResult(status, primal_result.to_dict(), meta, dual_result.to_dict(),
                         offset, pval, dval, gap, complementary, message)
