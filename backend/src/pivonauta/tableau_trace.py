from __future__ import annotations


def pivot_operations(tableau: list[list[float]], pivot_row: int, pivot_column: int,
                     tolerance: float = 1e-9) -> list[dict]:
    pivot_value = tableau[pivot_row][pivot_column]
    if abs(pivot_value) <= tolerance:
        raise ArithmeticError('A pivot must have a nonzero value')
    normalized = [value / pivot_value for value in tableau[pivot_row]]
    operations = [{
        'kind': 'scale',
        'target_row': pivot_row,
        'source_row': pivot_row,
        'factor': 1 / pivot_value,
        'pivot_value': pivot_value,
        'before': tableau[pivot_row].copy(),
        'after': normalized.copy(),
    }]
    for row_index, row in enumerate(tableau):
        if row_index == pivot_row:
            continue
        multiplier = row[pivot_column]
        if abs(multiplier) <= tolerance:
            continue
        after = [value - multiplier * normalized_value
                 for value, normalized_value in zip(row, normalized, strict=True)]
        operations.append({
            'kind': 'eliminate',
            'target_row': row_index,
            'source_row': pivot_row,
            'factor': -multiplier,
            'pivot_value': pivot_value,
            'before': row.copy(),
            'after': after,
        })
    return operations
