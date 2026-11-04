import { motion } from 'framer-motion';
import { ArrowLeft, Check, CheckCircle2, CircleDot, Play, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { validateModel } from '../services/solverApi';
import { StandardFormPreview } from '../components/StandardFormPreview';
import { modelFingerprint } from '../services/solverApi';
import { validateModelLocal } from '../services/model';
import { useNavigate } from 'react-router-dom';

export function Review({ model, solve, solving, solveError }) {
  const navigate = useNavigate();
  const [showStandardForm, setShowStandardForm] = useState(false);
  const [validation, setValidation] = useState({ state: 'checking', message: '', fingerprint: null });
  const fingerprint = modelFingerprint(model);
  const local = validateModelLocal(model);
  useEffect(() => {
    if (!local.valid) {
      setValidation({ state: 'invalid', message: local.errors[0], fingerprint });
      return undefined;
    }
    const controller = new AbortController();
    setValidation({ state: 'checking', message: '', fingerprint });
    const timer = setTimeout(() => {
      validateModel(model, { signal: controller.signal })
        .then(() => setValidation({ state: 'valid', message: 'Modelo validado estruturalmente pela API.', fingerprint }))
        .catch(error => {
          if (error.name !== 'AbortError') {
            setValidation({ state: 'invalid', message: error.message, fingerprint });
          }
        });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [model, fingerprint, local.valid]);
  const structurallyValid = validation.state === 'valid' && validation.fingerprint === fingerprint;
  const formula = `${model.sense === 'min' ? 'Min' : 'Max'} Z = ${model.objective.map((v, i) => `${v}x${i+1}`).join(' + ')}`;
  return (
    <div className="page review-page">
      <header className="page-header page-header--compact">
        <button className="back-link" onClick={() => navigate('/editor')}><ArrowLeft size={17} />Voltar ao editor</button>
        <div><div className="eyebrow"><ShieldCheck size={14} />Verificação antes da execução</div><h1>Revise. Entenda. <span>Então resolva.</span></h1><p>A formulação abaixo será convertida à forma padrão e processada pelo Simplex tabular.</p></div>
      </header>
      <section className="review-grid">
        <article className="panel review-formulation">
          <div className="panel__header"><div><span className="panel-kicker">FORMULAÇÃO CANÔNICA</span><h2>{model.name}</h2></div><span className="validity-badge">{structurallyValid ? <Check size={14} /> : <CircleDot size={14} />}{structurallyValid ? 'Estrutura válida' : validation.state === 'checking' ? 'Validando API…' : 'Verificar modelo'}</span></div>
          <div className="math-review"><div className="math-review__objective"><small>OBJETIVO</small><strong>{formula}</strong></div><div className="math-review__constraints"><small>SUJEITO A</small>{model.constraints.map((constraint, index) => <div key={constraint.id}><span>R{index + 1}</span><code>{constraint.coefficients.map((c, i) => `${c}·${model.variables[i].id}`).join(' + ')} {{ le: '≤', ge: '≥', eq: '=' }[constraint.operator]} {constraint.rhs}</code><CheckCircle2 size={16} /></div>)}<div><span>D</span><code>{model.variables.map(v => `${v.id}: ${v.domain === 'integer' ? 'ℤ' : 'ℝ'}; [${v.lower_bound === null ? '-∞' : v.lower_bound}, ${v.upper_bound === null ? '+∞' : v.upper_bound}]`).join('; ')}</code><CheckCircle2 size={16} /></div></div></div>
          <div className="standard-form"><WandSparkles size={18} /><div><strong>Normalização realizada pelo Simplex</strong><p>O motor próprio introduz folgas, excessos e variáveis artificiais conforme necessário.</p></div><button onClick={() => setShowStandardForm((value) => !value)}>{showStandardForm ? 'Ocultar informações' : 'Sobre a transformação'}</button></div>
          {showStandardForm && <StandardFormPreview model={model} />}
          {validation.state === 'invalid' && <p className="import-error"><CircleDot size={15} />{validation.message}</p>}
        </article>
        <aside className="run-card">
          <div className="run-card__halo"><CircleDot size={28} /></div>
          <span className="panel-kicker">MOTOR DE OTIMIZAÇÃO</span><h2>Pronto para decolar</h2><p>O PivôNauta registrará cada decisão algébrica e permite acompanhar tableaux e analisar região viável, dualidade e soluções ótimas alternativas.</p>
          <ul><li><Check size={16} />Simplex primal tabular</li><li><Check size={16} />Solução inteira e arredondamento</li><li><Check size={16} />Geometria dinâmica</li><li><Check size={16} />Dual e ótimos alternativos</li></ul>
          <button className="button button--primary run-button" disabled={solving || !structurallyValid} onClick={solve}>
            {solving ? <><span className="spinner" />Calculando órbita…</> : <><Play size={18} fill="currentColor" />Resolver modelo</>}
          </button>
          <small>A duração varia com a complexidade do modelo.</small>{solveError && <p role="alert" className="import-error">{solveError}</p>}
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
