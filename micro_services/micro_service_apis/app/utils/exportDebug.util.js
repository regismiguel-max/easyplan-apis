const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

async function exportDebugCsv(cpf, mes, rows) {
    try {
        const exportData = rows.map(r => ({
            propostaID: r.propostaID,
            vigMes: r.vigMes,
            vigDia: r.vigDia,
            beneficiarios: r.beneficiarios,
            foundContrato: r._foundContrato,
            contratoCodigo: r._contratoCodigo,
            ativo: r._ativo,
            pago: r._pago,
            titularCpf: r.titularCpf,
            operadora: r.operadoraNome,
            supervisor: r.supNome
        }));

        // ---> Excel-friendly CSV
        const parser = new Parser({ delimiter: ';' });
        const csv = parser.parse(exportData);

        const folder = path.resolve(__dirname, '../../../../uploads/produtores/ranking-cpf');
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        const filename = `${cpf}-${mes}.csv`;
        const filepath = path.join(folder, filename);

        // ---> BOM para acentos no Excel
        fs.writeFileSync(filepath, "\uFEFF" + csv, { encoding: 'utf8' });

        console.log(`[EXPORT DEBUG] CSV salvo em: ${filepath}`);
    } catch (err) {
        console.error('[EXPORT DEBUG] Erro ao gerar CSV:', err);
    }
}

module.exports = { exportDebugCsv };