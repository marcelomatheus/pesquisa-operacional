import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, Copy, FlaskConical, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examples } from '../data';
import { normalizeModelInput, newId } from '../services/model';
import { deleteSavedModel, duplicateSavedModel, listSavedModels } from '../services/storage';

export function Library({ model, onOpenModel, onSaveModel, pushLog }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try { setSaved(await listSavedModels()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const all = useMemo(() => [
    ...saved.map(item => ({ ...item, saved: true, accent: 'violet', eyebrow: 'Meu modelo', description: 'Modelo salvo neste navegador.' })),
    ...examples.map(item => ({ ...item, saved: false })),
  ], [saved]);
  const filtered = all.filter(item => {
    const text = `${item.name} ${item.description || ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === 'Todos' ||
      (filter === 'Minimização' && item.sense === 'min') ||
      (filter === 'Maximização' && item.sense === 'max') ||
      (filter === 'Salvos' && item.saved));
  });
  const openModel = item => {
    const target = item.saved ? { ...item } : normalizeModelInput(item);
    onOpenModel(target, { saved: item.saved });
    pushLog({ tone: 'cyan', text: `Modelo “${item.name}” carregado no editor`, time: new Date().toLocaleTimeString('pt-BR') });
    navigate('/editor');
  };
  const doSave = async () => {
    try { setBusy(true); await onSaveModel(); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const doDuplicate = async item => {
    try { setBusy(true); await duplicateSavedModel(item, newId); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const doDelete = async item => {
    if (!window.confirm(`Excluir definitivamente “${item.name}” da biblioteca local?`)) return;
    try { setBusy(true); await deleteSavedModel(item.id); await refresh(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="page">
    <header className="page-header page-header--compact">
      <div><div className="eyebrow"><FlaskConical size={14} />Modelos de referência e meus modelos</div><h1>Biblioteca de <span>experimentos.</span></h1><p>Os modelos salvos ficam neste navegador (IndexedDB). Exporte JSON para fazer backup ou compartilhar entre dispositivos.</p></div>
      <button className="button button--primary" disabled={busy} onClick={doSave}><Save size={16} />Salvar modelo ativo</button>
    </header>
    {error && <div className="import-error" role="alert">{error}</div>}
    <div className="library-toolbar">
      <label className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar modelos…" /></label>
      <div className="filter-pills">{['Todos', 'Salvos', 'Minimização', 'Maximização'].map(item => <button className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    </div>
    <section className="model-library-grid">{filtered.map((item, i) => (
      <motion.article className={`model-card accent-${item.accent || 'violet'}`} key={`${item.saved ? 'saved' : 'example'}-${item.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * .04, .25) }}>
        <div className="model-card__visual"><span className="model-card__badge">{item.saved ? 'SALVO LOCALMENTE' : item.eyebrow}</span><div className="mini-plot"><i /><i /><i /><b /></div></div>
        <div className="model-card__content"><div className="model-card__title"><div><small>{item.sense === 'min' ? 'MINIMIZAÇÃO' : 'MAXIMIZAÇÃO'}</small><h2>{item.name}</h2></div>{model.id === item.id && <CheckCircle2 size={19} />}</div>
          <p>{item.description}</p><code>{item.sense === 'min' ? 'Min' : 'Max'} Z = {item.objective.map((x, j) => `${x}x${j + 1}`).join(' + ')}</code>
          <div className="model-card__footer"><span>{item.constraints.length} restrições · {item.objective.length} variáveis</span>
            <button onClick={() => openModel(item)}>Abrir <ArrowUpRight size={16} /></button>
            {item.saved && <><button disabled={busy} title="Duplicar" aria-label={`Duplicar ${item.name}`} onClick={() => doDuplicate(item)}><Copy size={15} /></button>
              <button disabled={busy} title="Excluir" aria-label={`Excluir ${item.name}`} onClick={() => doDelete(item)}><Trash2 size={15} /></button></>}
          </div>
        </div>
      </motion.article>
    ))}</section>
    {!filtered.length && <div className="empty-state"><Sparkles size={25} /><h2>Nenhum modelo encontrado</h2><p>Experimente outra busca ou salve seu modelo ativo.</p></div>}
  </div>;
}
