from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class ApiResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class HealthResponse(ApiResponse):
    status: str
    version: str | None = None


class ModelValidationResponse(ApiResponse):
    structurally_valid: bool
    feasibility_checked: bool
    variable_count: int
    constraint_count: int


class SolveResponse(ApiResponse):
    status: str
    objective_value: float | None
    variables: dict[str, float] | None
    iterations: list[dict[str, Any]]
    pivot_count: int
    message: str


class BranchDecisionResponse(ApiResponse):
    variable_id: str
    operator: Literal["le", "ge"]
    rhs: float


class BranchNodeResponse(ApiResponse):
    id: str
    parent_id: str | None
    depth: int
    branch_constraint: str | None
    status: str
    relaxation_status: str
    relaxation_objective: float | None
    relaxation_variables: dict[str, float] | None
    pivot_count: int
    children: list[str]
    branch_decision: BranchDecisionResponse | None


class RoundingCandidateResponse(ApiResponse):
    values: dict[str, float]
    feasible: bool
    objective_value: float | None


class IntegerResponse(ApiResponse):
    status: str
    objective_value: float | None
    variables: dict[str, float] | None
    explored_nodes: int
    nodes: list[BranchNodeResponse]
    best_bound: float | None
    optimality_gap: float | None
    rounding_candidates: list[RoundingCandidateResponse]
    best_rounding_candidate: RoundingCandidateResponse | None = None
    message: str


class DualityResponse(ApiResponse):
    status: str
    primal: SolveResponse
    dual_model: dict[str, Any]
    dual: SolveResponse | None
    objective_offset: float
    primal_objective: float | None
    dual_objective: float | None
    duality_gap: float | None
    complementary_slackness: bool | None
    message: str


class AlternativesResponse(ApiResponse):
    status: str
    certified: bool
    objective_value: float | None
    reference: dict[str, float] | None
    alternative: dict[str, float] | None
    explored_bases: int
    zero_reduced_cost_columns: list[str]
    message: str


class GeometryResponse(ApiResponse):
    status: str
    region_type: str
    bounded: bool | None
    dimension: int | None
    viewport: dict[str, float]
    polygon: list[list[float]]
    vertices: list[list[float]]
    lines: list[dict[str, Any]]
    optimal_point: list[float] | None
    optimal_value: float | None
    message: str
    level_lines: list[dict[str, Any]] | None = None
    optimal_face: list[list[float]] | None = None
    integer_lattice: dict[str, Any] | None = None


class StandardFormResponse(ApiResponse):
    sense: str
    original_sense: str
    objective: list[float]
    objective_offset: float
    original_objective_offset: float
    columns: list[str]
    artificial_columns: list[str]
    phase_one_required: bool
    variable_reconstruction: list[dict[str, Any]]
    rows: list[dict[str, Any]]
