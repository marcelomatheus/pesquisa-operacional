import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, BarChart3, BookOpen, Braces, ChevronDown, ChevronRight,
  CircleHelp, Command, FileChartColumn, FolderKanban, Gauge, GitBranch,
  Home, Layers3, Menu, PanelRightClose, PanelRightOpen, Play, Plus,
  Search, Settings2, Sigma, Sparkles, Table2, TerminalSquare, X, Save,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Logo } from './Logo';

const primaryNavigation = [
  { to: '/workspace', icon: Home, label: 'Visão geral' },
  { to: '/library', icon: FolderKanban, label: 'Biblioteca' },
  { to: '/help', icon: CircleHelp, label: 'Guia de uso' },
];

const resultNavigation = [
  { to: '/results/summary', icon: Gauge, label: 'Resultado' },
  { to: '/results/simplex', icon: Table2, label: 'Simplex tabular' },
  { to: '/results/graph', icon: BarChart3, label: 'Plano gráfico' },
  { to: '/results/integer', icon: GitBranch, label: 'Solução inteira' },
  { to: '/results/dual', icon: Braces, label: 'Modelo dual' },
  { to: '/results/analysis', icon: Activity, label: 'Diagnósticos' },
  { to: '/results/report', icon: FileChartColumn, label: 'Relatório' },
];

