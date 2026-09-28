import { ArrowRight, BarChart3, Check, FilePlus2, GitBranch, Play, Table2, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FeasibleGraph } from '../components/FeasibleGraph';

export function Dashboard({ model, onNewModel }) {
  const navigate = useNavigate();
  const gap = Math.abs((model.integer.z - model.optimum.z) / (model.optimum.z || 1) * 100).toFixed(2);

  return (
    <div className="home-workbench">
      <header className="home-workbench__header">
        <div>
          <span className="route-label">WORKSPACE / MODELO ATIVO</span>
          <h1>{model.name}</h1>
          <p>{model.sense === 'min' ? 'Minimização' : 'Maximização'} · {model.variables.length} variáveis · {model.constraints.length} restrições</p>
        </div>
        <div className="home-workbench__actions">
          <button className="button button--secondary" onClick={onNewModel}><FilePlus2 size={17} />Novo</button>
          <button className="button button--secondary" onClick={() => navigate('/editor')}>Editar formulação</button>
          <button className="button button--primary" onClick={() => navigate('/review')}><Play size={16} fill="currentColor" />Revisar e resolver</button>
        </div>
      </header>

      <section className="instrument-strip" aria-label="Indicadores do modelo">
        <div><span>Função objetivo</span><code>{model.sense === 'min' ? 'Min' : 'Max'} Z = {model.objective[0]}x₁ + {model.objective[1]}x₂</code></div>
        <div><span>Ótimo contínuo</span><strong>{model.optimum.z}</strong><small>x = ({model.optimum.x}; {model.optimum.y})</small></div>
        <div><span>Ótimo inteiro</span><strong>{model.integer.z}</strong><small>gap {gap}%</small></div>
        <div><span>Integridade</span><strong className="status-text"><Check size={15} />viável</strong><small>forma padrão pronta</small></div>
      </section>

      <section className="home-stage">
        <article className="analysis-surface">
          <header className="surface-header">
            <div><span>GEOMETRIA DO MODELO</span><h2>Região de viabilidade</h2></div>
            <div className="surface-tabs"><button className="is-active" onClick={() => navigate('/results/graph')}>Plano x₁ × x₂</button><button onClick={() => navigate('/results/simplex')}>Tableau</button></div>
          </header>
          <div className="analysis-surface__graph"><FeasibleGraph layers={{ constraints: true, region: true, levels: true, optimum: true }} integerPoint /></div>
          <footer className="coordinate-footer"><span><i className="swatch swatch--violet" />região viável</span><span><i className="swatch swatch--cyan" />restrições</span><span><i className="swatch swatch--green" />ótimo inteiro</span><button onClick={() => navigate('/results/graph')}>Inspecionar gráfico <ArrowRight size={15} /></button></footer>
        </article>

        <aside className="analysis-index">
          <header className="surface-header"><div><span>PRÓXIMAS LEITURAS</span><h2>Análises disponíveis</h2></div><Target size={18} /></header>
          <button onClick={() => navigate('/results/simplex')}><span className="analysis-index__code">01</span><span><strong>Simplex tabular</strong><small>4 iterações · prova algébrica</small></span><Table2 size={17} /></button>
          <button onClick={() => navigate('/results/integer')}><span className="analysis-index__code">02</span><span><strong>Solução inteira</strong><small>arredondamento + Branch and Bound</small></span><GitBranch size={17} /></button>
          <button onClick={() => navigate('/results/dual')}><span className="analysis-index__code">03</span><span><strong>Modelo dual</strong><small>preços-sombra e complementaridade</small></span><BarChart3 size={17} /></button>
          <div className="analysis-index__note"><span>Leitura rápida</span><p>A solução inteira ({model.integer.x}, {model.integer.y}) altera o objetivo em apenas {gap}% em relação ao ótimo contínuo.</p></div>
        </aside>
      </section>
    </div>
  );
}
