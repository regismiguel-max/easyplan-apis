// produtores-duel-AudioData.js
const express = require("express");
const { pool } = require('./db');

module.exports = (app, opts = {}) => {
    const router = express.Router();
    /**
     * GET /duels/:id/escrow
     * Auditoria detalhada de escrow por duelo
     */
    router.get('/duels/:id/escrow', async (req, res, next) => {
        const duelId = Number(req.params.id);
        if (!duelId) return res.status(400).json({ error: 'duelId inválido' });
        try {
            const [rows] = await pool.query(
                `SELECT *
         FROM produtores_v_duel_escrow_audit
        WHERE duel_id = ?
        ORDER BY role`,
                [duelId]
            );
            res.json({ ok: true, duelId, escrows: rows });
        } catch (e) { next(e); }
    });

    /**
     * GET /wallets/consistency
     * Lista todos (ou por filtro) com diferença entre wallet.escrow e SOMA(amount_open)
     * Query params opcionais: cycleId, brokerId
     */
    router.get('/wallets/consistency', async (req, res, next) => {
        const cycleId = req.query.cycleId ? Number(req.query.cycleId) : null;
        const brokerId = req.query.brokerId ? Number(req.query.brokerId) : null;
        try {
            let sql = `SELECT * FROM produtores_v_duel_wallet_consistency WHERE 1=1`;
            const params = [];
            if (cycleId) { sql += ` AND cycle_id=?`; params.push(cycleId); }
            if (brokerId) { sql += ` AND broker_id=?`; params.push(brokerId); }
            sql += ` ORDER BY cycle_id, broker_id`;

            const [rows] = await pool.query(sql, params);
            res.json({ ok: true, items: rows });
        } catch (e) { next(e); }
    });

    /**
     * GET /wallets/inconsistencies
     * Apenas itens com diferença != 0
     * Query params opcionais: cycleId, brokerId
     */
    router.get('/wallets/inconsistencies', async (req, res, next) => {
        const cycleId = req.query.cycleId ? Number(req.query.cycleId) : null;
        const brokerId = req.query.brokerId ? Number(req.query.brokerId) : null;
        try {
            let sql = `SELECT * FROM produtores_v_duel_wallet_inconsistencies WHERE 1=1`;
            const params = [];
            if (cycleId) { sql += ` AND cycle_id=?`; params.push(cycleId); }
            if (brokerId) { sql += ` AND broker_id=?`; params.push(brokerId); }
            sql += ` ORDER BY cycle_id, broker_id`;

            const [rows] = await pool.query(sql, params);
            res.json({ ok: true, items: rows });
        } catch (e) { next(e); }
    });

    /**
     * POST /wallets/reconcile
     * Reconciliador opcional: ajusta wallet.escrow para bater com a soma de amount_open,
     * SEM mexer em balance (uso pontual/controlado por admin).
     * body: { cycleId?, brokerId? }
     */
    router.post('/wallets/reconcile', async (req, res, next) => {
        const { cycleId, brokerId } = req.body || {};
        const conn = await pool.getConnection(); await conn.beginTransaction();
        try {
            let sql = `SELECT * FROM produtores_v_duel_wallet_consistency WHERE 1=1`;
            const params = [];
            if (cycleId) { sql += ` AND cycle_id=?`; params.push(Number(cycleId)); }
            if (brokerId) { sql += ` AND broker_id=?`; params.push(Number(brokerId)); }

            const [rows] = await conn.query(sql, params);
            for (const r of rows) {
                if (r.diff_open_vs_wallet !== 0) {
                    // corrige apenas o agregado wallet.escrow
                    await conn.query(
                        `UPDATE produtores_duel_wallet
              SET escrow = GREATEST(?, 0)
            WHERE broker_id=? AND cycle_id=?`,
                        [Math.max(0, Number(r.escrow_open_sum || 0)), r.broker_id, r.cycle_id]
                    );

                    // ledger (facilitar trilha)
                    await conn.query(
                        `INSERT INTO produtores_duel_wallet_ledger
             (broker_id, cycle_id, kind, amount, ref_duel_id, meta_json)
           VALUES (?,?,?,?,NULL, JSON_OBJECT('action','RECONCILE_ESCROW','from',?, 'to',?))`,
                        [
                            r.broker_id, r.cycle_id, 'ESCROW_RECONCILE',
                            0, // amount 0 (apenas informativo)
                            r.wallet_escrow_agregado, r.escrow_open_sum
                        ]
                    );
                }
            }
            await conn.commit();
            res.json({ ok: true, reconciled: rows.length });
        } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
    });

    /**
     * GET /duels/:id/ledger
     * Ledger completo relacionado ao duelo (ambos os lados)
     */
    router.get('/duels/:id/ledger', async (req, res, next) => {
        const duelId = Number(req.params.id);
        if (!duelId) return res.status(400).json({ error: 'duelId inválido' });
        try {
            const [rows] = await pool.query(
                `SELECT broker_id, cycle_id, kind, amount, created_at, meta_json
         FROM produtores_duel_wallet_ledger
        WHERE ref_duel_id = ?
        ORDER BY created_at ASC, id ASC`,
                [duelId]
            );
            res.json({ ok: true, duelId, ledger: rows });
        } catch (e) { next(e); }
    });

    app.use("/api/duelos", router);

    app.use((err, req, res, _next) => {
        const msg = err?.message || "Erro interno";
        res.status(500).json({ sucesso: false, mensagem: msg });
    });
};
