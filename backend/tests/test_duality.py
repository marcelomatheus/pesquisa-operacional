import pytest

from pivonauta.domain import Constraint, LinearProgram, Variable
from pivonauta.duality import build_dual, solve_dual


def problem(sense, costs, rows, variables=None):
    variables = tuple(variables or (Variable(f'x{i+1}') for i in range(len(costs))))
    return LinearProgram('dual test', sense, tuple(costs),
                         tuple(Constraint(tuple(a), op, b, id=f'r{i}') for i, (a, op, b) in enumerate(rows)),
                         variables)


def test_wyndor_dual_strong_duality():
    model = problem('max', [3, 5], [([1, 0], 'le', 4), ([0, 2], 'le', 12), ([3, 2], 'le', 18)])
    result = solve_dual(model)
    assert result.status == 'optimal'
    assert result.primal_objective == pytest.approx(36)
    assert result.dual_objective == pytest.approx(36)
    assert result.dual_model['sense'] == 'min'
    assert [v['lower_bound'] for v in result.dual_model['variables']] == [0, 0, 0]
    assert result.complementary_slackness
    assert result.dual['iterations']


def test_radiotherapy_mixed_signs_and_equality():
    model = problem('min', [.4, .5], [([.3, .1], 'le', 2.7), ([.5, .5], 'eq', 6), ([.6, .4], 'ge', 6)])
    result = solve_dual(model)
    assert result.status == 'optimal', result.to_dict()
    assert result.primal_objective == pytest.approx(5.25)
    assert result.dual_objective == pytest.approx(5.25)
    vars_ = result.dual_model['variables']
    assert vars_[0]['upper_bound'] == 0
    assert vars_[1]['lower_bound'] is None and vars_[1]['upper_bound'] is None
    assert vars_[2]['lower_bound'] == 0
    assert all(c['operator'] == 'le' for c in result.dual_model['constraints'])


def test_nonzero_lower_and_upper_bounds_affine_offset():
    model = problem('max', [2], [], [Variable('x1', lower_bound=3, upper_bound=7)])
    result = solve_dual(model)
    assert result.status == 'optimal', result.to_dict()
    assert result.objective_offset == pytest.approx(6)
    assert result.primal_objective == pytest.approx(14)
    assert result.dual_objective == pytest.approx(14)


def test_free_primal_variable_yields_dual_equality():
    model = problem('max', [-1], [([1], 'ge', -5), ([1], 'le', 3)],
                    [Variable('x1', lower_bound=None)])
    result = solve_dual(model)
    assert result.status == 'optimal', result.to_dict()
    assert result.dual_model['constraints'][0]['operator'] == 'eq'
    assert result.primal_objective == pytest.approx(5)
    assert result.dual_objective == pytest.approx(5)


def test_dual_of_infeasible_has_no_false_certification():
    model = problem('max', [1], [([1], 'le', 1), ([1], 'ge', 2)])
    result = solve_dual(model)
    assert result.status != 'optimal'
    assert result.duality_gap is None
