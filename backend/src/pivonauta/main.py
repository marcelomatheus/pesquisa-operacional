"""FastAPI composition root; the domain/algorithms remain framework-independent."""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from . import __version__
from .domain import InvalidModel
from .branch_bound import solve_branch_bound
from .schemas import AnalysisRequest, GeometryRequest, IntegerRequest, ModelRequest, ReportRequest, SolveRequest
from .duality import solve_dual
from .alternatives import analyze_optima
from .geometry import build_geometry
from .simplex import solve_simplex
from .standard_form import describe_standard_form
from .report_data import collect_report
from .report_pdf import build_report_pdf

logger = logging.getLogger("pivonauta")
app = FastAPI(title="PivôNauta API", version=__version__, description="Simplex and Branch and Bound, handcrafted in pure Python")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://127.0.0.1:4173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    correlation_id = str(uuid.uuid4())
    request.state.request_id = correlation_id
    if request.headers.get("content-length"):
        try:
            oversized = int(request.headers["content-length"]) > 100_000
        except ValueError:
            oversized = True
        if oversized:
            response = problem(413, "Payload too large", "Maximum request size: 100KB", "PAYLOAD_TOO_LARGE", correlation_id)
            response.headers["X-Request-ID"] = correlation_id
            return response
    response = await call_next(request)
    response.headers["X-Request-ID"] = correlation_id
    return response


def problem(status: int, title: str, detail: str, code: str, request_id: str,
            errors: list | None = None) -> JSONResponse:
    body = {"type": f"urn:pivonauta:problem:{code.lower()}",
            "title": title, "status": status, "detail": detail,
            "code": code, "request_id": request_id}
    if errors is not None:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [{"field": ".".join(map(str, entry["loc"])), "message": entry["msg"]}
              for entry in exc.errors()]
    return problem(422, "Invalid model", "Request validation failed", "MODEL_VALIDATION_ERROR",
                   request.state.request_id, errors)


@app.exception_handler(InvalidModel)
async def domain_exception_handler(request: Request, exc: InvalidModel):
    return problem(422, "Invalid model", str(exc), "INVALID_MODEL", request.state.request_id)


@app.exception_handler(ValueError)
async def value_exception_handler(request: Request, exc: ValueError):
    return problem(422, "Invalid operation", str(exc), "INVALID_OPERATION", request.state.request_id)


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API exception request_id=%s", request.state.request_id)
    return problem(500, "Internal error", "An unexpected error occurred", "INTERNAL_ERROR",
                   request.state.request_id)


@app.get("/api/v1/health/live")
def health_live():
    return {"status": "ok"}


@app.get("/api/v1/health/ready")
def health_ready():
    return {"status": "ready", "version": __version__}


@app.post("/api/v1/models/validate")
def validate_model(request: ModelRequest):
    model = request.model.to_domain()
    return {"structurally_valid": True,
            "feasibility_checked": False,
            "variable_count": len(model.variables),
            "constraint_count": len(model.constraints)}


@app.post("/api/v1/solves")
def solve_model(request: SolveRequest):
    model = request.model.to_domain()
    result = solve_simplex(model, **request.options.model_dump())
    return result.to_dict()


@app.post("/api/v1/solves/integer")
def solve_integer(request: IntegerRequest):
    model = request.model.to_domain()
    result = solve_branch_bound(model, **request.options.model_dump())
    return result.to_dict()


@app.post("/api/v1/solves/dual")
def solve_dual_problem(request: SolveRequest):
    model = request.model.to_domain()
    return solve_dual(model, **request.options.model_dump()).to_dict()


@app.post("/api/v1/solves/alternatives")
def analyze_alternative_optima(request: AnalysisRequest):
    model = request.model.to_domain()
    return analyze_optima(model, **request.options.model_dump()).to_dict()


@app.post("/api/v1/geometry")
def calculate_geometry(request: GeometryRequest):
    model = request.model.to_domain()
    return build_geometry(model, **request.options.model_dump()).to_dict()


@app.post("/api/v1/models/standard-form")
def standard_form(request: ModelRequest):
    return describe_standard_form(request.model.to_domain())



@app.post("/api/v1/reports/pdf")
def generate_pdf_report(request: ReportRequest):
    model = request.model.to_domain()
    report = collect_report(model, request.options)
    document = build_report_pdf(report)
    return Response(
        content=document,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="pivonauta-relatorio.pdf"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
