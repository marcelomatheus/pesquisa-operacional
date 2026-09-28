import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  Binary,
  Braces,
  Check,
  GitBranch,
  MoveUpRight,
  Play,
  Table2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';

const capabilities = [
  {
    index: '01',
    icon: Table2,
    title: 'Simplex auditável',
    text: 'Acompanhe cada tableau, a escolha do pivô e a troca de base até o certificado de otimalidade.',
    meta: 'FORMA TABULAR',
  },
  {
    index: '02',
    icon: GitBranch,
    title: 'Decisões inteiras',
    text: 'Compare o arredondamento testado com a solução inteira ótima obtida por Branch and Bound.',
    meta: 'INTEIRO + GAP',
  },
  {
    index: '03',
    icon: Braces,
    title: 'Leitura primal e dual',
    text: 'Interprete preços-sombra, complementaridade e a relação entre as duas formulações.',
    meta: 'ANÁLISE DUAL',
  },
  {
    index: '04',
    icon: Binary,
    title: 'Casos especiais',
    text: 'Identifique ótimos múltiplos, degenerescência, inviabilidade e modelos ilimitados.',
    meta: 'DIAGNÓSTICO',
  },
];

const team = [
  {
    number: '01',
    name: 'Integrante 01',
    role: 'Produto e Front-end',
    scope: 'Wireframes, design system, editor do modelo, navegação e integração visual.',
  },
  {
    number: '02',
    name: 'Integrante 02',
    role: 'Simplex e Dual',
    scope: 'Normalização, duas fases, tableaux, modelo dual, dual simplex e testes matemáticos.',
  },
  {
    number: '03',
    name: 'Integrante 03',
    role: 'Gráficos e Inteiros',
    scope: 'Região viável, curvas de nível, pontos inteiros, arredondamento e Branch and Bound.',
  },
  {
    number: '04',
    name: 'Integrante 04',
    role: 'API, Qualidade e Documentação',
    scope: 'Contratos da API, integração, testes do fluxo, relatório, evidências e apresentação.',
  },
];

const tableauCells = ['BASE', 'x₁', 'x₂', 'f₁', 'a₂', 'e₃', 'b', 'PIVÔ 0.50', 'x₁ ENTRA', 'a₂ SAI'];

