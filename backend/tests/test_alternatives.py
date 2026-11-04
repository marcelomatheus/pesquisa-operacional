import pytest

from pivonauta.alternatives import analyze_optima
from pivonauta.domain import Constraint, LinearProgram, Variable


def model(sense, obj, rows, variables=None):
    return LinearProgram('alternatives', sense, tuple(obj),
                         tuple(Constraint(tuple(a), op, b) for a, op, b in rows),
                         tuple(variables or [Variable(f'x{i+1}') for i in range(len(obj))]))


def test_multiple_optimal_points_have_feasible_witness():
    problem = model('max', [1, 1], [([1, 1], 'le', 4), ([1, 0], 'le', 3), ([0, 1], 'le', 3)])
    result = analyze_optima(problem)
    assert result.status == 'multiple', result
    assert result.certified
    assert result.alternative != result.reference
    assert sum(result.alternative.values()) == pytest.approx(4)
    assert result.zero_reduced_cost_columns


def test_wyndor_unique():
    problem = model('max', [3, 5], [([1, 0], 'le', 4), ([0, 2], 'le', 12), ([3, 2], 'le', 18)])
    result = analyze_optima(problem)
    assert result.status == 'unique', result
    assert result.certified
    assert result.alternative is None


def test_degenerate_singleton_is_not_false_multiple():
    problem = model('max', [0, 0], [([1, 1], 'eq', 0)])
    result = analyze_optima(problem)
    assert result.status == 'unique', result


def test_free_variable_redundant_split_not_false_multiple():
    problem = model('max', [0], [([1], 'eq', 0)], [Variable('x1', lower_bound=None)])
    result = analyze_optima(problem)
    assert result.status == 'unique', result


def test_unbounded_optimal_face():
    problem = model('max', [1, 0], [([1, 0], 'le', 2)])
    result = analyze_optima(problem)
    assert result.status == 'multiple', result
    assert result.alternative['x1'] == pytest.approx(2)
    assert result.alternative['x2'] > result.reference['x2']


def test_infeasible_not_misreported_unique():
    problem = model('max', [1], [([1], 'le', 0), ([1], 'ge', 1)])
    result = analyze_optima(problem)
    assert result.status == 'not_certified'
    assert not result.certified
