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
const POPPLER_BIN = process.env.POPPLER_BIN || null;   // ex: C:\Program Files\poppler\bin
const VISION_PAGES = Math.max(1, Math.min(2, parseInt(process.env.NF_VISION_PAGES || '2', 10)));
const VISION_SCALE_TO = parseInt(process.env.NF_VISION_SCALE_TO || '2000', 10);
const VISION_DPI = parseInt(process.env.NF_VISION_DPI || '0', 10);

/* ========================= Helpers ========================= */
const onlyDigits = (s = '') => String(s).replace(/\D/g, '');

/** Normaliza dinheiro com suporte a pt-BR e en-US.
 *  Exemplos:
 *   "R$ 1.234,56" -> 1234.56
 *   "1,234.56"    -> 1234.56
 *   "931.49"      -> 931.49
 */
function normalizeMoneySmart(input) {
    if (input === null || input === undefined) return null;
    let s = String(input)
        .replace(/\u00A0/g, ' ')        // NBSP
        .replace(/[Rr]\$\s?/g, '')      // R$
        .trim()
        .replace(/\s+/g, '');           // remove espaços avulsos

    const hasDot = s.includes('.');
    const hasComma = s.includes(',');

    if (hasDot && hasComma) {
        // decide pelo último separador: se a vírgula veio por último, é decimal pt-BR
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"
        } else {
            s = s.replace(/,/g, ''); // "1,234.56" -> "1234.56"
        }
    } else if (hasComma) {
        // só vírgula: se termina com ,dd é decimal; senão, é milhar
        s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    } else if (hasDot) {
        // só ponto: se termina com .dd ok; senão, remove milhar
        if (!/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
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

/** Normaliza competência para "mm/aaaa" (aceita "Agosto/2025", "01/08/2025", "2025/08", etc.) */
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

/* ============== Pós-processo a partir das "fontes" (fallback visão) ============== */
function tryFixValorFromFontes(campos) {
    if (campos.valorTotal) return campos;
    const linhas = campos._fontes?.linhasRelevantes || [];
    for (const lin of linhas) {
        const v = parseMoneyPtBR(lin);
        if (v) { campos.valorTotal = v; campos._valorBrutoFonte = 'fontes'; break; }
    }
    return campos;
}

function tryFixDocFromFontes(docAtual, linhas) {
    if (docAtual && (isValidCNPJ(docAtual) || isValidCPF(docAtual))) return docAtual;
    for (const lin of (linhas || [])) {
        const m = lin.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14}|\d{11})/);
        if (!m) continue;
        let d = m[1].replace(/\D/g, '');
        d = d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1'); // swaps comuns
        const ok = d.length === 14 ? isValidCNPJ(d) : d.length === 11 ? isValidCPF(d) : false;
        if (ok) return d;
    }
    return docAtual;
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

