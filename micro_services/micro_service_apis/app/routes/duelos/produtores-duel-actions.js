// produtores-duel-actions.js
const express = require("express");
const axios = require("axios");
const { pool } = require('./db');

// ===============================
// utils
// ===============================
async function getActivePeriod(conn, cycleId) {
    const [[p]] = await conn.query(
        `SELECT id, start_date, end_date
       FROM produtores_duel_period
      WHERE cycle_id=? AND CURDATE() BETWEEN start_date AND end_date
      ORDER BY id LIMIT 1`,
        [cycleId]
    );
    return p || null;
}

// 🔹 NOVO: buscar vigência ativa vinculada ao ciclo
async function getActiveVigencia(conn, cycleId) {
    const [[v]] = await conn.query(
        `SELECT id, start_date, end_date
         FROM produtores_duel_vigencia
         WHERE cycle_id=? AND CURDATE() BETWEEN start_date AND end_date
         ORDER BY id DESC
         LIMIT 1`,
        [cycleId]
    );
    return v || null;
}

async function getCycleVigencia(conn, cycleId) {
    const [[row]] = await conn.query(
        `SELECT DATE_FORMAT(start_date,'%Y-%m') AS vigencia FROM produtores_duel_cycle WHERE id=?`,
        [cycleId]
    );
    return row?.vigencia || null;
}

async function getBrokerIdByCpf(conn, cpf) {
    const [[p]] = await conn.query(`SELECT id FROM produtores WHERE cpf=? LIMIT 1`, [cpf]);
    return p?.id || null;
}

async function getWallet(conn, brokerId, cycleId) {
    const [[w]] = await conn.query(
        `SELECT balance, escrow FROM produtores_duel_wallet WHERE broker_id=? AND cycle_id=?`,
        [brokerId, cycleId]
    );
    return w || null;
}

// helper: resolve broker por CPF (id, nome, cpf)
async function getBrokerBasicByCpf(conn, cpf) {
    const [[r]] = await conn.query(`SELECT id, cpf, nome FROM produtores WHERE cpf=? LIMIT 1`, [cpf]);
    return r || null;
}

// ===============================
// ESCROW helpers
// ===============================
async function lockEscrow(conn, { duelId, cycleId, brokerId, role, amount }) {
    await conn.query(
        `INSERT INTO produtores_duel_escrow (duel_id, cycle_id, broker_id, role, amount_locked, amount_open, status)
     VALUES (?,?,?,?,?,?, 'locked')`,
        [duelId, cycleId, brokerId, role, amount, amount]
    );

    await conn.query(
        `UPDATE produtores_duel_wallet
        SET balance = balance - ?, escrow = escrow + ?
      WHERE broker_id=? AND cycle_id=? AND balance >= ?`,
        [amount, amount, brokerId, cycleId, amount]
    );
}

async function lockOrBumpEscrow(conn, { duelId, cycleId, brokerId, role, targetAmount }) {
    const [[row]] = await conn.query(
        `SELECT id, amount_open
       FROM produtores_duel_escrow
      WHERE duel_id=? AND broker_id=? AND role=?
      FOR UPDATE`,
        [duelId, brokerId, role]
    );

    if (!row) {
        if (targetAmount <= 0) return 0;
        await conn.query(
            `INSERT INTO produtores_duel_escrow
         (duel_id, cycle_id, broker_id, role, amount_locked, amount_open, status)
       VALUES (?,?,?,?,?,?, 'locked')`,
            [duelId, cycleId, brokerId, role, targetAmount, targetAmount]
        );
        const [upd] = await conn.query(
            `UPDATE produtores_duel_wallet
          SET balance = balance - ?, escrow = escrow + ?
        WHERE broker_id=? AND cycle_id=? AND balance >= ?`,
            [targetAmount, targetAmount, brokerId, cycleId, targetAmount]
        );
        if (upd.affectedRows === 0) throw new Error('INSUFFICIENT_BALANCE');
        return targetAmount;
    }

    const open = Math.max(0, Number(row.amount_open || 0));
    const delta = Math.max(0, targetAmount - open);
    if (delta === 0) return 0;

    await conn.query(
        `UPDATE produtores_duel_escrow
        SET amount_locked = amount_locked + ?, amount_open = amount_open + ?
      WHERE id=?`,
        [delta, delta, row.id]
    );

    const [upd] = await conn.query(
        `UPDATE produtores_duel_wallet
        SET balance = balance - ?, escrow = escrow + ?
      WHERE broker_id=? AND cycle_id=? AND balance >= ?`,
        [delta, delta, brokerId, cycleId, delta]
    );
    if (upd.affectedRows === 0) throw new Error('INSUFFICIENT_BALANCE');
    return delta;
}

