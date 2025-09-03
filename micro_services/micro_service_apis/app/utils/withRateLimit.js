/**
 * Controla concorrência e espaçamento mínimo entre execuções.
 * Uso:
 *   const limiter = withRateLimit({ concurrency: 6, minDelayMs: 300 });
 *   await Promise.all(itens.map(i => limiter(() => doWork(i))));
 */
function withRateLimit(opts) {
  const concurrency = Number(opts && opts.concurrency || 1);
  const minDelayMs = Number(opts && opts.minDelayMs || 0);
  const q = [];
  let running = 0;
  let last = 0;

  const runNext = async () => {
    if (!q.length || running >= concurrency) return;
    const task = q.shift();
    const now = Date.now();
    const wait = Math.max(0, minDelayMs - (now - last));
    running++;
    await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    try { await task(); } finally { running--; runNext(); }
  };

  return function(fn) {
    return new Promise((resolve, reject) => {
      q.push(async () => { try { resolve(await fn()); } catch (e) { reject(e); } });
      runNext();
    });
  };
}

module.exports = { withRateLimit };
