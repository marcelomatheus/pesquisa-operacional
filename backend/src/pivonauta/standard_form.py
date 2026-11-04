from __future__ import annotations

from .domain import LinearProgram
from .simplex import standardize


def describe_standard_form(model: LinearProgram) -> dict:
    form = standardize(model)
    direction = 1 if model.sense == 'max' else -1
    mappings = []
    for variable, (shift, parts) in zip(model.variables, form.reconstruction, strict=True):
        mappings.append({
            'variable': variable.id,
            'constant': shift,
            'terms': [{'column': form.columns[column], 'factor': coefficient}
                      for column, coefficient in parts],
        })
    sources = [
        {'kind': 'constraint', 'id': item.id, 'name': item.id or f'R{i + 1}'}
        for i, item in enumerate(model.constraints)
    ]
    sources.extend(
        {'kind': 'upper_bound', 'id': variable.id, 'name': f'{variable.id} <= {variable.upper_bound}'}
        for variable in model.variables if variable.upper_bound is not None
    )
    offset = sum(cost * mapping[0]
                 for cost, mapping in zip(model.objective, form.reconstruction, strict=True))
    return {
        'sense': 'max',
        'original_sense': model.sense,
        'objective': form.transformed_costs,
        'objective_offset': direction * offset,
        'original_objective_offset': offset,
        'columns': form.columns,
        'artificial_columns': [form.columns[index] for index in sorted(form.artificial)],
        'phase_one_required': bool(form.artificial),
        'variable_reconstruction': mappings,
        'rows': [
            {
                'source': sources[index],
                'coefficients': row,
                'operator': 'eq',
                'rhs': form.right_hand_sides[index],
                'basic': form.columns[form.basis[index]],
                'normalized_rhs': form.right_hand_sides[index],
            }
            for index, row in enumerate(form.rows)
        ],
    }
