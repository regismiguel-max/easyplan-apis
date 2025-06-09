module.exports = function gerarMensagemPushPorStatusFatura(fatura, tipo, dias) {
    const vencimento = fatura.dataVencimento;
  
    switch (tipo) {
      case 'emitido_inicial':
        return {
          headings: {
            pt: '📬 Novo Boleto Gerado!',
            en: '📬 New Bill Generated!'
          },
          contents: {
            pt: `Seu boleto com vencimento em ${vencimento} está pronto para pagamento. 💳`,
            en: `Your bill due on ${vencimento} is ready for payment. 💳`
          }
        };
  
      case 'emitido_vencimento':
        return {
          headings: {
            pt: '⏰ Hoje é o vencimento do seu boleto!',
            en: '⏰ Your Bill is Due Today!'
          },
          contents: {
            pt: 'Evite atrasos! Clique para efetuar o pagamento hoje mesmo. ✅',
            en: 'Avoid late fees! Tap to pay your bill today. ✅'
          }
        };
  
      case 'vencido_4dias':
        return {
          headings: {
            pt: '⚠️ Boleto Atrasado!',
            en: '⚠️ Bill Overdue!'
          },
          contents: {
            pt: 'Seu boleto venceu há 4 dias. Regularize agora e evite juros. 📉',
            en: 'Your bill is 4 days overdue. Settle it now to avoid fees. 📉'
          }
        };
  
      case 'vencido_recorrente':
        return {
          headings: {
            pt: '📅 Boleto em Atraso',
            en: '📅 Overdue Bill'
          },
          contents: {
            pt: `Seu boleto está vencido há ${dias} dias. Toque para regularizar. 🔁`,
            en: `Your bill is ${dias} days overdue. Tap to settle it now. 🔁`
          }
        };
  
      default:
        return {
          headings: {
            pt: '🧾 Boleto Disponível',
            en: '🧾 Available Bill'
          },
          contents: {
            pt: 'Visualize seu boleto com um clique. 👁️',
            en: 'View your bill in one tap. 👁️'
          }
        };
    }
  }
  