/* ========================= IA (TEXTO) ========================= */
async function extrairCamposComGPT(texto) {
    const prompt = `
Você é um extrator de dados de NFS-e (Brasil). Leia o TEXTO e retorne SOMENTE JSON válido.

Conceitos obrigatórios (NÃO confundir):
- PRESTADOR: quem EMITE a NFS-e (seção "Dados do Prestador de Serviço" ou equivalente).
- TOMADOR: quem CONTRATA os serviços (seção "Dados do Tomador de Serviços" ou equivalente).

Regras de formatação:
- "numeroNota": somente dígitos.
- "valorTotal": número com ponto decimal (ex.: "1200.00").
- Datas: "dd/mm/aaaa".
- CNPJs/CPFs: somente dígitos.
- "competencia": "dd/mm/aaaa" OU "mm/aaaa".
- Se a competência vier com mês por extenso (ex.: "Agosto/2025" ou "Agosto de 2025"), CONVERTER para "mm/aaaa".

Regras para prestador/tomador:
1) Se existir seção explícita **"Dados do Prestador de Serviço"**, o CNPJ/CPF dela vai para "prestadorCPF/CNPJ".
2) Se existir seção explícita **"Dados do Tomador de Serviços"**, o CNPJ/CPF dela vai para "tomadorCPF/CNPJ".
3) Se só uma das seções existir, use o contexto textual mais próximo ("Prestador" para prestador; "Tomador" para tomador).
4) NÃO inverter quando ambas seções existirem.

Além dos campos, inclua um objeto "fontes" com:
- "prestadorSecao": nome da seção/linha base usada
- "tomadorSecao": nome da seção/linha base usada
- "linhasRelevantes": até 3 linhas curtas

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
"`
        .trim();

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
- PRESTADOR = quem EMITE (seção "Dados do Prestador de Serviço").
- TOMADOR   = quem CONTRATA (seção "Dados do Tomador de Serviços").

Regras:
- "numeroNota": somente dígitos (NÃO usar RPS/Série/Código de Verificação).
- "valorTotal": BRUTO (Valor dos Serviços / Valor Total dos Serviços / Total dos Serviços). Nunca líquido/retido/deduções/ISS/INSS/IRRF/PIS/COFINS/CSLL.
- Datas: "dd/mm/aaaa".
- CNPJ/CPF: somente dígitos.
- "competencia": "dd/mm/aaaa" OU "mm/aaaa". Se vier por extenso ("Agosto/2025"), CONVERTER para "mm/aaaa".
- SEMPRE preencha todas as chaves. Se não achar, use "".

Inclua "fontes" com:
- "prestadorSecao"
- "tomadorSecao"
- "linhasRelevantes": até 3 linhas curtas (ex.: "Vl. Total dos Serviços R$ 931,49", "CPF / CNPJ : 27.252.086/0001-04").`
        },
        ...images.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))
    ];

    // Tenta Structured Outputs; se indisponível, cai para json_object
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

/* ========================= Validação final ========================= */
async function validarComSubLote(campos, subLoteId) {
    const sublote = await SubLoteCommissions.findByPk(subLoteId);
    if (!sublote) return { valido: false, motivo: 'Sub-lote não encontrado.', camposComErro: ['subLoteCommissionsId inválido'], camposEsperados: {} };

    const empresa = await Empresa.findByPk(sublote.empresa_ID);
    if (!empresa) return { valido: false, motivo: 'Empresa vinculada ao sub-lote não encontrada.', camposComErro: ['empresa_ID inválido'], camposEsperados: {} };

    const criadoEm = new Date(sublote.createdAt);
    const criadoEmDia = soDia(criadoEm);
    const camposComErro = [];

    const prestador = onlyDigits(campos.prestadorCpfCnpj);
    const prestadorEsperado = onlyDigits(sublote.corretora_CNPJ);

    const tomador = onlyDigits(campos.tomadorCpfCnpj);
    const tomadorEsperado = onlyDigits(empresa?.cnpj);

    // >>>>>> USO DA normalizeMoneySmart <<<<<<
    const valorExtraido = normalizeMoneySmart(campos.valorTotal);
    const valorEsperado = normalizeMoneySmart(sublote.total_provisionado);

    const camposEsperados = {
        dataEmissaoMinima: criadoEm.toLocaleDateString('pt-BR'),
        competenciaMinima: criadoEm.toLocaleDateString('pt-BR'),
        valorTotal: valorEsperado != null ? valorEsperado.toFixed(2) : null,
        prestadorCpfCnpj: prestadorEsperado,
        tomadorCpfCnpj: tomadorEsperado
    };

    // Emissão: ignora hora
    const dataEmissao = parseDataOuCompetencia(campos.dataEmissao);
    const dataEmissaoDia = dataEmissao ? soDia(dataEmissao) : null;
    if (!dataEmissaoDia || dataEmissaoDia < criadoEmDia) camposComErro.push('dataEmissao');

    // Competência: mês/ano >= mês/ano do criadoEm
    const competencia = parseDataOuCompetencia(campos.competencia);
    const competenciaValida =
        competencia &&
        (competencia.getFullYear() * 100 + competencia.getMonth() + 1) >=
        (criadoEm.getFullYear() * 100 + criadoEm.getMonth() + 1);
    if (!competenciaValida) {
        camposComErro.push('competencia');
        camposEsperados.competenciaMinima = criadoEm.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
    }

    if (!Number.isFinite(valorExtraido) || !Number.isFinite(valorEsperado) || valorExtraido !== valorEsperado) {
        camposComErro.push('valorTotal');
    }
    if (!prestador || prestador !== prestadorEsperado) camposComErro.push('prestadorCpfCnpj');
    if (!tomador || tomador !== tomadorEsperado) camposComErro.push('tomadorCpfCnpj');

    const valido = camposComErro.length === 0;
    return { valido, motivo: valido ? null : 'Os dados extraídos não batem com o sublote informado.', camposComErro, camposEsperados };
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
        let texto = (data.text || '').replace(/\s+/g, ' ').trim();

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
            camposExtraidos.competencia = normalizarCompetencia(camposExtraidos.competencia);

            const antes = { prestador: camposExtraidos.prestadorCpfCnpj, tomador: camposExtraidos.tomadorCpfCnpj };
            camposExtraidos = autoCorrigirInversaoPorEsperado(camposExtraidos, prestadorEsperado, tomadorEsperado);
            camposExtraidos._antesPrestTom = antes;

            const resultado = await validarComSubLote(camposExtraidos, subLoteCommissionsId);
            if (resultado.valido) {
                return res.json({ sucesso: true, mensagem: 'Nota fiscal validada com sucesso.', via: 'texto', camposExtraidos, camposEsperados: resultado.camposEsperados, camposComErro: [] });
            }
            return res.status(422).json({ sucesso: false, mensagem: resultado.motivo, via: 'texto', camposExtraidos, camposEsperados: resultado.camposEsperados, camposComErro: resultado.camposComErro });
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

            // Reparo a partir das fontes (valor/doc/data)
            camposExtraidos = tryFixValorFromFontes(camposExtraidos);
            if (camposExtraidos._fontes?.linhasRelevantes?.length) {
                camposExtraidos.prestadorCpfCnpj = tryFixDocFromFontes(camposExtraidos.prestadorCpfCnpj, camposExtraidos._fontes.linhasRelevantes);
                camposExtraidos.tomadorCpfCnpj = tryFixDocFromFontes(camposExtraidos.tomadorCpfCnpj, camposExtraidos._fontes.linhasRelevantes);
                camposExtraidos = tryFixDataFromFontes(camposExtraidos);
            }

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
        const nfConfig = await configuracoes.find(cfg => cfg.nome === 'NF_validated');
        const isValidNF = await nfConfig?.checked;
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
