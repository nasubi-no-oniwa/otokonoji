// バランスの確かめ：元の字・ばらばらに組んだ作品をたくさん戦わせる
const fs = require('fs'), path = require('path');
const root = process.argv[2], N = +(process.argv[3] || 600);
const OK = require('./node-env')(root);
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const SH = OK.SH;
(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/gmeta.json'), 'utf8'));
  const pool = [];
  for (const k of meta.chunks) { const pack = JSON.parse(fs.readFileSync(path.join(root, 'data/g', k + '.json'), 'utf8')); for (const ch in pack) if (/\p{Script=Han}/u.test(ch) && pack[ch].j) pool.push([ch, pack[ch].j]); }
  // 作品を作る：kind 0=元のまま 1=少しいじる 2=大きく広げる 3=ぎゅっと重ねる
  function make(kind) {
    for (let tries = 0; tries < 50; tries++) {
      const [ch, strokes] = pool[Math.floor(rnd() * pool.length)];
      const prep = SH.prep(strokes); let pls = SH.original(prep);
      if (kind === 0) { const b = SH.build(prep, pls, { full: true }); return { s: SH.encode('j', ch, pls), b, prep, n: prep.length, kind }; }
      // ランダムに動かす（つながったままのものだけ受け入れる）
      let b = SH.build(prep, pls);
      const steps = kind === 1 ? 4 : 40;
      for (let s = 0; s < steps * 3; s++) {
        const k = Math.floor(rnd() * pls.length), old = Object.assign({}, pls[k]), pl = pls[k];
        if (kind === 2) { pl.x += Math.round((rnd() - 0.5) * 500); pl.y += Math.round((rnd() - 0.5) * 500); }
        else if (kind === 3) { pl.x += Math.round((800 - pl.x) * 0.3 * rnd()); pl.y += Math.round((800 - pl.y) * 0.3 * rnd()); }
        else { pl.x += Math.round((rnd() - 0.5) * 200); pl.y += Math.round((rnd() - 0.5) * 200); }
        if (rnd() < 0.4) pl.r = Math.floor(rnd() * 24);
        SH.clamp(prep[pl.i], pl);
        const nb = SH.build(prep, pls);
        if (nb.connected && (kind !== 2 || nb.ink >= b.ink * 0.9)) b = nb; else pls[k] = old;
      }
      if (!SH.build(prep, pls).connected) continue;
      const full = SH.build(prep, pls, { full: true });
      return { s: SH.encode('j', ch, pls), b: full, prep, n: prep.length, kind };
    }
    return null;
  }
  const W = [];
  for (let i = 0; i < 160; i++) { const w = make(i % 4); if (w) { w.st = SH.stats(w.b); W.push(w); } }
  console.log('works', W.length);
  const cls = n => n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : 3;
  const rec = {}; const add = (k, v) => { (rec[k] = rec[k] || [0, 0, 0])[v]++; };
  let t0 = Date.now(), steps = 0, timeouts = 0;
  for (let m = 0; m < N; m++) {
    const a = W[Math.floor(rnd() * W.length)], b = W[Math.floor(rnd() * W.length)]; if (a === b) continue;
    const da = SH.def(a), db = SH.def(b);
    const M = new OK.Match(da, db, 0, 4);
    while (!M.over) { M.tick(); M.ev.length = 0; }
    steps += M.step; if (M.endBy === 'time') timeouts++;
    const res = M.winner;   // 0=a 1=b -1=引き分け
    for (const [x, y, me] of [[a, b, 0], [b, a, 1]]) {
      const v = res < 0 ? 2 : res === me ? 0 : 1;
      add('class' + cls(x.n) + '_vs_class' + cls(y.n), v);
      add('kind' + x.kind, v);
      add('cls' + cls(x.n), v);
      add('big' + (x.b.reach > 1.6 ? 'Y' : 'N'), v);
    }
  }
  const ms = (Date.now() - t0) / N;
  console.log('ms/match', ms.toFixed(1), 'avg sec', (steps / N / 120).toFixed(1), 'timeouts', timeouts);
  for (const k of Object.keys(rec).sort()) { const [w, l, d] = rec[k]; console.log(k.padEnd(20), 'win%', (100 * w / (w + l + d)).toFixed(0), 'n', w + l + d); }
})();
