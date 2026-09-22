export function isSmartEntryAiConfigured() {
  return false;
}

export async function enhanceSmartEntryWithAi(result) {
  // Ponto de extensão intencional. A V1 funciona integralmente sem fornecedor externo.
  // Quando um provider for configurado, ele só poderá enriquecer um draft validado;
  // nunca gravar dados ou alterar as listas permitidas de categoria/pagamento.
  return result;
}