function AppNavLink({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.to === '/workspace'} className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`} onClick={onNavigate}>
      <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
    </NavLink>
  );
}

function CommandPalette({ open, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const commands = useMemo(() => [
    { action: 'new', icon: Plus, label: 'Criar novo modelo' },
    ...primaryNavigation,
    ...resultNavigation,
    { to: '/review', icon: Play, label: 'Revisar e resolver' },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div className="command-palette" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="command-palette__search"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite uma tela ou ação…" /><kbd>Esc</kbd></div>
            <div className="command-palette__list">
              <small>Comandos disponíveis</small>
              {commands.map((item) => {
                const Icon = item.icon;
                return <button key={`${item.to || item.action}-${item.label}`} onClick={() => onSelect(item)}><span><Icon size={17} />{item.label}</span><ChevronRight size={15} /></button>;
              })}
            </div>
            <div className="command-palette__footer"><Command size={14} /> Ctrl/⌘ K abre este menu em qualquer tela</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children, model, setModel, logs, selectedEntity, setSelectedEntity, onNewModel, onSaveModel, dirty, storageWarning }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ properties: true, formulation: true, assistance: true });
  const isResult = location.pathname.startsWith('/results');

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((value) => !value); }
      if (event.key === 'Escape') { setPaletteOpen(false); setInspectorOpen(false); setMobileMenu(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileMenu(false);
    const workspace = document.querySelector('.workspace');
    if (workspace) workspace.scrollTop = 0;
    if (location.pathname.startsWith('/results')) setSelectedEntity('Resultado do modelo');
    else if (location.pathname === '/review') setSelectedEntity('Revisão da formulação');
    else if (location.pathname !== '/editor') setSelectedEntity('Modelo matemático');
  }, [location.pathname]);

  const toggleSection = (key) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const modelFormula = `${model.sense === 'min' ? 'Min' : 'Max'} Z = ${model.objective.map((c, i) => `${c}${model.variables[i]?.id || `x${i + 1}`}`).join(' + ')}`;
  const selectCommand = (item) => { setPaletteOpen(false); if (item.action === 'new') onNewModel(); else navigate(item.to); };

  return (
    <div className={`app-shell ${consoleOpen ? 'has-console' : ''}`}>
      <aside className={`context-panel ${mobileMenu ? 'is-open' : ''}`} aria-label="Navegação principal">
        <div className="context-panel__head"><button className="brand-home-button" onClick={() => navigate('/')} aria-label="Ir para a página inicial"><Logo /></button><button className="icon-button mobile-only" onClick={() => setMobileMenu(false)} aria-label="Fechar navegação"><X size={18} /></button></div>
        <button className="new-model-button" onClick={onNewModel}><Plus size={17} />Novo modelo <kbd>N</kbd></button>
        <button className="search-button" onClick={() => setPaletteOpen(true)}><Search size={16} /><span>Ir para…</span><kbd>⌘K</kbd></button>

        <nav className="context-nav">
          <p>Workspace</p>
          {primaryNavigation.slice(0, 2).map((item) => <AppNavLink item={item} key={item.to} />)}
          <NavLink to="/editor" className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}><BookOpen size={17} strokeWidth={1.8} /><span>Editor do modelo</span></NavLink>
        </nav>

        {isResult && <nav className="context-nav context-nav--results"><p>Análises</p>{resultNavigation.map((item) => <AppNavLink item={item} key={item.to} />)}</nav>}

        <button className="active-model-row" onClick={() => navigate('/editor')}>
          <span className="active-model-row__index">M01</span>
          <span><small>Modelo ativo</small><strong>{model.name}</strong><code>{modelFormula}</code></span>
          <ChevronRight size={15} />
        </button>

        <div className="context-panel__footer"><AppNavLink item={primaryNavigation[2]} /><div className="project-status"><span>Motor matemático próprio</span></div>
          <div className="pr4-storage-status">{dirty ? '● Alterações não salvas na biblioteca' : '✓ Modelo salvo'}</div>
          {storageWarning && <div className="pr4-storage-warning" role="alert">{storageWarning}</div>}
        </div>
      </aside>

      <header className="mobile-topbar"><button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Abrir navegação"><Menu size={19} /></button><Logo /><button className="icon-button" onClick={() => setInspectorOpen(true)} aria-label="Abrir inspetor"><PanelRightOpen size={19} /></button></header>

      <main className="workspace">
        <div className="route-stage">{children}</div>
      </main>

      <aside className={`inspector ${inspectorOpen ? 'is-open' : ''}`} aria-label="Inspetor do modelo">
        <div className="inspector__head"><div><span>INSPECTOR</span><strong>{selectedEntity || 'Modelo matemático'}</strong></div>
          <button className="icon-button" title="Salvar modelo na biblioteca" aria-label="Salvar modelo" onClick={() => void onSaveModel().catch(error => window.alert(error.message))}><Save size={17} /></button><button className="icon-button inspector-close" onClick={() => setInspectorOpen(false)} aria-label="Fechar inspetor"><PanelRightClose size={17} /></button></div>
        <div className="inspector__body">
          <section className={`inspector-section ${openSections.properties ? 'is-open' : ''}`}>
            <button onClick={() => toggleSection('properties')} aria-expanded={openSections.properties}><span><Settings2 size={15} />Propriedades</span><ChevronDown size={15} /></button>
            {openSections.properties && <div className="inspector-section__content">
              <label>Nome do modelo<input value={model.name} onChange={(event) => setModel((current) => ({ ...current, name: event.target.value }))} /></label>
              <span className="field-caption">Sentido da otimização</span>
              <div className="segmented-control"><button className={model.sense === 'min' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, sense: 'min' }))}>Minimizar</button><button className={model.sense === 'max' ? 'is-active' : ''} onClick={() => setModel((current) => ({ ...current, sense: 'max' }))}>Maximizar</button></div>
              <div className="property-row"><span>Variáveis</span><strong>{model.variables.length}</strong></div><div className="property-row"><span>Restrições</span><strong>{model.constraints.length}</strong></div><div className="property-row"><span>Tipo</span><strong>{model.variables.some(v => v.domain === 'integer') ? 'Inteira / mista' : 'Contínua'}</strong></div>
            </div>}
          </section>

          <section className={`inspector-section ${openSections.formulation ? 'is-open' : ''}`}>
            <button onClick={() => toggleSection('formulation')} aria-expanded={openSections.formulation}><span><Sigma size={15} />Formulação</span><ChevronDown size={15} /></button>
            {openSections.formulation && <div className="inspector-section__content"><div className="formula-chip">{modelFormula}</div>{model.constraints.map((constraint) => <button className="constraint-mini" key={constraint.id} onClick={() => setSelectedEntity(constraint.name)}><span>{constraint.name}</span><code>{constraint.coefficients.map((c, i) => `${c}${model.variables[i].id}`).join(' + ')} {{ le: '≤', ge: '≥', eq: '=' }[constraint.operator]} {constraint.rhs}</code></button>)}</div>}
          </section>

          <section className={`inspector-section ${openSections.assistance ? 'is-open' : ''}`}>
            <button onClick={() => toggleSection('assistance')} aria-expanded={openSections.assistance}><span><Sparkles size={15} />Próxima ação</span><ChevronDown size={15} /></button>
            {openSections.assistance && <div className="inspector-section__content"><div className="hint-card"><Layers3 size={17} /><p><strong>Modelo pronto para revisão</strong><span>Confira a forma padrão antes de executar.</span></p></div><button className="inspector-action" onClick={() => navigate('/review')}>Revisar e resolver <ChevronRight size={15} /></button><button className="inspector-action inspector-action--quiet" onClick={() => navigate('/editor')}>Voltar ao editor <ChevronRight size={15} /></button></div>}
          </section>
        </div>
      </aside>

      <section className={`math-console ${consoleOpen ? 'is-open' : ''}`} aria-label="Console matemático">
        <button className="console-handle" onClick={() => setConsoleOpen((value) => !value)} aria-expanded={consoleOpen}><span><TerminalSquare size={15} />Console <i>{logs.length}</i></span><span className="console-handle__status"><b />eventos <ChevronDown className={consoleOpen ? '' : 'is-rotated'} size={15} /></span></button>
        <AnimatePresence initial={false}>{consoleOpen && <motion.div className="console-content" initial={{ height: 0 }} animate={{ height: 126 }} exit={{ height: 0 }}>{logs.map((log, index) => <div className="console-line" key={`${log.text}-${index}`}><span className={`console-dot tone-${log.tone}`} /><time>{log.time}</time><p>{log.text}</p></div>)}</motion.div>}</AnimatePresence>
      </section>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={selectCommand} />
    </div>
  );
}
