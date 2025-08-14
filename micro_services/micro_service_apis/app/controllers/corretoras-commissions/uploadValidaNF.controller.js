const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

const db = require("../../../../../models");
const SubLoteCommissions = db.corretoras_subLoteCommissions;
const Empresa = db.corretoras_commission_empresa;
const SystemConfigCheck = db.systemConfigCheck;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Aceita o arquivo
    } else {
        cb(new Error('Arquivo inválido. Envie a nota fiscal em PDF original (gerado pelo sistema emissor). Não são aceitos arquivos escaneados ou em outros formatos.'), false);
    }
};

const upload = multer({ storage, fileFilter });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mapearCamposExtraidos(campos) {
    return {
        dataEmissao: campos['dataGeração ou dataEmissão'],
        numeroNota: campos['numeroNota'],
        valorTotal: campos['valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido'],
        competencia: campos['competencia'],
        prestadorCpfCnpj: campos['prestadorCPF/CNPJ'],
        tomadorCpfCnpj: campos['tomadorCPF/CNPJ']
    };
}

function parseDataOuCompetencia(valor) {
    if (!valor) return null;
    const partes = valor.split('/');
    if (partes.length === 3) {
        const [dia, mes, ano] = partes.map(Number);
        return new Date(ano, mes - 1, dia);
    } else if (partes.length === 2) {
        const [mes, ano] = partes.map(Number);
        return new Date(ano, mes - 1, 1);
    }
    return null;
}

async function extrairCamposComGPT(texto) {
    const prompt = `
Você é um extrator de dados de notas fiscais emitidas no Brasil.  
Abaixo está o texto extraído de um arquivo PDF.  
Sua tarefa é identificar os seguintes campos com precisão e retornar no formato JSON.  

Regras:
- Retorne apenas o JSON, sem explicações.
- O número da nota deve conter apenas números.
- Os valores devem ser numéricos, com ponto como separador decimal. Ex: "1200.00"
- As datas devem estar no formato "dd/mm/aaaa".
- Os CNPJs e CPFs devem conter apenas números (sem ponto, traço ou barra).
- A competência pode ser "dd/mm/aaaa" ou "mm/aaaa".
- Se a competência vier com o mês por extenso (ex.: "Agosto/2025" ou "Agosto de 2025"), CONVERTA para "mm/aaaa" (ex.: "08/2025").

Texto da nota:

"""
${texto}
"""

Retorne os seguintes campos em formato JSON:
{
  "dataGeração ou dataEmissão": "...",
  "numeroNota": "...",
  "valorTotal ou valorBruto ou valor Total dos Serviços, nunca valor liquido": "...",
  "competencia": "...",
  "prestadorCPF/CNPJ": "...",
  "tomadorCPF/CNPJ": "..."
}`.trim();

    try {
        const completion = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error('Erro ao extrair dados com GPT:', error);
        return null;
    }
}

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
    const camposComErro = [];

    const prestador = campos.prestadorCpfCnpj?.replace(/\D/g, '');
    const prestadorEsperado = sublote.corretora_CNPJ?.replace(/\D/g, '');

    const tomador = campos.tomadorCpfCnpj?.replace(/\D/g, '');
    const tomadorEsperado = empresa?.cnpj?.replace(/\D/g, '');

    const valorExtraido = Number(parseFloat(campos.valorTotal?.replace(',', '.')).toFixed(2));
    const valorEsperado = Number(parseFloat(sublote.total_provisionado).toFixed(2));

    const camposEsperados = {
        dataEmissaoMinima: criadoEm.toLocaleDateString('pt-BR'),
        competenciaMinima: criadoEm.toLocaleDateString('pt-BR'),
        valorTotal: valorEsperado.toFixed(2),
        prestadorCpfCnpj: prestadorEsperado,
        tomadorCpfCnpj: tomadorEsperado
    };

    const dataEmissao = parseDataOuCompetencia(campos.dataEmissao);
    if (!dataEmissao || dataEmissao < criadoEm) camposComErro.push('dataEmissao');

    const competencia = parseDataOuCompetencia(campos.competencia);
    const competenciaValida =
        competencia &&
        (competencia.getFullYear() * 100 + competencia.getMonth() + 1) >=
        (criadoEm.getFullYear() * 100 + criadoEm.getMonth() + 1);
    if (!competenciaValida) {
        camposComErro.push('competencia');
        camposEsperados.competenciaMinima = criadoEm.toLocaleDateString('pt-BR', {
            month: '2-digit',
            year: 'numeric'
        });
    }

    if (isNaN(valorExtraido) || valorExtraido !== valorEsperado) camposComErro.push('valorTotal');
    if (!prestador || prestador !== prestadorEsperado) camposComErro.push('prestadorCpfCnpj');
    if (!tomador || tomador !== tomadorEsperado) camposComErro.push('tomadorCpfCnpj');

    const valido = camposComErro.length === 0;

    return {
        valido,
        motivo: valido ? null : 'Os dados extraídos não batem com o sublote informado.',
        camposComErro,
        camposEsperados
    };
}

