import { motion } from 'framer-motion';
import { ArrowLeft, Check, CheckCircle2, CircleDot, Play, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Review({ model, solve, solving }) {
  const navigate = useNavigate();
  const [showStandardForm, setShowStandardForm] = useState(false);
  const formula = `${model.sense === 'min' ? 'Min' : 'Max'} Z = ${model.objective[0]}x₁ + ${model.objective[1]}x₂`;
  return (
    <div className="page review-page">
      <header className="page-header page-header--compact">
        <button className="back-link" onClick={() => navigate('/editor')}><ArrowLeft size={17} />Voltar ao editor</button>
        <div><div className="eyebrow"><ShieldCheck size={14} />Verificação antes da execução</div><h1>Revise. Entenda. <span>Então resolva.</span></h1><p>A formulação abaixo será convertida à forma padrão e processada pelo Simplex tabular.</p></div>
      </header>
      <section className="review-grid">
        <article className="panel review-formulation">
          <div className="panel__header"><div><span className="panel-kicker">FORMULAÇÃO CANÔNICA</span><h2>{model.name}</h2></div><span className="validity-badge"><Check size={14} />Consistente</span></div>
          <div className="math-review"><div className="math-review__objective"><small>OBJETIVO</small><strong>{formula}</strong></div><div className="math-review__constraints"><small>SUJEITO A</small>{model.constraints.map((constraint, index) => <div key={constraint.id}><span>R{index + 1}</span><code>{constraint.values[0]}x₁ + {constraint.values[1]}x₂ {constraint.operator} {constraint.rhs}</code><CheckCircle2 size={16} /></div>)}<div><span>D</span><code>x₁, x₂ ≥ 0</code><CheckCircle2 size={16} /></div></div></div>
          <div className="standard-form"><WandSparkles size={18} /><div><strong>Conversão automática para forma padrão</strong><p>Folgas, excessos e artificiais serão introduzidos apenas quando necessários.</p></div><button onClick={() => setShowStandardForm((value) => !value)}>{showStandardForm ? 'Ocultar transformação' : 'Visualizar transformação'}</button></div>
          {showStandardForm && <motion.div className="standard-preview" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <span>FORMA PADRÃO GERADA</span>
            {model.constraints.map((constraint, index) => <code key={constraint.id}>R{index + 1}: {constraint.values[0]}x₁ + {constraint.values[1]}x₂ {constraint.operator === '≤' ? `+ f${index + 1}` : constraint.operator === '≥' ? `− e${index + 1} + a${index + 1}` : `+ a${index + 1}`} = {constraint.rhs}</code>)}
          </motion.div>}
        </article>
        <aside className="run-card">
          <div className="run-card__halo"><CircleDot size={28} /></div>
          <span className="panel-kicker">MOTOR DE OTIMIZAÇÃO</span><h2>Pronto para decolar</h2><p>O PivôNauta registrará cada decisão algébrica e preparará todas as análises extras.</p>
          <ul><li><Check size={16} />Simplex primal tabular</li><li><Check size={16} />Solução inteira e arredondamento</li><li><Check size={16} />Região viável e curvas de nível</li><li><Check size={16} />Dual e casos especiais</li></ul>
          <button className="button button--primary run-button" disabled={solving} onClick={solve}>
            {solving ? <><span className="spinner" />Calculando órbita…</> : <><Play size={18} fill="currentColor" />Resolver modelo</>}
          </button>
          <small>Tempo estimado: menos de 1 segundo</small>
        </aside>
      </section>
      {solving && (
        <motion.div className="solver-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="solver-orbit"><i /><i /><b /></div><Sparkles size={22} /><strong>Explorando vértices viáveis</strong><span>Aplicando pivoteamento e verificando integridade…</span>
        </motion.div>
      )}
    </div>
  );
}
