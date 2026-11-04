/** Small, explicit grammar for linear objective functions and constraints. No eval. */
import { normalizeModelInput, MAX_VARIABLES, MAX_CONSTRAINTS } from './model.js';

const subscripts = '₀₁₂₃₄₅₆₇₈₉';
function ascii(text) {
  return text.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subscripts.indexOf(c))
    .replace(/x_(\d+)/gi, 'x$1').replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[−–]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=');
}
function numberLiteral(text, label) {
  const token = text.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
    throw new Error(`${label}: o lado direito deve ser um número finito.`);
  }
  const value = Number(token);
  if (!Number.isFinite(value)) throw new Error(`${label}: coeficiente fora do intervalo numérico.`);
  return value;
}

/** Parse linear expression (constant plus coefficients), consuming all tokens. */
export function parseLinearExpression(source, lineNumber) {
  const expression = ascii(source).replace(/\s+/g, '');
  if (!expression) throw new Error(`Linha ${lineNumber}: expressão vazia.`);
  const tokens = expression.replace(/-/g, '+-').split('+').filter(Boolean);
  const coefficientByIndex = new Map();
  let constant = 0;
  for (const term of tokens) {
    const variable = /^(-?)(?:(\d+(?:\.\d*)?|\.\d+)(?:\*)?)?x(\d+)$/i.exec(term);
    if (variable) {
      const index = Number(variable[3]);
      if (!Number.isInteger(index) || index < 1 || index > MAX_VARIABLES) {
        throw new Error(`Linha ${lineNumber}: use variáveis de x1 a x10.`);
      }
      const magnitude = variable[2] ? Number(variable[2]) : 1;
      const factor = (variable[1] ? -1 : 1) * magnitude;
      coefficientByIndex.set(index, (coefficientByIndex.get(index) || 0) + factor);
    } else if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(term)) {
      constant += Number(term);
    } else {
      throw new Error(`Linha ${lineNumber}: termo inválido "${term}". Use expressões lineares como 2x1 - 3x2.`);
    }
  }
  return { coefficientByIndex, constant };
}

/** Parse objective followed by zero or more linear constraints. */
export function parseAlgebraic(source, { previous = null } = {}) {
  const lines = source.split(/\r?\n/).map((text, i) => ({ text: text.trim(), line: i + 1 }))
    .filter(({ text }) => text && !text.startsWith('#') && !/^sujeito\s+a\s*:?$/i.test(text));
  if (!lines.length) throw new Error('Informe uma função objetivo e suas restrições.');
  const first = lines[0];
  const objectiveMatch = /^(max(?:imizar|imize)?|min(?:imizar|imize)?)\s*(?:z\s*=\s*)?(.+)$/i.exec(ascii(first.text));
  if (!objectiveMatch) throw new Error(`Linha ${first.line}: comece com "Max Z = ..." ou "Min Z = ...".`);
  const sense = /^max/i.test(objectiveMatch[1]) ? 'max' : 'min';
  const obj = parseLinearExpression(objectiveMatch[2], first.line);
  if (obj.constant !== 0) throw new Error(`Linha ${first.line}: a função objetivo não pode conter constante independente nesta versão.`);
  const rows = [];
  let highest = Math.max(0, ...obj.coefficientByIndex.keys());
  for (const { text, line } of lines.slice(1)) {
    const normal = ascii(text).replace(/^(?:r\d+\s*:\s*)/i, '');
    const match = /^(.*?)\s*(<=|>=|=)\s*(.*?)$/.exec(normal);
    if (!match || !match[1].trim() || !match[3].trim()) {
      throw new Error(`Linha ${line}: use uma restrição como "x1 + 2x2 <= 8".`);
    }
    const lhs = parseLinearExpression(match[1], line);
    const rhs = numberLiteral(match[3], `Linha ${line}`) - lhs.constant;
    highest = Math.max(highest, ...lhs.coefficientByIndex.keys());
    rows.push({ coeff: lhs.coefficientByIndex, rhs, operator: { '<=': 'le', '>=': 'ge', '=': 'eq' }[match[2]] });
  }
  if (!highest) throw new Error('Inclua pelo menos uma variável x1, x2, … x10.');
  if (rows.length > MAX_CONSTRAINTS) throw new Error('Limite de 30 restrições excedido.');
  const variables = Array.from({ length: highest }, (_, i) => {
    const id = `x${i + 1}`;
    return previous?.variables?.find(v => v.id === id) || { id, domain: 'continuous', lower_bound: 0, upper_bound: null };
  });
  return normalizeModelInput({
    name: previous?.name || 'Modelo algébrico', sense, variables,
    objective: Array.from({ length: highest }, (_, i) => obj.coefficientByIndex.get(i + 1) || 0),
    constraints: rows.map((r, i) => ({
      id: previous?.constraints?.[i]?.id || `r${i + 1}`,
      name: previous?.constraints?.[i]?.name || `Restrição ${i + 1}`,
      coefficients: Array.from({ length: highest }, (_, j) => r.coeff.get(j + 1) || 0),
      operator: r.operator, rhs: r.rhs,
    })),
  }, { preserveId: false });
}

function term(value, id, isFirst) {
  if (!value) return '';
  const prefix = value < 0 ? (isFirst ? '-' : ' - ') : (isFirst ? '' : ' + ');
  const magnitude = Math.abs(value);
  return `${prefix}${magnitude === 1 ? '' : String(magnitude)}${id}`;
}
function expression(coefficients, variables) {
  let out = '';
  coefficients.forEach((v, i) => { if (v) out += term(v, variables[i].id, !out); });
  return out || '0';
}
export function formatAlgebraic(model) {
  const header = `${model.sense === 'max' ? 'Max' : 'Min'} Z = ${expression(model.objective, model.variables)}`;
  return [header, 'Sujeito a:', ...model.constraints.map(c =>
    `${expression(c.coefficients, model.variables)} ${ { le: '<=', ge: '>=', eq: '=' }[c.operator] } ${c.rhs}`)].join('\n');
}
