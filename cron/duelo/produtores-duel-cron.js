// jobs/produtores-duel-cron.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const cron = require('node-cron');
const axios = require('axios');
const mysql = require('mysql2/promise');
const moment = require('moment');
const { createLogger } = require('../../utils/logs/logger');

const log = createLogger('cron', 'duels', 'produtores-duel-cron');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dialect: "mysql",
    timezone: '-03:00',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});
// ==============================
// JOB 1: Expirar duelos pendentes
// ==============================
async function expirePendings() {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const [rows] = await conn.query(`
      SELECT id FROM produtores_duel 
      WHERE status='pending' AND accept_by < NOW()
      FOR UPDATE
    `);
        for (const r of rows) {
            await conn.query(`CALL sp_produtores_duel_expire(?)`, [r.id]);
        }
        await conn.commit();
        console.log(`⏰ ${rows.length} duelos expirados`);
        return rows.length;
    } catch (err) {
        await conn.rollback();
        console.error('Erro ao expirar duelos:', err);
        return 0;
    } finally {
        conn.release();
    }
}

// ==============================
// JOB 2: Finalizar duelos encerrados
// ==============================
async function settleFinished() {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const [rows] = await conn.query(`
            SELECT id 
            FROM produtores_duel 
            WHERE status IN ('active','pending') 
              AND DATE(end_date) < CURDATE()
            FOR UPDATE
        `);

        if (rows.length === 0) {
            console.log(`🏁 Nenhum duelo pendente de liquidação.`);
            await conn.commit();
            return 0;
        }

        console.log(`🏁 Encontrados ${rows.length} duelos para liquidar...`);

        for (const r of rows) {
            try {
                const apiUrl = `https://apis.easyplan.com.br:3088/api/duelos/duels/${r.id}/settle`;
                const response = await axios.post(apiUrl, {}, {
                    timeout: 30000, // 30s por segurança
                });
                console.log(`✅ Duelo ${r.id} liquidado:`, response.data?.result || 'ok');
            } catch (err) {
                console.error(`❌ Erro ao liquidar duelo ${r.id}:`, err.response?.data || err.message);
            }
        }

        await conn.commit();
        console.log(`🏁 Liquidação concluída de ${rows.length} duelos.`);
        return rows.length;

    } catch (err) {
        await conn.rollback();
        console.error('Erro ao liquidar duelos:', err);
        return 0;
    } finally {
        conn.release();
    }
}

// ==============================
// JOB 3: Atualizar ranking por vigência
// ==============================
async function updateVigenciaRankings() {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const [vigencias] = await conn.query(`
      SELECT id, cycle_id, name 
      FROM produtores_duel_vigencia
      WHERE CURDATE() BETWEEN start_date AND end_date
    `);
        for (const v of vigencias) {
            console.log(`📊 Atualizando ranking da vigência ${v.name} (ID ${v.id})...`);
            await conn.query(`DELETE FROM produtores_duel_ranking_vigencia WHERE vigencia_id=?`, [v.id]);
            const [rows] = await conn.query(`
        SELECT 
          w.broker_id,
          p.cpf,
          p.nome,
          COALESCE(SUM(w.balance),0) AS moedas,
          COALESCE(SUM(CASE WHEN l.kind='ESCROW_RELEASE_WIN' THEN 1 ELSE 0 END),0) AS vitorias,
          COALESCE(SUM(CASE WHEN l.kind='ESCROW_RELEASE_OUT' THEN 1 ELSE 0 END),0) AS derrotas
        FROM produtores_duel_wallet w
        JOIN produtores p ON p.id = w.broker_id
        LEFT JOIN produtores_duel_wallet_ledger l 
               ON l.broker_id = w.broker_id AND l.cycle_id = w.cycle_id
        WHERE w.cycle_id = ?
        GROUP BY w.broker_id
        ORDER BY moedas DESC
      `, [v.cycle_id]);

            let pos = 1;
            for (const r of rows) {
                await conn.query(`
          INSERT INTO produtores_duel_ranking_vigencia
          (vigencia_id, broker_id, cpf, nome, posicao, moedas, vitorias, derrotas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [v.id, r.broker_id, r.cpf, r.nome, pos++, r.moedas, r.vitorias, r.derrotas]);
            }
        }
        await conn.commit();
        console.log(`✅ Ranking(s) de vigência atualizado(s): ${vigencias.length}`);
    } catch (err) {
        await conn.rollback();
        console.error('Erro ao atualizar ranking de vigência:', err);
    } finally {
        conn.release();
    }
}

// ==============================
// JOB 4: Atualizar ranking acumulado do ciclo
// ==============================
async function updateCycleRankings() {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const [cycles] = await conn.query(`
      SELECT id, name FROM produtores_duel_cycle
      WHERE CURDATE() BETWEEN start_date AND end_date
    `);
        for (const c of cycles) {
            console.log(`🏆 Atualizando ranking do ciclo ${c.name}...`);
            await conn.query(`DELETE FROM produtores_duel_ranking_ciclo WHERE cycle_id=?`, [c.id]);
            const [rows] = await conn.query(`
        SELECT 
          w.broker_id,
          p.cpf,
          p.nome,
          COALESCE(SUM(w.balance),0) AS moedas,
          COALESCE(SUM(CASE WHEN l.kind='ESCROW_RELEASE_WIN' THEN 1 ELSE 0 END),0) AS vitorias,
          COALESCE(SUM(CASE WHEN l.kind='ESCROW_RELEASE_OUT' THEN 1 ELSE 0 END),0) AS derrotas
        FROM produtores_duel_wallet w
        JOIN produtores p ON p.id = w.broker_id
        LEFT JOIN produtores_duel_wallet_ledger l 
               ON l.broker_id = w.broker_id AND l.cycle_id = w.cycle_id
        WHERE w.cycle_id = ?
        GROUP BY w.broker_id
        ORDER BY moedas DESC
      `, [c.id]);

            let pos = 1;
            for (const r of rows) {
                await conn.query(`
          INSERT INTO produtores_duel_ranking_ciclo
          (cycle_id, broker_id, cpf, nome, posicao, moedas, vitorias, derrotas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [c.id, r.broker_id, r.cpf, r.nome, pos++, r.moedas, r.vitorias, r.derrotas]);
            }
        }
        await conn.commit();
        console.log(`🥇 Ranking(s) de ciclo atualizado(s): ${cycles.length}`);
    } catch (err) {
        await conn.rollback();
        console.error('Erro ao atualizar ranking de ciclo:', err);
    } finally {
        conn.release();
    }
}

// ==============================
// EXPORTS & AGENDAMENTO
// ==============================
const jobExpirePendings = cron.schedule('*/10 * * * *', expirePendings, { timezone: 'America/Sao_Paulo' });
const jobSettleFinished = cron.schedule('0 * * * *', settleFinished, { timezone: 'America/Sao_Paulo' });
const jobUpdateVigenciaRanking = cron.schedule('15 0 * * *', updateVigenciaRankings, { timezone: 'America/Sao_Paulo' });
const jobUpdateCycleRanking = cron.schedule('20 0 * * *', updateCycleRankings, { timezone: 'America/Sao_Paulo' });

module.exports = {
    jobExpirePendings,
    jobSettleFinished,
    jobUpdateVigenciaRanking,
    jobUpdateCycleRanking
};