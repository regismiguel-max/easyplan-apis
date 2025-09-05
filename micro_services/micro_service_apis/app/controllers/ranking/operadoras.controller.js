const path = require('path');
const db = require(path.resolve(__dirname, '../../../../../models'));

const norm = (s) => String(s || '').trim();

/**
 * GET /api/ranking/operadoras
 * Query:
 *   - fonte=cadastro|resultado (default: cadastro)
 *
 * Response:
 *   { sucesso: true, operadoras: string[] }
 */
async function listarOperadoras(req, res) {
    try {
        const rows = await db.rk_operadoras.findAll({
            where: { ativo: true },
            attributes: ['id', 'operadora_nome'],
            order: [['operadora_nome', 'ASC']],
            raw: true,
        });

        const operadoras = rows.map(r => ({
            id: r.id,
            nome: String(r.operadora_nome || '').trim()
        }));

        return res.json({ sucesso: true, operadoras });
    } catch (err) {
        console.error('[OPERADORAS][ERR]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar operadoras.' });
    }
}

module.exports = { listarOperadoras };
