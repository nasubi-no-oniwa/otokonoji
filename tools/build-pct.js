// 強さの順位表（元の字ぜんぶの中で何番目か）を作る → js/pct.js
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const OK = require('./node-env')(root);
(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(root, 'data/gmeta.json'), 'utf8'));
  const V = { ink: [], fill: [], reach: [], atk: [] };
  let n = 0; const t0 = Date.now();
  const add = (strokes) => {
    const prep = OK.SH.prep(strokes), b = OK.SH.build(prep, OK.SH.original(prep), { full: true });
    if (!b.parts || !b.parts.length) return;
    V.ink.push(b.ink); V.fill.push(b.fill); V.reach.push(b.reach); V.atk.push(prep.length); n++;
  };
  for (const k of meta.chunks) {
    const pack = JSON.parse(fs.readFileSync(path.join(root, 'data/g', k + '.json'), 'utf8'));
    for (const ch in pack) { const f = pack[ch]; add(f.j || f.c || f.l); }
  }
  // ハングル（500字おきに）
  for (let cp = 0xAC00; cp <= 0xD7A3; cp += 23) add(OK.GL.hangul(String.fromCodePoint(cp)));
  const q = a => { const s = a.slice().sort((x, y) => x - y), o = []; for (let i = 0; i <= 200; i++) o.push(+s[Math.min(s.length - 1, Math.round(i / 200 * (s.length - 1)))].toPrecision(6)); return o; };
  const P = { ink: q(V.ink), fill: q(V.fill), reach: q(V.reach), atk: q(V.atk) };
  fs.writeFileSync(path.join(root, 'js/pct.js'), '// 漢ノ字  強さの順位表（元の字 ' + n + '字の中で何番目くらいか）。tools/build-pct.js で作る\n(function (G) { const OK = G.OK = G.JM = G.OK || G.JM || {}; OK.PCT = ' + JSON.stringify(P) + '; })(typeof window !== \'undefined\' ? window : globalThis);\n');
  console.log('chars', n, 'sec', (Date.now() - t0) / 1000);
  for (const k in P) console.log(k, P[k][0], P[k][50], P[k][100], P[k][150], P[k][200]);
})();
