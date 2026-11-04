import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Table2 } from 'lucide-react';
import { displayNumber, SOLVE_STATUSES } from '../services/solverApi';

const phaseTitle = {
  phase_1: 'Fase I · viabilidade',
  phase_1_cleanup: 'Remoção das artificiais',
  phase_2: 'Fase II · otimização',
};

const eventTitle = {
  pivot: 'Decisão de pivoteamento',
  optimal: 'Condição de otimalidade',
  unbounded: 'Direção ilimitada',
  iteration_limit: 'Limite de iterações',
  time_limit: 'Limite de tempo',
  remove_redundant_row: 'Equação redundante removida',
};

function Operation({ value, index }) {
  const target = value.target_row === 0 ? 'Z' : `R${value.target_row}`;
  const source = value.source_row === 0 ? 'Z' : `R${value.source_row}`;
  const expression = value.kind === 'scale'
    ? `${target} ← ${target} ÷ (${displayNumber(value.pivot_value, 6)})`
    : `${target} ← ${target} + (${displayNumber(value.factor, 6)}) · ${source}`;
  return <li className="pr5-row-operation"><strong>{index + 1}. {expression}</strong>
    <small>Antes: [{value.before?.map(v => displayNumber(v, 4)).join('; ')}]</small>
    <small>Depois: [{value.after?.map(v => displayNumber(v, 4)).join('; ')}]</small>
  </li>;
}

