import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { activitySeed, examples } from './data';
import { Dashboard } from './screens/Dashboard';
import { Editor } from './screens/Editor';
import { Help } from './screens/Help';
import { Library } from './screens/Library';
import { Landing } from './screens/Landing';
import { Review } from './screens/Review';
import {
  AnalysisResult,
  DualResult,
  GraphResult,
  IntegerResult,
  ReportResult,
  SimplexResult,
  SummaryResult,
} from './screens/Results';

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model));
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [model, setModel] = useState(() => cloneModel(examples[0]));
  const [logs, setLogs] = useState(activitySeed);
  const [selectedEntity, setSelectedEntity] = useState('Modelo matemático');
  const [solving, setSolving] = useState(false);

  const pushLog = useCallback((entry) => {
    setLogs((current) => [entry, ...current].slice(0, 8));
  }, []);

  const createNewModel = useCallback(() => {
    const starter = cloneModel(examples[0]);
    setModel({
      ...starter,
      id: `draft-${Date.now()}`,
      name: 'Modelo sem título',
      sense: 'max',
      objective: [1, 1],
      constraints: [
        { id: 'draft-r1', name: 'Limite combinado', values: [1, 1], operator: '≤', rhs: 10 },
        { id: 'draft-r2', name: 'Capacidade de x₁', values: [1, 0], operator: '≤', rhs: 8 },
      ],
      domain: 'continuous',
    });
    setSelectedEntity('Modelo matemático');
    pushLog({ tone: 'violet', text: 'Novo modelo criado com estrutura inicial', time: 'agora' });
    navigate('/editor');
  }, [navigate, pushLog]);

  const solve = useCallback(() => {
    if (solving) return;
    setSolving(true);
    pushLog({ tone: 'amber', text: 'Inicializando forma padrão e variáveis auxiliares', time: 'agora' });
    window.setTimeout(() => pushLog({ tone: 'violet', text: 'Pivoteamento concluído em 4 tableaus', time: 'agora' }), 650);
    window.setTimeout(() => pushLog({ tone: 'success', text: `Ótimo global certificado: Z = ${model.optimum.z}`, time: 'agora' }), 1250);
    window.setTimeout(() => {
      setSolving(false);
      navigate('/results/summary');
    }, 1750);
  }, [model.optimum.z, navigate, pushLog, solving]);

  useEffect(() => {
    const context = typeof document === 'undefined' ? undefined : document.modelContext;
    if (!context?.registerTool) return undefined;
    const lifecycle = new AbortController();
    const register = (tool) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      } catch {
        // WebMCP is progressive enhancement; the visual interface remains fully functional.
      }
    };

    register({
      name: 'read_active_linear_model',
      title: 'Ler modelo linear ativo',
      description: 'Retorna a formulação, as restrições e as soluções demonstrativas atualmente visíveis no PivôNauta.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => ({
        id: model.id,
        name: model.name,
        sense: model.sense,
        objective: model.objective,
        constraints: model.constraints,
        continuousOptimum: model.optimum,
        integerOptimum: model.integer,
      }),
    });

    register({
      name: 'stage_linear_model',
      title: 'Preparar modelo linear',
      description: 'Atualiza o editor visual com uma função objetivo de duas variáveis e uma lista de restrições.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          sense: { type: 'string', enum: ['min', 'max'] },
          objective: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          constraints: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                values: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                operator: { type: 'string', enum: ['≤', '=', '≥'] },
                rhs: { type: 'number' },
              },
              required: ['name', 'values', 'operator', 'rhs'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'sense', 'objective', 'constraints'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        if (!input || !Array.isArray(input.objective) || !Array.isArray(input.constraints)) throw new Error('Formulação inválida.');
        setModel((current) => ({
          ...current,
          id: 'custom',
          name: input.name,
          sense: input.sense,
          objective: input.objective,
          constraints: input.constraints.map((constraint, index) => ({ ...constraint, id: `custom-${index + 1}` })),
        }));
        pushLog({ tone: 'violet', text: `Modelo “${input.name}” preparado via WebMCP`, time: 'agora' });
        navigate('/editor');
        return { status: 'staged', name: input.name, screen: 'editor' };
      },
    });

    register({
      name: 'start_model_solution',
      title: 'Iniciar solução do modelo',
      description: 'Abre a revisão e inicia a execução demonstrativa do Simplex para o modelo ativo.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => {
        navigate('/review');
        window.setTimeout(solve, 120);
        return { status: 'started', model: model.name, method: 'simplex-tabular' };
      },
    });

    return () => lifecycle.abort();
  }, [model, navigate, pushLog, solve]);

  const shellProps = useMemo(() => ({ model, setModel, logs, selectedEntity, setSelectedEntity, onNewModel: createNewModel }), [createNewModel, model, logs, selectedEntity]);

  if (location.pathname === '/') {
    return <Landing onNewModel={createNewModel} />;
  }

  return (
    <AppShell {...shellProps}>
      <Routes location={location} key={location.pathname}>
        <Route path="/workspace" element={<Dashboard model={model} onNewModel={createNewModel} />} />
        <Route path="/library" element={<Library model={model} setModel={setModel} pushLog={pushLog} />} />
        <Route path="/editor" element={<Editor model={model} setModel={setModel} pushLog={pushLog} setSelectedEntity={setSelectedEntity} />} />
        <Route path="/review" element={<Review model={model} solve={solve} solving={solving} />} />
        <Route path="/results/summary" element={<SummaryResult model={model} />} />
        <Route path="/results/simplex" element={<SimplexResult />} />
        <Route path="/results/graph" element={<GraphResult />} />
        <Route path="/results/integer" element={<IntegerResult model={model} />} />
        <Route path="/results/dual" element={<DualResult />} />
        <Route path="/results/analysis" element={<AnalysisResult />} />
        <Route path="/results/report" element={<ReportResult model={model} />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
