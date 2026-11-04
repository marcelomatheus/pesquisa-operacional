import { useMemo, useState } from 'react';
import { displayNumber } from '../services/solverApi';
import { describeIntegerOverlay, inViewport, projectToSvg, visibleOptimalFace } from '../services/plotGeometry';

const DIMENSIONS = { width: 720, height: 470, padding: 58 };

const colors = {
  constraint: '#22d3ee',
  bound: '#94a3b8',
  region: '#8b5cf6',
  contour: '#fbbf24',
  lattice: '#64748b',
  feasible: '#34d399',
  rejected: '#ef7373',
  continuous: '#c4b5fd',
  integer: '#10b981',
  alternative: '#f59e0b',
};

function PlotPoint({ point, viewport, color, radius, name, onPick, hollow = false }) {
  const position = projectToSvg(point, viewport, DIMENSIONS);
  if (!position || !inViewport(point, viewport)) return null;
  return <g role="button" tabIndex={0} aria-label={name} onClick={onPick}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(); } }}
    style={{ cursor: 'pointer' }}>
    <circle cx={position[0]} cy={position[1]} r={radius + 7} fill="transparent" />
    <circle cx={position[0]} cy={position[1]} r={radius} fill={hollow ? '#101116' : color}
      stroke={color} strokeWidth={hollow ? 2.4 : 1.4} />
  </g>;
}

function OverlayLine({ points, viewport, color, width = 1.5, dash = undefined, opacity = 1 }) {
  if (!Array.isArray(points) || points.length !== 2) return null;
  const [left, right] = points.map(point => projectToSvg(point, viewport, DIMENSIONS));
  if (!left || !right) return null;
  return <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} stroke={color}
    strokeWidth={width} strokeDasharray={dash} opacity={opacity} />;
}

