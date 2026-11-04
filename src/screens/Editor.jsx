import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, CircleAlert, Copy, Equal, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { validateModel } from '../services/solverApi';
import { useNavigate } from 'react-router-dom';

function NumberField({ value, onChange, label }) {
  return <input aria-label={label} type="number" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

export function Editor({ model, setModel, pushLog, setSelectedEntity }) {
  const navigate = useNavigate();
  const [showImporter, setShowImporter] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importError, setImportError] = useState('');
  const [apiValidation, setApiValidation] = useState({ state: 'checking', message: '' });
  useEffect(() => {
    const controller = new AbortController();
    setApiValidation({ state: 'checking', message: '' });
    const timer = setTimeout(() => {
      validateModel(model, { signal: controller.signal })
        .then(() => setApiValidation({ state: 'valid', message: 'Estrutura validada pela API' }))
        .catch(error => {
          if (error.name !== 'AbortError') setApiValidation({ state: 'invalid', message: error.message });
        });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [model]);
  const updateObjective = (index, value) => setModel((current) => ({ ...current, objective: current.objective.map((item, itemIndex) => itemIndex === index ? value : item) }));
  const updateConstraint = (id, patch) => setModel((current) => ({ ...current, constraints: current.constraints.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const addConstraint = () => {
    const id = `r${Date.now()}`;
    setModel((current) => ({ ...current, constraints: [...current.constraints, { id, name: `Restrição ${current.constraints.length + 1}`, values: [1, 1], operator: '≤', rhs: 10 }] }));
    pushLog({ tone: 'violet', text: 'Nova restrição adicionada ao modelo', time: 'agora' });
  };
  const removeConstraint = (id) => setModel((current) => ({ ...current, constraints: current.constraints.filter((item) => item.id !== id) }));
  const duplicateConstraint = (constraint) => setModel((current) => ({ ...current, constraints: [...current.constraints, { ...constraint, id: `${constraint.id}-${Date.now()}`, name: `${constraint.name} (cópia)` }] }));
  const openImporter = () => {
    setJsonText(JSON.stringify({ name: model.name, sense: model.sense, objective: model.objective, constraints: model.constraints.map(({ name, values, operator, rhs }) => ({ name, values, operator, rhs })) }, null, 2));
    setImportError('');
    setShowImporter(true);
  };
  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.objective) || parsed.objective.length !== 2 || !Array.isArray(parsed.constraints) || parsed.constraints.length === 0 || parsed.constraints.some(item => !['≤', '=', '≥'].includes(item.operator) || !Array.isArray(item.values) || item.values.length !== 2)) throw new Error('Estrutura incompleta');
      setModel((current) => ({
        ...current,
        name: parsed.name || current.name,
        sense: parsed.sense === 'min' ? 'min' : 'max',
        objective: parsed.objective.map(Number),
        constraints: parsed.constraints.map((item, index) => ({ id: `imported-${Date.now()}-${index}`, name: item.name || `Restrição ${index + 1}`, values: item.values.map(Number), operator: item.operator, rhs: Number(item.rhs) })),
      }));
      pushLog({ tone: 'cyan', text: 'Formulação JSON importada para revisão', time: 'agora' });
      setShowImporter(false);
    } catch {
      setImportError('Não foi possível importar. Verifique objetivo, restrições e operadores.');
    }
  };

  return (
    <div className="page editor-page">
      <header className="editor-topbar">
        <div><span className="breadcrumb">Workspace / Modelos /</span><input className="model-name-input" value={model.name} onChange={(event) => setModel((current) => ({ ...current, name: event.target.value }))} /></div>
        <div className="editor-status"><span><Check size={14} />Edição local</span><button className="button button--primary" onClick={() => navigate('/review')}>Revisar modelo <ArrowRight size={17} /></button></div>
      </header>

      <section className="editor-canvas dotted-canvas">
        <div className="canvas-toolbar"><button className={!showImporter ? 'is-active' : ''} onClick={() => setShowImporter(false)}>Editor algébrico</button><button className={showImporter ? 'is-active' : ''} onClick={openImporter}>Importar JSON</button><span /><small>{apiValidation.state === 'checking' ? 'Validando modelo…' : apiValidation.state === 'valid' ? apiValidation.message : 'Validação pendente ou falhou'}</small></div>

        <AnimatePresence>
          {showImporter && <motion.section className="json-importer" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <header><div><span>IMPORTAÇÃO ESTRUTURADA</span><h2>Cole ou ajuste a formulação</h2></div><small>JSON · 2 variáveis</small></header>
            <textarea value={jsonText} onChange={(event) => { setJsonText(event.target.value); setImportError(''); }} spellCheck="false" aria-label="Formulação em JSON" />
            {importError && <p className="import-error"><CircleAlert size={15} />{importError}</p>}
            <footer><button className="button button--secondary" onClick={() => setShowImporter(false)}>Cancelar</button><button className="button button--primary" onClick={applyJson}>Aplicar formulação</button></footer>
          </motion.section>}
        </AnimatePresence>

        <motion.article className="equation-node equation-node--objective" layout onClick={() => setSelectedEntity('Função objetivo')}>
          <div className="node-handle"><GripVertical size={18} /></div>
          <div className="node-number">01</div>
          <div className="node-content">
            <div className="node-title"><div><span className="node-type">FUNÇÃO OBJETIVO</span><h2>O que devemos otimizar?</h2></div><div className="segmented-control"><button className={model.sense === 'min' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, sense: 'min' }))}>Min</button><button className={model.sense === 'max' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, sense: 'max' }))}>Max</button></div></div>
            <div className="equation-builder"><strong>Z =</strong><label><NumberField label="Coeficiente de x1" value={model.objective[0]} onChange={(value) => updateObjective(0, value)} /><span>x₁</span></label><b>+</b><label><NumberField label="Coeficiente de x2" value={model.objective[1]} onChange={(value) => updateObjective(1, value)} /><span>x₂</span></label></div>
          </div>
        </motion.article>

        <div className="node-connector"><span /></div>

        <motion.article className="equation-node equation-node--constraints" layout onClick={() => setSelectedEntity('Conjunto de restrições')}>
          <div className="node-handle"><GripVertical size={18} /></div>
          <div className="node-number">02</div>
          <div className="node-content">
            <div className="node-title"><div><span className="node-type">RESTRIÇÕES</span><h2>Quais limites moldam a decisão?</h2></div><span className="validity-badge"><Check size={14} />{model.constraints.length} válidas</span></div>
            <div className="constraint-table">
              <div className="constraint-table__head"><span>Nome</span><span>Coeficientes</span><span>Relação</span><span>Limite</span><span /></div>
              <AnimatePresence initial={false}>
                {model.constraints.map((constraint, rowIndex) => (
                  <motion.div className="constraint-row" key={constraint.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <label><i>R{rowIndex + 1}</i><input value={constraint.name} onChange={(event) => updateConstraint(constraint.id, { name: event.target.value })} /></label>
                    <div className="coefficient-pair"><label><NumberField label={`x1 da restrição ${rowIndex + 1}`} value={constraint.values[0]} onChange={(value) => updateConstraint(constraint.id, { values: [value, constraint.values[1]] })} /><span>x₁</span></label><b>+</b><label><NumberField label={`x2 da restrição ${rowIndex + 1}`} value={constraint.values[1]} onChange={(value) => updateConstraint(constraint.id, { values: [constraint.values[0], value] })} /><span>x₂</span></label></div>
                    <label className="select-wrap"><select value={constraint.operator} onChange={(event) => updateConstraint(constraint.id, { operator: event.target.value })}><option>≤</option><option>=</option><option>≥</option></select><ChevronDown size={15} /></label>
                    <NumberField label={`Limite da restrição ${rowIndex + 1}`} value={constraint.rhs} onChange={(value) => updateConstraint(constraint.id, { rhs: value })} />
                    <div className="row-actions"><button title="Duplicar" onClick={() => duplicateConstraint(constraint)}><Copy size={15} /></button><button title="Remover" disabled={model.constraints.length <= 1} onClick={() => removeConstraint(constraint.id)}><Trash2 size={15} /></button></div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button className="add-row-button" onClick={addConstraint}><Plus size={17} />Adicionar restrição</button>
          </div>
        </motion.article>

        <div className="node-connector"><span /></div>

        <motion.article className="equation-node equation-node--domain" layout onClick={() => setSelectedEntity('Domínio das variáveis')}>
          <div className="node-handle"><GripVertical size={18} /></div><div className="node-number">03</div>
          <div className="node-content"><div className="node-title"><div><span className="node-type">DOMÍNIO</span><h2>Natureza das variáveis</h2></div></div><div className="domain-options"><button className={(model.domain || 'continuous') === 'continuous' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, domain: 'continuous' }))}><span>{(model.domain || 'continuous') === 'continuous' && <Check size={14} />}</span>x₁, x₂ ≥ 0<small>Contínuas e não negativas</small></button><button className={model.domain === 'integer' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, domain: 'integer' }))}><span>{model.domain === 'integer' && <Check size={14} />}</span><b>ℤ</b><small>Inteiras e não negativas</small></button></div></div>
        </motion.article>
      </section>

      <div className="editor-footer-notice"><Sparkles size={17} /><p><strong>{apiValidation.state === 'valid' ? 'Estrutura validada.' : apiValidation.state === 'checking' ? 'Validando estrutura…' : 'Corrija a formulação.'}</strong> {apiValidation.state === 'invalid' ? apiValidation.message : 'A viabilidade matemática só será conhecida após executar o Simplex.'}</p><button disabled={apiValidation.state !== 'valid'} onClick={() => navigate('/review')}>Prosseguir <ArrowRight size={16} /></button></div>
    </div>
  );
}
