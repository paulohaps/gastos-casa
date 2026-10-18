(function (root) {
  "use strict";
  const record = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const id = (value) =>
    text(value) || (Number.isSafeInteger(value) && value > 0);
  const money = (value) =>
    (typeof value === "number" ||
      (typeof value === "string" && /^\d+(\.\d+)?$/.test(value))) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;
  function date(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const parsed = new Date(value + "T12:00:00Z");
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }
  const expense = (row) =>
    id(row.id) &&
    date(row.data) &&
    money(row.valor) &&
    text(row.descricao) &&
    text(row.categoria);
  const schemas = {
    expenses: expense,
    householdExpenses: (row) =>
      expense(row) && text(row.usuario) && text(row.forma_pagamento),
    settlements: (row) =>
      id(row.id) &&
      date(row.data_pagamento) &&
      date(row.competencia) &&
      money(row.valor) &&
      text(row.pagador) &&
      text(row.recebedor) &&
      text(row.forma_pagamento),
    budgets: (row) => text(row.categoria) && money(row.valor_limite),
    recurring: (row) =>
      id(row.id) &&
      text(row.descricao) &&
      money(row.valor) &&
      text(row.categoria) &&
      text(row.forma_pagamento) &&
      Number.isInteger(Number(row.dia_vencimento)) &&
      Number(row.dia_vencimento) >= 1 &&
      Number(row.dia_vencimento) <= 31 &&
      typeof row.ativo === "boolean",
    wallets: (row) => id(row.id) && text(row.nome) && money(row.limite_mensal),
    members: (row) => text(row.nome) && text(row.email),
    rules: (row) =>
      id(row.id) && text(row.termo_normalizado) && text(row.categoria),
    months: (value) =>
      typeof value === "string" && /^(0[1-9]|1[0-2])\/\d{4}$/.test(value),
  };
  function invalid(field) {
    const error = new Error(
      "O servidor enviou dados inválidos. Tente novamente.",
    );
    error.code = "INVALID_RESPONSE";
    error.field = field;
    return error;
  }
  function arrayField(data, field, schema = field) {
    if (!record(data) || !Array.isArray(data[field])) throw invalid(field);
    const check = schemas[schema];
    if (!check) throw invalid(field);
    if (
      !data[field].every(
        (value) => (schema === "months" || record(value)) && check(value),
      )
    )
      throw invalid(field);
    return data[field];
  }
  function user(value) {
    if (!record(value) || !text(value.name) || !text(value.email))
      throw invalid("user");
    return value;
  }
  function envelope(value) {
    if (!record(value)) throw invalid("response");
    if (value.token !== undefined && !text(value.token)) throw invalid("token");
    if (value.user !== undefined) user(value.user);
    return value;
  }
  root.GastosApiContracts = Object.freeze({ arrayField, user, envelope });
})(globalThis);
