export const REPORT_SECTIONS = [
  { id: 'model', title: 'Formulação matemática', detail: 'Função objetivo, restrições, domínios e limites' },
  { id: 'simplex', title: 'Simplex tabular', detail: 'Solução contínua, pivoteamentos e tableaux' },
  { id: 'integer', title: 'Programação inteira', detail: 'Branch and Bound, podas e arredondamentos' },
  { id: 'geometry', title: 'Representação gráfica', detail: 'Região viável, curvas de nível e soluções em 2D' },
  { id: 'dual', title: 'Modelo dual', detail: 'Formulação, comparação de objetivos e tableaux duais' },
  { id: 'alternatives', title: 'Ótimos alternativos', detail: 'Diagnóstico e certificado de soluções distintas' },
];

export function reportOptions(sections, { maxTableaux = 30, integerMode = 'declared' } = {}) {
  const supported = new Set(REPORT_SECTIONS.map(section => section.id));
  if (!Array.isArray(sections) || sections.length === 0 ||
      sections.some(key => !supported.has(key)) || new Set(sections).size !== sections.length) {
    throw new Error('Selecione pelo menos uma seção válida do relatório.');
  }
  if (!Number.isInteger(maxTableaux) || maxTableaux < 1 || maxTableaux > 100) {
    throw new Error('Escolha um limite de 1 a 100 tableaux.');
  }
  if (!['declared', 'all_integer'].includes(integerMode)) {
    throw new Error('Modo de programação inteira inválido.');
  }
  return {
    sections: [...sections],
    max_tableaux: maxTableaux,
    max_nodes: 200,
    integer_mode: integerMode,
  };
}

export function reportFileName(name) {
  const slug = String(name || 'modelo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `pivonauta-${slug || 'modelo'}-relatorio.pdf`;
}
