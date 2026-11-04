import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, RotateCcw, Table2 } from 'lucide-react';
import { displayNumber, solveModel, SOLVE_STATUSES } from '../services/solverApi';
import { branchNodeLabels, buildNodeRelaxation, describeBranchNode, layoutBranchTree } from '../services/branchTree';
import { TableauViewer } from './TableauViewer';

export function BranchTree({ model, data, onInspect }) {
  const nodes = data?.nodes || [];
  const [step, setStep] = useState(nodes.length);
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState(nodes[0]?.id || null);
  const [relaxation, setRelaxation] = useState({ state: 'idle', id: null, data: null });
  useEffect(() => {
    setStep(nodes.length);
    setActiveId(nodes[0]?.id || null);
    setRelaxation({ state: 'idle', id: null, data: null });
  }, [data]);
  const visible = nodes.slice(0, step);
  const graph = useMemo(() => layoutBranchTree(visible), [data, step]);
  const selected = visible.find(node => node.id === activeId) || visible[0] || null;
  const details = selected ? describeBranchNode(selected) : null;
  const choose = id => {
    setActiveId(id);
    setRelaxation({ state: 'idle', id: null, data: null });
    if (onInspect) onInspect({ type: 'branch_node', id });
  };
  const calculateNode = async () => {
    if (!selected) return;
    const id = selected.id;
    setRelaxation({ state: 'loading', id, data: null });
    try {
      const formulation = buildNodeRelaxation(model, nodes, id);
      const result = await solveModel(formulation);
      setRelaxation(current => current.id === id ? { state: 'success', id, data: result } : current);
    } catch (error) {
      setRelaxation(current => current.id === id ?
        { state: 'error', id, error: error.message || 'Falha ao resolver nó.' } : current);
    }
  };
  if (!nodes.length) return <section className="panel" style={{ padding: 22 }}>Nenhum nó foi registrado nesta execução.</section>;
  return <div className="pr6-tree-layout">
    <section className="panel pr6-tree-canvas">
      <div className="pr6-tree-toolbar">
        <div><small>ÁRVORE DE BUSCA CALCULADA</small><h2>{visible.length} de {nodes.length} nós</h2></div>
        <div className="pr6-tree-actions">
          <button className="icon-button" aria-label="Retornar ao primeiro nó" onClick={() => setStep(1)}><RotateCcw size={16} /></button>
          <button className="icon-button" aria-label="Etapa anterior" disabled={step <= 1}
            onClick={() => setStep(n => Math.max(1, n - 1))}><ChevronLeft size={17} /></button>
          <button className="icon-button" aria-label="Próxima etapa" disabled={step >= nodes.length}
            onClick={() => setStep(n => Math.min(nodes.length, n + 1))}><ChevronRight size={17} /></button>
          <button className="icon-button" aria-label="Diminuir zoom" disabled={zoom <= 0.5}
            onClick={() => setZoom(v => Math.max(0.5, Math.round((v - 0.15) * 100) / 100))}><Minus size={16} /></button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button className="icon-button" aria-label="Aumentar zoom" disabled={zoom >= 1.5}
            onClick={() => setZoom(v => Math.min(1.5, Math.round((v + 0.15) * 100) / 100))}><Plus size={16} /></button>
          <button className="icon-button" aria-label="Mostrar árvore inteira"
            onClick={() => { setStep(nodes.length); setZoom(1); }}><Maximize2 size={16} /></button>
        </div>
      </div>
      <label className="pr6-tree-progress">Progresso da exploração
        <input type="range" min="1" max={Math.max(1, nodes.length)} value={Math.max(1, step)}
          onChange={event => setStep(Number(event.target.value))} />
      </label>
      <div className="pr6-tree-scroll" role="region" aria-label="Árvore visual de Branch and Bound" tabIndex={0}>
        <div style={{ width: graph.width * zoom, height: graph.height * zoom, position: 'relative' }}>
          <div style={{ width: graph.width, height: graph.height, position: 'absolute',
            left: 0, top: 0, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <svg width={graph.width} height={graph.height} aria-hidden="true" className="pr6-tree-edges">
              {graph.edges.map(edge => <path key={edge.id}
                d={`M ${edge.from.x} ${edge.from.y + 25} V ${(edge.from.y + edge.to.y) / 2} H ${edge.to.x} V ${edge.to.y - 27}`}
                stroke="#64748b" strokeOpacity={0.75} strokeWidth={1.7} fill="none" />)}
            </svg>
            {graph.positioned.map(node => <button key={node.id} type="button"
              className={`pr6-tree-node pr6-tree-node--${node.status} ${selected?.id === node.id ? 'is-selected' : ''}`}
              style={{ left: node.x - 76, top: node.y - 27 }}
              aria-pressed={selected?.id === node.id}
              onClick={() => choose(node.id)}>
              <span>{node.id}</span>
              <strong>{displayNumber(node.relaxation_objective)}</strong>
              <small>{branchNodeLabels[node.status] || node.status}</small>
            </button>)}
          </div>
        </div>
      </div>
      <div className="pr6-tree-legend">
        <span><i className="pr6-key pr6-key--integer" /> Inteiro</span>
        <span><i className="pr6-key pr6-key--branched" /> Ramificado</span>
        <span><i className="pr6-key pr6-key--pruned_bound" /> Poda</span>
        <span><i className="pr6-key pr6-key--infeasible" /> Inviável</span>
      </div>
    </section>
    <aside className="panel pr6-tree-details">
      <span className="panel-kicker">INSPEÇÃO DO NÓ</span>
      {selected && <><h2>Nó {selected.id}</h2>
        <p>{details.branch}</p>
        <dl>
          <dt>Classificação</dt><dd>{details.label}</dd>
          <dt>Status da relaxação</dt><dd>{SOLVE_STATUSES[details.relaxationStatus] || details.relaxationStatus}</dd>
          <dt>Valor da relaxação</dt><dd>{displayNumber(details.objective)}</dd>
          <dt>Profundidade</dt><dd>{selected.depth}</dd>
          <dt>Pivôs</dt><dd>{selected.pivot_count}</dd>
        </dl>
        {details.values && <div className="pr6-tree-values">
          <small>Solução da relaxação</small>
          {Object.entries(details.values).map(([name, value]) => <div key={name}><code>{name}</code><strong>{displayNumber(value)}</strong></div>)}
        </div>}
        <button className="button button--primary" disabled={relaxation.state === 'loading'}
          onClick={calculateNode}><Table2 size={16} />{relaxation.state === 'loading' ? 'Calculando…' : 'Inspecionar tableaux do nó'}</button>
        {relaxation.state === 'error' && <p role="alert" className="pr6-tree-error">{relaxation.error}</p>}
        <p className="pr6-tree-hint">Os tableaux são recalculados pelo Simplex com as restrições do caminho até este nó.</p>
      </>}
    </aside>
    {relaxation.state === 'success' && relaxation.id === selected?.id &&
      <div className="pr6-tree-tableau">
        <h2>Relaxação do nó {selected.id}</h2>
        <TableauViewer result={relaxation.data} source="branch" onInspect={onInspect} />
      </div>}
  </div>;
}
