export const examples = [
  {
    id: 'radioterapia',
    name: 'Planejamento radioterápico',
    eyebrow: 'Caso principal',
    description: 'Minimiza a exposição total enquanto preserva as doses mínimas do tratamento.',
    sense: 'min',
    variables: ['x₁', 'x₂'],
    objective: [0.4, 0.5],
    constraints: [
      { id: 'r1', name: 'Tecido saudável', values: [0.3, 0.1], operator: '≤', rhs: 2.7 },
      { id: 'r2', name: 'Região crítica', values: [0.5, 0.5], operator: '=', rhs: 6 },
      { id: 'r3', name: 'Volume tumoral', values: [0.6, 0.4], operator: '≥', rhs: 6 },
    ],
    optimum: { x: 7.5, y: 4.5, z: 5.25 },
    integer: { x: 7, y: 5, z: 5.3 },
    accent: 'violet',
  },
  {
    id: 'wyndor',
    name: 'Wyndor Glass Co.',
    eyebrow: 'Exemplo clássico',
    description: 'Maximiza o lucro de portas e janelas respeitando a capacidade de três fábricas.',
    sense: 'max',
    variables: ['x₁', 'x₂'],
    objective: [3, 5],
    constraints: [
      { id: 'w1', name: 'Fábrica 1', values: [1, 0], operator: '≤', rhs: 4 },
      { id: 'w2', name: 'Fábrica 2', values: [0, 2], operator: '≤', rhs: 12 },
      { id: 'w3', name: 'Fábrica 3', values: [3, 2], operator: '≤', rhs: 18 },
    ],
    optimum: { x: 2, y: 6, z: 36 },
    integer: { x: 2, y: 6, z: 36 },
    accent: 'cyan',
  },
  {
    id: 'multiplas',
    name: 'Ótimos alternativos',
    eyebrow: 'Caso especial',
    description: 'Demonstra múltiplas soluções ótimas em uma mesma aresta da região viável.',
    sense: 'max',
    variables: ['x₁', 'x₂'],
    objective: [1, 1],
    constraints: [
      { id: 'm1', name: 'Recurso combinado', values: [1, 1], operator: '≤', rhs: 4 },
      { id: 'm2', name: 'Limite de x₁', values: [1, 0], operator: '≤', rhs: 3 },
      { id: 'm3', name: 'Limite de x₂', values: [0, 1], operator: '≤', rhs: 3 },
    ],
    optimum: { x: 2, y: 2, z: 4 },
    integer: { x: 2, y: 2, z: 4 },
    accent: 'amber',
  },
];

export const simplexIterations = [
  {
    id: 0,
    title: 'Tableau inicial',
    entering: 'x₁',
    leaving: 'a₂',
    pivot: [1, 0],
    columns: ['Base', 'x₁', 'x₂', 'f₁', 'a₂', 'e₃', 'a₃', 'b'],
    rows: [
      ['f₁', '0.30', '0.10', '1', '0', '0', '0', '2.70'],
      ['a₂', '0.50', '0.50', '0', '1', '0', '0', '6.00'],
      ['a₃', '0.60', '0.40', '0', '0', '-1', '1', '6.00'],
      ['−M', '−0.70M', '−0.90M', '0', '0', 'M', '0', '−12M'],
    ],
    note: 'As variáveis artificiais entram na base para formar a solução inicial do método M-grande.',
  },
  {
    id: 1,
    title: 'Iteração 01',
    entering: 'x₂',
    leaving: 'a₃',
    pivot: [2, 1],
    columns: ['Base', 'x₁', 'x₂', 'f₁', 'a₂', 'e₃', 'a₃', 'b'],
    rows: [
      ['f₁', '0.00', '−0.20', '1', '−0.60', '0', '0', '−0.90'],
      ['x₁', '1.00', '1.00', '0', '2.00', '0', '0', '12.00'],
      ['a₃', '0.00', '−0.20', '0', '−1.20', '−1', '1', '−1.20'],
      ['Z', '0.00', '−0.20', '0', '0.80', '0', '0', '4.80'],
    ],
    note: 'x₁ entra na base. A coluna pivô e a linha de saída são realçadas para tornar a transformação auditável.',
  },
  {
    id: 2,
    title: 'Iteração 02',
    entering: 'f₁',
    leaving: 'a₂',
    pivot: [1, 2],
    columns: ['Base', 'x₁', 'x₂', 'f₁', 'a₂', 'e₃', 'a₃', 'b'],
    rows: [
      ['f₁', '0.00', '1.00', '1', '−1.00', '0', '0', '4.50'],
      ['a₂', '1.00', '0.00', '−1', '3.00', '0', '0', '7.50'],
      ['e₃', '0.00', '0.00', '−0.50', '0.50', '1', '−1', '0.30'],
      ['Z', '0.00', '0.00', '0.20', '0.60', '0', '0', '5.25'],
    ],
    note: 'A solução já satisfaz as condições de otimalidade; resta retirar a variável artificial da base.',
  },
  {
    id: 3,
    title: 'Tableau ótimo',
    entering: '—',
    leaving: '—',
    pivot: null,
    columns: ['Base', 'x₁', 'x₂', 'f₁', 'a₂', 'e₃', 'a₃', 'b'],
    rows: [
      ['x₂', '0.00', '1.00', '1', '−1.00', '0', '0', '4.50'],
      ['x₁', '1.00', '0.00', '−1', '3.00', '0', '0', '7.50'],
      ['e₃', '0.00', '0.00', '−0.50', '0.50', '1', '−1', '0.30'],
      ['Z', '0.00', '0.00', '0.20', '0.60', '0', '0', '5.25'],
    ],
    note: 'Ótimo contínuo encontrado: x₁ = 7,5; x₂ = 4,5; Z = 5,25.',
  },
];

export const activitySeed = [
  { tone: 'success', text: 'Modelo validado sem inconsistências', time: 'agora' },
  { tone: 'violet', text: '4 tableaus preparados para reprodução', time: 'agora' },
  { tone: 'cyan', text: 'Região viável construída em 2 dimensões', time: 'agora' },
];

export const diagnosticCases = [
  { title: 'Ótimos múltiplos', status: 'Detectado', tone: 'amber', text: 'O custo reduzido de x₂ é zero fora da base. A aresta destacada contém infinitas soluções ótimas.' },
  { title: 'Degenerescência', status: 'Monitorado', tone: 'violet', text: 'Há variável básica nula na iteração 02. A regra de Bland evita ciclagem durante a demonstração.' },
  { title: 'Ilimitado', status: 'Não encontrado', tone: 'success', text: 'Toda variável candidata possui coeficiente positivo em ao menos uma restrição ativa.' },
  { title: 'Inviável', status: 'Não encontrado', tone: 'success', text: 'As variáveis artificiais deixam a base com valor zero ao final da fase de viabilidade.' },
];
