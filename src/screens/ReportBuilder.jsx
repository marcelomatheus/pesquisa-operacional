import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, Eye, FileChartColumn,
  FileText, LoaderCircle, Settings2,
} from 'lucide-react';
import { displayNumber, generateReportPdf, SOLVE_STATUSES } from '../services/solverApi';
import { validateModelLocal } from '../services/model';
import { REPORT_SECTIONS, reportFileName, reportOptions } from '../services/reportOptions';

const DEFAULT_SECTIONS = REPORT_SECTIONS.map(section => section.id);

export function ReportBuilder({ model, result, integerTask }) {
  const navigate = useNavigate();
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [maxTableaux, setMaxTableaux] = useState(30);
  const [integerMode, setIntegerMode] = useState(
    model.variables.some(variable => variable.domain === 'integer') ? 'declared' : 'all_integer'
  );
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const previewUrlRef = useRef(null);
  const requestRef = useRef(null);
  const validation = validateModelLocal(model);
  const fingerprint = JSON.stringify({ model, sections, maxTableaux, integerMode });
  const included = useMemo(() => new Set(sections), [sections]);
  const currentInteger = integerTask?.state === 'success' ? integerTask.data : null;
  const isTwoDimensional = model.variables.length === 2;
  const selected = REPORT_SECTIONS.filter(section => included.has(section.id));

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setWorking(false);
    setMessage('');
    setPreview(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    return () => {
      requestRef.current?.abort();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [fingerprint]);

  const toggleSection = id => {
    setSections(current => current.includes(id) ? current.filter(item => item !== id)
      : REPORT_SECTIONS.filter(item => item.id === id || current.includes(item.id)).map(item => item.id));
  };

  const makePdf = async previewOnly => {
    if (!validation.valid || !sections.length) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setWorking(true);
    setMessage('');
    try {
      const options = reportOptions(sections, { maxTableaux, integerMode });
      const blob = await generateReportPdf(model, options, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (previewOnly) {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreview({ url, filename: reportFileName(model.name) });
        setMessage('Pré-visualização gerada a partir dos cálculos executados no servidor.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = reportFileName(model.name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1800);
        setMessage('PDF gerado com sucesso. O arquivo foi enviado ao navegador.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') setMessage(error.message || 'Falha ao gerar relatório.');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setWorking(false);
    }
  };

  const canGenerate = validation.valid && sections.length > 0 && !working;

  return <div className="page result-page pr7-report-page">
    <header className="result-header">
      <div className="result-header__title">
        <button className="icon-button" onClick={() => navigate('/results/summary')}
          aria-label="Voltar aos resultados"><ArrowLeft size={18} /></button>
        <div>
          <div className="eyebrow"><FileChartColumn size={15} /> DOCUMENTAÇÃO MATEMÁTICA</div>
          <h1>Relatório técnico em PDF</h1>
          <p>Monte um relatório acadêmico a partir dos algoritmos e dos dados reais do modelo ativo.</p>
        </div>
      </div>
    </header>
    <div className="pr7-report-layout">
      <section className="panel pr7-report-config">
        <div className="pr7-section-heading">
          <div><span className="panel-kicker">CONTEÚDO</span><h2>Seções do relatório</h2></div>
          <FileText size={22} />
        </div>
        <p className="pr7-help">Selecione os capítulos desejados. O servidor recalcula as análises
          escolhidas e identifica resultados que não puderem ser certificados.</p>
        <div className="pr7-section-list">
          {REPORT_SECTIONS.map(section => <label className="pr7-section-option" key={section.id}>
            <input type="checkbox" checked={included.has(section.id)}
              onChange={() => toggleSection(section.id)} />
            <span><strong>{section.title}</strong><small>{section.detail}</small></span>
            <span className="pr7-section-index">{String(REPORT_SECTIONS.indexOf(section) + 1).padStart(2, '0')}</span>
          </label>)}
        </div>
        <div className="pr7-section-heading pr7-settings-heading">
          <div><span className="panel-kicker">CONFIGURAÇÃO</span><h2>Parâmetros de exportação</h2></div>
          <Settings2 size={19} />
        </div>
        <div className="pr7-form-grid">
          <label>Tableaux por algoritmo
            <select value={maxTableaux} onChange={event => setMaxTableaux(Number(event.target.value))}>
              <option value={10}>Até 10</option>
              <option value={30}>Até 30</option>
              <option value={60}>Até 60</option>
              <option value={100}>Até 100</option>
            </select>
            <small>Se houver mais tableaux, o PDF apresenta uma seleção representativa e informa o total.</small>
          </label>
          <label>Modelo para a solução inteira
            <select value={integerMode} onChange={event => setIntegerMode(event.target.value)}>
              <option value="declared">Respeitar domínios declarados</option>
              <option value="all_integer">Considerar todas as variáveis inteiras</option>
            </select>
            <small>A conversão integral altera apenas o cenário de cálculo, não o modelo salvo.</small>
          </label>
        </div>
        {!isTwoDimensional && included.has('geometry') && <p className="pr7-notice">
          <AlertCircle size={16} /> Seu modelo tem {model.variables.length} variáveis.
          O PDF registrará que o gráfico bidimensional não se aplica, sem inventar uma figura.
        </p>}
        {included.has('integer') && integerMode === 'declared' &&
          !model.variables.some(variable => variable.domain === 'integer') && <p className="pr7-notice">
            <AlertCircle size={16} /> Não há variáveis inteiras declaradas. A seção registrará
            a indisponibilidade; use o modo integral para calcular uma versão inteiramente discreta.
          </p>}
        {!validation.valid && <p className="pr7-notice" role="alert">
          <AlertCircle size={16} /> {validation.errors[0]}
        </p>}
        <div className="pr7-report-actions">
          <button className="button button--secondary" disabled={!canGenerate}
            onClick={() => void makePdf(true)}>
            {working ? <LoaderCircle size={17} className="pr7-spin" /> : <Eye size={17} />}
            Visualizar PDF
          </button>
          <button className="button button--primary" disabled={!canGenerate}
            onClick={() => void makePdf(false)}>
            {working ? <LoaderCircle size={17} className="pr7-spin" /> : <Download size={17} />}
            {working ? 'Gerando relatório…' : 'Exportar PDF'}
          </button>
        </div>
        {message && <p className="pr7-report-message" role="status">{message}</p>}
      </section>
      <aside className="pr7-report-sidebar">
        <section className="panel pr7-report-summary">
          <span className="panel-kicker">MODELO ATIVO</span>
          <h2>{model.name}</h2>
          <div><span>Variáveis</span><strong>{model.variables.length}</strong></div>
          <div><span>Restrições</span><strong>{model.constraints.length}</strong></div>
          <div><span>Objetivo</span><strong>{model.sense === 'min' ? 'Minimização' : 'Maximização'}</strong></div>
          <div><span>Seções selecionadas</span><strong>{sections.length}</strong></div>
          <hr/>
          <div><span>Simplex anterior</span><strong>{result ? SOLVE_STATUSES[result.status] || result.status : 'Não executado'}</strong></div>
          {result && <div><span>Z contínuo anterior</span><strong>{displayNumber(result.objective_value)}</strong></div>}
          {currentInteger && <div><span>Inteiro anterior</span><strong>{displayNumber(currentInteger.objective_value)}</strong></div>}
          <p><CheckCircle2 size={14} /> O relatório não confia em números recebidos do frontend:
            as análises são executadas novamente na API.</p>
        </section>
        <section className="panel pr7-report-preview">
          <span className="panel-kicker">ESTRUTURA DO DOCUMENTO</span>
          <h3>Conteúdo selecionado</h3>
          <ol>{selected.map(section => <li key={section.id}>{section.title}</li>)}</ol>
          {!selected.length && <p>Selecione ao menos uma seção.</p>}
          <small>Páginas numeradas, tabelas legíveis, gráficos vetoriais e avisos de certificação.</small>
        </section>
      </aside>
    </div>
    {preview && <section className="panel pr7-preview-panel">
      <div className="pr7-preview-header">
        <div><span className="panel-kicker">PRÉ-VISUALIZAÇÃO</span><h2>{preview.filename}</h2></div>
        <button className="button button--secondary" onClick={() => {
          window.open(preview.url, '_blank', 'noopener,noreferrer');
        }}>Abrir em nova aba</button>
      </div>
      <iframe src={preview.url} title="Pré-visualização do relatório PivôNauta" />
    </section>}
  </div>;
}
