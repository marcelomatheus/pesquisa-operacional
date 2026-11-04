import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, BarChart3, CheckCircle2,
  ChevronLeft, ChevronRight, Download, FileChartColumn, GitBranch,
  Pause, Play, RotateCcw, Sigma, Table2, Target,
} from 'lucide-react';
import { displayNumber, SOLVE_STATUSES } from '../services/solverApi';

function PageHeading({ title, label, description, action }) {
  const navigate = useNavigate();
  return <header className="result-header">
    <div className="result-header__title">
      <button className="icon-button" onClick={() => navigate('/workspace')}><ArrowLeft size={18} /></button>
      <div><div className="eyebrow">{label}</div><h1>{title}</h1><p>{description}</p></div>
    </div>
    {action && <div className="result-header__actions">{action}</div>}
  </header>;
}

function Note({ title, description, action }) {
  return <section className="panel" style={{ padding: 28 }}>
    <h2>{title}</h2><p>{description}</p>{action}
  </section>;
}

function NeedSolve() {
  const navigate = useNavigate();
  return <Note title="Nenhuma execução atual" description="Revise o modelo e execute o Simplex para obter resultados reais. Os dados ilustrativos do protótipo não são utilizados." action={
    <button className="button button--primary" onClick={() => navigate('/review')}>Revisar e resolver <ArrowRight size={16} /></button>
  } />;
}

function Vector({ values }) {
  if (!values) return <span>—</span>;
  return <span>({Object.entries(values).map(([name, value]) => `${name} = ${displayNumber(value)}`).join('; ')})</span>;
}

