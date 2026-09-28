import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  FileChartColumn,
  GitBranch,
  Layers3,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Sigma,
  Sparkles,
  Table2,
  Target,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeasibleGraph } from '../components/FeasibleGraph';
import { MetricCard } from '../components/MetricCard';
import { diagnosticCases, simplexIterations } from '../data';

function ResultHeader({ title, eyebrow, description, icon: Icon, actions }) {
  const navigate = useNavigate();
  return (
    <header className="result-header">
      <div className="result-header__title"><button className="icon-button" onClick={() => navigate('/')}><ArrowLeft size={18} /></button><div><div className="eyebrow"><Icon size={14} />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>
      {actions && <div className="result-header__actions">{actions}</div>}
    </header>
  );
}

export function SummaryResult({ model }) {
  const navigate = useNavigate();
  const [shared, setShared] = useState(false);
  const gap = Math.abs((model.integer.z - model.optimum.z) / model.optimum.z * 100).toFixed(2);
  const shareResult = () => {
    setShared(true);
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    window.setTimeout(() => setShared(false), 1800);
  };
  return (
    <div className="page result-page">
      <ResultHeader title="Missão concluída" eyebrow="Solução ótima encontrada" description="A formulação foi resolvida, auditada e preparada para as análises complementares." icon={Sparkles} actions={<><button className="button button--secondary" onClick={shareResult}>{shared ? <Check size={17} /> : <Share2 size={17} />}{shared ? 'Link copiado' : 'Copiar link'}</button><button className="button button--primary" onClick={() => navigate('/results/report')}><FileChartColumn size={17} />Gerar relatório</button></>} />
      <section className="solution-banner">
        <div className="solution-banner__mark"><Target size={28} /></div><div><small>ÓTIMO CONTÍNUO</small><h2>Z* = {model.optimum.z}</h2><p>em x₁ = {model.optimum.x} e x₂ = {model.optimum.y}</p></div><div className="solution-banner__status"><span><CheckCircle2 size={16} />Ótimo global</span><small>Dualidade forte confirmada</small></div>
      </section>
      <section className="metric-grid metric-grid--result">
        <MetricCard icon={Table2} label="Iterações" value="4 tableaus" detail="sem ciclagem" tone="violet" />
        <MetricCard icon={GitBranch} label="Ótimo inteiro" value={`Z = ${model.integer.z}`} detail={`gap ${gap}%`} tone="success" delay={0.05} />
        <MetricCard icon={Activity} label="Status" value="Não degenerado" detail="ótimo único neste caso" tone="cyan" delay={0.1} />
        <MetricCard icon={BarChart3} label="Tempo" value="0,18 s" detail="execução local" tone="amber" delay={0.15} />
      </section>
      <section className="analysis-launchpad">
        <button onClick={() => navigate('/results/simplex')}><span className="launchpad-icon tone-violet"><Table2 size={23} /></span><div><small>PROVA ALGÉBRICA</small><strong>Simplex passo a passo</strong><p>Reproduza cada operação de pivoteamento.</p></div><ArrowUpRight size={18} /></button>
        <button onClick={() => navigate('/results/graph')}><span className="launchpad-icon tone-cyan"><BarChart3 size={23} /></span><div><small>PROVA GEOMÉTRICA</small><strong>Região de viabilidade</strong><p>Veja restrições, níveis e vértice ótimo.</p></div><ArrowUpRight size={18} /></button>
        <button onClick={() => navigate('/results/integer')}><span className="launchpad-icon tone-success"><GitBranch size={23} /></span><div><small>DECISÃO DISCRETA</small><strong>Solução inteira</strong><p>Compare arredondamento e busca exata.</p></div><ArrowUpRight size={18} /></button>
        <button onClick={() => navigate('/results/dual')}><span className="launchpad-icon tone-amber"><Sigma size={23} /></span><div><small>PONTOS EXTRAS</small><strong>Modelo dual</strong><p>Interprete os preços-sombra.</p></div><ArrowUpRight size={18} /></button>
      </section>
      <section className="panel narrative-card"><div><Lightbulb size={22} /></div><p><strong>Leitura gerencial.</strong> No modelo “{model.name}”, a solução contínua utiliza x₁ = {model.optimum.x} e x₂ = {model.optimum.y}. Se as decisões precisarem ser inteiras, a alternativa ({model.integer.x}, {model.integer.y}) altera o objetivo em {gap}%.</p></section>
    </div>
  );
}

