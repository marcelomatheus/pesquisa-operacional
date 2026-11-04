from fastapi.testclient import TestClient

from pivonauta.domain import Constraint, LinearProgram, Variable
from pivonauta.main import app
from pivonauta.simplex import solve_simplex
from pivonauta.standard_form import describe_standard_form
from pivonauta.tableau_trace import pivot_operations


client = TestClient(app)


def wyndor() -> LinearProgram:
    return LinearProgram(
        name='Wyndor',
        sense='max',
        objective=(3.0, 5.0),
        variables=(Variable('x1'), Variable('x2')),
        constraints=(
            Constraint((1.0, 0.0), 'le', 4.0, id='r1'),
            Constraint((0.0, 2.0), 'le', 12.0, id='r2'),
            Constraint((3.0, 2.0), 'le', 18.0, id='r3'),
        ),
    )


def test_operations_reconstruct_next_tableau():
    result = solve_simplex(wyndor())
    assert result.status == 'optimal'
    pivots = [step for step in result.iterations if step['event'] == 'pivot']
    assert pivots
    for step in pivots:
        before = step['matrix']
        after = [row[:] for row in before]
        operations = step['row_operations']
        assert operations
        for operation in operations:
            after[operation['target_row']] = operation['after']
        following = result.iterations[result.iterations.index(step) + 1]
        if following['phase'] == step['phase']:
            for expected, actual in zip(following['matrix'], after, strict=True):
                assert len(expected) == len(actual)
                for a, b in zip(expected, actual, strict=True):
                    assert abs(a - b) < 1e-7


def test_trace_has_reduced_costs_and_pivot_coordinates():
    result = solve_simplex(wyndor())
    for step in result.iterations:
        assert 'reduced_costs' in step
        assert 'row_operations' in step
        assert isinstance(step['reduced_costs'], list)
        if step['event'] == 'pivot':
            assert step['pivot']['row'] >= 1
            assert step['row_operations'][0]['kind'] == 'scale'
            assert step['row_operations'][0]['target_row'] == step['pivot']['row']


def test_standard_form_retains_original_variable_mapping():
    model = LinearProgram(
        name='Shift and bounds',
        sense='min',
        objective=(2.0, -1.0),
        variables=(Variable('x1', lower_bound=3.0, upper_bound=9.0),
                   Variable('x2', lower_bound=None)),
        constraints=(Constraint((1.0, -1.0), 'ge', -5.0, id='r1'),),
    )
    info = describe_standard_form(model)
    assert info['original_sense'] == 'min'
    assert info['objective_offset'] == -6.0
    assert info['original_objective_offset'] == 6.0
    assert info['phase_one_required'] is False
    assert len(info['rows']) == 2
    assert info['rows'][0]['source']['id'] == 'r1'
    assert info['rows'][1]['source']['kind'] == 'upper_bound'
    assert info['variable_reconstruction'][0]['constant'] == 3.0
    assert len(info['variable_reconstruction'][1]['terms']) == 2
    assert all(len(row['coefficients']) == len(info['columns']) for row in info['rows'])
    assert all(row['rhs'] >= 0 for row in info['rows'])


def test_standard_form_api_returns_exact_rows():
    payload = {
        'model': {
            'name': 'Wyndor', 'sense': 'max',
            'objective': [3, 5],
            'variables': [{'id': 'x1'}, {'id': 'x2'}],
            'constraints': [
                {'id': 'r1', 'coefficients': [1, 0], 'operator': 'le', 'rhs': 4},
                {'id': 'r2', 'coefficients': [0, 2], 'operator': 'le', 'rhs': 12},
                {'id': 'r3', 'coefficients': [3, 2], 'operator': 'le', 'rhs': 18},
            ],
        },
    }
    response = client.post('/api/v1/models/standard-form', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['phase_one_required'] is False
    assert data['columns'] == ['x1', 'x2', 's1', 's2', 's3']
    assert data['rows'][0]['basic'] == 's1'
    assert data['objective'][:2] == [3, 5]


def test_trace_opt_out_avoids_row_operation_building():
    result = solve_simplex(wyndor(), include_trace=False)
    assert result.iterations == []
    assert result.status == 'optimal'


def test_two_phase_standard_form_has_artificial_columns():
    model = LinearProgram('Equality', 'min', (1.0, 1.0),
                          (Constraint((1.0, 1.0), 'eq', 5.0, id='r1'),),
                          (Variable('x1'), Variable('x2')))
    data = describe_standard_form(model)
    assert data['phase_one_required'] is True
    assert data['artificial_columns']