// Remove acentos e normaliza para comparação
function removerAcentos(str = '') {
    return str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function mapMesParaNumero(nomeMesRaw = '') {
    const s = removerAcentos(String(nomeMesRaw).trim().toLowerCase());
    const mapa = {
        jan: '01', janeiro: '01',
        fev: '02', fevereiro: '02',
        mar: '03', marco: '03', 'marco.': '03', 'mar.': '03',
        abr: '04', abril: '04',
        mai: '05', maio: '05',
        jun: '06', junho: '06',
        jul: '07', julho: '07',
        ago: '08', agosto: '08',
        set: '09', setembro: '09',
        out: '10', outubro: '10',
        nov: '11', novembro: '11',
        dez: '12', dezembro: '12',
    };

    // tenta chave exata
    if (mapa[s]) return mapa[s];

    // tenta pelas 3 primeiras letras (ex.: "agost" -> "ago")
    const chave3 = s.slice(0, 3);
    if (mapa[chave3]) return mapa[chave3];

    return null;
}

/**
 * Normaliza a competência para "mm/aaaa".
 * Aceita formatos:
 * - "08/2025"
 * - "8/2025"
 * - "Agosto/2025"
 * - "Agosto de 2025"
 * - "2025-08" (converte para 08/2025)
 * - "01/08/2025" (usa só mês/ano -> 08/2025)
 */
function normalizarCompetencia(valor) {
    if (!valor) return valor;
    let s = String(valor).trim();

    // uniformiza separadores e remove "de"
    s = s.replace(/-/g, '/').replace(/\s+de\s+/gi, ' ').replace(/\s+/g, ' ');

    // 1) dd/mm/aaaa -> pega mm/aaaa
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const mm = String(m[2]).padStart(2, '0');
        const aaaa = m[3];
        return `${mm}/${aaaa}`;
    }

    // 2) mm/aaaa (ou m/aaaa) já numérico
    m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) {
        const mm = String(m[1]).padStart(2, '0');
        const aaaa = m[2];
        return `${mm}/${aaaa}`;
    }

    // 3) "Agosto/2025" ou "Agosto 2025"
    m = s.match(/^([A-Za-zçãâáéíóúõêô.]+)[\/\s]+(\d{4})$/i);
    if (m) {
        const mesNum = mapMesParaNumero(m[1]);
        if (mesNum) return `${mesNum}/${m[2]}`;
    }

    // 4) "2025/08" ou "2025-08"
    m = s.match(/^(\d{4})\/(\d{1,2})$/);
    if (m) {
        const mm = String(m[2]).padStart(2, '0');
        const aaaa = m[1];
        return `${mm}/${aaaa}`;
    }

    // Se nada bater, retorna original (deixa validação tratar)
    return valor;
}

const uploadNotaController = async (req, res) => {
    const file = req.file;
    const { subLoteCommissionsId } = req.body;

    if (!file || !subLoteCommissionsId) {
        return res.status(400).json({ mensagem: 'Arquivo PDF e subLoteCommissionsId são obrigatórios.' });
    }

    try {
        const data = await pdfParse(file.buffer);
        let texto = data.text.replace(/\s+/g, ' ').trim();

        if (!texto || texto.length < 50) {
            return res.status(422).json({
                sucesso: false,
                mensagem: 'O PDF enviado não contém texto legível para leitura automática.',
                dica: 'Certifique-se de enviar o arquivo PDF original gerado pelo sistema emissor da nota fiscal (NFS-e). Arquivos escaneados, digitalizados ou convertidos manualmente não são aceitos.',
                camposExtraidos: null,
                camposEsperados: null,
                camposComErro: ['texto']
            });
        }

        console.log("Texto enviado ao GPT:", texto);
        const camposBrutos = await extrairCamposComGPT(texto);
        if (!camposBrutos) return res.status(422).json({ mensagem: 'Falha ao extrair dados da nota fiscal.' });

        const camposExtraidos = mapearCamposExtraidos(camposBrutos);
        camposExtraidos.competencia = normalizarCompetencia(camposExtraidos.competencia);
        const resultado = await validarComSubLote(camposExtraidos, subLoteCommissionsId);

        if (resultado.valido) {
            return res.json({
                sucesso: true,
                mensagem: 'Nota fiscal validada com sucesso.',
                camposExtraidos,
                camposEsperados: resultado.camposEsperados,
                camposComErro: []
            });
        } else {
            return res.status(422).json({
                sucesso: false,
                mensagem: resultado.motivo,
                camposExtraidos,
                camposEsperados: resultado.camposEsperados,
                camposComErro: resultado.camposComErro
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

        res.send({
            isValidNF,
            sucesso: true
        });
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