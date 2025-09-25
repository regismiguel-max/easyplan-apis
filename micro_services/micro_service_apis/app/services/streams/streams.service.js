const puppeteer = require("puppeteer");

// Páginas oficiais (as que você enviou)
const CAM_PAGES = {
    esplanada: "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-esplanada",
    mane_garrincha: "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-mane-garrincha",
    parque_da_cidade: "https://www.climaaovivo.com.br/df/brasilia/combo-livre-brasil-21-parque-da-cidade",
};

const STREAM_HOST = "https://streaming3.climaaovivo.com.br";

// Util: timestamps do token (os 2 últimos blocos)
function parseTokenTimestamps(token) {
    const parts = String(token).split("-");
    const last2 = parts.slice(-2).map(n => Number(n));
    const exp = Math.max(last2[0], last2[1]);  // expiração
    const start = Math.min(last2[0], last2[1]);  // início
    return { startUnix: start, expUnix: exp };
}

// A partir de UMA playlist capturada, monta index.m3u8 e tracks-v1/mono.m3u8
function buildUrlsFromCapturedPlaylistUrl(playlistUrl, token) {
    const m = playlistUrl.match(/https?:\/\/[^/]+\/([^/]+\.df)\//i);
    if (!m) throw new Error('Não foi possível extrair "<camera>.df" da URL capturada');
    const camDf = m[1];
    const base = `${STREAM_HOST}/${camDf}`;
    const indexUrl = `${base}/index.m3u8?token=${token}&remote=no_check_ip`;
    const monoUrl = `${base}/tracks-v1/mono.m3u8?remote=no_check_ip&token=${token}`;
    return { indexUrl, monoUrl };
}

class StreamsService {
    constructor() {
        this.browser = null;
        this.pagePool = new Map(); // cam -> page
        this.cache = new Map();    // cam -> { token, startUnix, expUnix, monoUrl, indexUrl }
        this.locks = new Map();    // cam -> Promise (mutex)
        this.captureTimeoutMs = Number(process.env.CAPTURE_TIMEOUT_MS || 45000);
        this.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    }

    async _ensureBrowser() {
        if (this.browser) return this.browser;
        this.browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--autoplay-policy=no-user-gesture-required"
            ],
            defaultViewport: { width: 1366, height: 768 },
            executablePath: this.executablePath
        });
        return this.browser;
    }

    async _getOrCreatePage(cam) {
        if (this.pagePool.has(cam)) return this.pagePool.get(cam);
        const b = await this._ensureBrowser();
        const page = await b.newPage();
        await page.setRequestInterception(false);
        this.pagePool.set(cam, page);
        page.on("close", () => this.pagePool.delete(cam));
        return page;
    }

    /**
     * Abre a página oficial da câmera, simula o clique no player (passa ad)
     * e captura a PRIMEIRA URL que contenha 'm3u8?token='.
     * Não agenda renovação automática; apenas retorna dados.
     */
    async _clickAndCaptureToken(cam) {
        const pageUrl = CAM_PAGES[cam];
        if (!pageUrl) throw new Error("parâmetro 'cam' inválido");

        const page = await this._getOrCreatePage(cam);
        let capturedPlaylistUrl = null;

        const respListener = async (res) => {
            try {
                const u = res.url();
                if (res.status() >= 200 && res.status() < 400 && /m3u8\?/.test(u) && /token=/.test(u)) {
                    if (!capturedPlaylistUrl) capturedPlaylistUrl = u;
                }
            } catch { }
        };
        page.on("response", respListener);

        try {
            await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

            // Simula "gesto do usuário" repetidas vezes
            await page.evaluate(() => {
                const tryPlay = () => {
                    const v = document.querySelector("video");
                    if (v) { v.muted = true; v.playsInline = true; v.play().catch(() => { }); }
                    const sels = [
                        'button[aria-label="Play"]',
                        ".vjs-big-play-button",
                        'button[title="Play"]',
                        ".play-button",
                        'button[aria-label="Reproduzir"]'
                    ];
                    for (const s of sels) {
                        const el = document.querySelector(s);
                        if (el) el.click();
                    }
                };
                tryPlay();
                setTimeout(tryPlay, 1200);
                setTimeout(tryPlay, 2500);
                setTimeout(tryPlay, 5000);
                setTimeout(tryPlay, 8000);
                setTimeout(tryPlay, 12000);
            });

            // Espera até capturar uma playlist com token (ad ou conteúdo)
            const start = Date.now();
            while (!capturedPlaylistUrl && Date.now() - start < this.captureTimeoutMs) {
                await new Promise((r) => setTimeout(r, 350));
            }
            if (!capturedPlaylistUrl) throw new Error("Timeout: não capturou playlist com token a tempo");

            const m = capturedPlaylistUrl.match(/[?&]token=([^&]+)/);
            if (!m) throw new Error("Token não encontrado na URL capturada");
            const token = m[1];

            const { startUnix, expUnix } = parseTokenTimestamps(token);
            const { indexUrl, monoUrl } = buildUrlsFromCapturedPlaylistUrl(capturedPlaylistUrl, token);

            const data = { cam, token, startUnix, expUnix, indexUrl, monoUrl };
            this.cache.set(cam, data);
            return data;

        } finally {
            page.off("response", respListener);
        }
    }

    /** Entrega cache se válido; senão, roda Puppeteer sob demanda (para UMA câmera). */
    async getPlayable(cam) {
        const now = Date.now();
        const c = this.cache.get(cam);
        if (c && now < c.expUnix * 1000) return c;

        if (!this.locks.get(cam)) {
            this.locks.set(cam, (async () => {
                try {
                    return await this._clickAndCaptureToken(cam);
                } finally {
                    this.locks.delete(cam);
                }
            })());
        }
        return await this.locks.get(cam);
    }

    /** Inicia/atualiza TODAS as câmeras (respeitando cache). */
    async startAll() {
        const cams = Object.keys(CAM_PAGES);
        const out = {};
        for (const cam of cams) {
            out[cam] = await this.getPlayable(cam);
        }
        return Object.fromEntries(
            Object.entries(out).map(([k, d]) => [k, ({
                monoUrl: d.monoUrl,
                indexUrl: d.indexUrl,
                expUnix: d.expUnix,
                startUnix: d.startUnix
            })])
        );
    }

    /**
     * RENOVA TODAS as câmeras (força novo token, ignorando cache).
     * Útil para sua chamada única de “renovar agora tudo”.
     */
    async renewAll() {
        const cams = Object.keys(CAM_PAGES);
        const out = {};
        for (const cam of cams) {
            // usa mutex para evitar corrida; força execução nova ignorando cache
            if (!this.locks.get(cam)) {
                this.locks.set(cam, (async () => {
                    try {
                        return await this._clickAndCaptureToken(cam); // sempre captura novamente
                    } finally {
                        this.locks.delete(cam);
                    }
                })());
            }
            out[cam] = await this.locks.get(cam);
        }
        return Object.fromEntries(
            Object.entries(out).map(([k, d]) => [k, ({
                monoUrl: d.monoUrl,
                indexUrl: d.indexUrl,
                expUnix: d.expUnix,
                startUnix: d.startUnix
            })])
        );
    }

    /** (Opcional) Fechamento gracioso */
    async close() {
        try {
            for (const [_, p] of this.pagePool) { try { await p.close(); } catch { } }
            this.pagePool.clear();
            if (this.browser) { try { await this.browser.close(); } catch { } }
            this.browser = null;
        } catch { }
    }
}

module.exports = { StreamsService };
