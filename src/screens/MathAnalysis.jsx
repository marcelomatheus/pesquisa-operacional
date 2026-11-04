import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, BarChart3, Check,
  ChevronLeft, ChevronRight, GitBranch, Sigma, Table2, Target,
} from 'lucide-react';
import {
  analyzeAlternatives, calculateGeometry, displayNumber, modelFingerprint,
  solveDual, SOLVE_STATUSES,
} from '../services/solverApi';
import { TableauViewer } from '../components/TableauViewer';
import { OptimizationPlot } from '../components/OptimizationPlot';

function AnalysisHeader({ title, eyebrow, description, icon: Icon }) {
  const navigate = useNavigate();
  return <header className="result-header">
    <div className="result-header__title">
      <button className="icon-button" onClick={() => navigate('/results/summary')} aria-label="Voltar ao resultado"><ArrowLeft size={18} /></button>
      <div><div className="eyebrow"><Icon size={14} />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    </div>
  </header>;
}

function AsyncState({ state, onRetry }) {
  const navigate = useNavigate();
  if (state.phase === 'success') return null;
  const title = state.phase === 'error' ? 'Não foi possível calcular esta análise' : 'Calculando a análise matemática…';
  return <section className="panel" role={state.phase === 'error' ? 'alert' : 'status'} style={{ padding: 28 }}>
    <h2>{title}</h2>
    <p>{state.phase === 'error' ? state.error : 'Executando o algoritmo próprio no backend Python.'}</p>
    {state.phase === 'error' && <button className="button button--primary" onClick={onRetry}>Tentar novamente</button>}
    <button className="button button--secondary" style={{ marginLeft: 10 }} onClick={() => navigate('/editor')}>Voltar ao editor</button>
  </section>;
}

function useRemoteAnalysis(model, loader, enabled = true) {
  const fingerprint = modelFingerprint(model);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ phase: 'loading', data: null });
  useEffect(() => {
    if (!enabled) { setState({ phase: 'idle', data: null }); return undefined; }
    const controller = new AbortController();
    setState({ phase: 'loading', data: null });
    loader(model, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ phase: 'success', data }); })
      .catch(error => {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setState({ phase: 'error', data: null, error: error.message || 'Falha na API.' });
        }
      });
    return () => controller.abort();
  }, [fingerprint, attempt, loader, enabled]);
  return [state, () => setAttempt(i => i + 1)];
}

function VariableValues({ values }) {
  if (!values) return <span>—</span>;
  return <code>{Object.entries(values).map(([name, value]) => `${name} = ${displayNumber(value)}`).join(' · ')}</code>;
}

function LinearEquation({ coefficients, rhs, operator, variablePrefix = 'y' }) {
  const sign = { le: '≤', ge: '≥', eq: '=' }[operator] || operator;
  const expression = coefficients.map((c, i) => `${displayNumber(c)}${variablePrefix}${i + 1}`).join(' + ');
  return <code>{rhs === 'Z' || rhs === 'W' ? `${rhs} = ${expression}` : `${expression} ${sign} ${displayNumber(rhs)}`}</code>;
}

export function DualAnalysis({ model, setSelectedEntity }) {
  const [state, retry] = useRemoteAnalysis(model, solveDual);
  const data = state.data;
  return <div className="page result-page dual-page">
    <AnalysisHeader title="Modelo dual" eyebrow="Dualidade · cálculo real" icon={Sigma}
      description="Construa o dual e examine os tableaux produzidos pelo Simplex de duas fases." />
    <AsyncState state={state} onRetry={retry} />
    {data && <>
      <section className="duality-banner">
        <span>{data.status === 'optimal' ? <Check size={18} /> : <AlertCircle size={18} />}{data.status === 'optimal' ? 'Dualidade forte verificada' : 'Certificação não concluída'}</span>
        <strong>Z primal = {displayNumber(data.primal_objective)} · Z dual = {displayNumber(data.dual_objective)}</strong>
        <small>{data.status === 'optimal' ? 'Complementaridade verificada' : data.message}</small>
      </section>
      <section className="dual-mirror">
        <article className="panel dual-model dual-model--primal">
          <div className="dual-model__head"><span>PRIMAL</span><strong>{model.sense === 'min' ? 'Minimização' : 'Maximização'}</strong></div>
          <div className="dual-equation"><small>OBJETIVO</small><LinearEquation coefficients={model.objective} rhs="Z" operator="eq" variablePrefix="x" /></div>
          {model.constraints.map((constraint, i) => <div key={constraint.id || i} style={{ padding: '10px 16px' }}><small>R{i + 1} </small><LinearEquation coefficients={constraint.coefficients} operator={{ '≤': 'le', '≥': 'ge', '=': 'eq' }[constraint.operator]} rhs={constraint.rhs} variablePrefix="x" /></div>)}
        </article>
        <div className="duality-axis"><span>DUAL</span><Sigma size={23} /><small>Aᵀ</small></div>
        <article className="panel dual-model dual-model--dual">
          <div className="dual-model__head"><span>DUAL</span><strong>{data.dual_model?.sense === 'min' ? 'Minimização' : 'Maximização'}</strong></div>
          <div className="dual-equation"><small>OBJETIVO (sem constante {displayNumber(data.objective_offset)})</small><LinearEquation coefficients={data.dual_model?.objective || []} rhs="W" operator="eq" /></div>
          {(data.dual_model?.constraints || []).map((c, i) => <div key={c.id || i} style={{ padding: '10px 16px' }}><small>D{i + 1} </small><LinearEquation coefficients={c.coefficients} operator={c.operator} rhs={c.rhs} /></div>)}
          <div style={{ padding: 16 }}><small>LIMITES DAS VARIÁVEIS DUAIS</small><p>{(data.dual_model?.variables || []).map(v => `${v.id}: ${v.lower_bound === 0 ? '≥ 0' : v.upper_bound === 0 ? '≤ 0' : 'livre'}`).join(' · ')}</p></div>
        </article>
      </section>
      <section className="panel" style={{ padding: 20 }}>
        <strong>Resultado do dual</strong><p>{SOLVE_STATUSES[data.dual?.status] || data.dual?.status || 'Não disponível'} · <VariableValues values={data.dual?.variables} /></p>
        {data.objective_offset !== 0 && <p>Constante do deslocamento das variáveis do primal: {displayNumber(data.objective_offset)}</p>}
        <p>{data.message}</p>
      </section>
      <TableauViewer result={data.dual} source="dual" onInspect={setSelectedEntity} compact />
    </>}
  </div>;
}

