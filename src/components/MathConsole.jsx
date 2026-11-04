import { useMemo, useState } from 'react';
import { ChevronDown, Download, Search, TerminalSquare, X } from 'lucide-react';
import { eventsToText, filterConsoleEvents } from '../services/solverEvents';

const categories = [
  { value: 'all', label: 'Todos os módulos' },
  { value: 'simplex', label: 'Simplex' },
  { value: 'branch_bound', label: 'Branch and Bound' },
  { value: 'system', label: 'Sistema' },
];

const levels = [
  { value: 'all', label: 'Todos os níveis' },
  { value: 'info', label: 'Informação' },
  { value: 'success', label: 'Concluído' },
  { value: 'warning', label: 'Aviso' },
  { value: 'error', label: 'Erro' },
];

export function MathConsole({ events, open, onToggle, onNavigate }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('all');
  const [runId, setRunId] = useState('all');
  const [selected, setSelected] = useState(null);
  const runs = useMemo(() => Array.from(new Map(events.filter(e => e.runId)
    .map(e => [e.runId, e.modelName || e.runId])).entries()), [events]);
  const visible = useMemo(() => filterConsoleEvents(events, {
    query, category, level, currentRun: runId,
  }), [events, query, category, level, runId]);
  const selectedEvent = visible.find(e => e.id === selected) || null;
  const exportLog = () => {
    const blob = new Blob([eventsToText(visible)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pivonauta-console.txt';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={`math-console ${open ? 'is-open' : ''}`} aria-label="Console matemático">
    <button className="console-handle" onClick={onToggle} aria-expanded={open}>
      <span><TerminalSquare size={15} />Console <i>{events.length}</i></span>
      <span className="console-handle__status"><b />{open ? `${visible.length} eventos exibidos` : 'Histórico matemático'} <ChevronDown className={open ? '' : 'is-rotated'} size={15} /></span>
    </button>
    {open && <div className="pr5-console-body">
      <div className="pr5-console-toolbar">
        <label className="pr5-console-search"><Search size={15} /><input aria-label="Pesquisar eventos" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar operação, pivô ou mensagem" /></label>
        <label><span>Módulo</span><select aria-label="Filtrar módulo" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label><span>Nível</span><select aria-label="Filtrar nível" value={level} onChange={event => setLevel(event.target.value)}>{levels.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label><span>Execução</span><select aria-label="Filtrar execução" value={runId} onChange={event => setRunId(event.target.value)}><option value="all">Todas</option>{runs.map(([id, label]) => <option value={id} key={id}>{label} · {id.slice(-6)}</option>)}</select></label>
        <button className="icon-button" type="button" title="Exportar eventos filtrados" aria-label="Exportar eventos" disabled={!visible.length} onClick={exportLog}><Download size={17} /></button>
      </div>
      <div className="pr5-console-grid">
        <div className="pr5-console-list" role="log" aria-label="Eventos registrados">
          {visible.length === 0 && <div className="pr5-console-empty">Nenhum evento corresponde aos filtros. Execute um modelo para registrar passos matemáticos.</div>}
          {visible.map(event => <button type="button" key={event.id} className={`pr5-console-entry pr5-console-entry--${event.level} ${selected === event.id ? 'is-selected' : ''}`}
            onClick={() => { setSelected(event.id); if (event.route) onNavigate(event); }}>
            <time>{event.time}</time><span className="pr5-console-level">{event.level}</span><span className="pr5-console-title">{event.text}</span>
            {event.route && <span className="pr5-console-open">Inspecionar</span>}
          </button>)}
        </div>
        <aside className="pr5-console-details">
          {selectedEvent ? <>
            <div className="pr5-console-detail-head"><strong>Detalhe do evento</strong><button className="icon-button" title="Fechar detalhes" onClick={() => setSelected(null)}><X size={15} /></button></div>
            <h4>{selectedEvent.text}</h4><p>{selectedEvent.details || 'Sem detalhes adicionais.'}</p>
            <dl><dt>Origem</dt><dd>{selectedEvent.category}</dd><dt>Data</dt><dd>{selectedEvent.recordedAt}</dd>
              {selectedEvent.phase && <><dt>Fase</dt><dd>{selectedEvent.phase}</dd></>}
              {Number.isInteger(selectedEvent.step) && <><dt>Tableau</dt><dd>{selectedEvent.step + 1}</dd></>}
            </dl>
          </> : <><strong>Inspeção dos eventos</strong><p>Selecione uma linha para ver os detalhes. Eventos do Simplex levam ao tableau correspondente e eventos de ramificação levam à análise inteira.</p><small>Registros gerados a partir das respostas reais do backend; não são transmitidos em streaming.</small></>}
        </aside>
      </div>
    </div>}
  </section>;
}
