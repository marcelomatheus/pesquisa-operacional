import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, CircleAlert, Copy, Download, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addVariable, mathematicalFingerprint, modelToJson, normalizeModelInput, parseModelJson, removeVariable, validateModelLocal, MAX_VARIABLES, MAX_CONSTRAINTS } from '../services/model';
import { formatAlgebraic, parseAlgebraic } from '../services/algebraic';
import { validateModel } from '../services/solverApi';

const operatorLabels = { le: '≤', ge: '≥', eq: '=' };

function NumberField({ value, onChange, label, onValidityChange }) {
  const [raw, setRaw] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => setRaw(value === null || value === undefined ? '' : String(value)), [value]);
  const invalid = raw === '' || !Number.isFinite(Number(raw));
  const edit = text => {
    setRaw(text);
    const isValid = text.trim() !== '' && Number.isFinite(Number(text));
    onValidityChange?.(label, isValid);
    if (isValid) onChange(Number(text));
  };
  return <input aria-label={label} type="number" step="any" value={raw} aria-invalid={invalid}
    className={invalid ? 'pr4-invalid-number' : undefined} onChange={event => edit(event.target.value)} />;
}

function downloadJson(model) {
  const blob = new Blob([modelToJson(model)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo-pivonauta-v1.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Editor({ model, setModel, pushLog, setSelectedEntity }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('visual');
  const [jsonText, setJsonText] = useState('');
  const [algebraText, setAlgebraText] = useState('');
  const [preview, setPreview] = useState(null);
  const [inputError, setInputError] = useState('');
  const [invalidInputs, setInvalidInputs] = useState({});
  const [apiValidation, setApiValidation] = useState({ state: 'checking', fingerprint: null, message: '' });
  const fingerprint = mathematicalFingerprint(model);
  const local = validateModelLocal(model);
  const hasInvalidInputs = Object.values(invalidInputs).some(v => v === false);
  const valid = local.valid && !hasInvalidInputs && apiValidation.state === 'valid' && apiValidation.fingerprint === fingerprint;

  useEffect(() => {
    if (!local.valid || hasInvalidInputs) {
      setApiValidation({ state: 'invalid', fingerprint, message: local.errors[0] || 'Corrija os campos numéricos incompletos.' });
      return undefined;
    }
    const controller = new AbortController();
    setApiValidation({ state: 'checking', fingerprint, message: '' });
    const timer = setTimeout(() => {
      validateModel(model, { signal: controller.signal })
        .then(() => setApiValidation({ state: 'valid', fingerprint, message: 'Estrutura validada pela API' }))
        .catch(error => {
          if (error.name !== 'AbortError') setApiValidation({ state: 'invalid', fingerprint, message: error.message });
        });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [model, fingerprint, local.valid, hasInvalidInputs]);

  const setValidity = (label, state) => setInvalidInputs(old => ({ ...old, [label]: state }));
  const change = fn => { setPreview(null); setModel(current => fn(current)); };
  const updateVariable = (index, patch) => change(m => ({ ...m, variables: m.variables.map((v, i) => i === index ? { ...v, ...patch } : v) }));
  const updateConstraint = (id, patch) => change(m => ({ ...m, constraints: m.constraints.map(c => c.id === id ? { ...c, ...patch } : c) }));
  const resetValidation = () => setInvalidInputs({});
  const addConstraint = () => change(m => ({ ...m, constraints: [...m.constraints, {
    id: `r${Date.now()}`, name: `Restrição ${m.constraints.length + 1}`, coefficients: Array(m.variables.length).fill(0), operator: 'le', rhs: 0,
  }] }));
  const showTab = next => {
    setInputError(''); setPreview(null);
    if (next === 'json') setJsonText(modelToJson(model));
    if (next === 'algebra') setAlgebraText(formatAlgebraic(model));
    setTab(next);
  };
  const buildPreview = async () => {
    try {
      const candidate = tab === 'json' ? parseModelJson(jsonText) : parseAlgebraic(algebraText, { previous: model });
      await validateModel(candidate);
      setPreview({ ...candidate, id: model.id });
      setInputError('');
    } catch (error) {
      setPreview(null);
      setInputError(error.message || 'Não foi possível interpretar o modelo.');
    }
  };
  const applyPreview = () => {
    if (!preview) return;
    setModel(preview);
    resetValidation();
    pushLog({ tone: 'cyan', text: `${tab === 'json' ? 'JSON' : 'Expressões algébricas'} validado e aplicado`, time: new Date().toLocaleTimeString('pt-BR') });
    setPreview(null); setInputError(''); setTab('visual');
  };
  const loadFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 100_000) { setInputError('O arquivo deve ter no máximo 100 KB.'); return; }
    setJsonText(await file.text()); setPreview(null); setInputError(''); event.target.value = '';
  };

  return <div className="page editor-page">
    <header className="editor-topbar">
      <div><span className="breadcrumb">Workspace / Modelos /</span><input aria-label="Nome do modelo" className="model-name-input" value={model.name} onChange={event => change(m => ({ ...m, name: event.target.value }))} /></div>
      <div className="editor-status"><span>{valid ? <Check size={14} /> : <CircleAlert size={14} />}{valid ? 'Validado' : 'Em edição'}</span>
        <button className="button button--secondary" onClick={() => downloadJson(model)}><Download size={15} />Exportar JSON</button>
        <button className="button button--primary" disabled={!valid} onClick={() => navigate('/review')}>Revisar modelo <ArrowRight size={17} /></button></div>
    </header>
    <section className="editor-canvas dotted-canvas">
      <div className="canvas-toolbar" role="tablist" aria-label="Modos do editor">
        <button role="tab" aria-selected={tab === 'visual'} className={tab === 'visual' ? 'is-active' : ''} onClick={() => showTab('visual')}>Editor visual</button>
        <button role="tab" aria-selected={tab === 'algebra'} className={tab === 'algebra' ? 'is-active' : ''} onClick={() => showTab('algebra')}>Editor algébrico</button>
        <button role="tab" aria-selected={tab === 'json'} className={tab === 'json' ? 'is-active' : ''} onClick={() => showTab('json')}>Importar JSON</button>
        <span /><small>{valid ? 'Estrutura validada pela API' : apiValidation.message || 'Validando…'}</small>
      </div>
      {tab !== 'visual' ? <section className="json-importer pr4-import-panel">
        <header><div><span>{tab === 'json' ? 'IMPORTAÇÃO ESTRUTURADA' : 'GRAMÁTICA ALGÉBRICA LINEAR'}</span><h2>{tab === 'json' ? 'Importar modelo canônico ou legado' : 'Editar função objetivo e restrições como texto'}</h2></div><small>{tab === 'json' ? 'JSON v1 · até 10 variáveis' : 'Max Z = 3x1 + 5x2'}</small></header>
        <textarea spellCheck="false" value={tab === 'json' ? jsonText : algebraText} onChange={event => { tab === 'json' ? setJsonText(event.target.value) : setAlgebraText(event.target.value); setPreview(null); setInputError(''); }} aria-label={tab === 'json' ? 'Modelo JSON' : 'Expressões algébricas'} rows={11} />
        {tab === 'json' && <label className="pr4-file-import"><Upload size={16} />Importar arquivo .json<input type="file" accept=".json,application/json" onChange={loadFile} /></label>}
        {tab === 'algebra' && <p>Use uma equação por linha, com variáveis de x1 a x10, operadores &lt;=, &gt;= ou =. Domínios e limites individuais são preservados para variáveis existentes; novas variáveis começam contínuas e não negativas.</p>}
        {inputError && <p className="import-error" role="alert"><CircleAlert size={15} />{inputError}</p>}
        {preview && <div className="pr4-preview" role="status"><strong>Pré-visualização validada</strong><p>{preview.name} · {preview.variables.length} variáveis · {preview.constraints.length} restrições · {preview.sense === 'min' ? 'Minimização' : 'Maximização'}</p><small>A aplicação substituirá a formulação atual somente após sua confirmação.</small></div>}
        <footer><button className="button button--secondary" onClick={() => showTab('visual')}>Cancelar</button><button className="button button--secondary" onClick={buildPreview}>Validar e pré-visualizar</button><button className="button button--primary" disabled={!preview} onClick={applyPreview}>Aplicar formulação</button></footer>
      </section> : <>
        <motion.article className="equation-node equation-node--objective" layout onClick={() => setSelectedEntity('Função objetivo')}>
          <div className="node-number">01</div><div className="node-content"><div className="node-title"><div><span className="node-type">FUNÇÃO OBJETIVO</span><h2>O que devemos otimizar?</h2></div><div className="segmented-control"><button className={model.sense === 'min' ? 'is-active' : ''} onClick={() => change(m => ({ ...m, sense: 'min' }))}>Min</button><button className={model.sense === 'max' ? 'is-active' : ''} onClick={() => change(m => ({ ...m, sense: 'max' }))}>Max</button></div></div>
          <div className="pr4-coefficients"><strong>Z =</strong>{model.variables.map((v, i) => <label key={v.id}><NumberField label={`Coeficiente do objetivo ${v.id}`} value={model.objective[i]} onValidityChange={setValidity} onChange={value => change(m => ({ ...m, objective: m.objective.map((x, j) => j === i ? value : x) }))} /><span>{v.id}</span></label>)}</div></div>
        </motion.article>
        <motion.article className="equation-node equation-node--constraints" layout onClick={() => setSelectedEntity('Conjunto de restrições')}>
          <div className="node-number">02</div><div className="node-content"><div className="node-title"><div><span className="node-type">RESTRIÇÕES</span><h2>Quais limites moldam a decisão?</h2></div><span className="validity-badge">{model.constraints.length} restrições</span></div>
            <div className="pr4-table-scroll"><table className="pr4-model-table"><thead><tr><th>Nome</th>{model.variables.map(v => <th key={v.id}>{v.id}</th>)}<th>Relação</th><th>Limite</th><th>Ações</th></tr></thead><tbody>
              {model.constraints.map((c, row) => <tr key={c.id}><td><input aria-label={`Nome da restrição ${row + 1}`} value={c.name} onChange={event => updateConstraint(c.id, { name: event.target.value })} /></td>
                {c.coefficients.map((x, i) => <td key={model.variables[i].id}><NumberField label={`Restrição ${row + 1}, ${model.variables[i].id}`} value={x} onValidityChange={setValidity} onChange={value => updateConstraint(c.id, { coefficients: c.coefficients.map((n, j) => j === i ? value : n) })} /></td>)}
                <td><select aria-label={`Operador da restrição ${row + 1}`} value={c.operator} onChange={event => updateConstraint(c.id, { operator: event.target.value })}>{Object.entries(operatorLabels).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></td>
                <td><NumberField label={`RHS da restrição ${row + 1}`} value={c.rhs} onValidityChange={setValidity} onChange={value => updateConstraint(c.id, { rhs: value })} /></td>
                <td><div className="row-actions"><button aria-label={`Duplicar restrição ${row + 1}`} disabled={model.constraints.length >= MAX_CONSTRAINTS} onClick={() => change(m => ({ ...m, constraints: [...m.constraints, { ...c, id: `r${Date.now()}`, name: `${c.name} (cópia)` }] }))}><Copy size={15} /></button><button aria-label={`Remover restrição ${row + 1}`} onClick={() => { resetValidation(); change(m => ({ ...m, constraints: m.constraints.filter(item => item.id !== c.id) })); }}><Trash2 size={15} /></button></div></td>
              </tr>)}
            </tbody></table></div>
            <button className="add-row-button" disabled={model.constraints.length >= MAX_CONSTRAINTS} onClick={addConstraint}><Plus size={17} />Adicionar restrição</button>
          </div>
        </motion.article>
        <motion.article className="equation-node equation-node--domain" layout onClick={() => setSelectedEntity('Domínio das variáveis')}>
          <div className="node-number">03</div><div className="node-content"><div className="node-title"><div><span className="node-type">VARIÁVEIS E DOMÍNIOS</span><h2>Domínio e limites individuais</h2></div><small>{model.variables.length}/{MAX_VARIABLES} variáveis</small></div>
            <div className="pr4-table-scroll"><table className="pr4-model-table"><thead><tr><th>Identificador</th><th>Nome exibido</th><th>Domínio</th><th>Limite inferior</th><th>Limite superior</th><th>Ações</th></tr></thead><tbody>
              {model.variables.map((v, i) => <tr key={v.id}><td><code>{v.id}</code></td><td><input aria-label={`Nome da variável ${v.id}`} value={v.name} onChange={event => updateVariable(i, { name: event.target.value })} /></td>
                <td><select aria-label={`Domínio de ${v.id}`} value={v.domain} onChange={event => updateVariable(i, { domain: event.target.value })}><option value="continuous">Contínua</option><option value="integer">Inteira</option></select></td>
                {(['lower_bound', 'upper_bound']).map(bound => <td key={bound}><div className="pr4-bound"><label><input type="checkbox" checked={v[bound] === null} onChange={event => { setInvalidInputs({}); updateVariable(i, { [bound]: event.target.checked ? null : 0 }); }} />Sem limite</label>{v[bound] !== null && <NumberField label={`${bound} de ${v.id}`} value={v[bound]} onValidityChange={setValidity} onChange={value => updateVariable(i, { [bound]: value })} />}</div></td>)}
                <td><button className="icon-button" aria-label={`Remover variável ${v.id}`} disabled={model.variables.length === 1} onClick={() => { resetValidation(); change(m => removeVariable(m, i)); }}><Trash2 size={16} /></button></td></tr>)}
              </tbody></table></div>
            <button className="add-row-button" disabled={model.variables.length >= MAX_VARIABLES} onClick={() => { resetValidation(); change(addVariable); }}><Plus size={17} />Adicionar variável</button>
          </div>
        </motion.article>
      </>}
    </section>
    <div className="editor-footer-notice"><CircleAlert size={17} /><p><strong>{valid ? 'Modelo estruturalmente válido.' : 'Verificação pendente.'}</strong> {hasInvalidInputs ? 'Preencha todos os campos numéricos antes de continuar.' : apiValidation.message} {model.variables.length !== 2 && 'A visualização geométrica é exclusiva de modelos com duas variáveis.'}</p><button disabled={!valid} onClick={() => navigate('/review')}>Prosseguir <ArrowRight size={16} /></button></div>
  </div>;
}
