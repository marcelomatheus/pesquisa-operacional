"""Immutable domain models; this module depends only on the Python standard library."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Literal


Sense = Literal["min", "max"]
Operator = Literal["le", "ge", "eq"]
Domain = Literal["continuous", "integer"]


class InvalidModel(ValueError):
    """The mathematical input cannot be interpreted as a linear program."""


@dataclass(frozen=True, slots=True)
class Variable:
    id: str
    domain: Domain = "continuous"
    lower_bound: float | None = 0.0
    upper_bound: float | None = None


@dataclass(frozen=True, slots=True)
class Constraint:
    coefficients: tuple[float, ...]
    operator: Operator
    rhs: float
    id: str = ""


@dataclass(frozen=True, slots=True)
class LinearProgram:
    name: str
    sense: Sense
    objective: tuple[float, ...]
    constraints: tuple[Constraint, ...]
    variables: tuple[Variable, ...]

    def __post_init__(self) -> None:
        n = len(self.objective)
        if not 1 <= n <= 10:
            raise InvalidModel("The number of decision variables must be between 1 and 10")
        if len(self.variables) != n:
            raise InvalidModel("Objective and variable dimensions differ")
        if len(self.constraints) > 100:
            raise InvalidModel("Too many constraints (maximum 30)")
        if self.sense not in ("max", "min"):
            raise InvalidModel("Unsupported objective sense")
        if len({v.id for v in self.variables}) != n:
            raise InvalidModel("Variable identifiers must be unique")
        if any(not isfinite(v) for v in self.objective):
            raise InvalidModel("Objective coefficients must be finite")
        for var in self.variables:
            if var.domain not in ("continuous", "integer"):
                raise InvalidModel("Unsupported variable domain")
            if var.lower_bound is not None and not isfinite(var.lower_bound):
                raise InvalidModel("Lower bound must be finite or null")
            if var.upper_bound is not None and not isfinite(var.upper_bound):
                raise InvalidModel("Upper bound must be finite or null")
            if (var.lower_bound is not None and var.upper_bound is not None
                    and var.lower_bound > var.upper_bound):
                raise InvalidModel("Lower bound cannot exceed upper bound")
        for con in self.constraints:
            if len(con.coefficients) != n:
                raise InvalidModel("Constraint dimension differs from objective")
            if con.operator not in ("le", "ge", "eq"):
                raise InvalidModel("Unsupported constraint operator")
            if not isfinite(con.rhs) or any(not isfinite(v) for v in con.coefficients):
                raise InvalidModel("Constraint coefficients and RHS must be finite")

    def with_constraint(self, constraint: Constraint) -> LinearProgram:
        return LinearProgram(
            name=self.name,
            sense=self.sense,
            objective=self.objective,
            constraints=(*self.constraints, constraint),
            variables=self.variables,
        )

    def with_integer_variables(self) -> LinearProgram:
        return LinearProgram(
            name=self.name,
            sense=self.sense,
            objective=self.objective,
            constraints=self.constraints,
            variables=tuple(Variable(v.id, "integer", v.lower_bound, v.upper_bound)
                            for v in self.variables),
        )


def is_feasible(model: LinearProgram, values: tuple[float, ...], tol: float = 1e-7) -> bool:
    if len(values) != len(model.variables) or any(not isfinite(v) for v in values):
        return False
    for x, var in zip(values, model.variables, strict=True):
        if var.lower_bound is not None and x < var.lower_bound - tol * (1 + abs(var.lower_bound)):
            return False
        if var.upper_bound is not None and x > var.upper_bound + tol * (1 + abs(var.upper_bound)):
            return False
    for con in model.constraints:
        lhs = sum(c * x for c, x in zip(con.coefficients, values, strict=True))
        epsilon = tol * (1 + abs(con.rhs) + sum(abs(c * x) for c, x in zip(con.coefficients, values, strict=True)))
        if con.operator == "le" and lhs > con.rhs + epsilon:
            return False
        if con.operator == "ge" and lhs < con.rhs - epsilon:
            return False
        if con.operator == "eq" and abs(lhs - con.rhs) > epsilon:
            return False
    return True


def objective_value(model: LinearProgram, values: tuple[float, ...]) -> float:
    return sum(c * x for c, x in zip(model.objective, values, strict=True))
