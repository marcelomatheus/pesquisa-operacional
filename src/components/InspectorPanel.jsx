import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, Settings2, Sigma, Sparkles, PanelRightClose } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { describeSelection } from '../services/selection';
import { displayNumber } from '../services/solverApi';
import { validateModelLocal } from '../services/model';

const ops = { le: '≤', ge: '≥', eq: '=' };
const fieldNumber = value => value === null ? '' : String(value);

function ScalarField({ label, value, onCommit, nullable = false }) {
  const [draft, setDraft] = useState(fieldNumber(value));
  const current = fieldNumber(value);
  useEffect(() => { setDraft(current); }, [current]);
  const valid = draft.trim() !== '' && Number.isFinite(Number(draft));
  return <label className="pr5-inspector-field"><span>{label}</span>
    <input aria-label={label} type="number" step="any" value={draft} aria-invalid={!valid && !(nullable && draft.trim() === '')}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => { if (nullable && !draft.trim()) onCommit(null); else if (valid) onCommit(Number(draft)); else setDraft(current); }}
      onKeyDown={event => { if (event.key === 'Enter') event.target.blur(); }} />
  </label>;
}

function ExpandSection({ label, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`inspector-section ${open ? 'is-open' : ''}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span><Icon size={15} />{label}</span><ChevronDown size={15} /></button>
    {open && <div className="inspector-section__content">{children}</div>}
  </section>;
}

function Formula({ model, constraint }) {
  return <code className="pr5-inspector-formula">{constraint.coefficients.map((coefficient, index) => `${displayNumber(coefficient)}${model.variables[index].id}`).join(' + ')} {ops[constraint.operator]} {displayNumber(constraint.rhs)}</code>;
}

function InspectorContent({ model, setModel, setSelectedEntity, resolved, result, integerTask, onSaveModel }) {
  const navigate = useNavigate();
  const patchConstraint = patch => setModel(current => ({ ...current, constraints: current.constraints.map(item => item.id === resolved.constraint.id ? { ...item, ...patch } : item) }));
  const patchVariable = patch => setModel(current => ({ ...current, variables: current.variables.map(item => item.id === resolved.variable.id ? { ...item, ...patch } : item) }));
  if (resolved.type === 'constraint') {
    const c = resolved.constraint;
    return <>
      <ExpandSection label="Restrição selecionada" icon={Settings2}>
        <label className="pr5-inspector-field"><span>Nome</span><input value={c.name} onChange={event => patchConstraint({ name: event.target.value })} /></label>
        <Formula model={model} constraint={c} />
        <label className="pr5-inspector-field"><span>Relação</span><select value={c.operator} onChange={event => patchConstraint({ operator: event.target.value })}><option value="le">≤</option><option value="ge">≥</option><option value="eq">=</option></select></label>
        <ScalarField label="Lado direito (RHS)" value={c.rhs} onCommit={rhs => patchConstraint({ rhs })} />
        <div className="pr5-inspector-grid">{c.coefficients.map((coefficient, index) => <ScalarField key={`${c.id}-${model.variables[index].id}`} label={`Coeficiente ${model.variables[index].id}`} value={coefficient} onCommit={value => patchConstraint({ coefficients: c.coefficients.map((x, i) => i === index ? value : x) })} />)}</div>
      </ExpandSection>
      <ExpandSection label="Viabilidade no ótimo" icon={Sigma}>
        {!resolved.metrics ? <p>Execute o modelo para calcular atividade e folga desta restrição.</p> : <>
          <div className="property-row"><span>Lado esquerdo</span><strong>{displayNumber(resolved.metrics.lhs)}</strong></div>
          <div className="property-row"><span>Folga/excesso</span><strong>{displayNumber(resolved.metrics.slack)}</strong></div>
          <div className="property-row"><span>Ativa</span><strong>{resolved.metrics.active ? 'Sim' : 'Não'}</strong></div>
          <div className="property-row"><span>Viável</span><strong>{resolved.metrics.feasible ? 'Sim' : 'Não'}</strong></div>
        </>}
      </ExpandSection>
    </>;
  }
  if (resolved.type === 'variable') {
    const v = resolved.variable;
    return <ExpandSection label="Variável selecionada" icon={Settings2}>
      <div className="property-row"><span>Identificador</span><strong>{v.id}</strong></div>
      <label className="pr5-inspector-field"><span>Nome</span><input value={v.name} onChange={event => patchVariable({ name: event.target.value })} /></label>
      <label className="pr5-inspector-field"><span>Domínio</span><select value={v.domain} onChange={event => patchVariable({ domain: event.target.value })}><option value="continuous">Contínua</option><option value="integer">Inteira</option></select></label>
      <ScalarField label="Limite inferior (vazio = livre)" value={v.lower_bound} nullable onCommit={lower_bound => patchVariable({ lower_bound })} />
      <ScalarField label="Limite superior (vazio = sem limite)" value={v.upper_bound} nullable onCommit={upper_bound => patchVariable({ upper_bound })} />
      <div className="property-row"><span>Coeficiente Z</span><strong>{displayNumber(resolved.coefficient)}</strong></div>
      <div className="property-row"><span>Valor calculado</span><strong>{displayNumber(resolved.value)}</strong></div>
    </ExpandSection>;
  }
  if (resolved.type === 'tableau') {
    const step = resolved.snapshot;
    return <>
      <ExpandSection label="Etapa tabular" icon={Sigma}>
        <div className="property-row"><span>Fase</span><strong>{step.phase}</strong></div>
        <div className="property-row"><span>Evento</span><strong>{step.event}</strong></div>
        <div className="property-row"><span>Base</span><strong>{step.basis?.join(', ')}</strong></div>
        {step.pivot && <><div className="property-row"><span>Entra</span><strong>{step.pivot.entering || '—'}</strong></div><div className="property-row"><span>Sai</span><strong>{step.pivot.leaving || '—'}</strong></div><div className="property-row"><span>Razão mínima</span><strong>{displayNumber(step.pivot.min_ratio)}</strong></div></>}
        {resolved.row !== null && resolved.column !== null && <><div className="property-row"><span>Célula</span><strong>L{resolved.row}, C{resolved.column}</strong></div><div className="property-row"><span>Valor</span><strong>{displayNumber(step.matrix[resolved.row]?.[resolved.column], 6)}</strong></div></>}
      </ExpandSection>
      <ExpandSection label="Operações elementares" icon={Sparkles}>
        {step.row_operations?.length ? <ol className="pr5-operations-mini">{step.row_operations.map((operation, index) => <li key={index}>{operation.kind === 'scale' ? `R${operation.target_row} ÷ ${displayNumber(operation.pivot_value)}` : `R${operation.target_row} + (${displayNumber(operation.factor)}) · R${operation.source_row}`}</li>)}</ol> : <p>Não há pivoteamento nesta etapa.</p>}
      </ExpandSection>
    </>;
  }
  if (resolved.type === 'branch_node') {
    const node = resolved.node;
    return <ExpandSection label="Nó de ramificação" icon={Sigma}>
      <div className="property-row"><span>ID</span><strong>{node.id}</strong></div>
      <div className="property-row"><span>Profundidade</span><strong>{node.depth}</strong></div>
      <div className="property-row"><span>Condição</span><strong>{node.branch_constraint || 'Raiz'}</strong></div>
      <div className="property-row"><span>Status</span><strong>{node.status}</strong></div>
      <div className="property-row"><span>Relaxação</span><strong>{node.relaxation_status}</strong></div>
      <div className="property-row"><span>Valor Z</span><strong>{displayNumber(node.relaxation_objective)}</strong></div>
      <div className="property-row"><span>Pivôs</span><strong>{node.pivot_count}</strong></div>
      <div className="property-row"><span>Filhos</span><strong>{node.children.join(', ') || 'Nenhum'}</strong></div>
    </ExpandSection>;
  }
  return <>
    <ExpandSection label="Modelo matemático" icon={Settings2}>
      <label className="pr5-inspector-field"><span>Nome do modelo</span><input value={model.name} onChange={event => setModel(current => ({ ...current, name: event.target.value }))} /></label>
      <div className="segmented-control"><button className={model.sense === 'min' ? 'is-active' : ''} onClick={() => setModel(current => ({ ...current, sense: 'min' }))}>Minimizar</button><button className={model.sense === 'max' ? 'is-active' : ''} onClick={() => setModel(current => ({ ...current, sense: 'max' }))}>Maximizar</button></div>
      <div className="property-row"><span>Variáveis</span><strong>{model.variables.length}</strong></div>
      <div className="property-row"><span>Restrições</span><strong>{model.constraints.length}</strong></div>
      <div className="property-row"><span>Validação</span><strong>{validateModelLocal(model).valid ? 'Estrutura válida' : 'Corrigir modelo'}</strong></div>
    </ExpandSection>
    <ExpandSection label="Função objetivo" icon={Sigma}>
      <div className="formula-chip">{model.sense.toUpperCase()} Z = {model.objective.map((c, i) => `${displayNumber(c)}${model.variables[i].id}`).join(' + ')}</div>
      <div className="pr5-inspector-grid">{model.objective.map((c, i) => <ScalarField key={`${model.variables[i].id}-cost`} label={`Custo ${model.variables[i].id}`} value={c} onCommit={value => setModel(current => ({ ...current, objective: current.objective.map((x, j) => j === i ? value : x) }))} />)}</div>
    </ExpandSection>
    <ExpandSection label="Restrições" icon={Sigma}>
      <div className="pr5-inspector-entities">{model.constraints.map((constraint, index) => <button key={constraint.id} onClick={() => setSelectedEntity({ type: 'constraint', id: constraint.id })} className="constraint-mini" title={`R${index + 1} — disponível para seleção no editor`}><strong>R{index + 1} · {constraint.name}</strong><Formula model={model} constraint={constraint} /></button>)}</div>
    </ExpandSection>
    <ExpandSection label="Execução" icon={Sparkles}>
      <div className="property-row"><span>Status</span><strong>{result?.status || 'Ainda não executado'}</strong></div>
      <div className="property-row"><span>Valor objetivo</span><strong>{displayNumber(result?.objective_value)}</strong></div>
      <div className="property-row"><span>Pivoteamentos</span><strong>{result?.pivot_count ?? '—'}</strong></div>
      {integerTask?.state === 'success' && <div className="property-row"><span>Inteiro</span><strong>{integerTask.data.status}</strong></div>}
    </ExpandSection>
    <button className="inspector-action" onClick={() => navigate('/editor')}>Editar formulação <ChevronRight size={15} /></button>
    <button className="inspector-action inspector-action--quiet" onClick={() => navigate('/review')}>Revisar e resolver <ChevronRight size={15} /></button>
    <button className="inspector-action inspector-action--quiet" onClick={() => void onSaveModel().catch(error => window.alert(error.message))}><Save size={15} />Salvar na biblioteca</button>
  </>;
}

export function InspectorPanel({ model, setModel, selectedEntity, setSelectedEntity,
  result, integerTask, onSaveModel, open, onClose }) {
  const resolved = useMemo(() => describeSelection(model, selectedEntity, result, integerTask),
    [model, selectedEntity, result, integerTask]);
  return <aside className={`inspector ${open ? 'is-open' : ''}`} aria-label="Inspetor do modelo">
    <div className="inspector__head"><div><span>INSPECTOR</span><strong>{resolved.title}</strong></div>
      <button className="icon-button inspector-close" aria-label="Fechar inspetor" onClick={onClose}><PanelRightClose size={17} /></button>
    </div>
    <div className="inspector__body"><InspectorContent key={`${resolved.type}-${resolved.constraint?.id || resolved.variable?.id || resolved.node?.id || ''}`}
      model={model} setModel={setModel} setSelectedEntity={setSelectedEntity} resolved={resolved} result={result} integerTask={integerTask} onSaveModel={onSaveModel} />
      {resolved.type !== 'model' && <button className="inspector-action inspector-action--quiet" onClick={() => setSelectedEntity({ type: 'model' })}>Visão geral do modelo <ChevronRight size={15} /></button>}
    </div>
  </aside>;
}
