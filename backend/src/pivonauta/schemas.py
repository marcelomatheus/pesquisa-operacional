"""HTTP/Pydantic contracts: the mathematical domain never imports this module."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .domain import Constraint, LinearProgram, Variable


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class VariableIn(StrictModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-zA-Z][a-zA-Z0-9_]*$")
    domain: Literal["continuous", "integer"] = "continuous"
    lower_bound: float | None = 0.0
    upper_bound: float | None = None

    @model_validator(mode="after")
    def bounds_valid(self):
        if (self.lower_bound is not None and self.upper_bound is not None
                and self.lower_bound > self.upper_bound):
            raise ValueError("lower_bound cannot exceed upper_bound")
        return self


class ConstraintIn(StrictModel):
    id: str = Field(default="", max_length=50)
    coefficients: list[float] = Field(min_length=1, max_length=10)
    operator: Literal["le", "ge", "eq"]
    rhs: float


class LinearProgramIn(StrictModel):
    name: str = Field(default="Modelo sem título", min_length=1, max_length=120)
    sense: Literal["max", "min"]
    variables: list[VariableIn] = Field(min_length=1, max_length=10)
    objective: list[float] = Field(min_length=1, max_length=10)
    constraints: list[ConstraintIn] = Field(max_length=30)

    @model_validator(mode="after")
    def dimensions_valid(self):
        n = len(self.objective)
        if len(self.variables) != n:
            raise ValueError("The objective must have one coefficient per variable")
        if len({v.id for v in self.variables}) != n:
            raise ValueError("Variable identifiers must be unique")
        for index, constraint in enumerate(self.constraints):
            if len(constraint.coefficients) != n:
                raise ValueError(f"Constraint {index + 1} must have {n} coefficients")
        return self

    def to_domain(self) -> LinearProgram:
        return LinearProgram(
            name=self.name,
            sense=self.sense,
            objective=tuple(self.objective),
            variables=tuple(Variable(**v.model_dump()) for v in self.variables),
            constraints=tuple(Constraint(**{
                **c.model_dump(), "coefficients": tuple(c.coefficients)
            }) for c in self.constraints),
        )


class SolveOptions(StrictModel):
    max_iterations: int = Field(default=500, ge=1, le=2000)
    time_limit: float = Field(default=3.0, gt=0, le=30)
    tolerance: float = Field(default=1e-9, gt=0, le=1e-4)
    include_trace: bool = True


class IntegerOptions(StrictModel):
    max_nodes: int = Field(default=200, ge=1, le=1000)
    max_iterations: int = Field(default=500, ge=1, le=2000)
    time_limit: float = Field(default=10, gt=0, le=30)
    force_all_integer: bool = False


class ModelRequest(StrictModel):
    model: LinearProgramIn


class SolveRequest(ModelRequest):
    options: SolveOptions = Field(default_factory=SolveOptions)


class IntegerRequest(ModelRequest):
    options: IntegerOptions = Field(default_factory=IntegerOptions)