async function releaseEscrowToWinner(conn, { duelId, winnerId }) {
    const [rows] = await conn.query(
        `SELECT * FROM produtores_duel_escrow WHERE duel_id=? FOR UPDATE`,
        [duelId]
    );

    let totalRelease = 0;
    for (const e of rows) {
        const open = Math.max(0, Number(e.amount_open || 0));
        if (open > 0) {
            await conn.query(`UPDATE produtores_duel_escrow SET amount_open=0, status='released' WHERE id=?`, [e.id]);
            await conn.query(`UPDATE produtores_duel_wallet SET escrow = GREATEST(escrow - ?, 0) WHERE broker_id=? AND cycle_id=?`, [open, e.broker_id, e.cycle_id]);
            await conn.query(`UPDATE produtores_duel_wallet SET balance = balance + ? WHERE broker_id=? AND cycle_id=?`, [open, winnerId, e.cycle_id]);
        }
    }
    return totalRelease;
}

async function returnEscrowToOwners(conn, { duelId, reason }) {
    const [rows] = await conn.query(`SELECT * FROM produtores_duel_escrow WHERE duel_id=? FOR UPDATE`, [duelId]);
    for (const e of rows) {
        const open = Math.max(0, Number(e.amount_open || 0));
        if (open > 0) {
            await conn.query(`UPDATE produtores_duel_escrow SET amount_open=0, status='returned' WHERE id=?`, [e.id]);
            await conn.query(`UPDATE produtores_duel_wallet SET escrow = GREATEST(escrow - ?, 0), balance = balance + ? WHERE broker_id=? AND cycle_id=?`, [open, open, e.broker_id, e.cycle_id]);
        }
    }
}

// ===============================
// RANKING (API oficial)
// ===============================
const RANKING_API_BASE = process.env.RANKING_API_BASE || 'https://apis.easyplan.com.br:3088';
const RANKING_API_TOKEN = process.env.RANKING_API_TOKEN || null;

async function getRankingPositionByCpf({ cpf, vigencia }) {
    try {
        const url = `${RANKING_API_BASE}/api/ranking/por-vigencia`;
        const { data } = await axios.get(url, {
            params: { janela: 'MES', vigencia, escopo: 'nacional', limit: 1, incluirValor: false, cpf },
            headers: RANKING_API_TOKEN ? { Authorization: `Bearer ${RANKING_API_TOKEN}` } : {}
        });
        if (data && data.alvo && Number.isFinite(+data.alvo.rank_confirmadas)) {
            return Number(data.alvo.rank_confirmadas);
        }
        return null;
    } catch {
        return null;
    }
}

