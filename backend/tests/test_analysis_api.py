import pytest

from fastapi.testclient import TestClient
from pivonauta.main import app

client = TestClient(app)


def model(name, sense, objective, constraints, variables=None):
    return {'model': {'name': name, 'sense': sense, 'objective': objective,
                      'variables': variables or [{'id': f'x{i+1}'} for i in range(len(objective))],
                      'constraints': [{'id': f'r{i+1}', 'coefficients': a,
                                       'operator': op, 'rhs': rhs}
                                      for i, (a, op, rhs) in enumerate(constraints)]}}


def test_dual_wyndor_route():
    payload = model('Wyndor', 'max', [3, 5], [([1, 0], 'le', 4), ([0, 2], 'le', 12), ([3, 2], 'le', 18)])
    response = client.post('/api/v1/solves/dual', json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result['status'] == 'optimal'
    assert result['primal_objective'] == result['dual_objective'] == 36
    assert result['dual']['iterations']


def test_dual_radiotherapy_route():
    payload = model('Radioterapia', 'min', [.4, .5], [([.3, .1], 'le', 2.7), ([.5, .5], 'eq', 6), ([.6, .4], 'ge', 6)])
    response = client.post('/api/v1/solves/dual', json=payload)
    assert response.status_code == 200
    assert response.json()['status'] == 'optimal'
    assert response.json()['dual_objective'] == pytest.approx(5.25)


def test_alternatives_route():
    payload = model('Multiples', 'max', [1, 1], [([1, 1], 'le', 4), ([1, 0], 'le', 3), ([0, 1], 'le', 3)])
    response = client.post('/api/v1/solves/alternatives', json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result['status'] == 'multiple'
    assert result['certified'] is True
    assert result['reference'] != result['alternative']


def test_geometry_route():
    payload = model('Wyndor', 'max', [3, 5], [([1, 0], 'le', 4), ([0, 2], 'le', 12), ([3, 2], 'le', 18)])
    response = client.post('/api/v1/geometry', json=payload)
    assert response.status_code == 200
    result = response.json()
    assert result['region_type'] == 'polygon'
    assert len(result['polygon']) >= 3
    assert len(result['lines']) == 5


def test_geometry_rejects_non_2d():
    payload = model('3D', 'max', [1, 2, 3], [])
    response = client.post('/api/v1/geometry', json=payload)
    assert response.status_code == 422
    assert response.json()['code'] == 'INVALID_MODEL'
