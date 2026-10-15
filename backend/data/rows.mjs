/** Read every authorized page. Never return a successful partial financial list. */
export async function allRows(dataApi, query, jwt, { pageSize = 1000, maxRows = 100000 } = {}) {
  const result = [];
  const seen = new Set();
  let expectedTotal;
  for (let offset = 0; offset <= maxRows;) {
    const response = await dataApi(`${query}&limit=${pageSize}&offset=${offset}`, {
      method: 'GET', headers: { Prefer: 'count=exact' }
    }, jwt);
    if (!response.ok) throw Object.assign(new Error('Não foi possível carregar todos os registros.'), { status: response.status });
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Lista financeira inválida.');
    const range = response.headers.get('content-range');
    const match = range && /^(?:(\d+)-(\d+)|\*)\/(\d+|\*)$/.exec(range);
    if (range && !match) throw new Error('Paginação financeira inválida.');
    if (match && page.length && (Number(match[1]) !== offset || Number(match[2]) - offset + 1 !== page.length)) throw new Error('Página financeira fora de ordem.');
    for (const row of page) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Registro financeiro inválido.');
      if (row.id !== undefined) {
        if (seen.has(row.id)) throw new Error('A lista mudou durante a consulta. Tente novamente.');
        seen.add(row.id);
      }
    }
    result.push(...page);
    if (result.length > maxRows) throw new Error('Consulta muito extensa. Reduza o período.');
    if (match && match[3] !== '*') {
      const total = Number(match[3]);
      if (expectedTotal !== undefined && expectedTotal !== total) throw new Error('A lista mudou durante a consulta. Tente novamente.');
      expectedTotal = total;
      if (result.length > total) throw new Error('Total financeiro inconsistente.');
      if (result.length === total) return result;
      if (!page.length) throw new Error('Consulta financeira incompleta.');
    } else if (!page.length) return result;
    if (!page.length) throw new Error('Consulta financeira incompleta.');
    offset += page.length;
  }
  throw new Error('Consulta muito extensa. Reduza o período.');
}