export function AlternativesAnalysis({ model }) {
  const [state, retry] = useRemoteAnalysis(model, analyzeAlternatives);
  const data = state.data;
  const title = { multiple: 'Múltiplos ótimos comprovados', unique: 'Ótimo único', undetermined: 'Análise inconclusiva', not_certified: 'Certificação indisponível' }[data?.status] || 'Diagnóstico';
  return <div className="page result-page analysis-page">
    <AnalysisHeader title="Ótimos múltiplos" eyebrow="Diagnóstico · prova matemática" icon={Activity}
      description="O algoritmo explora bases ótimas com custo reduzido zero e procura uma solução de decisão realmente diferente." />
    <AsyncState state={state} onRetry={retry} />
    {data && <section className="diagnostic-layout">
      <article className="panel" style={{ padding: 28 }}>
        <div className="panel__header"><div><span className="panel-kicker">CERTIFICADO DE OTIMALIDADE</span><h2>{title}</h2></div><span className={`status-pill ${data.certified ? 'tone-success' : 'tone-violet'}`}>{data.certified ? 'Verificado' : 'Não certificado'}</span></div>
        <p>{data.message}</p>
        <p><strong>Valor ótimo:</strong> {displayNumber(data.objective_value)}</p>
        <p><strong>Base de referência:</strong> <VariableValues values={data.reference} /></p>
        {data.alternative && <p><strong>Outro ponto ótimo:</strong> <VariableValues values={data.alternative} /></p>}
        <p><strong>Bases exploradas:</strong> {data.explored_bases}</p>
        <p><strong>Custos reduzidos nulos na base inicial:</strong> {data.zero_reduced_cost_columns.length ? data.zero_reduced_cost_columns.join(', ') : 'nenhum'}</p>
      </article>
      <article className="panel" style={{ padding: 25 }}>
        <span className="panel-kicker">INTERPRETAÇÃO</span><h2>{data.status === 'multiple' ? 'Dois pontos, mesmo valor objetivo' : 'Critério de prova'}</h2>
        <p>Um custo reduzido nulo isoladamente não prova múltiplos ótimos: uma troca degenerada pode alterar a base sem alterar o vetor de decisões.</p>
        <p>{data.status === 'multiple' ? 'Foram encontrados dois vetores distintos, ambos viáveis e com igual valor da função objetivo.' : data.status === 'unique' ? 'A busca por movimentos que preservem o objetivo não produziu outro vetor ótimo.' : 'Os limites de cálculo ou o estado do Simplex impedem afirmar unicidade ou multiplicidade.'}</p>
        <small>Este diagnóstico considera a relaxação linear contínua, não a contagem de soluções inteiras.</small>
      </article>
    </section>}
  </div>;
}