function SimplexObservatory() {
  return (
    <div className="landing-observatory" aria-label="Visualização animada de uma região de viabilidade">
      <div className="observatory-topline">
        <span>PLANO x₁ × x₂</span>
        <span className="observatory-live"><i />CÁLCULO EM CURSO</span>
      </div>

      <div className="observatory-stage">
        <svg viewBox="0 0 640 470" role="img" aria-label="Restrições, região viável, curvas de nível e ponto ótimo">
          <defs>
            <pattern id="landing-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect className="observatory-grid" x="45" y="25" width="550" height="390" fill="url(#landing-grid)" />
          <line className="observatory-axis" x1="76" y1="390" x2="584" y2="390" />
          <line className="observatory-axis" x1="76" y1="390" x2="76" y2="48" />
          <text className="observatory-axis-label" x="574" y="414">x₁</text>
          <text className="observatory-axis-label" x="54" y="58">x₂</text>

          <g className="observatory-levels">
            <line x1="72" y1="332" x2="278" y2="76" />
            <line x1="145" y1="390" x2="398" y2="76" />
            <line x1="267" y1="390" x2="520" y2="76" />
            <line x1="389" y1="390" x2="590" y2="140" />
          </g>

          <polygon className="observatory-region" points="76,390 76,269 231,130 432,204 510,390" />
          <g className="observatory-constraints">
            <line x1="76" y1="269" x2="432" y2="204" />
            <line x1="231" y1="130" x2="510" y2="390" />
            <line x1="76" y1="390" x2="231" y2="130" />
          </g>

          <g className="observatory-point" transform="translate(432 204)">
            <circle className="observatory-point__wave" r="24" />
            <circle className="observatory-point__core" r="7" />
          </g>
          <line className="observatory-guide" x1="432" y1="204" x2="432" y2="390" />
          <line className="observatory-guide" x1="76" y1="204" x2="432" y2="204" />
        </svg>

        <motion.div
          className="observatory-readout observatory-readout--objective"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span>FUNÇÃO OBJETIVO</span>
          <strong>Min Z = 0.4x₁ + 0.5x₂</strong>
        </motion.div>
        <motion.div
          className="observatory-readout observatory-readout--optimum"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut', delay: -2 }}
        >
          <span>ÓTIMO CERTIFICADO</span>
          <strong>x* = (7.5; 4.5)</strong>
          <small>Z = 5.25</small>
        </motion.div>
        <div className="observatory-scan" aria-hidden="true" />
      </div>

      <div className="observatory-status">
        <span><i className="status-violet" />região viável</span>
        <span><i className="status-cyan" />restrições</span>
        <span><i className="status-green" />solução ótima</span>
        <code>iteração 04 / 04</code>
      </div>
    </div>
  );
}

function TableauStream() {
  return (
    <div className="tableau-stream" aria-hidden="true">
      <div className="tableau-stream__track">
        {[0, 1].map((copy) => (
          <div className="tableau-stream__set" key={copy}>
            {tableauCells.map((cell, index) => <span className={index === 7 ? 'is-pivot' : ''} key={`${copy}-${cell}`}>{cell}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Landing({ onNewModel }) {
  const navigate = useNavigate();
  const openWorkspace = () => navigate('/workspace');
  const scrollTop = () => document.querySelector('.landing-page')?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="landing-page">
      <header className="landing-header">
        <button className="landing-brand" onClick={scrollTop} aria-label="Voltar ao início"><Logo /></button>
        <nav aria-label="Navegação da página inicial">
          <button onClick={() => scrollToSection('recursos')}>Recursos</button>
          <button onClick={() => scrollToSection('metodo')}>Método</button>
          <button onClick={() => scrollToSection('equipe')}>Equipe</button>
        </nav>
        <button className="landing-header__action" onClick={openWorkspace}>Abrir laboratório <ArrowRight size={15} /></button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <motion.span className="landing-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
              PESQUISA OPERACIONAL · SIMPLEX STUDIO
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .08 }}>
              Do modelo à prova ótima, <em>sem perder o fio.</em>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .16 }}>
              O PivôNauta transforma problemas de Programação Linear em uma investigação visual completa: formulação, Simplex tabular, região viável, solução inteira e análise dual em um único fluxo auditável.
            </motion.p>
            <motion.div className="landing-hero__actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .24 }}>
              <button className="landing-button landing-button--primary" onClick={openWorkspace}><Play size={16} fill="currentColor" />Explorar o sistema</button>
              <button className="landing-button landing-button--quiet" onClick={onNewModel}>Criar um modelo <ArrowDownRight size={16} /></button>
            </motion.div>
            <div className="landing-proofline">
              <span><Check size={14} />Ótimo contínuo</span>
              <span><Check size={14} />Solução inteira</span>
              <span><Check size={14} />Primal e dual</span>
            </div>
          </div>
          <motion.div className="landing-hero__visual" initial={{ opacity: 0, scale: .975 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8, delay: .12 }}>
            <SimplexObservatory />
          </motion.div>
        </section>

        <TableauStream />

        <section className="landing-section landing-capabilities" id="recursos">
          <div className="landing-section__intro">
            <span className="landing-kicker">UM PROBLEMA, VÁRIAS LEITURAS</span>
            <h2>Mais do que encontrar uma resposta: entender por que ela é ótima.</h2>
          </div>
          <div className="capability-index">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <article className="capability-row" key={item.index}>
                  <span className="capability-row__number">{item.index}</span>
                  <Icon size={20} strokeWidth={1.6} />
                  <div><h3>{item.title}</h3><p>{item.text}</p></div>
                  <code>{item.meta}</code>
                  <MoveUpRight size={17} />
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-method" id="metodo">
          <div className="landing-method__sticky">
            <span className="landing-kicker">JORNADA DE ANÁLISE</span>
            <h2>Da linguagem do problema à decisão.</h2>
            <p>Cada etapa preserva o raciocínio anterior. O resultado gráfico e o algébrico convergem para a mesma conclusão.</p>
            <button className="landing-text-action" onClick={openWorkspace}>Ver um modelo resolvido <ArrowRight size={16} /></button>
          </div>
          <ol className="method-sequence">
            <li><span>01</span><div><small>MODELAR</small><h3>Defina decisões, objetivo e limites.</h3><p>O editor organiza coeficientes, sinais e domínios sem esconder a formulação matemática.</p></div></li>
            <li><span>02</span><div><small>VALIDAR</small><h3>Transforme e confira a forma padrão.</h3><p>Folgas, excessos e variáveis artificiais ficam explícitos antes da execução.</p></div></li>
            <li><span>03</span><div><small>PIVOTEAR</small><h3>Reproduza cada decisão do Simplex.</h3><p>Coluna de entrada, linha de saída e operações elementares permanecem auditáveis.</p></div></li>
            <li><span>04</span><div><small>INTERPRETAR</small><h3>Compare o contínuo, o inteiro e o dual.</h3><p>Gráficos, diagnósticos e relatórios convertem o cálculo em uma decisão explicável.</p></div></li>
          </ol>
        </section>

        <section className="landing-section landing-team" id="equipe">
          <div className="landing-section__intro landing-section__intro--team">
            <span className="landing-kicker">EQUIPE PIVÔNAUTA</span>
            <h2>Quatro frentes, uma única trajetória de produto.</h2>
            <p>A evolução ocorre em paralelo: experiência, matemática, visualização e qualidade avançam como partes do mesmo sistema.</p>
          </div>
          <div className="team-roster">
            {team.map((member) => (
              <article className="team-row" key={member.number}>
                <span>{member.number}</span>
                <div><small>MEMBRO DA EQUIPE</small><h3>{member.name}</h3></div>
                <strong>{member.role}</strong>
                <p>{member.scope}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <div><span className="landing-kicker">PRONTO PARA PIVOTEAR?</span><h2>Construa, resolva e explique seu próximo modelo.</h2></div>
          <button className="landing-button landing-button--primary" onClick={openWorkspace}>Entrar no PivôNauta <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer className="landing-footer"><Logo /><p>Laboratório visual de Programação Linear · Pesquisa Operacional · 2026</p><button onClick={scrollTop}>Voltar ao topo <ArrowRight size={14} /></button></footer>
    </div>
  );
}