export function OptimizationPlot({ geometry, model, integerTask, alternatives, layers }) {
  const [focus, setFocus] = useState(null);
  const viewport = geometry.viewport;
  const overlay = useMemo(() => describeIntegerOverlay(integerTask, model), [integerTask, model]);
  const face = visibleOptimalFace(geometry, alternatives);
  const x = value => projectToSvg([value, viewport.y_min], viewport, DIMENSIONS)[0];
  const y = value => projectToSvg([viewport.x_min, value], viewport, DIMENSIONS)[1];
  const ticks = Array.from({ length: 6 }, (_, i) => i / 5);
  const polygon = (geometry.polygon || []).map(point => projectToSvg(point, viewport, DIMENSIONS).join(',')).join(' ');
  const lattice = geometry.integer_lattice?.points || [];
  const pick = (name, point, detail) => setFocus({ name, point, detail });
  return <div className="pr6-plot">
    <svg viewBox="0 0 720 470" role="img"
      aria-label="Região viável, curvas de nível, pontos inteiros e solução ótima calculados para o modelo ativo">
      <rect x={DIMENSIONS.padding} y={DIMENSIONS.padding}
        width={DIMENSIONS.width - 2 * DIMENSIONS.padding} height={DIMENSIONS.height - 2 * DIMENSIONS.padding}
        fill="transparent" stroke="currentColor" strokeOpacity={0.2} />
      {ticks.map(t => <g key={t} stroke="currentColor" strokeOpacity={0.1}>
        <line x1={x(viewport.x_min + t * (viewport.x_max - viewport.x_min))}
          x2={x(viewport.x_min + t * (viewport.x_max - viewport.x_min))}
          y1={DIMENSIONS.padding} y2={DIMENSIONS.height - DIMENSIONS.padding} />
        <line x1={DIMENSIONS.padding} x2={DIMENSIONS.width - DIMENSIONS.padding}
          y1={y(viewport.y_min + t * (viewport.y_max - viewport.y_min))}
          y2={y(viewport.y_min + t * (viewport.y_max - viewport.y_min))} />
      </g>)}
      {layers.region && geometry.dimension === 2 && geometry.polygon?.length >= 3 &&
        <polygon points={polygon} fill={colors.region} fillOpacity={0.2} stroke={colors.region} strokeWidth={2.4} />}
      {layers.region && geometry.dimension === 1 && geometry.polygon?.length >= 2 &&
        <polyline points={polygon} fill="none" stroke={colors.region} strokeWidth={4} />}
      {layers.region && geometry.dimension === 0 && geometry.polygon?.[0] &&
        <PlotPoint point={geometry.polygon[0]} viewport={viewport} color={colors.region} radius={5}
          name="Região viável pontual" onPick={() => pick('Região pontual', geometry.polygon[0])} />}
      {layers.levels && (geometry.level_lines || []).map((contour, index) =>
        <g key={index}>
          <OverlayLine points={contour.segment} viewport={viewport} color={colors.contour}
            dash={contour.optimal ? 'none' : '6 7'} width={contour.optimal ? 2.3 : 1.2}
            opacity={contour.optimal ? 0.95 : 0.53} />
          <text x={DIMENSIONS.width - DIMENSIONS.padding - 5} y={DIMENSIONS.padding + 15 + index * 17}
            fontSize={10} textAnchor="end" fill={colors.contour} opacity={0.8}>
            Z = {displayNumber(contour.value)}
          </text>
        </g>)}
      {layers.constraints && geometry.lines.map((line, index) =>
        <OverlayLine key={line.id || index} points={line.segment} viewport={viewport}
          color={line.origin === 'constraint' ? colors.constraint : colors.bound}
          dash={line.operator === 'eq' ? '5 4' : undefined} opacity={0.7} />)}
      {layers.vertices && geometry.vertices.map((point, index) =>
        <PlotPoint key={index} point={point} viewport={viewport} color={colors.constraint} radius={4}
          name={`Vértice ${index + 1}`} onPick={() => pick(`Vértice ${index + 1}`, point)} />)}
      {layers.lattice && lattice.map((point, index) =>
        <PlotPoint key={index} point={point} viewport={viewport} color={colors.lattice} radius={2.5}
          name={`Ponto da malha inteira ${index + 1}`}
          onPick={() => pick('Ponto inteiro viável', point, geometry.integer_lattice?.mode)} />)}
      {layers.alternatives && face && <OverlayLine points={face} viewport={viewport}
        color={colors.alternative} width={6} opacity={0.95} />}
      {layers.candidates && overlay.candidates.map(candidate =>
        <PlotPoint key={candidate.id} point={candidate.point} viewport={viewport}
          color={candidate.feasible ? colors.feasible : colors.rejected}
          hollow={!candidate.feasible} radius={5}
          name={`Arredondamento ${candidate.feasible ? 'viável' : 'inviável'}`}
          onPick={() => pick(candidate.feasible ? 'Candidato viável' : 'Candidato inviável',
            candidate.point, candidate.feasible ? `Z = ${displayNumber(candidate.objective)}` : 'Não satisfaz todas as restrições')} />)}
      {layers.optimum && geometry.optimal_point &&
        <PlotPoint point={geometry.optimal_point} viewport={viewport} color={colors.continuous} radius={8}
          name="Ótimo contínuo" onPick={() => pick('Ótimo contínuo', geometry.optimal_point,
            `Z = ${displayNumber(geometry.optimal_value)}`)} />}
      {layers.integer && overlay.incumbent &&
        <PlotPoint point={overlay.incumbent} viewport={viewport} color={colors.integer} radius={10}
          name={overlay.certified ? 'Ótimo inteiro certificado' : 'Incumbente inteiro não certificado'}
          onPick={() => pick(overlay.certified ? 'Ótimo inteiro certificado' : 'Incumbente não certificado',
            overlay.incumbent, `Z = ${displayNumber(integerTask.data.objective_value)}`)} />}
      {ticks.map(t => <g key={`tick-${t}`} fill="currentColor" opacity={0.7} fontSize={10}>
        <text x={DIMENSIONS.padding + t * (DIMENSIONS.width - 2 * DIMENSIONS.padding)}
          y={DIMENSIONS.height - DIMENSIONS.padding + 20} textAnchor="middle">
          {displayNumber(viewport.x_min + t * (viewport.x_max - viewport.x_min), 2)}
        </text>
        <text x={DIMENSIONS.padding - 10}
          y={DIMENSIONS.height - DIMENSIONS.padding - t * (DIMENSIONS.height - 2 * DIMENSIONS.padding) + 4}
          textAnchor="end">{displayNumber(viewport.y_min + t * (viewport.y_max - viewport.y_min), 2)}</text>
      </g>)}
      <text x={DIMENSIONS.width - DIMENSIONS.padding} y={DIMENSIONS.height - 11} textAnchor="end"
        fill="currentColor" fontSize={13}>{model.variables[0].id}</text>
      <text x={DIMENSIONS.padding - 22} y={DIMENSIONS.padding - 15} fill="currentColor" fontSize={13}>{model.variables[1].id}</text>
    </svg>
    <div className="pr6-plot-caption" role="status">
      {focus ? <><strong>{focus.name}</strong> ({focus.point.map(value => displayNumber(value)).join('; ')})
        {focus.detail && <span>{focus.detail}</span>}</> :
        <span>Selecione um vértice ou um ponto para inspecionar suas coordenadas.</span>}
    </div>
    {geometry.region_type === 'unbounded' &&
      <p className="pr6-plot-warning">A região é ilimitada. A área desenhada corresponde apenas ao recorte da janela.</p>}
    {geometry.integer_lattice?.sampled &&
      <p className="pr6-plot-warning">A malha inteira foi amostrada para preservar o desempenho. Pontos não exibidos podem ser viáveis.</p>}
  </div>;
}
