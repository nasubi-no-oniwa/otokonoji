// 字の画データを作る（KanjiVG・Make Me a Hanzi（hanzi-writer-data）・Hershey）
// 出力：data/g/{cp>>10 の16進}.json  { "字": { j?: [[x,y,x,y...],...], c?: [...], l?: [...] } }
// 座標はすべて 0〜1000 の箱（y は下向き）。画は中心線（折れ線）
const fs = require('fs'), path = require('path');
const SRC = process.argv[2], OUT = process.argv[3];
const KVG = path.join(SRC, 'kanjivg/kanji'), HW = path.join(SRC, 'npm/node_modules/hanzi-writer-data'), HER = path.join(SRC, 'npm/node_modules/hersheytext/hersheytext.json');

// ---- 折れ線を間引く（Douglas-Peucker） ----
function dp(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = -1, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const flat = pts => { const o = []; for (const [x, y] of pts) o.push(Math.round(x), Math.round(y)); return o; };
// 同じ点が続いたものを除く
const uniq = pts => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);

// ---- SVG の path を折れ線に ----
function pathToPolys(d, scale) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const polys = []; let cur = null, x = 0, y = 0, cmd = '', i = 0, lcx = 0, lcy = 0, sx = 0, sy = 0;
  const num = () => parseFloat(toks[i++]);
  const bez = (x1, y1, x2, y2, x3, y3) => { const x0 = x, y0 = y; for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; cur.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); } x = x3; y = y3; lcx = x2; lcy = y2; };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    switch (cmd) {
      case 'M': x = num(); y = num(); cur = [[x, y]]; polys.push(cur); sx = x; sy = y; cmd = 'L'; break;
      case 'm': x += num(); y += num(); cur = [[x, y]]; polys.push(cur); sx = x; sy = y; cmd = 'l'; break;
      case 'L': x = num(); y = num(); cur.push([x, y]); lcx = x; lcy = y; break;
      case 'l': x += num(); y += num(); cur.push([x, y]); lcx = x; lcy = y; break;
      case 'C': { const a = num(), b = num(), c = num(), e = num(), f = num(), g = num(); bez(a, b, c, e, f, g); break; }
      case 'c': { const a = num(), b = num(), c = num(), e = num(), f = num(), g = num(); bez(x + a, y + b, x + c, y + e, x + f, y + g); break; }
      case 'S': { const c = num(), e = num(), f = num(), g = num(); bez(2 * x - lcx, 2 * y - lcy, c, e, f, g); break; }
      case 's': { const c = num(), e = num(), f = num(), g = num(); bez(2 * x - lcx, 2 * y - lcy, x + c, y + e, x + f, y + g); break; }
      case 'Z': case 'z': cur.push([sx, sy]); x = sx; y = sy; break;
      default: i++;
    }
  }
  return polys.map(p => p.map(([a, b]) => [a * scale, b * scale]));
}

const out = {};   // chunk -> { ch: {...} }
const put = (ch, k, strokes) => {
  const cp = ch.codePointAt(0), key = (cp >> 10).toString(16);
  (out[key] = out[key] || {})[ch] = (out[key][ch] || {}); out[key][ch][k] = strokes;
};
let nJ = 0, nC = 0, nL = 0;
// ---- KanjiVG（日本の字形） ----
for (const f of fs.readdirSync(KVG)) {
  if (!/^[0-9a-f]{5}\.svg$/.test(f)) continue;
  const cp = parseInt(f.slice(0, 5), 16); if (cp < 0x80) continue;   // 英数字は Hershey を使う
  const svg = fs.readFileSync(path.join(KVG, f), 'utf8');
  const ds = [...svg.matchAll(/<path[^>]*\sid="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)].sort((a, b) => a[1] - b[1]).map(m => m[2]);
  if (!ds.length) continue;
  const strokes = [];
  for (const d of ds) { const ps = pathToPolys(d, 1000 / 109); const pts = uniq([].concat(...ps)); if (pts.length < 1) continue; strokes.push(flat(dp(pts.length === 1 ? [pts[0], pts[0]] : pts, 6))); }
  if (!strokes.length) continue;
  put(String.fromCodePoint(cp), 'j', strokes); nJ++;
}
// ---- hanzi-writer-data（中国・台湾の字形） ----
for (const f of fs.readdirSync(HW)) {
  if (!f.endsWith('.json') || f === 'package.json') continue;
  const ch = f.slice(0, -5); if ([...ch].length !== 1) continue;
  let d; try { d = JSON.parse(fs.readFileSync(path.join(HW, f), 'utf8')); } catch (e) { continue; }
  if (!d.medians || !d.medians.length) continue;
  const strokes = d.medians.map(m => flat(dp(uniq(m.map(([x, y]) => [x * 1000 / 1024, (900 - y) * 1000 / 1024])), 6))).filter(s => s.length >= 2);
  if (!strokes.length) continue;
  put(ch, 'c', strokes); nC++;
}
// ---- Hershey（英字・数字・記号） ----
{
  const chars = JSON.parse(fs.readFileSync(HER, 'utf8')).futural.chars;
  chars.forEach((g, i) => {
    const code = 33 + i; if (code > 126) return;
    const polys = pathToPolys(g.d.replace(/(\d)\s+(?=-?\d)/g, '$1 '), 1);
    // Hershey の箱：x は 0〜2o、y は -6〜30 くらい。大文字の高さ（1〜22）が 700 になるように
    const k = 700 / 21, ox = g.o;
    const strokes = polys.map(p => flat(uniq(p.map(([x, y]) => [500 + (x - ox) * k, 150 + (y - 1) * k])))).filter(s => s.length >= 2);
    if (strokes.length) { put(String.fromCharCode(code), 'l', strokes); nL++; }
  });
}
fs.mkdirSync(OUT, { recursive: true });
let total = 0, files = 0, bytes = 0;
for (const k in out) { const s = JSON.stringify(out[k]); fs.writeFileSync(path.join(OUT, k + '.json'), s); files++; bytes += s.length; total += Object.keys(out[k]).length; }
// 字の数（ひらがな・カタカナ・漢字・英数字）
const all = new Set(); for (const k in out) for (const ch in out[k]) all.add(ch);
const isHan = ch => /\p{Script=Han}/u.test(ch);
let han = 0; for (const ch of all) if (isHan(ch)) han++;
fs.writeFileSync(path.join(OUT, '..', 'gmeta.json'), JSON.stringify({ chunks: Object.keys(out), n: all.size, han }));
console.log({ nJ, nC, nL, chars: all.size, han, files, kb: Math.round(bytes / 1024) });
