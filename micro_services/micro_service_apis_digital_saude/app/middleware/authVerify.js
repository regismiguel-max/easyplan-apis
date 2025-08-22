const jwt = require("jsonwebtoken");
const config = require("../config/auth/auth.config.js");

verifyToken = (req, res, next) => {
    let token = req.headers["x-access-token"];

    if (!token) {
        return res.status(403).send({
            message: "Acesso negado. Nenhum token fornecido!"
        });
    }

    jwt.verify(token, config.privateKey, (err, decoded) => {
        if (err) {
            return res.status(401).send({
                message: "Não autorizado!"
            });
        }
        // req.userId = decoded.id;
        next();
    });
};

verifyCredentials = (req, res, next) => {
    let key = req.headers["x-access-key"];

    if (!key) {
        return res.status(403).send({
            message: "Acesso negado. Nenhum chave fornecida!"
        });
    }
    else {
        if (String(key) === String(process.env.KEYAUTH)) {
            next();
        }
        else {
            return res.status(403).send({
                message: "Acesso negado. Chave inválida!"
            });
        }
    }
};

// ============== NOVO (helpers + verifyAccessPair) ==============
const CryptoJS = require("crypto-js");

// normalização de headers (aliases, trim, remover "Bearer ")
function coerceHeader(v) {
    if (Array.isArray(v)) v = v[0];
    return typeof v === 'string' ? v : (v == null ? '' : String(v));
}
function cleanToken(v) {
    v = coerceHeader(v).trim();
    if (v.toLowerCase().startsWith('bearer ')) v = v.slice(7);
    return v.trim();
}
function normalizeAccessHeadersInPlace(req) {
    const h = req.headers || {};
    if (!h['x-access-key'] && h['x-api-key']) {
        h['x-access-key'] = h['x-api-key'];
    }
    if (!h['x-access-token'] && h['x-api-token']) {
        h['x-access-token'] = h['x-api-token'];
    }
    if (h['x-access-key']) h['x-access-key'] = coerceHeader(h['x-access-key']).trim();
    if (h['x-access-token']) h['x-access-token'] = cleanToken(h['x-access-token']);
}

// comparação “constante” via XOR em bytes (crypto-js)
function wordArrayToUint8(wa) {
    const { words, sigBytes } = wa;
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
        u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
}
function safeEqual(a, b) {
    const aBytes = wordArrayToUint8(CryptoJS.enc.Utf8.parse(String(a ?? "")));
    const bBytes = wordArrayToUint8(CryptoJS.enc.Utf8.parse(String(b ?? "")));
    let diff = aBytes.length ^ bBytes.length;
    const maxLen = Math.max(aBytes.length, bBytes.length);
    for (let i = 0; i < maxLen; i++) {
        const av = i < aBytes.length ? aBytes[i] : 0;
        const bv = i < bBytes.length ? bBytes[i] : 0;
        diff |= (av ^ bv);
    }
    return diff === 0;
}

// NOVO: valida o PAR fixo (key + token) sem chamar verifyCredentials
verifyAccessPair = (req, res, next) => {
    normalizeAccessHeadersInPlace(req);

    const keyHeader = req.headers["x-access-key"];
    const tokenHeader = req.headers["x-access-token"];
    const expectedKey = process.env.KEYAUTH;
    const expectedTok = process.env.ACCESS_TOKEN || process.env.TOKENAUTH;

    if (!keyHeader) {
        return res.status(403).send({ message: "Acesso negado. Nenhum chave fornecida!" });
    }
    if (!tokenHeader) {
        return res.status(403).send({ message: "Acesso negado. Nenhum token de acesso fornecido!" });
    }
    if (!expectedKey || !expectedTok) {
        return res.status(500).send({ message: "Configuração inválida: credenciais fixas não definidas no servidor." });
    }
    // pode usar comparação simples na key; usei safeEqual nos dois por consistência
    if (!safeEqual(keyHeader, expectedKey)) {
        return res.status(403).send({ message: "Acesso negado. Chave inválida!" });
    }
    if (!safeEqual(tokenHeader, expectedTok)) {
        return res.status(403).send({ message: "Acesso negado. Token de acesso inválido!" });
    }

    return next();
};


module.exports = {
    verifyToken,        // mantenha se outras rotas usarem JWT
    verifyCredentials,  // legado; continua disponível
    verifyAccessPair,   // → use este nas rotas externas
};