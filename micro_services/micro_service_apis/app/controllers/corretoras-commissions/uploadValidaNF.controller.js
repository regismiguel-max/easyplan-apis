const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

const db = require("../../../../../models");
const SubLoteCommissions = db.corretoras_subLoteCommissions;
const Empresa = db.corretoras_commission_empresa;
const SystemConfigCheck = db.systemConfigCheck;

/* ========================= Config ========================= */
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowed = ['application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Arquivo inválido. Envie a NFS-e em PDF original (gerado pelo sistema emissor).'), false);
};
const upload = multer({ storage, fileFilter });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEXT_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o';

const PDFTOPPM_PATH = process.env.PDFTOPPM_PATH || null; // ex: C:\Program Files\poppler\bin\pdftoppm.exe
const POPPLER_BIN = process.env.POPPLER_BIN || null;     // ex: C:\Program Files\poppler\bin
const VISION_PAGES = Math.max(1, Math.min(2, parseInt(process.env.NF_VISION_PAGES || '2', 10)));
const VISION_SCALE_TO = parseInt(process.env.NF_VISION_SCALE_TO || '2000', 10);
const VISION_DPI = parseInt(process.env.NF_VISION_DPI || '0', 10);

/* ——— NEW: flag para ligar/desligar cross-check por visão ——— */
const VISION_CROSSCHECK = (process.env.NF_VISION_CROSSCHECK || 'true').toLowerCase() === 'true';

/* ========================= Helpers ========================= */
const onlyDigits = (s = '') => String(s).replace(/\D/g, '');

/** Normaliza dinheiro com suporte a pt-BR e en-US. */
function normalizeMoneySmart(input) {
    if (input === null || input === undefined) return null;
    if (typeof input === 'number' && Number.isFinite(input)) {
        return Number(input.toFixed(2));
    }
    let s = String(input)
        .replace(/\u00A0/g, ' ')
        .replace(/[Rr]\$\s?/g, '')
        .trim()
        .replace(/\s+/g, '');
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    const ptPattern = /^\d{1,3}(?:\.\d{3})+(?:,\d{2})$/;  // 1.234,56
    const usPattern = /^\d{1,3}(?:,\d{3})+(?:\.\d{2})$/;  // 1,234.56
    if (ptPattern.test(s)) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (usPattern.test(s)) {
        s = s.replace(/,/g, '');
    } else if (hasDot && hasComma) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (hasComma && !hasDot) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasDot && !hasComma) {
        const dotCount = (s.match(/\./g) || []).length;
        if (dotCount > 1 && !/\.\d{1,2}$/.test(s)) {
            s = s.replace(/\./g, '');
        }
    }
    const n = Number(s);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function parseMoneyPtBR(line) {
    if (!line) return null;
    const m = String(line).match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/);
    if (!m) return null;
    const n = m[1].replace(/\./g, '').replace(',', '.');
    const f = Number(n);
    return Number.isFinite(f) ? f.toFixed(2) : null;
}

/** Tenta dinheiro em pt-BR ou en-US em qualquer linha curta. */
function parseMoneyAny(line) {
    if (!line) return null;
    const s = String(line);
    const pt = s.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/);
    if (pt) return parseMoneyPtBR(s);
    const us = s.match(/(?:R\$\s*)?(\d{1,3}(?:,\d{3})+\.\d{2})(?!\d)/);
    if (us) {
        const n = Number(us[1].replace(/,/g, ''));
        return Number.isFinite(n) ? n.toFixed(2) : null;
    }
    const simple = s.match(/(?:R\$\s*)?(\d+\.\d{2})(?!\d)/);
    if (simple) {
        const n = Number(simple[1]);
        return Number.isFinite(n) ? n.toFixed(2) : null;
    }
    return null;
}

