function bringMonth(finalData){
    // Cria um objeto Date a partir da string
    const dateObj = new Date(finalData);

    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Extrai o número do mês (0 a 11)
    const numeroMes = dateObj.getMonth() + 1; // +1 para ajustar
    const nomeMes = meses[dateObj.getMonth()];

    // console.log(numeroMes.toString().padStart(2, '0')); // "05"
    // console.log(nomeMes); // "Maio"

    return nomeMes;
}

module.exports = bringMonth;