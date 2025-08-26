function validateIncentivePayload(payload) {
  if (!payload) return { valid: false, message: "Payload ausente" };

  const { incentiveType } = payload;

  if (!incentiveType) {
    return { valid: false, message: "Tipo de incentivo é obrigatório" };
  }

  if (incentiveType === 'premiacao') {
    const required = ['incentiveName', 'incentiveDescription', 'dateAward', 'awardPrice', 'cpfCorretor', 'nameCorretor', 'cnpjCorretora'];
    for (let field of required) {
      if (!payload[field]) {
        return { valid: false, message: `Campo obrigatório ausente: ${field}` };
      }
    }
  }

  if (incentiveType === 'vida') {
    const required = ['incentiveName', 'incentiveDescription', 'lifeGoal', 'startDate', 'endDate', 'lifePrice', 'challengePrice', 'cnpjCorretora'];
    for (let field of required) {
      if (!payload[field]) {
        return { valid: false, message: `Campo obrigatório ausente: ${field}` };
      }
    }
  }

  return { valid: true };
}

module.exports = { validateIncentivePayload };