export function SimplexResult() {
  const [iteration, setIteration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const data = simplexIterations[iteration];
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setIteration((current) => {
      if (current >= simplexIterations.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 1800);
    return () => window.clearInterval(timer);
  }, [playing]);
  const go = (next) => setIteration(Math.min(Math.max(next, 0), simplexIterations.length - 1));
  return (
    <div className="page result-page simplex-page">
      <ResultHeader title="Simplex tabular" eyebrow="Prova algébrica" description="Cada transformação mantém equivalência e aproxima a base da condição ótima." icon={Table2} actions={<button className="button button--secondary" onClick={() => { setIteration(0); setPlaying(false); }}><RotateCcw size={16} />Reiniciar</button>} />
      <section className="simplex-controls panel">
        <div className="playback"><button className="icon-button" onClick={() => go(iteration - 1)} disabled={iteration === 0}><ChevronLeft size={19} /></button><button className="play-button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" onClick={() => go(iteration + 1)} disabled={iteration === simplexIterations.length - 1}><ChevronRight size={19} /></button></div>
        <div className="iteration-track">{simplexIterations.map((item, index) => <button key={item.id} className={`${index === iteration ? 'is-active' : ''} ${index < iteration ? 'is-done' : ''}`} onClick={() => { setPlaying(false); setIteration(index); }}><i>{index < iteration ? <Check size={12} /> : index + 1}</i><span>{index === 0 ? 'Inicial' : index === simplexIterations.length - 1 ? 'Ótimo' : `Iteração ${index}`}</span></button>)}</div>
        <div className="iteration-counter"><small>ETAPA</small><strong>{iteration + 1}/{simplexIterations.length}</strong></div>
      </section>
      <section className="simplex-layout">
        <article className="panel tableau-card">
          <div className="panel__header"><div><span className="panel-kicker">TABLEAU {String(iteration).padStart(2, '0')}</span><h2>{data.title}</h2></div><span className={`status-pill ${iteration === simplexIterations.length - 1 ? 'tone-success' : 'tone-violet'}`}>{iteration === simplexIterations.length - 1 ? 'Ótimo' : 'Em progresso'}</span></div>
          <div className="tableau-scroll">
            <motion.table className="tableau" key={iteration} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}>
              <thead><tr>{data.columns.map((column, columnIndex) => <th className={data.pivot && columnIndex === data.pivot[1] + 1 ? 'is-pivot-column' : ''} key={column}>{column}</th>)}</tr></thead>
              <tbody>{data.rows.map((row, rowIndex) => <tr className={data.pivot && rowIndex === data.pivot[0] ? 'is-pivot-row' : ''} key={`${iteration}-${rowIndex}`}>{row.map((cell, columnIndex) => <motion.td className={data.pivot && rowIndex === data.pivot[0] && columnIndex === data.pivot[1] + 1 ? 'is-pivot' : ''} key={columnIndex} initial={{ backgroundColor: 'rgba(139,92,246,.22)' }} animate={{ backgroundColor: 'rgba(0,0,0,0)' }} transition={{ delay: columnIndex * 0.035 }}>{cell}</motion.td>)}</tr>)}</tbody>
            </motion.table>
          </div>
          <div className="tableau-note"><Lightbulb size={17} /><p>{data.note}</p></div>
        </article>
        <aside className="simplex-side">
          <article className="panel pivot-card"><span className="panel-kicker">DECISÃO DE PIVÔ</span><div className="pivot-flow"><div><small>ENTRA</small><strong>{data.entering}</strong><ArrowDown size={17} /></div><span className="pivot-flow__center"><Sparkles size={18} /></span><div><small>SAI</small><strong>{data.leaving}</strong><ArrowDown size={17} /></div></div><p>{data.pivot ? 'Menor razão não negativa define a linha pivô.' : 'Nenhum custo reduzido pode melhorar a função objetivo.'}</p></article>
          <article className="panel mini-proof"><span className="panel-kicker">CRITÉRIO</span><h3>{iteration === simplexIterations.length - 1 ? 'Otimalidade satisfeita' : 'Custo reduzido favorável'}</h3><div className="proof-meter"><motion.span animate={{ width: `${25 + iteration * 25}%` }} /></div><small>{25 + iteration * 25}% da trajetória demonstrada</small></article>
        </aside>
      </section>
    </div>
  );
}

