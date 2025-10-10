const express = require('express');
const multer = require('multer');
const xlsx = require('node-xlsx');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');

const upload = multer({ dest: path.join(process.cwd(), 'uploads') });

/** dd/mm/yyyy OU serial excel -> 'YYYY-MM-DD' */
function parseBrDateToISO(v) {
    if (v == null) return null;
    if (typeof v === 'number' && isFinite(v)) {
        const ms = Math.round((v - 25569) * 86400 * 1000);
        return new Date(ms).toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

const onlyDigits = s => String(s || '').replace(/\D/g, '');

/** carrega ciclos para mapear cada DATA -> cycle_id */
async function loadCycles(conn) {
    const [rows] = await conn.query(
        `SELECT id AS cycle_id, start_date, end_date FROM produtores_duel_cycle`
    );
    return rows.map(r => ({
        cycle_id: Number(r.cycle_id),
        start: new Date(r.start_date).toISOString().slice(0, 10),
        end: new Date(r.end_date).toISOString().slice(0, 10),
    }));
}
const inRange = (iso, start, end) => iso >= start && iso <= end;

/** cache simples de produtores.id por CPF */
const brokerCache = new Map();
async function getBrokerIdByCpf(conn, cpf) {
    if (brokerCache.has(cpf)) return brokerCache.get(cpf);
    const [[r]] = await conn.query(`SELECT id FROM produtores WHERE cpf=? LIMIT 1`, [cpf]);
    const id = r?.id || null;
    brokerCache.set(cpf, id);
    return id;
}

/** tenta inserir log do upload SE (e só se) a tabela existir e aceitar NULLs compatíveis */
async function tryInsertUploadLog(conn, fileName) {
    try {
        const [tbl] = await conn.query(
            `SELECT 1
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'produtores_duel_upload_batch'
        LIMIT 1`
        );
        if (!tbl.length) return null;

        const [cols] = await conn.query(
            `SELECT column_name, is_nullable
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'produtores_duel_upload_batch'`
        );
        const hasCycle = cols.some(c => c.column_name === 'cycle_id');
        const hasUploadedBy = cols.some(c => c.column_name === 'uploaded_by');
        const hasFileName = cols.some(c => c.column_name === 'file_name');
        const hasUploadedAt = cols.some(c => c.column_name === 'uploaded_at');

        const fields = [];
        const values = [];
        const params = [];

        if (hasCycle) { fields.push('cycle_id'); values.push('?'); params.push(null); }
        if (hasFileName) { fields.push('file_name'); values.push('?'); params.push(fileName); }
        if (hasUploadedBy) { fields.push('uploaded_by'); values.push('?'); params.push(null); }
        if (hasUploadedAt) { fields.push('uploaded_at'); values.push('NOW()'); }

        if (!fields.length) return null;

        const sql = `INSERT INTO produtores_duel_upload_batch (${fields.join(', ')})
                 VALUES (${values.join(', ')})`;
        const [ins] = await conn.query(sql, params);
        return ins.insertId || null;
    } catch {
        return null;
    }
}

module.exports = function mount(app) {
    const router = express.Router();

    router.post('/upload-pontos', upload.single('file'), async (req, res, next) => {
        if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'arquivo ausente (file)' });

        const filePath = req.file.path;
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        let uploadBatchId = null;

        let linhasComCpf = 0;
        let celulasGravadas = 0;
        let combosCpfCiclo = 0;
        let walletsAtualizadas = 0;
        let colDatasMapeadas = 0;
        let colDatasIgnoradas = 0;
        let cpfsSemBroker = 0;

        try {
            const sheets = xlsx.parse(filePath);
            if (!sheets.length) throw new Error('planilha vazia');
            const ws = sheets[0].data || [];
            if (ws.length < 3) throw new Error('planilha deve ter 2 linhas de cabeçalho + ao menos 1 linha de dados');

            const header = ws[1];
            const IDX_CPF = 2;
            const FIRST_COL = 4;

            uploadBatchId = await tryInsertUploadLog(conn, path.basename(req.file.originalname || req.file.filename));

            const cycles = await loadCycles(conn);
            const colMap = [];
            for (let c = FIRST_COL; c < header.length; c++) {
                const label = header[c];
                if (label == null) { colMap[c] = null; colDatasIgnoradas++; continue; }
                const up = String(label).trim().toUpperCase();
                if (up === 'PTS' || up === 'PTS FINAL') { colMap[c] = null; colDatasIgnoradas++; continue; }

                const iso = parseBrDateToISO(label);
                if (!iso) { colMap[c] = null; colDatasIgnoradas++; continue; }

                const match = cycles.find(x => inRange(iso, x.start, x.end));
                if (match) { colMap[c] = { iso, cycleId: match.cycle_id }; colDatasMapeadas++; }
                else { colMap[c] = null; colDatasIgnoradas++; }
            }

            const newTotalsByKey = new Map();
            const prevTotalsByKey = new Map();
            const dayRows = [];

            // percorre as linhas de dados
            for (let r = 2; r < ws.length; r++) {
                const row = ws[r];
                if (!row || row.length < 3) continue;

                const cpf = onlyDigits(row[IDX_CPF]);
                if (!cpf || cpf.length < 11) continue;

                linhasComCpf++;
                const brokerId = await getBrokerIdByCpf(conn, cpf);

                // ✅ AJUSTE: ignorar CPFs sem broker
                if (!brokerId) {
                    cpfsSemBroker++;
                    console.warn(`[UPLOAD XLSX] CPF ${cpf} não encontrado em produtores — ignorando linha ${r + 1}`);
                    continue;
                }

                for (let c = FIRST_COL; c < header.length; c++) {
                    const map = colMap[c];
                    if (!map) continue;

                    const cellVal = (row[c] == null ? 0 : row[c]);
                    const posts = Math.max(0, Number(cellVal || 0));
                    const cap = Math.min(posts * 100, 100);

                    dayRows.push({
                        cpf,
                        brokerId,
                        cycleId: map.cycleId,
                        iso: map.iso,
                        posts,
                        cap
                    });

                    const key = `${cpf}::${map.cycleId}`;
                    newTotalsByKey.set(key, (newTotalsByKey.get(key) || 0) + cap);
                }
            }

            // totais anteriores
            if (newTotalsByKey.size) {
                for (const key of newTotalsByKey.keys()) {
                    const [cpf, cycleIdStr] = key.split('::');
                    const cycleId = Number(cycleIdStr);
                    const [[prev]] = await conn.query(
                        `SELECT COALESCE(SUM(credited_cap),0) AS total
               FROM produtores_duel_daily_points
              WHERE cpf=? AND cycle_id=?`,
                        [cpf, cycleId]
                    );
                    prevTotalsByKey.set(key, Number(prev?.total || 0));
                }
            }

            // UPSERT diário
            for (const d of dayRows) {
                await conn.query(
                    `INSERT INTO produtores_duel_daily_points
             (cpf, broker_id, cycle_id, day_date, posts_count, credited_cap, upload_batch_id, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             broker_id=COALESCE(produtores_duel_daily_points.broker_id, VALUES(broker_id)),
             cycle_id=VALUES(cycle_id),
             posts_count=VALUES(posts_count),
             credited_cap=VALUES(credited_cap),
             upload_batch_id=VALUES(upload_batch_id),
             updated_at=NOW()`,
                    [d.cpf, d.brokerId, d.cycleId, d.iso, d.posts, d.cap, uploadBatchId]
                );
                celulasGravadas++;
            }

            // aplicar DELTA nas carteiras
            for (const [key, totalNovo] of newTotalsByKey.entries()) {
                const [cpf, cycleIdStr] = key.split('::');
                const cycleId = Number(cycleIdStr);

                const totalAnterior = Number(prevTotalsByKey.get(key) || 0);
                const delta = totalNovo - totalAnterior;

                const brokerId = await getBrokerIdByCpf(conn, cpf);

                // ✅ AJUSTE: ignorar CPFs sem broker
                if (!brokerId) {
                    cpfsSemBroker++;
                    console.warn(`[UPLOAD XLSX] Ignorando delta: CPF ${cpf} sem broker_id.`);
                    continue;
                }

                if (!delta) continue;

                await conn.query(
                    `INSERT INTO produtores_duel_wallet (broker_id, cycle_id, balance, escrow, updated_at)
             VALUES (?, ?, 0, 0, NOW())
             ON DUPLICATE KEY UPDATE updated_at = NOW()`,
                    [brokerId, cycleId]
                );

                const [upd] = await conn.query(
                    `UPDATE produtores_duel_wallet
              SET balance = balance + ?, updated_at = NOW()
            WHERE broker_id=? AND cycle_id=?`,
                    [delta, brokerId, cycleId]
                );

                if (upd.affectedRows > 0) {
                    walletsAtualizadas++;
                    await conn.query(
                        `INSERT INTO produtores_duel_wallet_ledger
               (broker_id, cycle_id, kind, amount, ref_duel_id, meta_json, created_at)
             VALUES (?,?,?,?,NULL, JSON_OBJECT('source','UPLOAD_XLSX'), NOW())`,
                        [brokerId, cycleId, 'POSTS_DELTA', delta]
                    );
                }
            }

            await conn.commit();
            res.json({
                ok: true,
                linhasComCpf,
                celulasGravadas,
                combosCpfCiclo: newTotalsByKey.size,
                walletsAtualizadas,
                colDatasMapeadas,
                colDatasIgnoradas,
                cpfsSemBroker
            });
        } catch (err) {
            await conn.rollback();
            next(err);
        } finally {
            conn.release();
            try { fs.unlinkSync(filePath); } catch { }
        }
    });

    app.use('/api/duelos', router);
};
