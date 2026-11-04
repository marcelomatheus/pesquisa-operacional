import pytest
from fastapi.testclient import TestClient

from pivonauta.branch_bound import solve_branch_bound
from pivonauta.domain import Constraint, LinearProgram, Variable, is_feasible
from pivonauta.geometry import build_geometry
from pivonauta.main import app


def model(objective, constraints, integer=False, sense='max'):
    return LinearProgram(
        'PR6', sense, tuple(objective),
        tuple(Constraint(tuple(coeff), operator, rhs, id=f'r{i}')
              for i, (coeff, operator, rhs) in enumerate(constraints)),
        tuple(Variable(f'x{i+1}', 'integer' if integer else 'continuous')
              for i in range(len(objective))),
    )


def test_wyndor_levels_satisfy_objective_equations():
    item = model([3, 5], [([1, 0], 'le', 4), ([0, 2], 'le', 12), ([3, 2], 'le', 18)])
    shape = build_geometry(item)
    assert shape.status == 'feasible'
    assert len(shape.level_lines) >= 3
    for contour in shape.level_lines:
        assert contour['segment']
        for x, y in contour['segment']:
            assert 3 * x + 5 * y == pytest.approx(contour['value'], rel=1e-7, abs=1e-7)


def test_alternative_optimal_face_lies_on_feasible_boundary():
    item = model([1, 1], [([1, 1], 'le', 4), ([1, 0], 'le', 3), ([0, 1], 'le', 3)])
    shape = build_geometry(item)
    assert shape.optimal_face is not None
    assert len(shape.optimal_face) == 2
    assert shape.optimal_face[0] != pytest.approx(shape.optimal_face[1])
    for point in shape.optimal_face:
        assert is_feasible(item, tuple(point))
        assert sum(point) == pytest.approx(4)


def test_integer_lattice_contains_only_feasible_integer_points():
    item = model([1, 1], [([1, 1], 'le', 4), ([1, 0], 'le', 3), ([0, 1], 'le', 3)], integer=True)
    shape = build_geometry(item)
    lattice = shape.integer_lattice
    assert lattice['mode'] == 'declared_integer'
    assert not lattice['sampled']
    assert len(lattice['points']) > 1
    assert all(all(value.is_integer() for value in point) for point in lattice['points'])
    assert all(is_feasible(item, tuple(point)) for point in lattice['points'])


def test_forced_integer_mode_is_explicit():
    item = model([.4, .5], [([.5, .5], 'eq', 6), ([.6, .4], 'ge', 6)])
    ordinary = build_geometry(item)
    assert ordinary.integer_lattice['mode'] == 'mixed_or_continuous'
    forced = build_geometry(item, force_all_integer=True)
    assert forced.integer_lattice['mode'] == 'forced_all'
    assert all(is_feasible(item, tuple(p)) for p in forced.integer_lattice['points'])


def test_zero_objective_does_not_invent_contours_or_optimal_face():
    item = model([0, 0], [([1, 1], 'le', 4)])
    shape = build_geometry(item)
    assert shape.level_lines == []
    assert shape.optimal_face == []


def test_lattice_sampling_discloses_truncation():
    item = model([0, 0], [([1, 0], 'le', 100), ([0, 1], 'le', 100)], integer=True)
    shape = build_geometry(item, max_integer_points=16)
    assert shape.integer_lattice['sampled']
    assert shape.integer_lattice['stride'] > 1


def test_bnb_nodes_encode_reconstructable_branch_decisions():
    item = model([.4, .5], [([.3, .1], 'le', 2.7), ([.5, .5], 'eq', 6),
                             ([.6, .4], 'ge', 6)], integer=True, sense='min')
    result = solve_branch_bound(item)
    assert result.status == 'optimal'
    assert result.explored_nodes > 1
    assert result.nodes[0].branch_decision is None
    for node in result.nodes[1:]:
        decision = node.branch_decision
        assert decision is not None
        assert decision['variable_id'] in ('x1', 'x2')
        assert decision['operator'] in ('le', 'ge')
        if node.relaxation_status == 'optimal':
            value = node.relaxation_variables[decision['variable_id']]
            if decision['operator'] == 'le':
                assert value <= decision['rhs'] + 1e-6
            else:
                assert value >= decision['rhs'] - 1e-6


def test_geometry_api_options_and_input_validation():
    client = TestClient(app)
    payload = {'model': {
        'name': 'Pr6', 'sense': 'max', 'variables': [
            {'id': 'x1', 'domain': 'integer'}, {'id': 'x2', 'domain': 'integer'}],
        'objective': [1, 1], 'constraints': [
            {'id': 'r1', 'coefficients': [1, 1], 'operator': 'le', 'rhs': 4}],
    }, 'options': {'show_integer_lattice': True, 'max_integer_points': 12}}
    response = client.post('/api/v1/geometry', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['integer_lattice']['points']
    assert data['level_lines']
    assert 'optimal_face' in data
    payload['options']['max_integer_points'] = 0
    response = client.post('/api/v1/geometry', json=payload)
    assert response.status_code == 422
