// =============================================
//  漢ノ字  組み立てた画から「戦う形」と「強さ」を作る
//  ・どの端末でも必ず同じ答えになるよう、足し算・かけ算・割り算・平方根だけで計算する
//    （回転は 15度ずつで、値は表に書いておく）
//  ・画は太さの決まった線。マス目（200×200）に塗って、重なりをひとつにまとめる
//  ・まとめた形の輪郭をたどって多角形にし、面積をそろえて試合に出す
// =============================================
(function (G) {
  const OK = G.OK = G.JM = G.OK || G.JM || {};
  const SH = OK.SH = {};
  const CANVAS = SH.CANVAS = 1600;   // 組み立ての台の大きさ
  const OFF = SH.OFF = 300;          // 元の字（0〜1000）を台の真ん中に置くずらし
  const HW = SH.HW = 38;             // 線の太さの半分
  const N = SH.N = 200, CELL = CANVAS / N;   // マス目
  // 回転の表（15度ずつ 24方向）
  const Q = [1, 0.9659258262890683, 0.8660254037844387, 0.7071067811865476, 0.5, 0.25881904510252074, 0];
  const COS = [], SIN = [];
  for (let k = 0; k < 24; k++) {
    const q = k % 6, h = Math.floor(k / 6);   // 90度ごとの区切り
    const c = Q[q], s = Q[6 - q];
    const t = [[c, s], [-s, c], [-c, -s], [s, -c]][h];
    COS.push(t[0]); SIN.push(t[1]);
  }
  SH.COS = COS; SH.SIN = SIN;

  // ---------- 画のまん中 ----------
  // 画ごとに、まん中（外接する箱の中心、整数）と、まん中からの点
  SH.prep = function (strokes) {
    return strokes.map(s => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < s.length; i += 2) { x0 = Math.min(x0, s[i]); x1 = Math.max(x1, s[i]); y0 = Math.min(y0, s[i + 1]); y1 = Math.max(y1, s[i + 1]); }
      const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2), rel = [];
      for (let i = 0; i < s.length; i += 2) rel.push(s[i] - cx, s[i + 1] - cy);
      let r2 = 0; for (let i = 0; i < rel.length; i += 2) r2 = Math.max(r2, rel[i] * rel[i] + rel[i + 1] * rel[i + 1]);
      return { cx, cy, rel, r: Math.sqrt(r2) };
    });
  };
  // 元の字のままの置き方
  SH.original = prep => prep.map((p, i) => ({ i, x: p.cx + OFF, y: p.cy + OFF, r: 0 }));
  // 置いた画の点（台の座標）
  SH.points = function (p, pl) {
    const c = COS[pl.r], s = SIN[pl.r], o = [];
    for (let i = 0; i < p.rel.length; i += 2) { const dx = p.rel[i], dy = p.rel[i + 1]; o.push(pl.x + dx * c - dy * s, pl.y + dx * s + dy * c); }
    return o;
  };
  // 台からはみ出さない位置に直す（線の太さの分も内がわ）
  SH.clamp = function (p, pl) {
    const pts = SH.points(p, pl); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    let dx = 0, dy = 0; const lo = HW + 2, hi = CANVAS - HW - 2;
    if (x0 < lo) dx = lo - x0; else if (x1 > hi) dx = hi - x1;
    if (y0 < lo) dy = lo - y0; else if (y1 > hi) dy = hi - y1;
    pl.x = Math.round(pl.x + dx); pl.y = Math.round(pl.y + dy);
    return pl;
  };

  // ---------- マス目に塗る ----------
  // 返り値：own[マス] ＝ そのマスを塗った画の番号＋1（重なりは最初の画）、cnt：塗ったマスの数、by[画] ＝ その画が塗ったマスの一覧
  function raster(prep, pls) {
    const own = new Int16Array(N * N), by = [];
    const R2 = HW * HW;
    for (const pl of pls) {
      const p = prep[pl.i], pts = SH.points(p, pl), mine = [];
      const segs = pts.length === 2 ? [[pts[0], pts[1], pts[0], pts[1]]] : [];
      for (let i = 0; i + 3 < pts.length; i += 2) segs.push([pts[i], pts[i + 1], pts[i + 2], pts[i + 3]]);
      const seen = new Uint8Array(N * N);
      for (const [ax, ay, bx, by2] of segs) {
        const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - HW) / CELL)), gx1 = Math.min(N - 1, Math.floor((Math.max(ax, bx) + HW) / CELL));
        const gy0 = Math.max(0, Math.floor((Math.min(ay, by2) - HW) / CELL)), gy1 = Math.min(N - 1, Math.floor((Math.max(ay, by2) + HW) / CELL));
        const ex = bx - ax, ey = by2 - ay, l2 = ex * ex + ey * ey;
        for (let gy = gy0; gy <= gy1; gy++) {
          const py = (gy + 0.5) * CELL;
          for (let gx = gx0; gx <= gx1; gx++) {
            const k = gy * N + gx; if (seen[k]) continue;
            const px = (gx + 0.5) * CELL;
            let t = l2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = ax + ex * t - px, qy = ay + ey * t - py;
            if (qx * qx + qy * qy <= R2) { seen[k] = 1; mine.push(k); if (!own[k]) own[k] = pl.i + 1; }
          }
        }
      }
      by[pl.i] = mine;
    }
    let cnt = 0; for (let k = 0; k < N * N; k++) if (own[k]) cnt++;
    return { own, cnt, by };
  }
  // つながり（上下左右）
  function components(own) {
    const lab = new Int32Array(N * N).fill(-1), sizes = []; let n = 0; const st = [];
    for (let k = 0; k < N * N; k++) {
      if (!own[k] || lab[k] >= 0) continue;
      lab[k] = n; st.push(k); let sz = 0;
      while (st.length) {
        const c = st.pop(); sz++; const x = c % N, y = (c - x) / N;
        if (x > 0 && own[c - 1] && lab[c - 1] < 0) { lab[c - 1] = n; st.push(c - 1); }
        if (x < N - 1 && own[c + 1] && lab[c + 1] < 0) { lab[c + 1] = n; st.push(c + 1); }
        if (y > 0 && own[c - N] && lab[c - N] < 0) { lab[c - N] = n; st.push(c - N); }
        if (y < N - 1 && own[c + N] && lab[c + N] < 0) { lab[c + N] = n; st.push(c + N); }
      }
      sizes.push(sz); n++;
    }
    return { lab, n, sizes };
  }

  // ---------- 輪郭をたどる ----------
  // 塗ったマスと塗っていないマスの境目をつなぐ。外まわりは面積が正、穴は負
  function contours(own) {
    const filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && own[y * N + x] > 0;
    const out = new Map();   // 頂点 → そこから出る辺 [ [nx,ny], ... ]
    const add = (x0, y0, x1, y1) => { const k = y0 * (N + 1) + x0; let a = out.get(k); if (!a) out.set(k, a = []); a.push(x1, y1); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!own[y * N + x]) continue;
      if (!filled(x, y - 1)) add(x, y, x + 1, y);
      if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!filled(x - 1, y)) add(x, y + 1, x, y);
    }
    const rings = [];
    const keys = [...out.keys()].sort((a, b) => a - b);
    for (const k0 of keys) {
      for (;;) {
        const a0 = out.get(k0); if (!a0 || !a0.length) break;
        let x = k0 % (N + 1), y = (k0 - x) / (N + 1);
        const ring = [x, y]; let nx = a0.shift(), ny = a0.shift(); if (!a0.length) out.delete(k0);
        let dx = nx - x, dy = ny - y; x = nx; y = ny;
        let guard = 0;
        while (!(x === ring[0] && y === ring[1]) && guard++ < 200000) {
          ring.push(x, y);
          const k = y * (N + 1) + x, a = out.get(k);
          if (!a || !a.length) break;
          // 出る辺が2つあるとき（ななめにふれているマス）は、右に曲がる方を先に（上下左右のつながりと同じになる）
          let bi = 0;
          if (a.length > 2) {
            let best = 9;
            for (let i = 0; i < a.length; i += 2) {
              const ex = a[i] - x, ey = a[i + 1] - y;
              const turn = (ex === -dy && ey === dx) ? 0 : (ex === dx && ey === dy) ? 1 : 2;   // 右・まっすぐ・左
              if (turn < best) { best = turn; bi = i; }
            }
          }
          nx = a[bi]; ny = a[bi + 1]; a.splice(bi, 2); if (!a.length) out.delete(k);
          dx = nx - x; dy = ny - y; x = nx; y = ny;
        }
        if (ring.length >= 6) rings.push(ring);
      }
    }
    return rings;
  }
  const area2 = p => { let a = 0; for (let i = 0, n = p.length; i < n; i += 2) { const j = (i + 2) % n; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return a; };
  // まっすぐ並ぶ点を消して、少しなめらかに間引く（輪のまま）
  function simplify(r, tol) {
    // まっすぐの点を消す
    let p = []; const n = r.length / 2;
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      const cr = (r[2 * i] - r[2 * a]) * (r[2 * b + 1] - r[2 * i + 1]) - (r[2 * i + 1] - r[2 * a + 1]) * (r[2 * b] - r[2 * i]);
      if (cr !== 0) p.push(r[2 * i], r[2 * i + 1]);
    }
    if (p.length < 8) return p;
    // 階段の角を、辺のまん中の点に置きかえる（ギザギザをなめらかに）
    const m = []; const k = p.length / 2;
    for (let i = 0; i < k; i++) { const j = (i + 1) % k; m.push((p[2 * i] + p[2 * j]) / 2, (p[2 * i + 1] + p[2 * j + 1]) / 2); }
    p = m;
    // Douglas-Peucker（輪を2つに分けて）
    const L = p.length / 2;
    let far = 0, fd = -1; for (let i = 1; i < L; i++) { const d = (p[2 * i] - p[0]) * (p[2 * i] - p[0]) + (p[2 * i + 1] - p[1]) * (p[2 * i + 1] - p[1]); if (d > fd) { fd = d; far = i; } }
    const keep = new Uint8Array(L); keep[0] = keep[far] = 1;
    const st = [[0, far], [far, L]];
    while (st.length) {
      const [a, b] = st.pop(); if (b - a < 2) continue;
      const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * (b % L)], by = p[2 * (b % L) + 1], ex = bx - ax, ey = by - ay, l = Math.sqrt(ex * ex + ey * ey) || 1;
      let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((p[2 * i] - ax) * ey - (p[2 * i + 1] - ay) * ex) / l; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    const o = []; for (let i = 0; i < L; i++) if (keep[i]) o.push(p[2 * i], p[2 * i + 1]);
    return o.length >= 6 ? o : p;
  }
  function inPoly(x, y, p) {
    let c = false;
    for (let i = 0, n = p.length, j = n - 2; i < n; j = i, i += 2) {
      const yi = p[i + 1], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < (p[j] - p[i]) * (y - yi) / (yj - yi) + p[i]) c = !c;
    }
    return c;
  }
  function segX(ax, ay, bx, by, cx, cy, dx, dy) {   // 線分が交わるか（端点どうしは交わらない扱い）
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  // 穴を、細い切れ目で外まわりにつなぐ（1本の輪にする）
  function bridge(outer, hole) {
    // 穴のいちばん左の点
    let hi = 0; for (let i = 2; i < hole.length; i += 2) if (hole[i] < hole[hi] || (hole[i] === hole[hi] && hole[i + 1] < hole[hi + 1])) hi = i;
    const hx = hole[hi], hy = hole[hi + 1];
    // 外まわりの点のうち、近い順に、切れ目が辺と交わらないものを選ぶ
    const cand = []; for (let i = 0; i < outer.length; i += 2) cand.push([(outer[i] - hx) * (outer[i] - hx) + (outer[i + 1] - hy) * (outer[i + 1] - hy), i]);
    cand.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const crosses = (ring, ax, ay, bx, by) => { for (let i = 0, n = ring.length; i < n; i += 2) { const j = (i + 2) % n; if (segX(ax, ay, bx, by, ring[i], ring[i + 1], ring[j], ring[j + 1])) return true; } return false; };
    let oi = cand[0][1];
    for (const [, i] of cand.slice(0, 400)) { if (!crosses(outer, hx, hy, outer[i], outer[i + 1]) && !crosses(hole, hx, hy, outer[i], outer[i + 1])) { oi = i; break; } }
    const o = outer.slice(0, oi + 2);
    for (let k = 0; k <= hole.length; k += 2) { const t = (hi + k) % hole.length; o.push(hole[t], hole[t + 1]); }
    o.push(outer[oi], outer[oi + 1]);
    return o.concat(outer.slice(oi + 2));
  }
  // 凸包（整数の点）
  function hullArea2(pts) {
    const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (P.length < 3) return 0;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    const h = lo.slice(0, -1).concat(up.slice(0, -1)); let a = 0;
    for (let i = 0; i < h.length; i++) { const j = (i + 1) % h.length; a += h[i][0] * h[j][1] - h[j][0] * h[i][1]; }
    return Math.abs(a);
  }

  // ---------- 形と強さ ----------
  // prep：SH.prep の結果、pls：置き方 [{i,x,y,r}]、opt.full：輪郭（試合用の形）も作る
  SH.build = function (prep, pls, opt = {}) {
    const ras = raster(prep, pls), cmp = components(ras.own);
    // 画ごとに、どのかたまりに入っているか
    const strokeComp = pls.map(pl => { const m = ras.by[pl.i]; return m && m.length ? cmp.lab[m[0]] : -1; });
    // いちばん画が多いかたまり（同じなら大きい方）
    const cntBy = new Array(cmp.n).fill(0); for (const c of strokeComp) if (c >= 0) cntBy[c]++;
    let main = 0; for (let c = 1; c < cmp.n; c++) if (cntBy[c] > cntBy[main] || (cntBy[c] === cntBy[main] && cmp.sizes[c] > cmp.sizes[main])) main = c;
    const loose = pls.filter((pl, k) => strokeComp[k] !== main).map(pl => pl.i);
    const res = { ink: ras.cnt, comps: cmp.n, loose, connected: cmp.n === 1, strokes: pls.length };
    if (!opt.full) return res;
    // 輪郭 → 多角形（台の座標）
    const rings = contours(ras.own).map(r => simplify(r, 0.9)).filter(r => r.length >= 6 && area2(r) !== 0);
    const outers = rings.filter(r => area2(r) > 0), holes = rings.filter(r => area2(r) < 0);
    const parts = outers.map(r => ({ r, a: area2(r) }));
    // 穴は、それをかこむ外まわりのうち、いちばん小さいものにつなぐ
    holes.sort((a, b) => { let ma = 1e9, mb = 1e9; for (let i = 0; i < a.length; i += 2) ma = Math.min(ma, a[i]); for (let i = 0; i < b.length; i += 2) mb = Math.min(mb, b[i]); return ma - mb; });
    for (const h of holes) {
      let best = null;
      for (const o of parts) if (inPoly(h[0] + 0.25, h[1] + 0.25, o.r0 || o.r) || inPoly(h[0], h[1], o.r0 || o.r)) { if (!best || o.a < best.a) best = o; }
      if (!best) continue;
      if (!best.r0) best.r0 = best.r;
      best.r = bridge(best.r, h);
    }
    let A = 0; for (const o of parts) A += area2(o.r0 || o.r) / 2; for (const h of holes) A += area2(h) / 2;
    // 面積を 1000×1000 にそろえた整数の形（重心を原点に）
    const k = Math.sqrt(1e6 / (A * CELL * CELL));
    let cx = 0, cy = 0, aa = 0;
    for (const o of parts) { const p = o.r; for (let i = 0, n = p.length; i < n; i += 2) { const j = (i + 2) % n, c = p[i] * p[j + 1] - p[j] * p[i + 1]; aa += c; cx += (p[i] + p[j]) * c; cy += (p[i + 1] + p[j + 1]) * c; } }
    cx /= 3 * aa; cy /= 3 * aa;
    res.parts = parts.map(o => o.r.map((v, i) => Math.round((v - (i % 2 ? cy : cx)) * CELL * k)));
    res.area = A;
    // 強さのもと
    const allPts = []; for (const o of parts) { const p = o.r0 || o.r; for (let i = 0; i < p.length; i += 2) allPts.push(p[i], p[i + 1]); }
    const hull = hullArea2(allPts) / 2;
    res.fill = hull > 0 ? A / hull : 1;                      // すき間の少なさ
    let r2 = 0; for (let i = 0; i < allPts.length; i += 2) r2 = Math.max(r2, (allPts[i] - cx) * (allPts[i] - cx) + (allPts[i + 1] - cy) * (allPts[i + 1] - cy));
    res.reach = r2 / A;                                      // 出っぱり（いちばん遠い点まで²÷面積）
    return res;
  };

  // ---------- 強さ（0〜100） ----------
  // 元の字（約1万字）の中で何番目くらいか（OK.PCT は tools で作った表）
  function pct(tab, v) {
    if (!tab) return 50;
    const n = tab.length - 1;
    if (v <= tab[0]) return 0; if (v >= tab[n]) return 100;
    let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] <= v) lo = m; else hi = m; }
    const f = tab[hi] > tab[lo] ? (v - tab[lo]) / (tab[hi] - tab[lo]) : 0;
    return Math.round((lo + f) / n * 100);
  }
  SH.stats = function (b) {
    const P = OK.PCT || {};
    const ink = pct(P.ink, b.ink);
    return {
      hp: ink,                       // 体力：線が占める広さ
      atk: pct(P.atk, b.strokes),    // 勢い：画数
      def: pct(P.fill, b.fill),      // かたさ：すき間の少なさ
      shp: pct(P.reach, b.reach),    // 鋭さ：出っぱり
      spd: 100 - ink,                // 速さ：軽さ
    };
  };

  // ---------- 作品（文字列） ----------
  // 「字形の記号＋字:画,x,y,向き;…」 例：j木:0,812,640,0;1,…
  SH.encode = (form, ch, pls) => form + ch + ':' + pls.slice().sort((a, b) => a.i - b.i).map(p => [p.i, p.x, p.y, p.r].join(',')).join(';');
  SH.decode = function (s) {
    const m = /^([jclh])(.+?):([0-9,;]*)$/u.exec(String(s || ''));
    if (!m || [...m[2]].length !== 1) return null;
    const pls = m[3] ? m[3].split(';').map(t => { const v = t.split(',').map(Number); return { i: v[0], x: v[1], y: v[2], r: v[3] }; }) : [];
    for (const p of pls) if (![p.i, p.x, p.y, p.r].every(Number.isInteger) || p.r < 0 || p.r > 23 || p.x < 0 || p.y < 0 || p.x > CANVAS || p.y > CANVAS) return null;
    return { form: m[1], ch: m[2], pls };
  };
  // 文字列から、試合に出す形をつくる（OK.GL で字を読む）
  const memo = new Map();
  SH.make = async function (s) {
    if (memo.has(s)) return memo.get(s);
    const w = SH.decode(s); if (!w) throw new Error('作品が読めませんでした');
    const g = await OK.GL.get(w.ch); if (!g || !g.forms[w.form]) throw new Error('その字の画がありません');
    const prep = SH.prep(g.forms[w.form]);
    if (w.pls.length !== prep.length || new Set(w.pls.map(p => p.i)).size !== prep.length || w.pls.some(p => p.i < 0 || p.i >= prep.length)) throw new Error('画の数があいません');
    const b = SH.build(prep, w.pls, { full: true });
    const out = { s, form: w.form, ch: w.ch, pls: w.pls, prep, b, st: SH.stats(b), orig: SH.isOriginal(prep, w.pls) };
    memo.set(s, out); if (memo.size > 60) memo.delete(memo.keys().next().value);
    return out;
  };
  SH.isOriginal = (prep, pls) => pls.every(p => p.r === 0 && p.x === prep[p.i].cx + OFF && p.y === prep[p.i].cy + OFF);
  SH.originalOf = (form, ch, prep) => SH.encode(form, ch, SH.original(prep));
  // 試合用の def（sim.js の Body に渡す）
  // 画数が少ない字は、細い線が欠けて落ちやすいので体力を足す（たくさん戦わせて決めた値。画数で決まるので組み方では変わらない）
  const HPX = [3.0743,2.4104,2.0283,1.7741,1.5903,1.4498,1.3382,1.2469,1.1705,1.1054,1.0492,1.0000,0.9565,0.9177,0.8829,0.8513,0.8226,0.7964,0.7722,0.7500,0.7293,0.7101,0.6922,0.6755,0.6598,0.6450,0.6311,0.6179,0.6055,0.5937,0.5825,0.5718,0.5617,0.5520,0.5427,0.5339,0.5254,0.5173,0.5095,0.5020,0.4948,0.4878,0.4812,0.4747,0.4685,0.4625,0.4567,0.4511,0.4456,0.4404,0.4353,0.4303,0.4255,0.4209,0.4163,0.4119,0.4077,0.4035,0.3995,0.3955,0.3917,0.3879,0.3843,0.3807,0.3773,0.3739,0.3706,0.3673,0.3642,0.3611,0.3581];
  SH.hpx = n => HPX[Math.max(0, Math.min(HPX.length - 1, n))];
  SH.def = w => ({ key: w.s, parts: w.b.parts, st: w.st, pol: [], hpx: SH.hpx(w.prep.length) });
})(typeof window !== 'undefined' ? window : globalThis);
