import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { examples } from './data';
import { Dashboard } from './screens/Dashboard';
import { Editor } from './screens/Editor';
import { Help } from './screens/Help';
import { Landing } from './screens/Landing';
import { Library } from './screens/Library';
import { Review } from './screens/Review';
import { LiveInteger, LiveReport, LiveSimplex, LiveSummary } from './screens/LiveResults';
import { modelFingerprint, solveInteger, solveModel } from './services/solverApi';
import { createBlankModel, newId, normalizeModelInput, validateModelLocal } from './services/model';
import { getSavedModel, listRuns, loadDraft, rememberRun, saveModel, writeDraft } from './services/storage';
import { fromBranchBoundResult, fromLegacyLog, fromSimplexResult, mergeConsoleEvents } from './services/solverEvents';
import { AlternativesAnalysis, DualAnalysis, GeometryAnalysis } from './screens/MathAnalysis';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [model, setModel] = useState(() => normalizeModelInput(examples[0]));
  const [logs, setLogs] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState({ type: 'model' });
  const [hydrated, setHydrated] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState('');
  const [run, setRun] = useState(null);
  const [integerTask, setIntegerTask] = useState(null);
  const integerPendingRef = useRef(false);
  const fingerprint = modelFingerprint(model);
  const latestFingerprintRef = useRef(fingerprint);
  latestFingerprintRef.current = fingerprint;
  const result = run?.fingerprint === fingerprint ? run.data : null;
  const currentIntegerTask = integerTask?.fingerprint === fingerprint ? integerTask : null;

  const pushLog = useCallback((entry) => {
    setLogs(current => mergeConsoleEvents(current, [fromLegacyLog(entry)]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const stored = await loadDraft();
        if (!cancelled && stored) {
          let canonical;
          try {
            canonical = normalizeModelInput(stored, { preserveId: true });
          } catch (error) {
            // A draft may legitimately be mid-edit (empty name or conflicting bounds).
            // Restore the editable shape instead of discarding the user's work.
            if (stored.schema_version !== 1 || !Array.isArray(stored.variables)
                || !Array.isArray(stored.objective) || !Array.isArray(stored.constraints)) throw error;
            canonical = stored;
            setStorageWarning('Rascunho recuperado com campos incompletos. Corrija-os antes de resolver.');
          }
          setModel(canonical);
          const saved = await getSavedModel(canonical.id);
          if (!cancelled) setSavedSignature(saved ? JSON.stringify(normalizeModelInput(saved, { preserveId: true })) : null);
        }
        const pastRuns = await listRuns();
        if (!cancelled && pastRuns.length) {
          const previousEvents = pastRuns.slice(0, 12).flatMap(entry => {
            const info = { runId: entry.id, modelName: entry.model_snapshot?.name || 'Modelo', recordedAt: entry.recorded_at };
            return entry.method === 'branch_bound'
              ? fromBranchBoundResult(entry.result, info)
              : fromSimplexResult(entry.result, info);
          });
          setLogs(current => mergeConsoleEvents(current, previousEvents));
        }
      } catch (error) {
        if (!cancelled) setStorageWarning(error.message || 'Armazenamento local indisponível.');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = window.setTimeout(() => {
      writeDraft(model).catch(error => setStorageWarning(error.message || 'Falha ao salvar rascunho.'));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [model, hydrated]);

  const openModel = useCallback((candidate, { saved = false } = {}) => {
    const canonical = normalizeModelInput(candidate, { preserveId: true });
    setModel(canonical);
    setSavedSignature(saved ? JSON.stringify(canonical) : null);
    setRun(null);
    setIntegerTask(null);
  }, []);

  const saveCurrentModel = useCallback(async () => {
    const validation = validateModelLocal(model);
    if (!validation.valid) throw new Error(validation.errors[0]);
    await saveModel(model);
    setSavedSignature(JSON.stringify(model));
    setStorageWarning('');
    pushLog({ tone: 'success', text: 'Modelo salvo na biblioteca local', time: new Date().toLocaleTimeString('pt-BR') });
  }, [model, pushLog]);

  const createNewModel = useCallback(() => {
    openModel(createBlankModel());
    setSelectedEntity({ type: 'model' });
    pushLog({ tone: 'violet', text: 'Novo modelo criado com estrutura inicial', time: new Date().toLocaleTimeString('pt-BR') });
    navigate('/editor');
  }, [navigate, pushLog, openModel]);

  const solve = useCallback(async () => {
    if (solving) return;
    const inputFingerprint = modelFingerprint(model);
    setSolving(true);
    setSolveError('');
    pushLog({ tone: 'violet', text: 'Executando Simplex tabular com a API Python', time: 'agora' });
    try {
      const calculated = await solveModel(model);
      if (latestFingerprintRef.current !== inputFingerprint) return;
      const executionId = newId('run');
      const recordedAt = new Date().toISOString();
      setRun({ fingerprint: inputFingerprint, data: calculated });
      setLogs(current => mergeConsoleEvents(current,
        fromSimplexResult(calculated, { runId: executionId, modelName: model.name, recordedAt })));
      void rememberRun({ id: executionId, model_id: model.id,
        fingerprint: inputFingerprint, model_snapshot: model,
        method: 'simplex', status: calculated.status, result: calculated })
        .catch(error => setStorageWarning(error.message || 'Não foi possível registrar execução.'));
      setIntegerTask(null);
      pushLog({ tone: calculated.status === 'optimal' ? 'success' : 'amber',
        text: `Simplex: ${calculated.status} · ${calculated.pivot_count} pivoteamentos`, time: 'agora' });
      navigate('/results/summary');
    } catch (error) {
      if (latestFingerprintRef.current === inputFingerprint) {
        setSolveError(error.message || 'Falha ao executar Simplex');
        pushLog({ tone: 'amber', text: `Falha: ${error.message}`, time: 'agora' });
      }
    } finally {
      setSolving(false);
    }
  }, [model, solving, pushLog, navigate]);

  const calculateInteger = useCallback(async () => {
    if (!result || result.status !== 'optimal' || integerPendingRef.current) return;
    const inputFingerprint = modelFingerprint(model);
    integerPendingRef.current = true;
    setIntegerTask({ fingerprint: inputFingerprint, state: 'loading' });
    pushLog({ tone: 'violet', text: 'Iniciando Branch and Bound com Simplex próprio', time: 'agora' });
    try {
      const calculated = await solveInteger(model);
      if (latestFingerprintRef.current !== inputFingerprint) return;
      const executionId = newId('run');
      const recordedAt = new Date().toISOString();
      setIntegerTask({ fingerprint: inputFingerprint, state: 'success', data: calculated });
      setLogs(current => mergeConsoleEvents(current,
        fromBranchBoundResult(calculated, { runId: executionId, modelName: model.name, recordedAt })));
      void rememberRun({ id: executionId, model_id: model.id,
        fingerprint: inputFingerprint, model_snapshot: model,
        method: 'branch_bound', status: calculated.status, result: calculated })
        .catch(error => setStorageWarning(error.message || 'Não foi possível registrar execução.'));
      pushLog({ tone: calculated.status === 'optimal' ? 'success' : 'amber',
        text: `Branch and Bound: ${calculated.status} · ${calculated.explored_nodes} nós`, time: 'agora' });
    } catch (error) {
      if (latestFingerprintRef.current === inputFingerprint) {
        setIntegerTask({ fingerprint: inputFingerprint, state: 'error', error: error.message });
        pushLog({ tone: 'amber', text: `Falha da busca inteira: ${error.message}`, time: 'agora' });
      }
    } finally {
      integerPendingRef.current = false;
    }
  }, [model, result, pushLog]);

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
      description: 'Retorna a formulação, as restrições e as última execução real quando disponível no PivôNauta.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => ({
        id: model.id,
        name: model.name,
        sense: model.sense,
        objective: model.objective,
        constraints: model.constraints,
        continuousSolution: result,
        integerSolution: currentIntegerTask?.state === 'success' ? currentIntegerTask.data : null,
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
        openModel(normalizeModelInput({
          name: input.name, sense: input.sense, objective: input.objective,
          constraints: input.constraints.map((constraint, index) => ({
            id: `r${index + 1}`, name: constraint.name,
            coefficients: constraint.values, operator: constraint.operator, rhs: constraint.rhs,
          })),
        }));
        pushLog({ tone: 'violet', text: `Modelo “${input.name}” preparado via WebMCP`, time: 'agora' });
        navigate('/editor');
        return { status: 'staged', name: input.name, screen: 'editor' };
      },
    });

    register({
      name: 'start_model_solution',
      title: 'Iniciar solução do modelo',
      description: 'Abre a revisão e inicia a execução real do Simplex no backend para o modelo ativo.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => {
        navigate('/review');
        window.setTimeout(solve, 120);
        return { status: 'submitted', model: model.name, method: 'simplex-tabular' };
      },
    });

    return () => lifecycle.abort();
  }, [model, result, currentIntegerTask, navigate, pushLog, solve, openModel]);

  const dirty = savedSignature !== JSON.stringify(model);
  const shellProps = useMemo(() => ({
    model, setModel, logs, selectedEntity, setSelectedEntity,
    onNewModel: createNewModel, dirty, storageWarning, onSaveModel: saveCurrentModel,
    result, integerTask: currentIntegerTask,
  }), [createNewModel, model, logs, selectedEntity, dirty, storageWarning, saveCurrentModel, result, currentIntegerTask]);

  if (location.pathname === '/') {
    return <Landing onNewModel={createNewModel} />;
  }

  return (
    <AppShell {...shellProps}>
      <Routes location={location} key={location.pathname}>
        <Route path="/workspace" element={<Dashboard model={model} result={result} integerTask={currentIntegerTask} onNewModel={createNewModel} />} />
        <Route path="/library" element={<Library model={model} onOpenModel={openModel} onSaveModel={saveCurrentModel} pushLog={pushLog} />} />
        <Route path="/editor" element={<Editor model={model} setModel={setModel} pushLog={pushLog} setSelectedEntity={setSelectedEntity} />} />
        <Route path="/review" element={<Review model={model} solve={solve} solving={solving} solveError={solveError} />} />
        <Route path="/results/summary" element={<LiveSummary model={model} result={result} integerTask={currentIntegerTask} />} />
        <Route path="/results/simplex" element={<LiveSimplex result={result} setSelectedEntity={setSelectedEntity} />} />
        <Route path="/results/graph" element={<GeometryAnalysis model={model} result={result} integerTask={currentIntegerTask} onStartInteger={calculateInteger} />} />
        <Route path="/results/integer" element={<LiveInteger model={model} result={result} task={currentIntegerTask} onStart={calculateInteger} setSelectedEntity={setSelectedEntity} />} />
        <Route path="/results/dual" element={<DualAnalysis model={model} setSelectedEntity={setSelectedEntity} />} />
        <Route path="/results/analysis" element={<AlternativesAnalysis model={model} />} />
        <Route path="/results/report" element={<LiveReport model={model} result={result} integerTask={currentIntegerTask} />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
