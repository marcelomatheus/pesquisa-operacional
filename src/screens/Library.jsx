import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, FlaskConical, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examples } from '../data';

export function Library({ model, setModel, pushLog }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const filtered = useMemo(() => examples.filter((item) => {
    const matchesText = `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'Todos' || (filter === 'Minimização' && item.sense === 'min') || (filter === 'Maximização' && item.sense === 'max');
    return matchesText && matchesFilter;
  }), [query, filter]);

  const openModel = (item) => {
    setModel(structuredClone(item));
    pushLog({ tone: item.accent, text: `Exemplo “${item.name}” carregado no editor`, time: 'agora' });
    navigate('/editor');
  };

  return (
    <div className="page">
      <header className="page-header page-header--compact">
        <div><div className="eyebrow"><FlaskConical size={14} />Modelos de referência</div><h1>Biblioteca de <span>experimentos.</span></h1><p>Comece por um caso conhecido, observe o comportamento do algoritmo e adapte os parâmetros.</p></div>
      </header>
      <div className="library-toolbar">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelos, casos ou conceitos…" /></label>
        <div className="filter-pills">{['Todos', 'Minimização', 'Maximização'].map((item) => <button className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
      </div>
      <section className="model-library-grid">
        {filtered.map((item, index) => (
          <motion.article className={`model-card accent-${item.accent}`} key={item.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
            <div className="model-card__visual">
              <span className="model-card__badge">{item.eyebrow}</span>
              <div className="mini-plot"><i /><i /><i /><b /></div>
            </div>
            <div className="model-card__content">
              <div className="model-card__title"><div><small>{item.sense === 'min' ? 'MINIMIZAÇÃO' : 'MAXIMIZAÇÃO'}</small><h2>{item.name}</h2></div>{model.id === item.id && <CheckCircle2 size={19} />}</div>
              <p>{item.description}</p>
              <code>{item.sense === 'min' ? 'Min' : 'Max'} Z = {item.objective[0]}x₁ + {item.objective[1]}x₂</code>
              <div className="model-card__footer"><span>{item.constraints.length} restrições</span><button onClick={() => openModel(item)}>Abrir modelo <ArrowUpRight size={16} /></button></div>
            </div>
          </motion.article>
        ))}
      </section>
      {filtered.length === 0 && <div className="empty-state"><Sparkles size={25} /><h2>Nenhum experimento encontrado</h2><p>Tente um termo mais amplo ou limpe o filtro atual.</p></div>}
    </div>
  );
}