export function GraphResult() {
  const [layers, setLayers] = useState({ constraints: true, region: true, levels: true, optimum: true });
  const [expanded, setExpanded] = useState(false);
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <div className="page result-page graph-page">
      <ResultHeader title="Plano de viabilidade" eyebrow="Prova geométrica" description="Explore como cada inequação recorta o espaço e conduz ao vértice ótimo." icon={BarChart3} actions={<button className="button button--secondary" onClick={() => setExpanded(true)}><Maximize2 size={16} />Ampliar gráfico</button>} />
      <section className={`graph-workbench ${expanded ? 'is-expanded' : ''}`}>
        {expanded && <button className="graph-focus-close" onClick={() => setExpanded(false)}><Minimize2 size={16} />Sair da ampliação <kbd>Esc</kbd></button>}
        <article className="panel graph-main"><FeasibleGraph layers={layers} integerPoint /><div className="graph-floating-card"><span>SOLUÇÃO ÓTIMA</span><strong>(7,5; 4,5)</strong><small>Z* = 5,25</small></div></article>
        <aside className="panel layer-panel"><div className="panel__header"><div><span className="panel-kicker">CAMADAS</span><h2>Composição visual</h2></div><Layers3 size={19} /></div>{[
          ['constraints', 'Restrições', 'Retas que delimitam o problema', 'violet'],
          ['region', 'Região viável', 'Interseção de todas as condições', 'cyan'],
          ['levels', 'Curvas de nível', 'Deslocamento da função objetivo', 'amber'],
          ['optimum', 'Pontos ótimos', 'Contínuo e inteiro', 'success'],
        ].map(([key, title, text, tone]) => <button className="layer-row" onClick={() => toggle(key)} key={key}><span className={`layer-swatch tone-${tone}`} /><span><strong>{title}</strong><small>{text}</small></span><i className={layers[key] ? 'is-on' : ''}><b /></i></button>)}
          <div className="coordinate-card"><small>CURSOR</small><div><span>x₁</span><strong>7,50</strong></div><div><span>x₂</span><strong>4,50</strong></div><div><span>Z</span><strong>5,25</strong></div></div>
        </aside>
      </section>
    </div>
  );
}

const treeNodes = [
  { id: 'P0', x: 300, y: 30, label: 'PL₀', value: '5,25', status: 'branched' },
  { id: 'P1', x: 155, y: 130, label: 'x₁ ≤ 7', value: '5,30', status: 'best' },
  { id: 'P2', x: 445, y: 130, label: 'x₁ ≥ 8', value: '5,42', status: 'cut' },
  { id: 'P3', x: 90, y: 245, label: '(7, 5)', value: '5,30', status: 'integer' },
  { id: 'P4', x: 220, y: 245, label: 'x₂ ≤ 4', value: '5,50', status: 'cut' },
];

