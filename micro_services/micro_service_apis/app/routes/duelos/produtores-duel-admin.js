const express = require("express");
const { pool } = require("./db");

// ===============================
// Admin Duelos Controller
// ===============================
module.exports = (app) => {
    const router = express.Router();

    // ============================================================
    // 🔹 LISTAR DUELOS COM FILTROS
    // ============================================================
    router.get("/list", async (req, res, next) => {
        const { nome, cpf, ciclo, vigencia, status } = req.query;
        const conn = await pool.getConnection();

        try {
            let where = "WHERE 1=1";
            const params = [];

            if (nome) {
                where += " AND (pc.nome LIKE ? OR po.nome LIKE ?)";
                params.push(`%${nome}%`, `%${nome}%`);
            }
            if (cpf) {
                where += " AND (pc.cpf LIKE ? OR po.cpf LIKE ?)";
                params.push(`%${cpf}%`, `%${cpf}%`);
            }
            if (ciclo) {
                where += " AND d.cycle_id = ?";
                params.push(ciclo);
            }
            if (vigencia) {
                where += " AND v.name LIKE ?";
                params.push(`%${vigencia}%`);
            }
            if (status) {
                where += " AND d.status = ?";
                params.push(status);
            }

            const [rows] = await conn.query(
                `
        SELECT 
          d.id,
          d.cycle_id,
          c.name AS ciclo_name,
          v.name AS vigencia_name,
          d.status,
          d.percent,
          d.end_date,
          d.created_at,
          pc.nome AS desafiante,
          pc.cpf AS desafiante_cpf,
          po.nome AS desafiado,
          po.cpf AS desafiado_cpf,
          COALESCE((
            SELECT SUM(e.amount_locked) 
            FROM produtores_duel_escrow e 
            WHERE e.duel_id = d.id
          ), 0) AS aposta
        FROM produtores_duel d
        JOIN produtores pc ON pc.id = d.challenger_id
        JOIN produtores po ON po.id = d.challenged_id
        LEFT JOIN produtores_duel_cycle c ON c.id = d.cycle_id
        LEFT JOIN produtores_duel_vigencia v ON v.id = d.vigencia_id
        ${where}
        ORDER BY d.id DESC
        LIMIT 300
        `,
                params
            );

            res.json({ ok: true, duelos: rows });
        } catch (err) {
            console.error("Erro ao listar duelos:", err);
            next(err);
        } finally {
            conn.release();
        }
    });

    // ============================================================
    // 🔹 RANKING ADMIN (POR VIGÊNCIA OU CICLO)
    // ============================================================
    router.get("/ranking", async (req, res, next) => {
        const { tipo, ciclo, vigencia } = req.query;
        const conn = await pool.getConnection();

        try {
            if (!["vigencia", "ciclo"].includes(tipo)) {
                return res.status(400).json({ ok: false, mensagem: "Tipo inválido (use vigencia ou ciclo)" });
            }

            let query = "";
            let params = [];

            if (tipo === "vigencia") {
                query = `
          SELECT 
            r.id,
            r.vigencia_id,
            v.name AS vigencia_name,
            r.broker_id,
            r.nome,
            r.cpf,
            r.posicao,
            r.moedas,
            r.vitorias,
            r.derrotas
          FROM produtores_duel_ranking_vigencia r
          JOIN produtores_duel_vigencia v ON v.id = r.vigencia_id
          WHERE 1=1
        `;
                if (vigencia) {
                    query += " AND v.name LIKE ?";
                    params.push(`%${vigencia}%`);
                }
                query += " ORDER BY v.name DESC, r.posicao ASC LIMIT 200";
            } else {
                query = `
          SELECT 
            r.id,
            r.cycle_id,
            c.name AS ciclo_name,
            r.broker_id,
            r.nome,
            r.cpf,
            r.posicao,
            r.moedas,
            r.vitorias,
            r.derrotas
          FROM produtores_duel_ranking_ciclo r
          JOIN produtores_duel_cycle c ON c.id = r.cycle_id
          WHERE 1=1
        `;
                if (ciclo) {
                    query += " AND c.name LIKE ?";
                    params.push(`%${ciclo}%`);
                }
                query += " ORDER BY c.name DESC, r.posicao ASC LIMIT 200";
            }

            const [rows] = await conn.query(query, params);
            res.json({ ok: true, ranking: rows });
        } catch (err) {
            console.error("Erro ao buscar ranking:", err);
            next(err);
        } finally {
            conn.release();
        }
    });

    // ============================================================
    // 🔹 RESUMO GERAL (para dashboards futuros)
    // ============================================================
    router.get("/resumo", async (_req, res, next) => {
        const conn = await pool.getConnection();
        try {
            const [[totais]] = await conn.query(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pendentes,
          SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS ativos,
          SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) AS resolvidos,
          SUM(CASE WHEN status='tie' THEN 1 ELSE 0 END) AS empates,
          SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expirados
        FROM produtores_duel
      `);

            res.json({ ok: true, resumo: totais });
        } catch (err) {
            next(err);
        } finally {
            conn.release();
        }
    });

    app.use("/api/duelos/admin", router);

    app.use((err, req, res, _next) => {
        const msg = err?.message || "Erro interno";
        res.status(500).json({ sucesso: false, mensagem: msg });
    });
};