// ===============================
// Rotas
// ===============================
module.exports = (app) => {
    const router = express.Router();

    // ---------- Criar duelo (CPF) ----------
    router.post('/duels', async (req, res, next) => {
        const { cycleId, challengerCpf, challengedCpf, percent } = req.body;
        if (![50, 100].includes(Number(percent))) return res.status(400).json({ error: 'percent inválido (use 50 ou 100)' });

        const conn = await pool.getConnection(); await conn.beginTransaction();
        try {
            const period = await getActivePeriod(conn, cycleId);
            if (!period) throw new Error('NO_ACTIVE_PERIOD');

            // 🔹 NOVO: vincular vigência ativa
            const vigencia = await getActiveVigencia(conn, cycleId);
            if (!vigencia) throw new Error('NO_ACTIVE_VIGENCIA');

            const [[nowRow]] = await conn.query(`SELECT NOW() AS now`);
            const hoursLeft = Math.floor((new Date(period.end_date) - new Date(nowRow.now)) / (1000 * 60 * 60));
            const MIN_HOURS = Number(process.env.DUEL_MIN_ACCEPT_HOURS || 48);
            if (hoursLeft < MIN_HOURS) throw new Error('PERIOD_TOO_CLOSE');

            const challengerId = await getBrokerIdByCpf(conn, challengerCpf);
            const challengedId = await getBrokerIdByCpf(conn, challengedCpf);
            if (!challengerId || !challengedId) return res.status(400).json({ error: 'CPF não encontrado' });

            const wC = await getWallet(conn, challengerId, cycleId);
            const wO = await getWallet(conn, challengedId, cycleId);
            if (!wC || !wO) return res.status(400).json({ error: 'wallet faltando' });

            const stakeChallenger = Math.floor((wC.balance * Number(percent)) / 100);
            if (stakeChallenger <= 0) return res.status(400).json({ error: 'saldo insuficiente do desafiante' });

            // 🔸 Agora inclui vigencia_id no INSERT
            const [duelIns] = await conn.query(
                `INSERT INTO produtores_duel
               (cycle_id, period_id, vigencia_id, challenger_id, challenged_id, percent, status, accept_by, end_date, challenger_cpf, challenged_cpf)
             VALUES (?,?,?,?,?,?, 'pending', DATE_ADD(NOW(), INTERVAL 48 HOUR), ?, ?, ?)`,
                [cycleId, period.id, vigencia.id, challengerId, challengedId, percent, period.end_date, challengerCpf, challengedCpf]
            );
            const duelId = duelIns.insertId;

            await lockEscrow(conn, { duelId, cycleId, brokerId: challengerId, role: 'challenger', amount: stakeChallenger });
            await conn.commit();
            res.json({ ok: true, duelId });
        } catch (e) {
            await conn.rollback(); next(e);
        } finally { conn.release(); }
    });

    // ---------- Aceitar duelo ----------
    router.post('/duels/:id/accept', async (req, res, next) => {
        const duelId = Number(req.params.id);

        const conn = await pool.getConnection(); await conn.beginTransaction();
        try {
            const [[per]] = await conn.query(
                `SELECT end_date FROM produtores_duel_period WHERE id=?`,
                [d.period_id]
            );
            if (!per || new Date(per.end_date) < new Date()) {
                throw new Error('PERIOD_ENDED');
            }

            const [[d]] = await conn.query(`SELECT * FROM produtores_duel WHERE id=? FOR UPDATE`, [duelId]);
            if (!d || d.status !== 'pending') return res.status(400).json({ error: 'duelo inválido' });

            const wO = await getWallet(conn, d.challenged_id, d.cycle_id);
            if (!wO) return res.status(400).json({ error: 'wallet faltando' });

            const stakeChallenged = Math.floor((wO.balance * d.percent) / 100);
            if (stakeChallenged <= 0) return res.status(400).json({ error: 'desafiado sem saldo' });

            // Bump do escrow do desafiado até a aposta real (aproveita pré-hold se existir)
            await lockOrBumpEscrow(conn, {
                duelId, cycleId: d.cycle_id, brokerId: d.challenged_id, role: 'challenged', targetAmount: stakeChallenged
            });

            await conn.query(`UPDATE produtores_duel SET status='active' WHERE id=?`, [duelId]);

            await conn.query(
                `INSERT INTO produtores_duel_wallet_ledger (broker_id, cycle_id, kind, amount, ref_duel_id, meta_json)
         VALUES (?,?,?,?,?, JSON_OBJECT('percent', ?, 'role','challenged'))`,
                [d.challenged_id, d.cycle_id, 'ESCROW_LOCK', -stakeChallenged, duelId, d.percent]
            );

            await conn.commit();
            res.json({ ok: true });
        } catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
    });

    // ---------- Recusar / Expirar (penaliza 25) ----------
    async function refuseOrExpire(conn, duelId, reason) {
        const [[d]] = await conn.query(`SELECT * FROM produtores_duel WHERE id=? FOR UPDATE`, [duelId]);
        if (!d || (d.status !== 'pending' && d.status !== 'active')) throw new Error('INVALID_DUEL_STATE');

        const PEN = 25;

        // 1) Tenta pagar a penalidade primeiro do escrow aberto do desafiado
        let paidFromEscrow = 0;
        const [[eCh]] = await conn.query(
            `SELECT id, amount_open FROM produtores_duel_escrow
        WHERE duel_id=? AND broker_id=? AND role='challenged' FOR UPDATE`,
            [duelId, d.challenged_id]
        );
        if (eCh) {
            const open = Math.max(0, Number(eCh.amount_open || 0));
            const take = Math.min(PEN, open);
            if (take > 0) {
                await conn.query(
                    `UPDATE produtores_duel_escrow
              SET amount_open = GREATEST(amount_open - ?, 0),
                  amount_locked = GREATEST(amount_locked - ?, 0)
            WHERE id=?`,
                    [take, take, eCh.id]
                );
                await conn.query(
                    `UPDATE produtores_duel_wallet
              SET escrow = GREATEST(escrow - ?, 0)
            WHERE broker_id=? AND cycle_id=?`,
                    [take, d.challenged_id, d.cycle_id]
                );
                await conn.query(
                    `UPDATE produtores_duel_wallet
              SET balance = balance + ?
            WHERE broker_id=? AND cycle_id=?`,
                    [take, d.challenger_id, d.cycle_id]
                );
                await conn.query(
                    `INSERT INTO produtores_duel_wallet_ledger (broker_id, cycle_id, kind, amount, ref_duel_id, meta_json)
           VALUES
           (?,?,?,?,?, JSON_OBJECT('reason', ?)),
           (?,?,?,?,?, JSON_OBJECT('reason', ?))`,
                    [
                        d.challenged_id, d.cycle_id, 'ESCROW_RELEASE_OUT', -take, duelId, reason,
                        d.challenger_id, d.cycle_id, 'REFUSAL_PENALTY_GAIN', +take, duelId, reason
                    ]
                );
                paidFromEscrow = take;
            }
        }

        // 2) Se faltou, desconta do balance do desafiado (apenas o que tiver)
        const remain = PEN - paidFromEscrow;
        if (remain > 0) {
            const [[wCh]] = await conn.query(
                `SELECT balance FROM produtores_duel_wallet WHERE broker_id=? AND cycle_id=? FOR UPDATE`,
                [d.challenged_id, d.cycle_id]
            );
            const bal = Math.max(0, Number(wCh?.balance || 0));
            const takeBal = Math.min(remain, bal);
            if (takeBal > 0) {
                await conn.query(
                    `UPDATE produtores_duel_wallet SET balance = balance - ?
            WHERE broker_id=? AND cycle_id=?`,
                    [takeBal, d.challenged_id, d.cycle_id]
                );
                await conn.query(
                    `UPDATE produtores_duel_wallet SET balance = balance + ?
            WHERE broker_id=? AND cycle_id=?`,
                    [takeBal, d.challenger_id, d.cycle_id]
                );
                await conn.query(
                    `INSERT INTO produtores_duel_wallet_ledger (broker_id, cycle_id, kind, amount, ref_duel_id, meta_json)
           VALUES
           (?,?,?,?,?, JSON_OBJECT('reason', ?)),
           (?,?,?,?,?, JSON_OBJECT('reason', ?))`,
                    [
                        d.challenged_id, d.cycle_id, 'REFUSAL_PENALTY_LOSS', -takeBal, duelId, reason,
                        d.challenger_id, d.cycle_id, 'REFUSAL_PENALTY_GAIN', +takeBal, duelId, reason
                    ]
                );
            }
            // se não houver saldo, simplesmente não paga o restante (evita criar saldo negativo)
        }

        // 3) Devolve qualquer escrow aberto restante aos donos
        await returnEscrowToOwners(conn, { duelId, reason });

        // 4) Atualiza status
        await conn.query(
            `UPDATE produtores_duel SET status=? WHERE id=?`,
            [reason === 'expired' ? 'expired' : 'declined', duelId]
        );
    }

    router.post('/duels/:id/refuse', async (req, res, next) => {
        const conn = await pool.getConnection(); await conn.beginTransaction();
        try { await refuseOrExpire(conn, Number(req.params.id), 'refused'); await conn.commit(); res.json({ ok: true }); }
        catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
    });

    router.post('/duels/:id/expire', async (req, res, next) => {
        const conn = await pool.getConnection(); await conn.beginTransaction();
        try { await refuseOrExpire(conn, Number(req.params.id), 'expired'); await conn.commit(); res.json({ ok: true }); }
        catch (e) { await conn.rollback(); next(e); } finally { conn.release(); }
    });

    // ---------- Liquidar por ranking interno (vidas_vendidas) ----------
    router.post('/duels/:id/settle', async (req, res, next) => {
        const duelId = Number(req.params.id);
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // 🔹 Busca o duelo
            const [[d]] = await conn.query(`SELECT * FROM produtores_duel WHERE id=? FOR UPDATE`, [duelId]);
            if (!d || (d.status !== 'active' && d.status !== 'pending')) {
                return res.status(400).json({ error: 'duelo inválido' });
            }

            // 🔹 Localiza a vigência correta usando o campo name
            const [[vig]] = await conn.query(
                `SELECT v.name AS vigencia
             FROM produtores_duel_vigencia v
             WHERE v.cycle_id = ?
               AND ? BETWEEN v.start_date AND v.end_date
             ORDER BY v.start_date DESC
             LIMIT 1`,
                [d.cycle_id, d.end_date]
            );

            const vigencia = vig?.vigencia;
            if (!vigencia) throw new Error('VIGENCIA_NOT_FOUND');

            // 🔹 Pega a última execução do ranking (janela DIA)
            const [[ultimaExecucao]] = await conn.query(
                `SELECT MAX(execucao_id) AS execucao_id
             FROM produtores_ranking_resultados
             WHERE janela='DIA' AND vigencia = ?`,
                [vigencia]
            );

            const execucaoId = ultimaExecucao?.execucao_id;
            if (!execucaoId) throw new Error('EXECUCAO_NOT_FOUND');

            // 🔹 Busca vidas_vendidas de cada participante
            const [[challengerRank]] = await conn.query(
                `SELECT vidas_vendidas
             FROM produtores_ranking_resultados
             WHERE cpf = ? AND janela='DIA' AND vigencia = ? AND execucao_id = ?
             LIMIT 1`,
                [d.challenger_cpf, vigencia, execucaoId]
            );

            const [[challengedRank]] = await conn.query(
                `SELECT vidas_vendidas
             FROM produtores_ranking_resultados
             WHERE cpf = ? AND janela='DIA' AND vigencia = ? AND execucao_id = ?
             LIMIT 1`,
                [d.challenged_cpf, vigencia, execucaoId]
            );

            const v1 = Number(challengerRank?.vidas_vendidas || 0);
            const v2 = Number(challengedRank?.vidas_vendidas || 0);

            // 🔸 Empate automático
            if (v1 === v2) {
                await returnEscrowToOwners(conn, { duelId, reason: 'TIE' });
                await conn.query(
                    `UPDATE produtores_duel
                 SET status='tie', vigencia=?, execucao_id=?, vencedor_id=NULL
                 WHERE id=?`,
                    [vigencia, execucaoId, duelId]
                );
                await conn.commit();
                return res.json({ ok: true, result: 'tie', vigencia, execucaoId, v1, v2 });
            }

            // 🔸 Determina o vencedor com base em vidas_vendidas
            const winnerId = v1 > v2 ? d.challenger_id : d.challenged_id;
            const totalWin = await releaseEscrowToWinner(conn, { duelId, winnerId });

            await conn.query(
                `UPDATE produtores_duel
             SET status='resolved', vigencia=?, execucao_id=?, vencedor_id=?
             WHERE id=?`,
                [vigencia, execucaoId, winnerId, duelId]
            );

            await conn.commit();

            res.json({
                ok: true,
                result: 'resolved',
                winnerId,
                vigencia,
                execucaoId,
                v1,
                v2,
                gain: totalWin
            });

        } catch (e) {
            await conn.rollback();
            next(e);
        } finally {
            conn.release();
        }
    });

    // ---------- Endpoint de inspeção (debug opcional) ----------
    router.get('/wallet', async (req, res, next) => {
        try {
            const { cpf, cycleId } = req.query;
            const conn = await pool.getConnection();
            const id = await getBrokerIdByCpf(conn, cpf);
            const w = id ? await getWallet(conn, id, Number(cycleId)) : null;
            conn.release();
            res.json({ ok: true, brokerId: id, wallet: w });
        } catch (e) { next(e); }
    });

    // ---------- UI endpoints (leitura) ----------
    router.get('/ui/me', async (req, res, next) => {
        try {
            const cpf = String(req.query.cpf || '').replace(/\D/g, '');
            const cycleId = Number(req.query.cycleId);
            if (!cpf || !cycleId) return res.status(400).json({ error: 'cpf e cycleId são obrigatórios' });

            const conn = await pool.getConnection();
            try {
                const broker = await getBrokerBasicByCpf(conn, cpf);
                if (!broker) return res.json({ ok: true, me: null });

                const vigencia = await getCycleVigencia(conn, cycleId);
                const posicao = vigencia ? await getRankingPositionByCpf({ cpf, vigencia }) : null;

                const [[w]] = await conn.query(
                    `SELECT COALESCE(balance,0) AS balance, COALESCE(escrow,0) AS escrow
             FROM produtores_duel_wallet
            WHERE broker_id=? AND cycle_id=?`,
                    [broker.id, cycleId]
                );

                const [[wins]] = await conn.query(
                    `SELECT COUNT(*) AS vitorias
   FROM produtores_duel_wallet_ledger
   WHERE broker_id=? AND cycle_id=? 
     AND (kind='ESCROW_RELEASE_WIN' OR kind='REFUSAL_PENALTY_GAIN')`,
                    [broker.id, cycleId]
                );
                const [[losses]] = await conn.query(
                    `SELECT COUNT(*) AS derrotas
             FROM produtores_duel_wallet_ledger
            WHERE broker_id=? AND cycle_id=? AND kind='ESCROW_RELEASE_OUT'`,
                    [broker.id, cycleId]
                );

                const me = {
                    id: String(broker.id),
                    cpf: broker.cpf,
                    nome: broker.nome,
                    posicao: posicao ?? 0,
                    vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                    moedas: Number(w?.balance || 0),
                    vitorias: Number(wins?.vitorias || 0),
                    derrotas: Number(losses?.derrotas || 0),
                };

                res.json({ ok: true, me });
            } finally { conn.release(); }
        } catch (e) { next(e); }
    });

    router.get('/ui/top', async (req, res, next) => {
        try {
            const cycleId = Number(req.query.cycleId);
            const limit = Math.max(1, Math.min(50, Number(req.query.limit || 7)));
            if (!cycleId) return res.status(400).json({ error: 'cycleId é obrigatório' });

            const conn = await pool.getConnection();
            try {
                const [rows] = await conn.query(
                    `SELECT w.broker_id AS id, p.cpf, p.nome, w.balance AS moedas
             FROM produtores_duel_wallet w
             JOIN produtores p ON p.id = w.broker_id
            WHERE w.cycle_id=?
            ORDER BY w.balance DESC
            LIMIT ?`,
                    [cycleId, limit]
                );

                const vigencia = await getCycleVigencia(conn, cycleId);
                const lista = [];
                for (const r of rows) {
                    let posicao = 0;
                    if (vigencia) {
                        try { posicao = (await getRankingPositionByCpf({ cpf: r.cpf, vigencia })) || 0; } catch { posicao = 0; }
                    }
                    lista.push({
                        id: String(r.id),
                        cpf: r.cpf,
                        nome: r.nome,
                        posicao,
                        vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                        moedas: Number(r.moedas || 0),
                        vitorias: 0, derrotas: 0
                    });
                }

                res.json({ ok: true, lista });
            } finally { conn.release(); }
        } catch (e) { next(e); }
    });

    router.get('/ui/pendentes', async (req, res, next) => {
        try {
            const cpf = String(req.query.cpf || '').replace(/\D/g, '');
            const cycleId = Number(req.query.cycleId);
            if (!cpf || !cycleId) return res.status(400).json({ error: 'cpf e cycleId são obrigatórios' });

            const conn = await pool.getConnection();
            try {
                const broker = await getBrokerBasicByCpf(conn, cpf);
                if (!broker) return res.json({ ok: true, pendentes: [] });

                const [rows] = await conn.query(
                    `SELECT d.*,
                  pc.nome AS challenger_nome, pc.cpf AS challenger_cpf,
                  po.nome AS challenged_nome, po.cpf AS challenged_cpf
             FROM produtores_duel d
             JOIN produtores pc ON pc.id = d.challenger_id
             JOIN produtores po ON po.id = d.challenged_id
            WHERE d.cycle_id=? AND d.status='pending'
              AND (d.challenger_id=? OR d.challenged_id=?)
            ORDER BY d.id DESC`,
                    [cycleId, broker.id, broker.id]
                );

                const pendentes = [];
                for (const d of rows) {
                    const [[esc]] = await conn.query(
                        `SELECT amount_locked
               FROM produtores_duel_escrow
              WHERE duel_id=? AND role='challenger' LIMIT 1`,
                        [d.id]
                    );
                    const aposta = Number(esc?.amount_locked || 0);

                    pendentes.push({
                        id: String(d.id),
                        duelId: d.id,
                        desafiante: {
                            id: String(d.challenger_id),
                            cpf: d.challenger_cpf || '',
                            nome: d.challenger_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        desafiado: {
                            id: String(d.challenged_id),
                            cpf: d.challenged_cpf || '',
                            nome: d.challenged_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        percent: Number(d.percent) === 100 ? 100 : 50,
                        aposta,
                        data: new Date(d.created_at || Date.now()).toISOString(),
                        mensagem: d.msg || '',
                        status: 'pendente',
                        expiresAt: new Date(d.accept_by).getTime()
                    });
                }

                res.json({ ok: true, pendentes });
            } finally { conn.release(); }
        } catch (e) { next(e); }
    });

    router.get('/ui/historico', async (req, res, next) => {
        try {
            const cpf = String(req.query.cpf || '').replace(/\D/g, '');
            const cycleId = Number(req.query.cycleId);
            const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
            if (!cpf || !cycleId) return res.status(400).json({ error: 'cpf e cycleId são obrigatórios' });

            const conn = await pool.getConnection();
            try {
                const broker = await getBrokerBasicByCpf(conn, cpf);
                if (!broker) return res.json({ ok: true, concluidos: [] });

                const [rows] = await conn.query(
                    `SELECT d.*,
                  pc.nome AS challenger_nome, pc.cpf AS challenger_cpf,
                  po.nome AS challenged_nome, po.cpf AS challenged_cpf
             FROM produtores_duel d
             JOIN produtores pc ON pc.id = d.challenger_id
             JOIN produtores po ON po.id = d.challenged_id
            WHERE d.cycle_id=? AND (d.challenger_id=? OR d.challenged_id=?)
              AND d.status IN ('resolved','declined','expired','tie')
            ORDER BY d.id DESC
            LIMIT ?`,
                    [cycleId, broker.id, broker.id, limit]
                );

                const concluidos = [];
                for (const d of rows) {
                    let statusUi = 'finalizado';
                    let resultado = undefined;
                    let aposta = 0;

                    if (d.status === 'declined') statusUi = 'recusado';
                    if (d.status === 'expired') statusUi = 'expirado';

                    if (d.status === 'resolved' || d.status === 'tie') {
                        const [[win]] = await conn.query(
                            `SELECT broker_id, amount
                 FROM produtores_duel_wallet_ledger
                WHERE ref_duel_id=? AND kind='ESCROW_RELEASE_WIN'
                ORDER BY id DESC LIMIT 1`,
                            [d.id]
                        );
                        aposta = Math.abs(Number(win?.amount || 0));

                        if (d.status === 'resolved') {
                            const myWin = win && Number(win.broker_id) === Number(broker.id);
                            resultado = myWin ? 'vitoria' : 'derrota';
                        } else {
                            resultado = undefined;
                        }
                    }

                    concluidos.push({
                        id: String(d.id),
                        duelId: d.id,
                        desafiante: {
                            id: String(d.challenger_id),
                            cpf: d.challenger_cpf || '',
                            nome: d.challenger_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        desafiado: {
                            id: String(d.challenged_id),
                            cpf: d.challenged_cpf || '',
                            nome: d.challenged_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        percent: Number(d.percent) === 100 ? 100 : 50,
                        aposta,
                        data: new Date(d.created_at || Date.now()).toISOString(),
                        mensagem: d.msg || '',
                        status: statusUi,
                        resultado
                    });
                }

                res.json({ ok: true, concluidos });
            } finally { conn.release(); }
        } catch (e) { next(e); }
    });

    // GET /api/duelos/ui/andamento?cpf=...&cycleId=...
    // -> { ok, ativos: [{ id, duelId, desafiante{}, desafiado{}, percent, aposta, data, status:'ativo', endsAt }] }
    router.get('/ui/andamento', async (req, res, next) => {
        try {
            const cpf = String(req.query.cpf || '').replace(/\D/g, '');
            const cycleId = Number(req.query.cycleId);
            if (!cpf || !cycleId) return res.status(400).json({ error: 'cpf e cycleId são obrigatórios' });

            const conn = await pool.getConnection();
            try {
                const broker = await getBrokerBasicByCpf(conn, cpf);
                if (!broker) return res.json({ ok: true, ativos: [] });

                // Duelos ativos do usuário (como desafiante OU desafiado)
                const [rows] = await conn.query(
                    `SELECT d.*,
                pc.nome AS challenger_nome, pc.cpf AS challenger_cpf,
                po.nome AS challenged_nome, po.cpf AS challenged_cpf,
                /* pote aberto (preferível); se 0, usa locked como fallback */
                COALESCE((
                  SELECT SUM(e.amount_open) FROM produtores_duel_escrow e
                   WHERE e.duel_id = d.id
                ),0)       AS pot_open,
                COALESCE((
                  SELECT SUM(e.amount_locked) FROM produtores_duel_escrow e
                   WHERE e.duel_id = d.id
                ),0)       AS pot_locked
         FROM produtores_duel d
         JOIN produtores pc ON pc.id = d.challenger_id
         JOIN produtores po ON po.id = d.challenged_id
        WHERE d.cycle_id=? AND d.status='active'
          AND (d.challenger_id=? OR d.challenged_id=?)
        ORDER BY d.id DESC`,
                    [cycleId, broker.id, broker.id]
                );

                const ativos = rows.map(d => {
                    const pote = Number(d.pot_open || 0) > 0 ? Number(d.pot_open) : Number(d.pot_locked || 0);
                    return {
                        id: String(d.id),
                        duelId: d.id,
                        desafiante: {
                            id: String(d.challenger_id),
                            cpf: d.challenger_cpf || '',
                            nome: d.challenger_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        desafiado: {
                            id: String(d.challenged_id),
                            cpf: d.challenged_cpf || '',
                            nome: d.challenged_nome,
                            posicao: 0, vendas: 0, confirmadas: 0, ativas: 0, confirmadasAtivas: 0,
                            moedas: 0, vitorias: 0, derrotas: 0
                        },
                        percent: Number(d.percent) === 100 ? 100 : 50,
                        // Na UI usamos "aposta" para exibir — aqui enviamos o POTE (soma dos dois lados)
                        aposta: pote,
                        data: new Date(d.created_at || Date.now()).toISOString(),
                        status: 'ativo',
                        endsAt: new Date(d.end_date || Date.now()).getTime()
                    };
                });

                res.json({ ok: true, ativos });
            } finally {
                conn.release();
            }
        } catch (e) { next(e); }
    });

    // GET /api/duelos/ui/period?cycleId=...
    // -> { ok, period: { id, start_date, end_date, hoursLeft } }
    router.get('/ui/period', async (req, res, next) => {
        try {
            const cycleId = Number(req.query.cycleId);
            if (!cycleId) return res.status(400).json({ error: 'cycleId é obrigatório' });

            const conn = await pool.getConnection();
            try {
                const [[p]] = await conn.query(
                    `SELECT id, start_date, end_date
           FROM produtores_duel_period
          WHERE cycle_id=? AND CURDATE() BETWEEN start_date AND end_date
          ORDER BY id LIMIT 1`,
                    [cycleId]
                );
                if (!p) return res.json({ ok: true, period: null });

                const [rowNow] = await conn.query(`SELECT NOW() AS now`);
                const now = new Date(rowNow[0].now);
                const end = new Date(p.end_date);
                const hoursLeft = Math.max(0, Math.floor((end - now) / (1000 * 60 * 60)));

                res.json({
                    ok: true,
                    period: {
                        id: p.id,
                        start_date: p.start_date,
                        end_date: p.end_date,
                        hoursLeft
                    }
                });
            } finally {
                conn.release();
            }
        } catch (e) { next(e); }
    });

    app.use('/api/duelos', router);

    // handler global simples
    app.use((err, req, res, _next) => {
        if (err?.message === 'PERIOD_ENDED') {
            return res.status(400).json({ sucesso: false, mensagem: 'Período encerrado para este duelo.' });
        }
        if (err?.message === 'PERIOD_TOO_CLOSE') {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Não é possível criar duelos nas últimas 48h do período.',
                detalhes: err.details || null
            });
        }
        const msg = err?.message || "Erro interno";
        res.status(500).json({ sucesso: false, mensagem: msg });
    });
};