export function IntegerResult({ model }) {
  const [method, setMethod] = useState('exact');
  const [step, setStep] = useState(5);
  return (
    <div className="page result-page integer-page">
      <ResultHeader title="Decisões inteiras" eyebrow="Otimização discreta" description="Compare a aproximação imediata com a busca exata por ramificação e limites." icon={GitBranch} />
      <div className="method-switch"><button className={method === 'round' ? 'is-active' : ''} onClick={() => setMethod('round')}>Arredondamento</button><button className={method === 'exact' ? 'is-active' : ''} onClick={() => setMethod('exact')}>Branch and Bound <span>RECOMENDADO</span></button></div>
      {method === 'round' ? (
        <motion.section className="rounding-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <article className="panel rounding-card"><span className="panel-kicker">SOLUÇÃO CONTÍNUA</span><h2>({model.optimum.x}; {model.optimum.y})</h2><div className="rounding-arrow"><ArrowRight size={22} /></div><span className="panel-kicker">ARREDONDAMENTO TESTADO</span><h2>({Math.round(model.optimum.x)}; {Math.round(model.optimum.y)})</h2><div className="warning-box"><CircleAlert size={18} /><p><strong>Nem todo arredondamento é viável.</strong> O PivôNauta testa as combinações vizinhas antes de propor uma resposta.</p></div></article>
          <article className="panel candidate-list"><div className="panel__header"><h2>Candidatos próximos</h2></div>{[[7, 5, 'Viável', '5,30'], [8, 4, 'Inviável', '—'], [8, 5, 'Viável', '5,70'], [7, 4, 'Inviável', '—']].map((row, index) => <div className={index === 0 ? 'is-best' : ''} key={`${row[0]}-${row[1]}`}><code>({row[0]}, {row[1]})</code><span>{row[2]}</span><strong>{row[3]}</strong></div>)}</article>
        </motion.section>
      ) : (
        <motion.section className="branch-layout" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <article className="panel branch-tree-card">
            <div className="panel__header"><div><span className="panel-kicker">ÁRVORE DE BUSCA</span><h2>Branch and Bound</h2></div><span className="status-pill tone-success">5 nós explorados</span></div>
            <div className="branch-tree">
              <svg viewBox="0 0 600 330" role="img" aria-label="Árvore de Branch and Bound">
                <g className="branch-lines"><motion.path d="M300 72 L155 130" initial={{ pathLength: 0 }} animate={{ pathLength: step > 1 ? 1 : 0 }} /><motion.path d="M300 72 L445 130" initial={{ pathLength: 0 }} animate={{ pathLength: step > 2 ? 1 : 0 }} /><motion.path d="M155 174 L90 245" initial={{ pathLength: 0 }} animate={{ pathLength: step > 3 ? 1 : 0 }} /><motion.path d="M155 174 L220 245" initial={{ pathLength: 0 }} animate={{ pathLength: step > 4 ? 1 : 0 }} /></g>
                {treeNodes.slice(0, step).map((node, index) => <motion.g className={`tree-node tree-node--${node.status}`} key={node.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.12 }} transform={`translate(${node.x - 55} ${node.y})`}><rect width="110" height="52" rx="12" /><text x="12" y="21">{node.label}</text><text className="tree-node__value" x="12" y="40">Z = {node.value}</text></motion.g>)}
              </svg>
            </div>
            <div className="branch-controls"><button className="icon-button" onClick={() => setStep(Math.max(1, step - 1))}><ChevronLeft size={17} /></button><span>Passo {step} de 5</span><button className="icon-button" onClick={() => setStep(Math.min(5, step + 1))}><ChevronRight size={17} /></button></div>
          </article>
          <aside className="integer-summary">
            <article className="panel integer-winner"><span className="winner-badge"><CheckCircle2 size={16} />ÓTIMO INTEIRO</span><h2>({model.integer.x}, {model.integer.y})</h2><strong>Z = {model.integer.z}</strong><div><span>Gap de integralidade</span><b>0,95%</b></div></article>
            <article className="panel bound-card"><span className="panel-kicker">LIMITES</span><div><span>Limitante inferior</span><strong>5,25</strong></div><div><span>Incumbente</span><strong>5,30</strong></div><div className="bound-track"><i /><b /></div><small>Convergência certificada</small></article>
          </aside>
        </motion.section>
      )}
    </div>
  );
}

