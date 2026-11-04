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
import { InspectorPanel } from './InspectorPanel';
import { MathConsole } from './MathConsole';

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

export function AppShell({ children, model, setModel, logs, selectedEntity, setSelectedEntity, onNewModel, onSaveModel, dirty, storageWarning, result, integerTask }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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
    if (location.pathname === '/results/simplex') {
      setSelectedEntity(current => current?.type === 'tableau' && current.source === 'primal' ? current : { type: 'tableau', index: 0, source: 'primal' });
    } else if (location.pathname === '/results/integer') {
      setSelectedEntity(current => current?.type === 'branch_node' ? current : { type: 'result' });
    } else if (location.pathname === '/review') {
      setSelectedEntity({ type: 'review' });
    } else if (location.pathname !== '/editor' && location.pathname !== '/results/dual') {
      setSelectedEntity({ type: 'model' });
    }
  }, [location.pathname]);

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

      <InspectorPanel model={model} setModel={setModel}
        selectedEntity={selectedEntity} setSelectedEntity={setSelectedEntity}
        result={result} integerTask={integerTask} onSaveModel={onSaveModel}
        open={inspectorOpen} onClose={() => setInspectorOpen(false)} />

      <MathConsole events={logs} open={consoleOpen}
        onToggle={() => setConsoleOpen(current => !current)}
        onNavigate={event => {
          if (event.metadata?.nodeId) setSelectedEntity({ type: 'branch_node', id: event.metadata.nodeId });
          else if (Number.isInteger(event.step)) setSelectedEntity({ type: 'tableau', source: 'primal', index: event.step });
          if (event.route) navigate(event.route);
        }} />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={selectCommand} />
    </div>
  );
}
