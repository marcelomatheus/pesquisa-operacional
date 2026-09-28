import { ArrowRight, BookOpen, CircleHelp, Command, GitBranch, Keyboard, Play, Table2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Help() {
  const navigate = useNavigate();
  return (
    <div className="page help-page">
      <header className="page-header page-header--compact"><div><div className="eyebrow"><CircleHelp size={14} />Central de bordo</div><h1>Aprenda enquanto <span>explora.</span></h1><p>Um guia curto para apresentar o raciocínio matemático com confiança.</p></div></header>
      <section className="help-grid">
        <article className="panel help-card"><span className="help-card__icon tone-violet"><Play size={22} /></span><small>JORNADA 01</small><h2>Do modelo à solução</h2><p>Defina objetivo e restrições, revise a forma padrão e execute o algoritmo.</p><button onClick={() => navigate('/editor')}>Iniciar jornada <ArrowRight size={16} /></button></article>
        <article className="panel help-card"><span className="help-card__icon tone-cyan"><Table2 size={22} /></span><small>JORNADA 02</small><h2>Entenda o pivoteamento</h2><p>Acompanhe variável de entrada, razão mínima e eliminação de Gauss.</p><button onClick={() => navigate('/results/simplex')}>Ver demonstração <ArrowRight size={16} /></button></article>
        <article className="panel help-card"><span className="help-card__icon tone-success"><GitBranch size={22} /></span><small>JORNADA 03</small><h2>Decisões inteiras</h2><p>Compare o arredondamento com a solução certificada pelo Branch and Bound.</p><button onClick={() => navigate('/results/integer')}>Abrir análise <ArrowRight size={16} /></button></article>
      </section>
      <section className="panel shortcuts-card"><div><Keyboard size={22} /><div><span className="panel-kicker">ATALHOS</span><h2>Navegação veloz</h2></div></div><dl><div><dt><kbd>⌘</kbd><kbd>K</kbd></dt><dd>Abrir paleta de comandos</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Fechar painéis</dd></div><div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>Navegar nas iterações</dd></div></dl></section>
      <section className="concept-strip"><BookOpen size={21} /><div><strong>Glossário rápido</strong><p><b>Pivô:</b> elemento usado para trocar a base. <b>Folga:</b> recurso não utilizado. <b>Preço-sombra:</b> ganho marginal associado a uma restrição.</p></div></section>
    </div>
  );
}