export function DualResult() {
  const [focus, setFocus] = useState(0);
  const links = [
    { primal: 'Restrição R1', dual: 'Variável y₁', value: '0,20' },
    { primal: 'Restrição R2', dual: 'Variável y₂', value: '0,60' },
    { primal: 'Variável x₁', dual: 'Restrição D1', value: 'ativa' },
  ];
  return (
    <div className="page result-page dual-page">
      <ResultHeader title="Espelho dual" eyebrow="Análise de sensibilidade" description="Cada recurso do primal ganha um valor econômico no problema dual." icon={Sigma} />
      <section className="duality-banner"><span><WandSparkles size={19} />Dualidade forte</span><strong>Z<sub>primal</sub> = 5,25 = Z<sub>dual</sub></strong><small>Certificado algébrico de otimalidade</small></section>
      <section className="dual-mirror">
        <article className="panel dual-model dual-model--primal"><div className="dual-model__head"><span>PRIMAL</span><strong>Minimização</strong></div><div className="dual-equation"><small>OBJETIVO</small><code>Min Z = 0,4x₁ + 0,5x₂</code></div>{['0,3x₁ + 0,1x₂ ≤ 2,7', '0,5x₁ + 0,5x₂ = 6', '0,6x₁ + 0,4x₂ ≥ 6'].map((item, index) => <button className={focus === index ? 'is-active' : ''} onClick={() => setFocus(index)} onMouseEnter={() => setFocus(index)} onFocus={() => setFocus(index)} key={item}><i>R{index + 1}</i><code>{item}</code></button>)}</article>
        <div className="duality-axis"><span>TRANSPOSTA</span><div><ArrowRight size={19} /><ArrowLeft size={19} /></div><small>Aᵀ</small></div>
        <article className="panel dual-model dual-model--dual"><div className="dual-model__head"><span>DUAL</span><strong>Maximização</strong></div><div className="dual-equation"><small>OBJETIVO</small><code>Max W = 2,7y₁ + 6y₂ + 6y₃</code></div>{['0,3y₁ + 0,5y₂ + 0,6y₃ ≤ 0,4', '0,1y₁ + 0,5y₂ + 0,4y₃ ≤ 0,5', 'y₁ ≤ 0; y₂ livre; y₃ ≥ 0'].map((item, index) => <button className={focus === index ? 'is-active' : ''} onClick={() => setFocus(index)} onMouseEnter={() => setFocus(index)} onFocus={() => setFocus(index)} key={item}><i>D{index + 1}</i><code>{item}</code></button>)}</article>
      </section>
      <section className="shadow-prices">
        <div className="panel__header"><div><span className="panel-kicker">CORRESPONDÊNCIAS</span><h2>Preços-sombra e complementaridade</h2></div></div>
        <div className="shadow-grid">{links.map((link, index) => <motion.button className={focus === index ? 'is-active' : ''} onClick={() => setFocus(index)} key={link.primal} whileHover={{ y: -3 }}><span>{link.primal}</span><i><ArrowRight size={16} /></i><span>{link.dual}</span><strong>{link.value}</strong></motion.button>)}</div>
      </section>
    </div>
  );
}

export function AnalysisResult() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="page result-page analysis-page">
      <ResultHeader title="Diagnóstico avançado" eyebrow="Casos especiais" description="Sinais algébricos que revelam múltiplos ótimos, degenerescência, inviabilidade ou ilimitabilidade." icon={Activity} />
      <section className="diagnostic-layout">
        <div className="diagnostic-list">{diagnosticCases.map((item, index) => <motion.button onClick={() => setSelected(index)} className={`${selected === index ? 'is-active' : ''} accent-${item.tone}`} key={item.title} whileHover={{ x: 3 }}><span className={`diagnostic-icon tone-${item.tone}`}>{index === 0 ? <Sparkles size={20} /> : index === 1 ? <Activity size={20} /> : <CheckCircle2 size={20} />}</span><div><small>{item.status}</small><strong>{item.title}</strong><p>{item.text}</p></div><ChevronRight size={18} /></motion.button>)}</div>
        <article className="panel diagnostic-detail">
          <div className="diagnostic-detail__visual"><div className="parallel-lines"><i /><i /><i /><b /></div></div>
          <span className="panel-kicker">EVIDÊNCIA NO TABLEAU</span><h2>{diagnosticCases[selected].title}</h2><p>{diagnosticCases[selected].text}</p>
          <div className="evidence-code"><span>Custo reduzido</span><code>c̄₂ = c₂ − z₂ = 0</code><strong><Check size={15} />condição confirmada</strong></div>
          <div className="interpretation"><Lightbulb size={18} /><p>Quando uma variável não básica apresenta custo reduzido zero no tableau ótimo, ela pode entrar na base sem alterar Z.</p></div>
        </article>
      </section>
    </div>
  );
}