function isValidCPF(cpf) {
    cpf = onlyDigits(cpf);
    if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0; if (d1 !== parseInt(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === parseInt(cpf[10]);
}

function isValidCNPJ(cnpj) {
    cnpj = onlyDigits(cnpj);
    if (!cnpj || cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const calc = (x) => {
        let n = 0, pos = x - 7;
        for (let i = 0; i < x; i++) { n += parseInt(cnpj[i]) * (pos--); if (pos < 2) pos = 9; }
        const r = n % 11;
        return (r < 2) ? 0 : 11 - r;
    };
    const d1 = calc(12), d2 = calc(13);
    return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}

function removerAcentos(str = '') {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function mapMesParaNumero(nomeMesRaw = '') {
    const s = removerAcentos(String(nomeMesRaw).trim().toLowerCase());
    const mapa = {
        jan: '01', janeiro: '01',
        fev: '02', fevereiro: '02',
        mar: '03', marco: '03', 'mar.': '03',
        abr: '04', abril: '04',
        mai: '05', maio: '05',
        jun: '06', junho: '06',
        jul: '07', julho: '07',
        ago: '08', agosto: '08',
        set: '09', setembro: '09',
        out: '10', outubro: '10',
        nov: '11', novembro: '11',
        dez: '12', dezembro: '12'
    };
    if (mapa[s]) return mapa[s];
    const k = s.slice(0, 3);
    return mapa[k] || null;
}

/** Normaliza competência para "mm/aaaa". */
function normalizarCompetencia(valor) {
    if (!valor) return valor;
    let s = String(valor).trim().replace(/-/g, '/').replace(/\s+de\s+/gi, ' ').replace(/\s+/g, ' ');
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${String(m[2]).padStart(2, '0')}/${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{4})$/); if (m) return `${String(m[1]).padStart(2, '0')}/${m[2]}`;
    m = s.match(/^([A-Za-zçãâáéíóúõêô.]+)[\/\s]+(\d{4})$/i);
    if (m) { const mm = mapMesParaNumero(m[1]); if (mm) return `${mm}/${m[2]}`; }
    m = s.match(/^(\d{4})\/(\d{1,2})$/); if (m) return `${String(m[2]).padStart(2, '0')}/${m[1]}`;
    return valor;
}

/** Aceita: "dd/mm/aaaa [HH:mm:ss]", "yyyy-mm-dd[THH:mm:ss]", "mm/aaaa" */
function parseDataOuCompetencia(valor) {
    if (!valor) return null;
    const s = String(valor).trim();
    let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[2], +m[1] - 1, 1);
    return null;
}
function soDia(d) { if (!(d instanceof Date) || isNaN(d)) return null; return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/* ---------- OCR helpers para CNPJ/CPF ---------- */
function normalizeOcrCharsToDigits(raw = '') {
    return String(raw)
        .replace(/[OoDd]/g, '0')
        .replace(/[Il]/g, '1')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8');
}
function hamming14(a, b) {
    if (!a || !b || a.length !== 14 || b.length !== 14) return Infinity;
    let d = 0; for (let i = 0; i < 14; i++) if (a[i] !== b[i]) d++;
    return d;
}

/* ============== Pós-processo a partir das "fontes" (fallback visão) ============== */
function tryFixValorFromFontes(campos) {
    if (campos.valorTotal) return campos;
    const linhas = campos._fontes?.linhasRelevantes || [];
    if (!linhas.length) return campos;

    const POS = /VALOR\s+(DOS|DE)\s+SERVI[CÇ]OS|TOTAL\s+DOS\s+SERVI[CÇ]OS|VALOR\s+TOTAL\s+(DA\s+NOTA|DA\s+NFS-E)|VALOR\s+BRUTO/i;
    const NEG = /ISS|ISSQN|ALIQUOTA|ALIQ|TRIBUTO|IMPOSTO|IRRF|PIS|COFINS|CSLL|INSS|LIQUIDO|RETEN|RETIDO/i;

    const parseMoney = (s) => {
        const m = String(s).match(/(?:R\$\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2})/);
        if (!m) return null;
        let x = m[0].replace(/\s+/g, '');
        const hasComma = /,\d{2}$/.test(x);
        if (hasComma) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, '');
        const n = Number(x.replace(/[^\d.]/g, ''));
        return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
    };

    for (const lin of linhas) {
        if (NEG.test(lin)) continue;
        if (POS.test(lin)) {
            const n = parseMoney(lin);
            if (Number.isFinite(n)) {
                campos.valorTotal = n.toFixed(2);
                campos._valorBrutoFonte = 'fontes';
                return campos;
            }
        }
    }
    for (const lin of linhas) {
        if (NEG.test(lin)) continue;
        const n = parseMoney(lin);
        if (Number.isFinite(n)) {
            campos.valorTotal = n.toFixed(2);
            campos._valorBrutoFonte = 'fontes';
            return campos;
        }
    }
    return campos;
}

function tryFixDocFromFontes(docAtual, linhas) {
    if (docAtual && (isValidCNPJ(docAtual) || isValidCPF(docAtual))) return docAtual;
    for (const lin of (linhas || [])) {
        if (/\binscr[ií]c[aã]o|\bim\b|\bie\b|estadual|municipal/i.test(lin)) continue;
        const m = lin.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/);
        if (!m) continue;
        let d = normalizeOcrCharsToDigits(m[1]).replace(/\D/g, '');
        d = d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
        const ok = d.length === 14 ? isValidCNPJ(d) : d.length === 11 ? isValidCPF(d) : false;
        if (ok) return d;
    }
    return docAtual;
}

function tryFixDocFromFontesByRole(docAtual, fontes, role /* 'prestador' | 'tomador' */) {
    const linhas = fontes?.linhasRelevantes || [];
    if (!linhas.length) return docAtual;

    const reBan = /\binscr[ií]c[aã]o|\bim\b|\bie\b|estadual|municipal/i;
    const reDocHint = /(cnpj|cpf)/i;

    for (const lin of linhas) {
        if (!reDocHint.test(lin)) continue;
        if (reBan.test(lin)) continue;
        const m = lin.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/);
        if (!m) continue;
        let d = normalizeOcrCharsToDigits(m[1]).replace(/\D/g, '');
        d = d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
        const ok = d.length === 14 ? isValidCNPJ(d) : d.length === 11 ? isValidCPF(d) : false;
        if (ok) return d;
    }
    for (const lin of linhas) {
        if (reBan.test(lin)) continue;
        const m = lin.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/);
        if (!m) continue;
        let d = normalizeOcrCharsToDigits(m[1]).replace(/\D/g, '');
        d = d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
        const ok = d.length === 14 ? isValidCNPJ(d) : d.length === 11 ? isValidCPF(d) : false;
        if (ok) return d;
    }
    return tryFixDocFromFontes(docAtual, linhas);
}

function tryFixDataFromFontes(campos) {
    if (campos.dataEmissao) return campos;
    const linhas = campos._fontes?.linhasRelevantes || [];
    for (const lin of linhas) {
        const m = String(lin).match(/(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/\d{4}/);
        if (m) { campos.dataEmissao = m[0]; break; }
    }
    return campos;
}

/* ====== Fuzzy a partir de fontes + esperados (corrige OCR como 086->586) ====== */
function fuzzyAssignDocs(campos, fontes, prestadorEsperado, tomadorEsperado) {
    const P = onlyDigits(prestadorEsperado || '');
    const T = onlyDigits(tomadorEsperado || '');
    const linhas = fontes?.linhasRelevantes || [];

    // Coleta candidatos (mesmo se checksum inválido)
    const cand = [];
    for (const lin of linhas) {
        if (/\binscr[ií]c[aã]o|\bim\b|\bie\b|estadual|municipal/i.test(lin)) continue;
        const norm = normalizeOcrCharsToDigits(lin);
        const m = norm.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/g);
        if (!m) continue;
        for (const raw of m) {
            const d = onlyDigits(raw);
            if ((d.length === 14 || d.length === 11) && !cand.includes(d)) cand.push(d);
        }
    }

    let p = onlyDigits(campos.prestadorCpfCnpj || '');
    let t = onlyDigits(campos.tomadorCpfCnpj || '');

    // Se p==t ou tomador vazio, tenta “puxar” T dos candidatos por proximidade
    if ((!t || p === t) && T && cand.length) {
        if (cand.includes(T)) {
            t = T;
            campos._autocorrecao = (campos._autocorrecao || '') + '|tomador_exact_fontes';
        } else {
            let best = null, bestD = Infinity;
            for (const c of cand) {
                if (c.length !== 14) continue;
                const d = hamming14(c, T);
                if (d < bestD) { bestD = d; best = c; }
            }
            if (best !== null && bestD <= 2) {
                t = T; // corrige para o esperado (near-match)
                campos._autocorrecao = (campos._autocorrecao || '') + `|tomador_fuzzy(d=${bestD})`;
            }
        }
    }

    // Se prestador vazio/igual ao tomador, tenta “puxar” P
    if ((!p || p === t) && P && cand.length) {
        if (cand.includes(P)) {
            p = P;
            campos._autocorrecao = (campos._autocorrecao || '') + '|prestador_exact_fontes';
        } else {
            let best = null, bestD = Infinity;
            for (const c of cand) {
                if (c.length !== 14) continue;
                const d = hamming14(c, P);
                if (d < bestD) { bestD = d; best = c; }
            }
            if (best !== null && bestD <= 2) {
                p = P;
                campos._autocorrecao = (campos._autocorrecao || '') + `|prestador_fuzzy(d=${bestD})`;
            }
        }
    }

    if (p) campos.prestadorCpfCnpj = p;
    if (t) campos.tomadorCpfCnpj = t;
    return campos;
}

