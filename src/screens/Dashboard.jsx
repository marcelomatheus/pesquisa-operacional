import { ArrowRight, BarChart3, FilePlus2, GitBranch, Play, Table2, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { displayNumber, SOLVE_STATUSES } from '../services/solverApi';

export function Dashboard({ model, result, integerTask, onNewModel }) {
  const navigate = useNavigate();
  const integerResult = integerTask?.state === 'success' ? integerTask.data : null;
  return <div className="home-workbench">
    <header className="home-workbench__header">
      <div>
        <span className="route-label">WORKSPACE / MODELO ATIVO</span>
        <h1>{model.name}</h1>
        <p>{model.sense === 'min' ? 'Minimização' : 'Maximização'} · {model.objective.length} variáveis · {model.constraints.length} restrições</p>
      </div>
      <div className="home-workbench__actions">
        <button className="button button--secondary" onClick={onNewModel}><FilePlus2 size={17} />Novo</button>
        <button className="button button--secondary" onClick={() => navigate('/editor')}>Editar formulação</button>
        <button className="button button--primary" onClick={() => navigate('/review')}><Play size={16} />Revisar e resolver</button>
      </div>
    </header>
    <section className="instrument-strip" aria-label="Indicadores do modelo">
      <div><span>Função objetivo</span><code>{model.sense === 'min' ? 'Min' : 'Max'} Z = {model.objective.map((value, i) => `${value}x${i + 1}`).join(' + ')}</code></div>
      <div><span>Solução contínua</span><strong>{displayNumber(result?.objective_value)}</strong><small>{result ? SOLVE_STATUSES[result.status] || result.status : 'Execute o modelo'}</small></div>
      <div><span>Solução inteira</span><strong>{displayNumber(integerResult?.objective_value)}</strong><small>{integerResult ? SOLVE_STATUSES[integerResult.status] || integerResult.status : 'Não calculada'}</small></div>
      <div><span>Tableaux</span><strong>{result?.iterations?.length ?? '—'}</strong><small>{result ? `${result.pivot_count} pivôs` : 'Aguardando solução'}</small></div>
    </section>
    <section className="home-stage">
      <article className="analysis-surface">
        <header className="surface-header"><div><span>CÁLCULO MATEMÁTICO</span><h2>Simplex tabular</h2></div><div className="surface-tabs"><button className="is-active" onClick={() => navigate('/results/simplex')}>Tableaux reais</button></div></header>
        <div style={{ padding: 28, minHeight: 260 }}>
          <Target size={29} />
          <h2 style={{ marginTop: 18 }}>{result ? (SOLVE_STATUSES[result.status] || result.status) : 'Seu laboratório de otimização'}</h2>
          <p>{result ? result.message : 'Revise o modelo e execute o algoritmo para gerar uma trilha de cálculos verificável. Nenhum resultado demonstrativo é utilizado.'}</p>
          {result?.variables && <p><strong>{Object.entries(result.variables).map(([id, value]) => `${id} = ${displayNumber(value)}`).join(' · ')}</strong></p>}
          <button className="button button--primary" style={{ marginTop: 20 }} onClick={() => navigate(result ? '/results/simplex' : '/review')}>
            {result ? 'Inspecionar iterações' : 'Iniciar resolução'} <ArrowRight size={16} />
          </button>
        </div>
        <footer className="coordinate-footer"><span><i className="swatch swatch--violet" />Resultados calculados por Python puro</span></footer>
      </article>
      <aside className="analysis-index">
        <header className="surface-header"><div><span>PRÓXIMAS LEITURAS</span><h2>Análises disponíveis</h2></div><Target size={18} /></header>
        <button onClick={() => navigate('/results/simplex')}><span className="analysis-index__code">01</span><span><strong>Simplex tabular</strong><small>Tableaux e prova algébrica</small></span><Table2 size={17} /></button>
        <button onClick={() => navigate('/results/integer')}><span className="analysis-index__code">02</span><span><strong>Branch and Bound</strong><small>Busca inteira com nós reais</small></span><GitBranch size={17} /></button>
        <button onClick={() => navigate('/results/graph')}><span className="analysis-index__code">03</span><span><strong>Plano gráfico</strong><small>Integração matemática pendente</small></span><BarChart3 size={17} /></button>
        <div className="analysis-index__note"><span>Integridade</span><p>Os resultados são invalidados automaticamente quando a formulação matemática muda.</p></div>
      </aside>
    </section>
  </div>;
}