export function LiveSummary({ model, result, integerTask }) {
  const navigate = useNavigate();
  return <div className="page result-page">
    <PageHeading title="Resultado da otimização" label="Cálculo real · Python puro" description="Resultados derivados do motor Simplex e da formulação ativa." action={
      <button className="button button--secondary" onClick={() => navigate('/review')}>Nova execução</button>
    } />
    {!result ? <NeedSolve /> : <>
      <section className="solution-banner">
        <div className="solution-banner__mark"><Target size={28} /></div>
        <div><small>STATUS DO SIMPLEX</small><h2>{SOLVE_STATUSES[result.status] || result.status}</h2>
          {result.status === 'optimal' ? <><p>Valor objetivo: Z = {displayNumber(result.objective_value)}</p><p><Vector values={result.variables} /></p></> : <p>{result.message}</p>}
        </div>
        <div className="solution-banner__status"><span>{result.status === 'optimal' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{result.status === 'optimal' ? 'Ótimo contínuo' : 'Não certificado'}</span></div>
      </section>
      <section className="metric-grid metric-grid--result">
        <article className="panel" style={{ padding: 20 }}><small>ITERAÇÕES</small><h2>{result.iterations?.length ?? 0} tableaux</h2><p>{result.pivot_count} pivoteamentos</p></article>
        <article className="panel" style={{ padding: 20 }}><small>RESULTADO INTEIRO</small><h2>{integerTask?.state === 'success' ? (SOLVE_STATUSES[integerTask.data.status] || integerTask.data.status) : 'Não calculado'}</h2><p>{integerTask?.state === 'success' && integerTask.data.objective_value !== null ? `Z = ${displayNumber(integerTask.data.objective_value)}` : 'Disponível na análise inteira'}</p></article>
        <article className="panel" style={{ padding: 20 }}><small>FORMULAÇÃO</small><h2>{model.sense === 'min' ? 'Minimização' : 'Maximização'}</h2><p>{model.objective.length} variáveis · {model.constraints.length} restrições</p></article>
      </section>
      <section className="analysis-launchpad">
        <button onClick={() => navigate('/results/simplex')}><span className="launchpad-icon tone-violet"><Table2 size={23} /></span><div><small>PROVA ALGÉBRICA</small><strong>Simplex passo a passo</strong><p>Consulte a base, os tableaux e os pivôs realmente calculados.</p></div><ArrowRight size={18} /></button>
        <button onClick={() => navigate('/results/integer')}><span className="launchpad-icon tone-success"><GitBranch size={23} /></span><div><small>DECISÃO DISCRETA</small><strong>Branch and Bound</strong><p>Execute a busca inteira e inspecione seus nós.</p></div><ArrowRight size={18} /></button>
        <button onClick={() => navigate('/results/report')}><span className="launchpad-icon tone-cyan"><FileChartColumn size={23} /></span><div><small>EXPORTAÇÃO</small><strong>Relatório textual</strong><p>Exporte os cálculos efetivamente disponíveis.</p></div><ArrowRight size={18} /></button>
      </section>
    </>}
  </div>;
}

function phaseLabel(phase) {
  return { phase_1: 'Fase I · Viabilidade', phase_1_cleanup: 'Remoção de artificiais', phase_2: 'Fase II · Otimização' }[phase] || phase;
}

function eventLabel(event) {
  return { pivot: 'Pivoteamento', optimal: 'Critério de otimalidade', unbounded: 'Problema ilimitado', time_limit: 'Tempo limite', iteration_limit: 'Limite de iterações', remove_redundant_row: 'Restrição redundante removida' }[event] || event;
}

export function LiveSimplex({ result }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const iterations = result?.iterations || [];
  useEffect(() => { setStep(0); setPlaying(false); }, [result]);
  useEffect(() => {
    if (!playing || iterations.length < 2) return undefined;
    const timer = setInterval(() => setStep(current => {
      if (current >= iterations.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 1400);
    return () => clearInterval(timer);
  }, [playing, iterations.length]);
  const current = iterations[Math.min(step, iterations.length - 1)];
  const pivot = current?.pivot;
  const jump = n => setStep(Math.max(0, Math.min(n, iterations.length - 1)));
  return <div className="page result-page simplex-page">
    <PageHeading title="Simplex tabular" label="Histórico auditável" description="Tableaux produzidos pelo nosso algoritmo Python de duas fases." action={
      <button className="button button--secondary" onClick={() => { setStep(0); setPlaying(false); }}><RotateCcw size={16} />Reiniciar</button>
    } />
    {!result ? <NeedSolve /> : !current ? <Note title="Sem tableaux" description={result.message} /> : <>
      <section className="simplex-controls panel">
        <div className="playback">
          <button className="icon-button" disabled={step === 0} onClick={() => jump(step - 1)}><ChevronLeft size={19} /></button>
          <button className="play-button" disabled={iterations.length < 2} onClick={() => { if (step >= iterations.length - 1) jump(0); setPlaying(v => !v); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button className="icon-button" disabled={step >= iterations.length - 1} onClick={() => jump(step + 1)}><ChevronRight size={19} /></button>
        </div>
        <div className="iteration-track" style={{ overflowX: 'auto' }}>
          {iterations.map((item, index) => <button key={index} className={index === step ? 'is-active' : ''} onClick={() => { setPlaying(false); jump(index); }}><i>{index + 1}</i><span>{phaseLabel(item.phase)} #{item.iteration}</span></button>)}
        </div>
        <div className="iteration-counter"><small>ETAPA</small><strong>{step + 1}/{iterations.length}</strong></div>
      </section>
      <section className="simplex-layout">
        <article className="panel tableau-card">
          <div className="panel__header"><div><span className="panel-kicker">{phaseLabel(current.phase)}</span><h2>{eventLabel(current.event)}</h2></div><span className="status-pill tone-violet">Tableau {step + 1}</span></div>
          <div className="tableau-scroll">
            <table className="tableau"><thead><tr><th>Base</th>{current.columns.map((col, colIndex) => <th key={colIndex} className={pivot?.column === colIndex ? 'is-pivot-column' : ''}>{col}</th>)}</tr></thead>
              <tbody>{current.matrix.map((row, rowIndex) => <tr key={rowIndex} className={pivot?.row === rowIndex ? 'is-pivot-row' : ''}><td>{rowIndex === 0 ? 'Z' : current.basis[rowIndex - 1]}</td>{row.map((value, colIndex) => <td key={colIndex} className={pivot?.row === rowIndex && pivot.column === colIndex ? 'is-pivot' : ''}>{displayNumber(value, 5)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="tableau-note"><Activity size={17} /><p>{pivot?.entering ? `Entra ${pivot.entering}; sai ${pivot.leaving || '—'}; pivô = ${displayNumber(pivot.value)}.` : eventLabel(current.event)}. Matriz obtida da execução real.</p></div>
        </article>
        <aside className="simplex-side">
          <article className="panel pivot-card"><span className="panel-kicker">DECISÃO DE PIVÔ</span><div className="pivot-flow"><div><small>ENTRA</small><strong>{pivot?.entering || '—'}</strong></div><div><small>SAI</small><strong>{pivot?.leaving || '—'}</strong></div></div>
            {pivot?.ratio_test?.length ? <p>Razões: {pivot.ratio_test.map(r => `L${r.row}: ${displayNumber(r.value)}`).join(' · ')}</p> : <p>Sem troca de base nesta etapa.</p>}
          </article>
          <article className="panel mini-proof"><span className="panel-kicker">RESULTADO</span><h3>{SOLVE_STATUSES[result.status] || result.status}</h3><p>{result.message}</p><small>{result.pivot_count} operações de pivoteamento</small></article>
        </aside>
      </section>
    </>}
  </div>;
}

export function LiveInteger({ result, task, onStart }) {
  const [tab, setTab] = useState('tree');
  useEffect(() => {
    if (result?.status === 'optimal' && !task && onStart) onStart();
  }, [result, task, onStart]);
  const data = task?.data;
  return <div className="page result-page integer-page">
    <PageHeading title="Programação inteira" label="Branch and Bound próprio" description="Cada nó é resolvido por uma relaxação linear usando o Simplex tabular implementado em Python." action={
      <button className="button button--secondary" disabled={task?.state === 'loading' || !result || result.status !== 'optimal'} onClick={onStart}>Reexecutar busca</button>
    } />
    {!result ? <NeedSolve /> : result.status !== 'optimal' ? <Note title="Relaxação não ótima" description="A busca inteira só é iniciada após uma resolução contínua ótima." /> :
      task?.state === 'loading' ? <Note title="Explorando os nós…" description="O servidor está calculando as relaxações lineares e as ramificações." /> :
      task?.state === 'error' ? <Note title="Falha na busca inteira" description={task.error} action={<button className="button button--primary" onClick={onStart}>Tentar novamente</button>} /> :
      !data ? <Note title="Busca ainda não executada" description="Execute o Branch and Bound para inspecionar os resultados." action={<button className="button button--primary" onClick={onStart}>Resolver inteiro</button>} /> :
      <>
        <section className="metric-grid metric-grid--result">
          <article className="panel" style={{ padding: 20 }}><small>STATUS</small><h2>{SOLVE_STATUSES[data.status] || data.status}</h2><p>{data.message}</p></article>
          <article className="panel" style={{ padding: 20 }}><small>INCUMBENTE</small><h2>{displayNumber(data.objective_value)}</h2><p><Vector values={data.variables} /></p></article>
          <article className="panel" style={{ padding: 20 }}><small>NÓS EXPLORADOS</small><h2>{data.explored_nodes}</h2><p>{data.status === 'optimal' ? 'Ótimo inteiro certificado' : 'Otimização não certificada'}</p></article>
        </section>
        <div className="method-switch">
          <button className={tab === 'tree' ? 'is-active' : ''} onClick={() => setTab('tree')}>Nós reais da busca</button>
          <button className={tab === 'round' ? 'is-active' : ''} onClick={() => setTab('round')}>Arredondamento verificado</button>
        </div>
        {tab === 'tree' ? <section className="panel" style={{ padding: 24 }}>
          <div className="panel__header"><h2>Árvore de ramificações</h2><span>{data.nodes.length} nós registrados</span></div>
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            {data.nodes.map(node => <div key={node.id} style={{ borderBottom: '1px solid var(--border-color, #8884)', padding: '12px 0', paddingLeft: Math.min(node.depth * 22, 160) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><strong>{node.id} · {node.branch_constraint || 'Relaxação inicial'}</strong><span>{node.status}</span></div>
              <small>Relaxação: {node.relaxation_status} · Z = {displayNumber(node.relaxation_objective)} · {node.pivot_count} pivôs</small>
            </div>)}
          </div>
        </section> : <section className="panel" style={{ padding: 24 }}>
          <div className="panel__header"><h2>Candidatos vizinhos</h2></div>
          <p>Arredondamento não é prova de ótimo inteiro. Cada candidato foi testado contra as restrições.</p>
          <div className="candidate-list">{data.rounding_candidates.map((candidate, index) => <div key={index}>
            <code><Vector values={candidate.values} /></code>
            <span>{candidate.feasible ? 'Viável' : 'Inviável'}</span>
            <strong>{displayNumber(candidate.objective_value)}</strong>
          </div>)}</div>
        </section>}
      </>
    }
  </div>;
}

export function PendingAnalysis({ area }) {
  const navigate = useNavigate();
  const config = {
    graph: ['Região viável', 'Geometria dinâmica', 'O gráfico do protótipo é ilustrativo e não representa a formulação executada. A geração de primitivas geométricas reais será implementada na próxima fase.', BarChart3],
    dual: ['Modelo dual', 'Dualidade', 'A construção e resolução tabular do problema dual ainda não está integrada ao motor. Nenhum valor dual demonstrativo será apresentado como resultado.', Sigma],
    analysis: ['Diagnósticos especiais', 'Casos especiais', 'Os diagnósticos de degenerescência e ótimos múltiplos ainda não estão certificados; somente o status retornado pelo Simplex está disponível.', Activity],
  }[area];
  if (!config) return null;
  return <div className="page result-page">
    <PageHeading title={config[0]} label={config[1]} description="Funcionalidade pendente de implementação matemática." />
    <Note title="Análise ainda não disponível" description={config[2]} action={<button className="button button--primary" onClick={() => navigate('/results/simplex')}>Consultar tableaux reais <ArrowRight size={16} /></button>} />
  </div>;
}

export function LiveReport({ model, result, integerTask }) {
  const download = () => {
    const lines = [
      'PIVÔNAUTA — RELATÓRIO DE OTIMIZAÇÃO',
      `Modelo: ${model.name}`,
      `Objetivo: ${model.sense} Z = ${model.objective.join(' ; ')}`,
      ...model.constraints.map((c, i) => `R${i + 1}: [${c.values.join(', ')}] ${c.operator} ${c.rhs}`),
      '',
      `Simplex: ${result.status}`,
      `Valor objetivo: ${result.objective_value ?? 'indisponível'}`,
      `Variáveis: ${JSON.stringify(result.variables)}`,
      `Pivoteamentos: ${result.pivot_count}`,
      ...result.iterations.map((t, i) => [
        '', `Tableau ${i + 1}: ${t.phase} - ${t.event}`,
        `Colunas: ${t.columns.join(', ')}`,
        ...t.matrix.map((row, index) => `${index === 0 ? 'Z' : t.basis[index - 1]}: ${row.join(', ')}`),
      ].join('\n')),
    ];
    if (integerTask?.state === 'success') {
      lines.push('', 'PROGRAMACAO INTEIRA', `Status: ${integerTask.data.status}`,
        `Objetivo: ${integerTask.data.objective_value}`,
        `Variáveis: ${JSON.stringify(integerTask.data.variables)}`,
        `Nós explorados: ${integerTask.data.explored_nodes}`);
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'relatorio-pivonauta.txt'; anchor.click();
    URL.revokeObjectURL(url);
  };
  return <div className="page result-page report-page">
    <PageHeading title="Relatório técnico" label="Exportação dos cálculos reais" description="Relatório textual gerado exclusivamente a partir do motor matemático." action={
      <button className="button button--primary" disabled={!result} onClick={download}><Download size={17} />Exportar TXT</button>
    } />
    {!result ? <NeedSolve /> : <section className="panel" style={{ padding: 24 }}>
      <h2>{model.name}</h2><p>Simplex: {SOLVE_STATUSES[result.status] || result.status}</p>
      <p>Objetivo: {displayNumber(result.objective_value)}</p>
      <p><Vector values={result.variables} /></p>
      <p>{result.iterations.length} tableaux registrados; {result.pivot_count} pivoteamentos.</p>
      <p>Exportação PDF e visualizações geométricas permanecerão para a próxima fase.</p>
    </section>}
  </div>;
}