/* ====== FALLBACK DETERMINÍSTICO NO TEXTO (âncora + ranking) ====== */
function extrairValorBrutoDeterministico(texto) {
    if (!texto) return null;

    const NBSP = /\u00A0/g;
    const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const toFlat = s => strip(String(s || ''))
        .replace(NBSP, ' ')
        .replace(/\s+/g, ' ')
        .toUpperCase();

    const flat = toFlat(texto);
    const MONEY = '(?:R\\$\\s*)?((?:\\d{1,3}(?:[.\\s]\\d{3})+|\\d+)[.,]\\d{2})';

    const anchors = [
        /VALOR\s+TOTAL\s+DOS\s+SERVI[CÇ]OS/gi,
        /VALOR\s+DOS\s+SERVI[CÇ]OS/gi,
        /TOTAL\s+DOS\s+SERVI[CÇ]OS/gi,
        /VALOR\s+TOTAL\s+DA\s+(?:NOTA|NFS-?E)/gi,
        /VALOR\s+BRUTO(?:\s+DOS\s+SERVI[CÇ]OS)?/gi,
        /VL\.?\s+TOTAL\s+DOS\s+SERVI[CÇ]OS/gi,
        /VL\.?\s+DOS\s+SERVI[CÇ]OS/gi,
        /VALOR\s+TOTAL\s+DOS\s+SERVICOS\s+PRESTADOS/gi,
        /TOTAL\s+SERVI[CÇ]OS/gi,
    ];
    const NEG_BETWEEN = /(ISS|ISSQN|ALIQUOTA|ALIQ|IRRF|PIS|COFINS|CSLL|INSS|RETEN|RETIDO|LIQUIDO|DEDU|DESCONTO)/i;

    for (const a of anchors) {
        a.lastIndex = 0;
        let m;
        while ((m = a.exec(flat)) !== null) {
            const start = m.index + m[0].length;
            const look = flat.slice(start, start + 180);
            if (NEG_BETWEEN.test(look)) {
                const mm = look.match(new RegExp('^\\s*' + MONEY, 'i')) || look.match(new RegExp(MONEY, 'i'));
                if (mm) {
                    const posNum = look.indexOf(mm[1]);
                    const posNeg = look.search(NEG_BETWEEN);
                    if (posNeg !== -1 && posNeg < posNum) continue;
                    let s = mm[1].replace(/\s+/g, '');
                    const br = /,\d{2}$/.test(s);
                    if (br) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
                    const n = Number(s);
                    if (Number.isFinite(n) && n > 0) return n.toFixed(2);
                }
                continue;
            }
            const mm = look.match(new RegExp(MONEY, 'i'));
            if (mm && mm[1]) {
                let s = mm[1].replace(/\s+/g, '');
                const br = /,\d{2}$/.test(s);
                if (br) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
                const n = Number(s);
                if (Number.isFinite(n) && n > 0) return n.toFixed(2);
            }
        }
    }

    // Fallback por linhas com ranking
    const normLine = s => toFlat(s).trim();
    const lines = String(texto || '').replace(/\r\n/g, '\n').split('\n').map((orig, i) => ({ i, orig, norm: normLine(orig) }));

    const POS_PRIMARY = [
        'VALOR TOTAL DOS SERVICOS',
        'VALOR DOS SERVICOS',
        'TOTAL DOS SERVICOS',
        'VALOR TOTAL DA NOTA',
        'VALOR TOTAL DA NFS-E',
        'VALOR BRUTO',
        'VALOR BRUTO DOS SERVICOS',
        'VL. TOTAL DOS SERVICOS',
        'VL TOTAL DOS SERVICOS',
        'VL. DOS SERVICOS',
        'VALOR TOTAL DOS SERVICOS PRESTADOS',
        'TOTAL SERVICOS'
    ];
    const POS_SECONDARY = ['VALOR DO SERVICO', 'VALOR DE SERVICO', 'TOTAL GERAL', 'VALOR CONTABIL', 'TOTAL NOTA'];
    const NEG_STRONG = [
        'VALOR DO ISS', 'ISS', 'ISSQN', 'ALIQUOTA', 'ALIQ', 'IMPOSTO', 'TRIBUTO',
        'IRRF', 'PIS', 'COFINS', 'CSLL', 'INSS', 'RETEN', 'RETIDO', 'RETENCAO',
        'LIQUIDO', 'VALOR LIQUIDO', 'LIQ', 'DEDU', 'DESCONTO'
    ];

    const MONEY_REGEX = /(?:R\$\s*)?((?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2}))/g;
    const parseMoney = s => {
        s = String(s).replace(/\s+/g, '');
        const br = /,\d{2}$/.test(s);
        if (br) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
        const n = Number(s);
        return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
    };
    const includesAny = (hay, arr) => arr.some(t => hay.includes(t));
    const win = (idx, span = 1) => {
        const lo = Math.max(0, idx - span), hi = Math.min(lines.length - 1, idx + span);
        return Array.from({ length: hi - lo + 1 }, (_, k) => lines[lo + k].norm).join(' \n ');
    };

    const candidates = [];
    for (const line of lines) {
        let m; MONEY_REGEX.lastIndex = 0;
        const found = [];
        while ((m = MONEY_REGEX.exec(line.orig)) !== null) found.push({ raw: m[0], core: m[1], idx: m.index });
        if (!found.length) continue;

        const near = win(line.i, 1);
        const negHere = includesAny(line.norm, NEG_STRONG);
        const negNear = includesAny(near, NEG_STRONG);
        const p1Here = includesAny(line.norm, POS_PRIMARY);
        const p1Near = includesAny(near, POS_PRIMARY);
        const p2Here = includesAny(line.norm, POS_SECONDARY);
        const p2Near = includesAny(near, POS_SECONDARY);

        for (const mm of found) {
            const val = parseMoney(mm.core);
            if (!Number.isFinite(val)) continue;
            const tail = line.orig.slice(mm.idx, mm.idx + mm.raw.length + 5);
            if (!/\bR\$\s*/.test(mm.raw) && /%/.test(tail) && val <= 1) continue;

            let score = 0;
            if (p1Here) score += 80; else if (p1Near) score += 35;
            if (!p1Here && !p1Near) { if (p2Here) score += 25; else if (p2Near) score += 10; }
            if (/\bR\$\s*/.test(mm.raw)) score += 6;
            if (negHere) score -= 70; else if (negNear) score -= 35;
            if (val === 0) score -= 50;
            if (/[:\-–]\s*(R\$\s*)?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{2})\b/.test(line.orig)) score += 8;

            candidates.push({ i: line.i, val, score, lineOrig: line.orig, lineNorm: line.norm, p1Here });
        }
    }
    if (!candidates.length) return null;

    candidates.sort((a, b) => b.score - a.score);
    const withPrimaryHere = candidates.filter(c => c.p1Here);
    let winner = withPrimaryHere.length ? withPrimaryHere[0] : candidates[0];
    if (winner.val === 0) {
        const alt = candidates.find(c => c.val > 0 && c.score >= winner.score - 15);
        if (alt) winner = alt;
    }
    return Number(winner.val).toFixed(2);
}

