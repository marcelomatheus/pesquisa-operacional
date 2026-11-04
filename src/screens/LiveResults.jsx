import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, BarChart3, CheckCircle2,
  ChevronLeft, ChevronRight, Download, FileChartColumn, GitBranch,
  Pause, Play, RotateCcw, Sigma, Table2, Target,
} from 'lucide-react';
import { displayNumber, SOLVE_STATUSES } from '../services/solverApi';
import { TableauViewer } from '../components/TableauViewer';
import { BranchTree } from '../components/BranchTree';

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

export function LiveSimplex({ result, setSelectedEntity }) {
  return <div className="page result-page simplex-page">
    <PageHeading title="Simplex tabular" label="Prova algébrica · Python puro"
      description="Cada tableau, custo reduzido, teste da razão e operação de linha foi calculado pelo backend." />
    {!result ? <NeedSolve /> : <TableauViewer result={result} source="primal" onInspect={setSelectedEntity} />}
  </div>;
}

export function LiveInteger({ model, result, task, onStart, setSelectedEntity }) {
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
        {tab === 'tree' ? <BranchTree model={model} data={data} onInspect={setSelectedEntity} /> : <section className="panel" style={{ padding: 24 }}>
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

export { ReportBuilder as LiveReport } from './ReportBuilder';
