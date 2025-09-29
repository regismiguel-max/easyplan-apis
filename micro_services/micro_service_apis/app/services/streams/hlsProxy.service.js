const { request } = require("undici");

const isPlaylist = (p) => /\.m3u8(\?.*)?$/i.test(p);
const allowedHosts = new Set([
    "streaming3.climaaovivo.com.br",
    "streaming2.climaaovivo.com.br",
    "streaming.climaaovivo.com.br",
]);

function resolveRefererFor(u) {
    const p = u.pathname || "";
    if (p.includes("/brasilia1.df/")) {
        return "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-esplanada";
    }
    if (p.includes("/brasilia2.df/")) {
        return "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-mane-garrincha";
    }
    if (p.includes("/brasilia3.df/")) {
        return "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-parque-da-cidade";
    }
    return "https://www.climaaovivo.com.br/";
}

class HlsProxyService {
    constructor() {
        this.UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
    }

    parseUpstream(raw) {
        let u;
        try { u = new URL(raw); } catch { throw new Error("URL inválida"); }
        if (!allowedHosts.has(u.hostname)) throw new Error("Host não permitido");
        return u;
    }

    async handle(req, res, rawUrl) {
        const upstreamUrl = this.parseUpstream(rawUrl);
        const playlist = isPlaylist(upstreamUrl.pathname);

        const headers = {
            "User-Agent": this.UA,
            "Referer": resolveRefererFor(upstreamUrl), // 🔑 evita wrong_domain
            "Origin": "https://www.climaaovivo.com.br",
            "Accept": playlist
                ? "application/vnd.apple.mpegurl,application/x-mpegURL,*/*"
                : "*/*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            ...(req.headers.range ? { Range: req.headers.range } : {}),
        };

        const upstream = await request(upstreamUrl.toString(), {
            method: "GET",
            headers,
            maxRedirections: 2,
        });

        if (upstream.statusCode >= 400) {
            console.warn("[HLS-PROXY] %s -> %d (%s)",
                upstreamUrl.toString(),
                upstream.statusCode,
                upstream.headers["x-deny-reason"] || "");
            res.status(upstream.statusCode).end();
            upstream.body.resume();
            return;
        }

        if (playlist) {
            const text = await upstream.body.text();
            const base = new URL(".", upstreamUrl);
            const rewritten = this.rewriteM3U8(text, base);
            res.setHeader("Content-Type", upstream.headers["content-type"] || "application/vnd.apple.mpegurl");
            res.setHeader("Cache-Control", "no-store");
            res.status(200).send(rewritten);
            return;
        }

        // segmento/binário
        if (upstream.headers["content-type"]) res.setHeader("Content-Type", upstream.headers["content-type"]);
        if (upstream.headers["content-length"]) res.setHeader("Content-Length", upstream.headers["content-length"]);
        if (upstream.headers["accept-ranges"]) res.setHeader("Accept-Ranges", upstream.headers["accept-ranges"]);
        if (upstream.headers["content-range"]) res.setHeader("Content-Range", upstream.headers["content-range"]);
        res.setHeader("Cache-Control", "no-store");
        res.status(upstream.statusCode);
        upstream.body.pipe(res);
    }

    rewriteM3U8(content, baseUrl) {
        const lines = content.split(/\r?\n/);
        return lines.map(line => {
            if (!line || line.startsWith("#")) return line;
            let abs;
            try { abs = new URL(line, baseUrl); }
            catch { return line; }
            return `https://apis.easyplan.com.br:3088/api/streams/proxy/play?u=${encodeURIComponent(abs.toString())}`;

        }).join("\n");
    }
}

module.exports = { HlsProxyService };
