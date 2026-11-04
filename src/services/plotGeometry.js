export function projectedPoint(values, model) {
  if (!values || model.variables.length !== 2) return null;
  const point = model.variables.map(variable => Number(values[variable.id]));
  return point.every(Number.isFinite) ? point : null;
}

export function describeIntegerOverlay(task, model) {
  if (!task || task.state !== 'success') return { incumbent: null, candidates: [], certified: false, status: null };
  const result = task.data;
  const candidates = (result.rounding_candidates || []).map((candidate, index) => ({
    id: index,
    point: projectedPoint(candidate.values, model),
    feasible: candidate.feasible === true,
    objective: candidate.objective_value,
  })).filter(candidate => candidate.point !== null);
  return {
    incumbent: projectedPoint(result.variables, model),
    candidates,
    certified: result.status === 'optimal',
    status: result.status,
    exploredNodes: result.explored_nodes,
  };
}

export function visibleOptimalFace(geometry, alternatives) {
  if (geometry?.status !== 'feasible' || alternatives?.status !== 'multiple' ||
      alternatives?.certified !== true || !Array.isArray(geometry.optimal_face) ||
      geometry.optimal_face.length !== 2) return null;
  return geometry.optimal_face;
}

export function projectToSvg(point, viewport, dimensions) {
  const { width, height, padding } = dimensions;
  const dx = viewport.x_max - viewport.x_min;
  const dy = viewport.y_max - viewport.y_min;
  if (!point || !Number.isFinite(dx) || !Number.isFinite(dy) || dx <= 0 || dy <= 0) return null;
  return [
    padding + (point[0] - viewport.x_min) / dx * (width - 2 * padding),
    height - padding - (point[1] - viewport.y_min) / dy * (height - 2 * padding),
  ];
}

export function inViewport(point, viewport, tolerance = 1e-8) {
  return point?.length === 2 && point[0] >= viewport.x_min - tolerance &&
    point[0] <= viewport.x_max + tolerance && point[1] >= viewport.y_min - tolerance &&
    point[1] <= viewport.y_max + tolerance;
}