function extrairDataEmissaoDeterministica(texto) {
    if (!texto) return null;

    const t = removerAcentos(String(texto))
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const padroes = [
        /data\s*(?:\/|e)?\s*hora\s*(?:de|da)?\s*emiss[aã]o[^0-9]{0,40}((?:\d{1,2}\/){2}\d{4})/i,
        /data\s*(?:de)?\s*emiss[aã]o[^0-9]{0,40}((?:\d{1,2}\/){2}\d{4})/i,
        /compet[ea]ncia\s*\/\s*emiss[aã]o[^0-9]{0,40}((?:\d{1,2}\/){2}\d{4})/i,
        /emiss[aã]o[^0-9]{0,40}((?:\d{1,2}\/){2}\d{4})/i
    ];

    for (const re of padroes) {
        const m = t.match(re);
        if (m && m[1]) {
            const [d, mth, y] = m[1].split('/').map(s => s.padStart(2, '0'));
            return `${d}/${mth}/${y}`;
        }
    }

    const idx = t.indexOf('emissa');
    if (idx >= 0) {
        const janela = t.slice(idx, idx + 120);
        const m = janela.match(/(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/\d{4}/);
        if (m) {
            const [d, mth, y] = m[0].split('/').map(s => s.padStart(2, '0'));
            return `${d}/${mth}/${y}`;
        }
    }

    const idxData = t.indexOf('data');
    if (idxData >= 0) {
        const janela = t.slice(idxData, idxData + 120);
        const m = janela.match(/(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/\d{4}/);
        if (m) {
            const [d, mth, y] = m[0].split('/').map(s => s.padStart(2, '0'));
            return `${d}/${mth}/${y}`;
        }
    }
    return null;
}

/* ========================= IA (TEXTO) ========================= */
async function extrairCamposComGPT(texto) {
    const prompt = `
Você é um extrator de dados de NFS-e (Brasil). Leia o TEXTO e retorne SOMENTE JSON válido.

Conceitos obrigatórios (NÃO confundir):
- PRESTADOR: quem EMITE a NFS-e (seção "Dados do Prestador de Serviço" ou equivalente). Em alguns municípios aparece como "EMITENTE" ou "EMITENTE DA NFS-e": trate **EMITENTE = PRESTADOR**.
- TOMADOR: quem CONTRATA os serviços (seção "Dados do Tomador de Serviços" ou equivalente). Também pode aparecer como "DESTINATÁRIO" ou "CONTRATANTE".

Regras de formatação:
- "numeroNota": somente dígitos.
- "valorTotal": número com ponto decimal (ex.: "1200.00").
- Datas: "dd/mm/aaaa".
- CNPJs/CPFs: somente dígitos.
- "competencia": "dd/mm/aaaa" OU "mm/aaaa".
- Se a competência vier com mês por extenso (ex.: "Agosto/2025" ou "Agosto de 2025"), CONVERTER para "mm/aaaa".

Regras para prestador/tomador:
1) Se existir seção explícita **"Dados do Prestador de Serviço"** ou **"EMITENTE"**, o CNPJ/CPF DELA vai para "prestadorCPF/CNPJ".
2) Se existir seção explícita **"Dados do Tomador de Serviços"** (ou "DESTINATÁRIO"/"CONTRATANTE"), o CNPJ/CPF DELA vai para "tomadorCPF/CNPJ".
3) NÃO usar **Inscrição Municipal/Estadual (IM/IE)** como documento; apenas CNPJ/CPF (11/14 dígitos).
4) NÃO inverter quando ambas seções existirem.

Além dos campos, inclua um objeto "fontes" com:
- "prestadorSecao": nome da seção/linha base usada
- "tomadorSecao": nome da seção/linha base usada
- "linhasRelevantes": até 3 linhas curtas, priorizando as linhas que contêm "CNPJ" ou "CPF" e o valor total.

Estrutura de saída (retorne SOMENTE isso):
{
  "dataGeração ou dataEmissão": "...",
  "numeroNota": "...",
  "valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido": "...",
  "competencia": "...",
  "prestadorCPF/CNPJ": "...",
  "tomadorCPF/CNPJ": "...",
  "fontes": {
    "prestadorSecao": "...",
    "tomadorSecao": "...",
    "linhasRelevantes": ["...", "..."]
  }
}

TEXTO:
"""
${texto}
"""
`.trim();

    try {
        const completion = await openai.chat.completions.create({
            model: TEXT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' },
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Erro ao extrair dados com GPT (texto):', error);
        return null;
    }
}

/* ========================= VISÃO: PDF -> PNG ========================= */
async function pdfBufferToPngPaths(buffer, { from = 1, to = VISION_PAGES, scaleTo = VISION_SCALE_TO } = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-'));
    const pdfPath = path.join(tmpDir, 'input.pdf');
    fs.writeFileSync(pdfPath, buffer);

    const outPrefix = path.join(tmpDir, 'page');
    const execFileAsync = promisify(execFile);

    const args = ['-f', String(from), '-l', String(to), '-png'];
    if (Number.isFinite(VISION_DPI) && VISION_DPI > 0) {
        args.push('-rx', String(VISION_DPI), '-ry', String(VISION_DPI));
    } else {
        args.push('-scale-to', String(scaleTo));
    }
    args.push(pdfPath, outPrefix);

    const binDir = (POPPLER_BIN && fs.existsSync(POPPLER_BIN)) ? POPPLER_BIN : null;
    const pdfToPpmCmd =
        (PDFTOPPM_PATH && fs.existsSync(PDFTOPPM_PATH)) ? PDFTOPPM_PATH : 'pdftoppm';
    const mergedEnv = binDir
        ? { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` }
        : process.env;

    try {
        await execFileAsync(pdfToPpmCmd, args, { windowsHide: true, env: mergedEnv });
    } catch (err) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
        const msg = `pdftoppm (Poppler) não encontrado/sem acesso. Configure PDFTOPPM_PATH ou POPPLER_BIN. Comando: ${pdfToPpmCmd}`;
        const e = new Error(msg); e.original = err; throw e;
    }

    const resultPaths = [];
    for (let i = from; i <= to; i++) {
        const p = `${outPrefix}-${i}.png`;
        if (fs.existsSync(p)) resultPaths.push(p);
    }
    if (!resultPaths.length) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { }
        throw new Error('Falha ao converter PDF em imagens.');
    }

    return {
        paths: resultPaths,
        cleanup: () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) { } }
    };
}

function fileToDataUrl(pngPath) {
    const b64 = fs.readFileSync(pngPath).toString('base64');
    return `data:image/png;base64,${b64}`;
}

/* ========================= IA (VISÃO) ========================= */
async function extrairCamposComVisionFromPngs(pngPaths) {
    const images = pngPaths.slice(0, VISION_PAGES).map(fileToDataUrl);

    const content = [
        {
            type: 'text',
            text:
                `Você é um extrator de dados de NFS-e (Brasil). Analise AS IMAGENS e retorne SOMENTE JSON válido.

Conceitos (NÃO confundir):
- PRESTADOR = quem EMITE (seção "Dados do Prestador de Serviço"). Em alguns municípios aparece como "EMITENTE" ou "EMITENTE DA NFS-e": trate **EMITENTE = PRESTADOR**.
- TOMADOR   = quem CONTRATA (seção "Dados do Tomador de Serviços", "DESTINATÁRIO" ou "CONTRATANTE").

Regras:
- "numeroNota": somente dígitos (NÃO usar RPS/Série/Código de Verificação).
- "valorTotal": BRUTO (Valor dos Serviços / Valor Total dos Serviços / Total dos Serviços). Nunca líquido/retido/deduções/ISS/INSS/IRRF/PIS/COFINS/CSLL.
- Datas: "dd/mm/aaaa".
- CNPJ/CPF: somente dígitos (11 ou 14).
- "competencia": "dd/mm/aaaa" OU "mm/aaaa". Se vier por extenso ("Agosto/2025"), CONVERTER para "mm/aaaa".
- SEMPRE preencha todas as chaves. Se não achar, use "".

ATENÇÃO (obrigatório para documentos):
- NÃO confundir CNPJ/CPF com **Inscrição Municipal/Estadual** (IM/IE). IGNORE qualquer número rotulado como "Inscrição", "Inscrição Municipal", "Inscrição Estadual", "IM" ou "IE".
- Extraia o CNPJ/CPF **da linha que contenha “CNPJ” ou “CPF”** dentro da seção correspondente. Se ambos aparecerem, use **CNPJ**.
- Se houver “CNPJ/CPF: xxx”, use esse valor, e não números em outras linhas próximas.

Inclua "fontes" com:
- "prestadorSecao"
- "tomadorSecao"
- "linhasRelevantes": até 3 linhas curtas, priorizando as **linhas utilizadas** (ex.: "CNPJ/CPF: 27.252.086/0001-04", "Vl. Total dos Serviços R$ 931,49").`
        },
        ...images.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))
    ];

    const schema = {
        name: "nfse_extracao",
        strict: true,
        schema: {
            type: "object",
            additionalProperties: false,
            required: [
                "dataGeração ou dataEmissão",
                "numeroNota",
                "valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido",
                "competencia",
                "prestadorCPF/CNPJ",
                "tomadorCPF/CNPJ",
                "fontes"
            ],
            properties: {
                "dataGeração ou dataEmissão": { type: "string" },
                "numeroNota": { type: "string" },
                "valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido": { type: "string" },
                "competencia": { type: "string" },
                "prestadorCPF/CNPJ": { type: "string" },
                "tomadorCPF/CNPJ": { type: "string" },
                "fontes": {
                    type: "object",
                    additionalProperties: false,
                    required: ["prestadorSecao", "tomadorSecao", "linhasRelevantes"],
                    properties: {
                        "prestadorSecao": { type: "string" },
                        "tomadorSecao": { type: "string" },
                        "linhasRelevantes": { type: "array", items: { type: "string" }, maxItems: 3 }
                    }
                }
            }
        }
    };

    try {
        const completion = await openai.chat.completions.create({
            model: VISION_MODEL,
            temperature: 0,
            response_format: { type: "json_schema", json_schema: schema },
            messages: [{ role: 'user', content }]
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (errSchema) {
        try {
            const completion2 = await openai.chat.completions.create({
                model: VISION_MODEL,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [{ role: 'user', content }]
            });
            return JSON.parse(completion2.choices[0].message.content);
        } catch (errObj) {
            console.error('Erro ao extrair dados com GPT (visão):', errObj);
            return null;
        }
    }
}

/* ========================= Mapeamento e inversão ========================= */
function mapearCamposExtraidos(campos) {
    return {
        dataEmissao: campos['dataGeração ou dataEmissão'],
        numeroNota: campos['numeroNota'],
        valorTotal: campos['valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido'],
        competencia: campos['competencia'],
        prestadorCpfCnpj: campos['prestadorCPF/CNPJ'],
        tomadorCpfCnpj: campos['tomadorCPF/CNPJ'],
        _fontes: campos.fontes || null,
        _autocorrecao: null
    };
}

/** Correção conservadora por esperado (só quando há evidência clara) */
function autoCorrigirInversaoPorEsperado(campos, prestadorEsperado, tomadorEsperado) {
    const p = onlyDigits(campos.prestadorCpfCnpj);
    const t = onlyDigits(campos.tomadorCpfCnpj);
    const P = onlyDigits(prestadorEsperado);
    const T = onlyDigits(tomadorEsperado);
    if (!p || !t || !P || !T) return campos;
    if (p === P && t === T) return campos;
    if (p === T && t === P) { [campos.prestadorCpfCnpj, campos.tomadorCpfCnpj] = [t, p]; campos._autocorrecao = 'swap_total_por_esperado'; return campos; }
    if (p === T && t !== T) { [campos.prestadorCpfCnpj, campos.tomadorCpfCnpj] = [t, p]; campos._autocorrecao = 'swap_parcial_prestador=tomadorEsperado'; return campos; }
    if (t === P && p !== P) { [campos.prestadorCpfCnpj, campos.tomadorCpfCnpj] = [t, p]; campos._autocorrecao = 'swap_parcial_tomador=prestadorEsperado'; return campos; }
    return campos;
}

/* ====== Reconciliar quando IA retornou docs iguais (usa fontes & esperados) ====== */
function reconciliarDocsSeIguais(campos, fontes, prestadorEsperado, tomadorEsperado) {
    const p = onlyDigits(campos.prestadorCpfCnpj);
    const t = onlyDigits(campos.tomadorCpfCnpj);
    if (p && t && p !== t) return campos;

    const linhas = fontes?.linhasRelevantes || [];
    const docs = [];
    for (const lin of linhas) {
        if (/\binscr[ií]c[aã]o|\bim\b|\bie\b|estadual|municipal/i.test(lin)) continue;
        const m = normalizeOcrCharsToDigits(lin).match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/g);
        if (m) {
            for (const raw of m) {
                const d = onlyDigits(raw);
                const ok = (d.length === 14 && isValidCNPJ(d)) || (d.length === 11 && isValidCPF(d));
                if (ok && !docs.includes(d)) docs.push(d);
            }
        }
    }

    const P = onlyDigits(prestadorEsperado || '');
    const T = onlyDigits(tomadorEsperado || '');

    if (docs.length >= 2) {
        if (docs.includes(P) && docs.includes(T)) {
            campos.prestadorCpfCnpj = P;
            campos.tomadorCpfCnpj = T;
            campos._autocorrecao = (campos._autocorrecao || '') + '|reconc_docs_fontes';
        }
    }
    return campos;
}

/* ========================= Validação final ========================= */
async function validarComSubLote(campos, subLoteId) {
    const sublote = await SubLoteCommissions.findByPk(subLoteId);
    if (!sublote) {
        return {
            valido: false,
            motivo: 'Sub-lote não encontrado.',
            camposComErro: ['subLoteCommissionsId inválido'],
            camposEsperados: {}
        };
    }

    const empresa = await Empresa.findByPk(sublote.empresa_ID);
    if (!empresa) {
        return {
            valido: false,
            motivo: 'Empresa vinculada ao sub-lote não encontrada.',
            camposComErro: ['empresa_ID inválido'],
            camposEsperados: {}
        };
    }

    const criadoEm = new Date(sublote.createdAt);
    const criadoEmDia = soDia(criadoEm);
    const camposComErro = [];

    const prestador = onlyDigits(campos.prestadorCpfCnpj);
    const prestadorEsperado = onlyDigits(sublote.corretora_CNPJ);

    const tomador = onlyDigits(campos.tomadorCpfCnpj);
    const tomadorEsperado = onlyDigits(empresa?.cnpj);

    const valorExtraido = normalizeMoneySmart(campos.valorTotal);
    const valorEsperado = normalizeMoneySmart(sublote.total_provisionado);

    const toCents = n => Number.isFinite(n) ? Math.round(n * 100) : NaN;
    const sameMoney = (a, b) =>
        Number.isFinite(a) && Number.isFinite(b) &&
        Math.abs(toCents(a) - toCents(b)) <= 1; // tolera 1 centavo

    if (!Number.isFinite(valorExtraido) || !Number.isFinite(valorEsperado) || !sameMoney(valorExtraido, valorEsperado)) {
        camposComErro.push('valorTotal');
    }

    const camposEsperados = {
        dataEmissaoMinima: criadoEm.toLocaleDateString('pt-BR'),
        competenciaMinima: criadoEm.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
        valorTotal: Number.isFinite(valorEsperado) ? valorEsperado.toFixed(2) : null,
        prestadorCpfCnpj: prestadorEsperado,
        tomadorCpfCnpj: tomadorEsperado
    };

    const dataEmissao = parseDataOuCompetencia(campos.dataEmissao);
    const dataEmissaoDia = dataEmissao ? soDia(dataEmissao) : null;
    if (!dataEmissaoDia || dataEmissaoDia < criadoEmDia) {
        camposComErro.push('dataEmissao');
    }

    const competencia = parseDataOuCompetencia(campos.competencia);
    const competenciaValida =
        competencia &&
        (competencia.getFullYear() * 100 + competencia.getMonth() + 1) >=
        (criadoEm.getFullYear() * 100 + criadoEm.getMonth() + 1);

    if (!competenciaValida) {
        camposComErro.push('competencia');
    }

    if (!prestador || prestador !== prestadorEsperado) {
        camposComErro.push('prestadorCpfCnpj');
    }
    if (!tomador || tomador !== tomadorEsperado) {
        camposComErro.push('tomadorCpfCnpj');
    }

    const camposComErroUnicos = Array.from(new Set(camposComErro));
    const valido = camposComErroUnicos.length === 0;

    return {
        valido,
        motivo: valido ? null : 'Os dados extraídos não batem com o sublote informado.',
        camposComErro: camposComErroUnicos,
        camposEsperados
    };
}

/* ========================= Controller ========================= */
const uploadNotaController = async (req, res) => {
    const file = req.file;
    const { subLoteCommissionsId } = req.body;

    if (!file || !subLoteCommissionsId) {
        return res.status(400).json({ mensagem: 'Arquivo PDF e subLoteCommissionsId são obrigatórios.' });
    }

    try {
        const data = await pdfParse(file.buffer);

        // ——— IMPORTANTE: preservar quebras de linha para o determinístico ———
        const texto = (data.text || '');

        // Esperados (para possível correção de inversão, conforme combinado)
        const sublote = await SubLoteCommissions.findByPk(subLoteCommissionsId);
        if (!sublote) return res.status(422).json({ sucesso: false, mensagem: 'Sub-lote não encontrado.', camposComErro: ['subLoteCommissionsId'] });

        const empresa = await Empresa.findByPk(sublote.empresa_ID);
        if (!empresa) return res.status(422).json({ sucesso: false, mensagem: 'Empresa vinculada ao sub-lote não encontrada.', camposComErro: ['empresa_ID'] });

        const prestadorEsperado = onlyDigits(sublote.corretora_CNPJ);
        const tomadorEsperado = onlyDigits(empresa.cnpj);

        // (A) Caminho por TEXTO
        if (texto && texto.length >= 50) {
            const camposBrutos = await extrairCamposComGPT(texto);
            if (!camposBrutos) return res.status(422).json({ sucesso: false, mensagem: 'Falha ao extrair dados da nota fiscal.' });

            let camposExtraidos = mapearCamposExtraidos(camposBrutos);

            // Valor: preferir determinístico; se não achar, normaliza o que vier da IA
            const vDet = extrairValorBrutoDeterministico(texto);
            if (vDet) {
                const nDet = normalizeMoneySmart(vDet);
                const nIa = normalizeMoneySmart(camposExtraidos.valorTotal);
                if (!Number.isFinite(nIa) || Math.abs(nIa - nDet) > 0.01) {
                    camposExtraidos.valorTotal = nDet.toFixed(2);
                    camposExtraidos._valorBrutoFonte = 'deterministico';
                } else {
                    camposExtraidos.valorTotal = nIa.toFixed(2);
                    camposExtraidos._valorBrutoFonte = camposExtraidos._valorBrutoFonte || 'gpt';
                }
            } else {
                if (camposExtraidos.valorTotal) {
                    const n = normalizeMoneySmart(camposExtraidos.valorTotal);
                    if (Number.isFinite(n)) camposExtraidos.valorTotal = n.toFixed(2);
                }
                camposExtraidos._valorBrutoFonte = 'gpt';
            }

            // Data emissão determinística (se a IA não trouxe)
            if (!camposExtraidos.dataEmissao) {
                const d = extrairDataEmissaoDeterministica(texto);
                if (d) camposExtraidos.dataEmissao = d;
            }

            camposExtraidos.competencia = normalizarCompetencia(camposExtraidos.competencia);

            // Se prestador=tomador, tenta separar usando fontes+esperados com fuzzy
            camposExtraidos = fuzzyAssignDocs(camposExtraidos, camposExtraidos._fontes, prestadorEsperado, tomadorEsperado);
            camposExtraidos = reconciliarDocsSeIguais(camposExtraidos, camposExtraidos._fontes, prestadorEsperado, tomadorEsperado);

            const antes = { prestador: camposExtraidos.prestadorCpfCnpj, tomador: camposExtraidos.tomadorCpfCnpj };
            camposExtraidos = autoCorrigirInversaoPorEsperado(camposExtraidos, prestadorEsperado, tomadorEsperado);
            camposExtraidos._antesPrestTom = antes;

            /* ——— NEW: Cross-check por VISÃO se o valor do TEXTO for suspeito ——— */
            const valorTexto = normalizeMoneySmart(camposExtraidos.valorTotal);
            const valorEsperado = normalizeMoneySmart(sublote.total_provisionado);
            const toCents = n => Number.isFinite(n) ? Math.round(n * 100) : NaN;
            const diffMaiorQue1cent = Number.isFinite(valorTexto) && Number.isFinite(valorEsperado)
                ? Math.abs(toCents(valorTexto) - toCents(valorEsperado)) > 1
                : true;

            const contextoNegativo = /ISS|ISSQN|ALIQUOTA|ALIQ|IRRF|PIS|COFINS|CSLL|INSS|RETEN|RETIDO|LIQUIDO|DEDU|DESCONTO/i.test(texto);
            const precisaVisao =
                VISION_CROSSCHECK &&
                (
                    !Number.isFinite(valorTexto) ||
                    valorTexto === 0 ||
                    diffMaiorQue1cent ||
                    (camposExtraidos._valorBrutoFonte === 'deterministico' && contextoNegativo)
                );

            if (precisaVisao) {
                try {
                    const conv = await pdfBufferToPngPaths(file.buffer, { from: 1, to: VISION_PAGES, scaleTo: VISION_SCALE_TO });
                    try {
                        const visRaw = await extrairCamposComVisionFromPngs(conv.paths);
                        if (visRaw) {
                            let vis = mapearCamposExtraidos(visRaw);
                            vis.competencia = normalizarCompetencia(vis.competencia);
                            vis = tryFixValorFromFontes(vis);
                            const nVis = normalizeMoneySmart(vis.valorTotal);
                            if (Number.isFinite(nVis) && nVis > 0) {
                                const bateComEsperado = Number.isFinite(valorEsperado) && Math.abs(toCents(nVis) - toCents(valorEsperado)) <= 1;
                                const textoRuim = !Number.isFinite(valorTexto) || valorTexto === 0 || diffMaiorQue1cent;
                                if (bateComEsperado || textoRuim) {
                                    camposExtraidos.valorTotal = nVis.toFixed(2);
                                    camposExtraidos._valorBrutoFonte = 'visao-crosscheck';
                                }
                            }
                        }
                    } finally {
                        conv.cleanup();
                    }
                } catch (_) {
                    // silencioso: se a visão falhar, segue com o valor por texto
                }
            }

            const resultado = await validarComSubLote(camposExtraidos, subLoteCommissionsId);
            if (resultado.valido) {
                return res.json({
                    sucesso: true,
                    mensagem: 'Nota fiscal validada com sucesso.',
                    via: (camposExtraidos._valorBrutoFonte === 'visao-crosscheck' ? 'texto+visao' : 'texto'),
                    camposExtraidos,
                    camposEsperados: resultado.camposEsperados,
                    camposComErro: []
                });
            }
            return res.status(422).json({
                sucesso: false,
                mensagem: resultado.motivo,
                via: (camposExtraidos._valorBrutoFonte === 'visao-crosscheck' ? 'texto+visao' : 'texto'),
                camposExtraidos,
                camposEsperados: resultado.camposEsperados,
                camposComErro: resultado.camposComErro
            });
        }

        // (B) Fallback VISÃO — apenas quando não há texto legível
        try {
            const conv = await pdfBufferToPngPaths(file.buffer, { from: 1, to: VISION_PAGES, scaleTo: VISION_SCALE_TO });
            let camposBrutosVisao = null;
            try {
                camposBrutosVisao = await extrairCamposComVisionFromPngs(conv.paths);
            } finally {
                conv.cleanup();
            }
            if (!camposBrutosVisao) {
                return res.status(422).json({
                    sucesso: false,
                    mensagem: 'O PDF enviado não contém texto legível e a extração por visão falhou.',
                    camposExtraidos: null, camposEsperados: null, camposComErro: ['texto']
                });
            }

            let camposExtraidos = mapearCamposExtraidos(camposBrutosVisao);
            camposExtraidos.competencia = normalizarCompetencia(camposExtraidos.competencia);

            camposExtraidos = tryFixValorFromFontes(camposExtraidos);
            if (camposExtraidos._fontes?.linhasRelevantes?.length) {
                camposExtraidos.prestadorCpfCnpj = tryFixDocFromFontesByRole(camposExtraidos.prestadorCpfCnpj, camposExtraidos._fontes, 'prestador');
                camposExtraidos.tomadorCpfCnpj = tryFixDocFromFontesByRole(camposExtraidos.tomadorCpfCnpj, camposExtraidos._fontes, 'tomador');
                camposExtraidos = tryFixDataFromFontes(camposExtraidos);
            }

            camposExtraidos = fuzzyAssignDocs(camposExtraidos, camposExtraidos._fontes, prestadorEsperado, tomadorEsperado);
            camposExtraidos = reconciliarDocsSeIguais(camposExtraidos, camposExtraidos._fontes, prestadorEsperado, tomadorEsperado);

            const antes = { prestador: camposExtraidos.prestadorCpfCnpj, tomador: camposExtraidos.tomadorCpfCnpj };
            camposExtraidos = autoCorrigirInversaoPorEsperado(camposExtraidos, prestadorEsperado, tomadorEsperado);
            camposExtraidos._antesPrestTom = antes;

            const resultado = await validarComSubLote(camposExtraidos, subLoteCommissionsId);
            if (resultado.valido) {
                return res.json({ sucesso: true, mensagem: 'Nota fiscal validada com sucesso.', via: 'visao', camposExtraidos, camposEsperados: resultado.camposEsperados, camposComErro: [] });
            }
            return res.status(422).json({ sucesso: false, mensagem: resultado.motivo, via: 'visao', camposExtraidos, camposEsperados: resultado.camposEsperados, camposComErro: resultado.camposComErro });
        } catch (e) {
            return res.status(422).json({
                sucesso: false,
                mensagem: 'O PDF enviado não contém texto legível para leitura automática.',
                detalhe: e.message,
                dica: 'Verifique instalação do Poppler (defina PDFTOPPM_PATH ou POPPLER_BIN no .env).',
                camposExtraidos: null,
                camposEsperados: null,
                camposComErro: ['texto']
            });
        }

    } catch (err) {
        console.error('Erro ao processar nota fiscal:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao processar a nota fiscal.' });
    }
};

const getValidNF = async (req, res) => {
    try {
        const configuracoes = await SystemConfigCheck.findAll();
        const nfConfig = configuracoes.find(cfg => cfg.nome === 'NF_validated'); // (não precisa await)
        const isValidNF = nfConfig?.checked;
        res.send({ isValidNF, sucesso: true });
    } catch (err) {
        res.status(500).send({
            isValidNF: false,
            sucesso: false,
            mensagem: 'Erro ao verificar se a validação de notas fiscais está ativa.'
        });
    }
};

module.exports = {
    uploadNotaController,
    uploadMiddleware: upload.single('nota'),
    getValidNF
};
