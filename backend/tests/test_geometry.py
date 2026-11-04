import pytest

from pivonauta.domain import Constraint, InvalidModel, LinearProgram, Variable
from pivonauta.geometry import build_geometry


def p(obj, rows, variables=None):
    return LinearProgram('geometry', 'max', tuple(obj),
                         tuple(Constraint(tuple(a), op, b, id=f'r{i}') for i, (a, op, b) in enumerate(rows)),
                         tuple(variables or [Variable(f'x{i+1}') for i in range(len(obj))]))


def test_wyndor_bounded_vertices_and_optimum():
    result = build_geometry(p([3,5], [([1,0], 'le', 4), ([0,2], 'le', 12), ([3,2], 'le', 18)]))
    assert result.status == 'feasible', result
    assert result.bounded
    assert result.region_type == 'polygon'
    assert result.dimension == 2
    assert result.optimal_point == pytest.approx([2,6])
    assert any(pt == pytest.approx([2,6]) for pt in result.vertices)
    assert len(result.polygon) >= 3
    assert all(line['segment'] for line in result.lines)


def test_multiple_optima_polygon():
    result = build_geometry(p([1,1], [([1,1], 'le', 4), ([1,0], 'le', 3), ([0,1], 'le', 3)]))
    assert result.region_type == 'polygon'
    assert result.bounded
    assert len(result.vertices) >= 4


def test_unbounded_feasible_region_not_labelled_bounded():
    result = build_geometry(p([1, 0], [([1, 0], 'le', 2)]))
    assert result.status == 'feasible'
    assert result.region_type == 'unbounded'
    assert result.bounded is False
    assert result.polygon
    assert result.optimal_point is not None


def test_unbounded_objective_still_draws_feasible_region():
    result = build_geometry(p([0, 1], [([1, 0], 'le', 2)]))
    assert result.region_type == 'unbounded'
    assert result.optimal_point is None


def test_empty_region():
    result = build_geometry(p([1, 0], [([1, 0], 'le', 1), ([1, 0], 'ge', 2)]))
    assert result.status == 'infeasible'
    assert result.region_type == 'empty'
    assert not result.polygon


def test_segment_with_equality():
    result = build_geometry(p([1, 1], [([1, 1], 'eq', 2)]))
    assert result.status == 'feasible', result
    assert result.region_type == 'segment'
    assert result.dimension == 1
    assert result.bounded


def test_single_point():
    result = build_geometry(p([1, 1], [([1, 0], 'eq', 1), ([0, 1], 'eq', 2)]))
    assert result.status == 'feasible', result
    assert result.region_type == 'point'
    assert result.dimension == 0
    assert result.optimal_point == pytest.approx([1, 2])


def test_unconstrained_free_plane():
    result = build_geometry(p([0, 0], [], [Variable('x1', lower_bound=None), Variable('x2', lower_bound=None)]))
    assert result.status == 'feasible'
    assert result.region_type == 'unbounded'
    assert result.dimension == 2
    assert result.bounded is False


def test_geometry_rejects_more_than_two_variables():
    with pytest.raises(InvalidModel):
        build_geometry(p([1, 2, 3], []))