export function TableauViewer({ result, source = 'primal', onInspect, compact = false }) {
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const iterations = result?.iterations || [];
  const selected = Math.min(step, Math.max(0, iterations.length - 1));
  const current = iterations[selected];
  useEffect(() => { setStep(0); setPlaying(false); }, [result]);
  useEffect(() => {
    if (source !== 'primal') return;
    const requested = params.get('step');
    if (requested !== null && /^\d+$/.test(requested) && Number(requested) < iterations.length) {
      setStep(Number(requested));
      setPlaying(false);
    }
  }, [params, iterations.length, source]);
  useEffect(() => {
    if (!playing || iterations.length < 2) return undefined;
    const timer = window.setInterval(() => setStep(index => {
      if (index >= iterations.length - 1) { setPlaying(false); return index; }
      return index + 1;
    }), 1400);
    return () => window.clearInterval(timer);
  }, [playing, iterations.length]);
  const jump = next => { setStep(Math.max(0, Math.min(next, iterations.length - 1))); setPlaying(false); };
  const inspect = (row = null, column = null) => {
    if (onInspect && current) onInspect({ type: 'tableau', source, index: selected, row, column, snapshot: current });
  };
  if (!result) return <section className="panel" style={{ padding: 24 }}>Execute o modelo para visualizar o histórico tabular.</section>;
  if (!current) return <section className="panel" style={{ padding: 24 }}>{result.message || 'Nenhum tableau registrado.'}</section>;
  return <div className={`pr5-tableau-viewer ${compact ? 'is-compact' : ''}`}>
    <section className="simplex-controls panel">
      <div className="playback">
        <button className="icon-button" aria-label="Tableau anterior" onClick={() => jump(selected - 1)} disabled={selected === 0}><ChevronLeft size={19} /></button>
        <button className="play-button" aria-label={playing ? 'Pausar' : 'Reproduzir'} onClick={() => { if (selected === iterations.length - 1) setStep(0); setPlaying(v => !v); }} disabled={iterations.length < 2}>
          {playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button className="icon-button" aria-label="Próximo tableau" onClick={() => jump(selected + 1)} disabled={selected >= iterations.length - 1}><ChevronRight size={19} /></button>
      </div>
      <div className="iteration-track pr5-tableau-track">
        {iterations.map((item, index) => <button key={`${item.phase}-${item.iteration}-${index}`} className={index === selected ? 'is-active' : ''}
          onClick={() => jump(index)}><i>{index + 1}</i><span>{phaseTitle[item.phase] || item.phase} · {item.iteration}</span></button>)}
      </div>
      <div className="iteration-counter"><small>ETAPA</small><strong>{selected + 1}/{iterations.length}</strong></div>
    </section>
    <section className="simplex-layout pr5-tableau-layout">
      <article className="panel tableau-card">
        <div className="panel__header"><div><span className="panel-kicker">{phaseTitle[current.phase] || current.phase}</span>
          <h2>{eventTitle[current.event] || current.event}</h2></div><button className="button button--secondary" onClick={() => { jump(0); inspect(); }}><RotateCcw size={15} />Reiniciar</button></div>
        <div className="tableau-scroll"><table className="tableau">
          <thead><tr><th>Base</th>{current.columns.map((col, index) => <th key={`${col}-${index}`} className={current.pivot?.column === index ? 'is-pivot-column' : ''}>{col}</th>)}</tr></thead>
          <tbody>{current.matrix.map((row, rowIndex) => <tr key={`${selected}-${rowIndex}`} className={current.pivot?.row === rowIndex ? 'is-pivot-row' : ''}>
            <th scope="row">{rowIndex === 0 ? 'Z' : current.basis[rowIndex - 1]}</th>
            {row.map((cell, colIndex) => <td key={colIndex} className={current.pivot?.row === rowIndex && current.pivot?.column === colIndex ? 'is-pivot' : ''}>
              <button className="pr5-cell-button" onClick={() => inspect(rowIndex, colIndex)} aria-label={`Inspecionar linha ${rowIndex}, coluna ${current.columns[colIndex]}, valor ${cell}`}>{displayNumber(cell, 6)}</button>
            </td>)}
          </tr>)}</tbody>
        </table></div>
        <div className="tableau-note"><Activity size={17} /><p>{current.event === 'pivot'
          ? `Entra ${current.pivot.entering}; sai ${current.pivot.leaving}. O elemento de pivô é ${displayNumber(current.pivot.value, 6)}. Clique em uma célula para inspecioná-la.`
          : current.event === 'optimal' ? 'Nenhum custo reduzido elegível melhora o objetivo nesta fase.' : eventTitle[current.event] || current.event}</p></div>
        <div className="pr5-tableau-proof">
          <h3>Transformações elementares</h3>
          {current.row_operations?.length
            ? <ol>{current.row_operations.map((operation, index) => <Operation key={index} value={operation} index={index} />)}</ol>
            : <p>Esta etapa não realiza operações de Gauss-Jordan.</p>}
          {current.event === 'pivot' && <p>A normalização divide a linha pivô pelo elemento escolhido; a eliminação zera a coluna pivô nas outras linhas.</p>}
        </div>
      </article>
      <aside className="simplex-side">
        <article className="panel pivot-card"><span className="panel-kicker">TESTE DA RAZÃO</span>
          {current.pivot?.ratio_test?.length ? <div className="pr5-ratio-list">{current.pivot.ratio_test.map((ratio, index) => <div key={index} className={ratio.row === current.pivot.row ? 'is-selected' : ''}><span>Linha {ratio.row}</span><strong>{displayNumber(ratio.value, 6)}</strong></div>)}</div> : <p>Nenhum teste da razão nesta etapa.</p>}
          {current.pivot && <p><strong>Entra:</strong> {current.pivot.entering}<br/><strong>Sai:</strong> {current.pivot.leaving}<br/><strong>Razão mínima:</strong> {displayNumber(current.pivot.min_ratio)}</p>}
        </article>
        <article className="panel mini-proof"><span className="panel-kicker">CUSTOS REDUZIDOS</span>
          {current.reduced_costs?.length ? <div className="pr5-reduced-costs">{current.reduced_costs.map((value, index) => <div key={index}><span>{value.column}</span><strong>{displayNumber(value.value, 6)}</strong></div>)}</div> : <p>Todos os custos reduzidos não básicos estão indisponíveis ou não há colunas livres.</p>}
          <small>Valores calculados a partir da linha objetivo do tableau.</small>
        </article>
        <article className="panel mini-proof"><span className="panel-kicker">CERTIFICAÇÃO</span><h3>{SOLVE_STATUSES[result.status] || result.status}</h3><p>{result.message}</p><small>{result.pivot_count} pivoteamentos</small></article>
      </aside>
    </section>
  </div>;
}
