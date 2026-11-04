import { useEffect, useState } from 'react';
import { fetchStandardForm, displayNumber, modelFingerprint } from '../services/solverApi';

export function StandardFormPreview({ model }) {
  const fingerprint = modelFingerprint(model);
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: '' });
    fetchStandardForm(model, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ status: 'success', data, error: '' }); })
      .catch(error => { if (!controller.signal.aborted && error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }); });
    return () => controller.abort();
  }, [fingerprint, attempt]);
  if (state.status === 'loading') return <div className="standard-preview" role="status">Calculando a transformação para a forma padrão…</div>;
  if (state.status === 'error') return <div className="standard-preview" role="alert"><p>{state.error}</p><button className="button button--secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>;
  const data = state.data;
  return <section className="standard-preview pr5-standard-form">
    <div className="pr5-standard-head"><div><small>FORMA PADRÃO CALCULADA</small><h3>Maximizar em variáveis não negativas</h3></div><span>{data.phase_one_required ? 'Fase I necessária' : 'Base inicial viável'}</span></div>
    <div className="pr5-standard-metrics"><span>Sentido original: {data.original_sense}</span><span>Constante da transformação: {displayNumber(data.original_objective_offset)}</span><span>Artificiais: {data.artificial_columns.join(', ') || 'nenhuma'}</span></div>
    <p><strong>Objetivo interno:</strong> Max W = {data.objective.map((c, i) => `${displayNumber(c)}·${data.columns[i]}`).join(' + ')}{data.objective_offset ? ` + (${displayNumber(data.objective_offset)})` : ''}</p>
    <div className="tableau-scroll"><table className="tableau"><thead><tr><th>Origem</th><th>Base</th>{data.columns.map((col, index) => <th key={`${col}-${index}`}>{col}</th>)}<th>RHS</th></tr></thead>
      <tbody>{data.rows.map((row, index) => <tr key={`${row.source.id}-${index}`}><th>{row.source.name}</th><th>{row.basic}</th>{row.coefficients.map((value, j) => <td key={j}>{displayNumber(value, 5)}</td>)}<td>{displayNumber(row.rhs, 5)}</td></tr>)}</tbody>
    </table></div>
    <h4>Reconstrução das variáveis originais</h4>
    <div className="pr5-reconstruction">{data.variable_reconstruction.map(variable => <code key={variable.variable}>{variable.variable} = {displayNumber(variable.constant)} {variable.terms.map(term => `${term.factor < 0 ? '−' : '+'} ${displayNumber(Math.abs(term.factor))}·${term.column}`).join(' ')}</code>)}</div>
    <p>A formulação exibida representa a transformação real aplicada pelo Simplex, incluindo mudanças de sinal e variáveis auxiliares. Os tableaux finais são apresentados na execução.</p>
  </section>;
}