export function ReportResult({ model }) {
  const [sections, setSections] = useState({ formulation: true, tableaus: true, graph: true, integer: true, dual: true, diagnostics: false });
  const [exported, setExported] = useState(false);
  const toggle = (key) => setSections((current) => ({ ...current, [key]: !current[key] }));
  const exportReport = () => {
    const report = `PIVÔNAUTA — RELATÓRIO DE OTIMIZAÇÃO\n\nModelo: ${model.name}\nObjetivo: ${model.sense.toUpperCase()} Z = ${model.objective[0]}x1 + ${model.objective[1]}x2\nÓtimo contínuo: (${model.optimum.x}, ${model.optimum.y}), Z=${model.optimum.z}\nÓtimo inteiro: (${model.integer.x}, ${model.integer.y}), Z=${model.integer.z}\n\nProtótipo acadêmico — Pesquisa Operacional.`;
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'relatorio-pivonauta.txt'; anchor.click(); URL.revokeObjectURL(url);
    setExported(true); window.setTimeout(() => setExported(false), 2400);
  };
  const labels = { formulation: 'Formulação e forma padrão', tableaus: 'Tableaus do Simplex', graph: 'Região viável', integer: 'Soluções inteiras', dual: 'Modelo dual', diagnostics: 'Diagnósticos especiais' };
  return (
    <div className="page result-page report-page">
      <ResultHeader title="Relatório da missão" eyebrow="Síntese acadêmica" description="Escolha as evidências que farão parte do documento final do projeto." icon={FileChartColumn} actions={<button className="button button--primary" onClick={exportReport}>{exported ? <><Check size={17} />Arquivo gerado</> : <><Download size={17} />Exportar relatório</>}</button>} />
      <section className="report-layout">
        <aside className="panel report-settings"><div className="panel__header"><div><span className="panel-kicker">CONTEÚDO</span><h2>Seções incluídas</h2></div></div>{Object.entries(labels).map(([key, label]) => <button className="report-toggle" onClick={() => toggle(key)} key={key}><span className={sections[key] ? 'is-on' : ''}><Check size={13} /></span><strong>{label}</strong></button>)}<div className="report-divider" /><label className="report-field">Autores<input defaultValue="Equipe PivôNauta" /></label><label className="report-field">Disciplina<input defaultValue="Pesquisa Operacional" /></label></aside>
        <article className="report-preview">
          <div className="report-paper">
            <div className="report-paper__cover"><div className="report-logo"><Target size={21} /></div><span>RELATÓRIO TÉCNICO · 2026</span><h1>PivôNauta</h1><h2>{model.name}</h2><p>Análise de programação linear pelo método Simplex</p><div><strong>Equipe PivôNauta</strong><span>Pesquisa Operacional</span></div></div>
            <div className="report-paper__body"><h3>Resumo executivo</h3><p>O modelo foi resolvido por meio do método Simplex em sua forma tabular. A solução ótima contínua encontrada foi Z = {model.optimum.z}.</p>{sections.formulation && <><h3>Formulação</h3><code>{model.sense === 'min' ? 'Min' : 'Max'} Z = {model.objective[0]}x₁ + {model.objective[1]}x₂</code></>}{sections.integer && <><h3>Solução inteira</h3><p>A busca exata encontrou ({model.integer.x}, {model.integer.y}), com valor Z = {model.integer.z}.</p></>}</div>
          </div>
          <div className="preview-caption"><Eye size={16} />Pré-visualização reduzida · 8 páginas estimadas</div>
        </article>
      </section>
    </div>
  );
}