export function GeometryAnalysis({ model, result, integerTask, onStartInteger }) {
  const [state, retry] = useRemoteAnalysis(model, calculateGeometry, model.variables.length === 2);
  const [alternativesState] = useRemoteAnalysis(model, analyzeAlternatives, model.variables.length === 2);
  const [layers, setLayers] = useState({
    constraints: true, region: true, vertices: true, optimum: true,
    levels: true, lattice: true, alternatives: true, candidates: true, integer: true,
  });
  const toggle = key => setLayers(old => ({ ...old, [key]: !old[key] }));
  const geometry = state.data;
  if (model.variables.length !== 2) return <div className="page result-page graph-page">
    <AnalysisHeader title="Região viável" eyebrow="Geometria 2D" icon={BarChart3}
      description="A representação gráfica é disponível somente para modelos com duas variáveis de decisão." />
    <section className="panel" style={{ padding: 28 }}><h2>Modelo com {model.variables.length} variáveis</h2>
      <p>O Simplex e o Branch and Bound podem resolver este modelo, mas não existe gráfico bidimensional fiel para esta quantidade de variáveis.</p>
      <button className="button button--primary" onClick={() => window.location.hash = '#/editor'}>Editar variáveis</button>
    </section>
  </div>;
  return <div className="page result-page graph-page">
    <AnalysisHeader title="Região viável" eyebrow="Geometria · cálculo real" icon={BarChart3}
      description="Restrições, curvas de nível, pontos inteiros e ótimos obtidos por cálculo matemático real." />
    <AsyncState state={state} onRetry={retry} />
    {geometry && <section className="graph-workbench">
      <article className="panel graph-main" style={{ minHeight: 430, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {geometry.status === 'feasible' ? <OptimizationPlot geometry={geometry} model={model} layers={layers} integerTask={integerTask} alternatives={alternativesState.data} /> : <div style={{ padding: 30 }}><h2>{geometry.status === 'infeasible' ? 'Região vazia' : 'Representação não certificada'}</h2><p>{geometry.message}</p></div>}
      </article>
      <aside className="panel layer-panel">
        <div className="panel__header"><div><span className="panel-kicker">CAMADAS</span><h2>Composição visual</h2></div><Target size={19} /></div>
        {[['constraints', 'Restrições'], ['region', 'Região viável'], ['levels', 'Curvas de nível'], ['vertices', 'Vértices'], ['lattice', 'Pontos inteiros viáveis'], ['optimum', 'Ótimo contínuo'], ['integer', 'Ótimo inteiro / incumbente'], ['candidates', 'Arredondamentos'], ['alternatives', 'Aresta de ótimos múltiplos']].map(([key, title]) => <button key={key} className="layer-row" onClick={() => toggle(key)} aria-pressed={layers[key]}><span className="layer-swatch tone-violet" /><strong>{title}</strong><i className={layers[key] ? 'is-on' : ''}><b /></i></button>)}
        <section className="pr6-geometry-integer">
          <strong>Solução inteira</strong>
          {integerTask?.state === 'success' ? <p>
            {integerTask.data.status === 'optimal' ? 'Ótimo inteiro certificado' : 'Incumbente sem certificado de otimalidade'}
            {' · '}Z = {displayNumber(integerTask.data.objective_value)}
          </p> : integerTask?.state === 'loading' ? <p>Explorando a árvore de busca…</p>
            : integerTask?.state === 'error' ? <p role="alert">{integerTask.error}</p>
            : <p>Calcule o Branch and Bound para mostrar a solução inteira.</p>}
          <button className="button button--secondary" disabled={!result || result.status !== 'optimal' || integerTask?.state === 'loading'} onClick={onStartInteger}>
            {integerTask?.state === 'loading' ? 'Calculando…' : integerTask?.state === 'success' ? 'Reexecutar busca inteira' : 'Calcular solução inteira'}
          </button>
          {(!result || result.status !== 'optimal') && <small>Execute o Simplex no modelo antes de iniciar a busca inteira.</small>}
          {geometry.integer_lattice?.mode === 'forced_all' && <small>A malha representa o cenário hipotético em que ambas as variáveis são inteiras.</small>}
          {geometry.integer_lattice?.mode === 'mixed_or_continuous' && <small>Para modelos mistos, a malha inteira isolada não representa o domínio contínuo.</small>}
          {alternativesState.data?.status === 'multiple' && alternativesState.data.certified === true &&
            <small>Ótimos alternativos certificados. A aresta destacada mostra um segmento da região ótima.</small>}
        </section>
        <div className="coordinate-card">
          <small>ANÁLISE</small>
          <div><span>Tipo</span><strong>{geometry.region_type}</strong></div>
          <div><span>Limitada</span><strong>{geometry.bounded === null ? '—' : geometry.bounded ? 'Sim' : 'Não'}</strong></div>
          <div><span>Dimensão</span><strong>{geometry.dimension ?? '—'}</strong></div>
          <div><span>Vértices</span><strong>{geometry.vertices.length}</strong></div>
        </div>
        {geometry.region_type === 'unbounded' && <p style={{ padding: 16 }}>A região é ilimitada. O preenchimento mostra apenas a interseção com a janela de visualização, e não uma região limitada.</p>}
      </aside>
    </section>}
  </div>;
}
