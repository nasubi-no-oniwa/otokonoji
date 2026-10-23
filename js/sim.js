// =============================================
//  漢ノ字  ぶつかり割り（自作の2D物理。地元の最強と同じしくみ）
//  ・同じ作品どうしなら、どの端末でも必ず同じ結果
//    （Math.sin / cos などは端末で答えが少しちがうことがあるので使わない。
//      足し算・かけ算・割り算・平方根だけで計算する）
//  ・形は欠片（かけら）に分かれていて、強く当たると割れて飛ぶ
// =============================================
(function (G) {
  const JM = G.JM = G.OK = G.JM || G.OK || {};
  // ---------- 決まった答えの sin / cos ----------
  const PI = 3.141592653589793, TAU = 6.283185307179586;
  function dsin(x) {
    x = x - TAU * Math.round(x / TAU);              // -π〜π
    if (x > PI / 2) x = PI - x; else if (x < -PI / 2) x = -PI - x;   // -π/2〜π/2
    const x2 = x * x;
    return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110 * (1 - x2 / 156 * (1 - x2 / 210)))))));
  }
  const dcos = x => dsin(x + PI / 2);
  const sq = v => v * v;   // 2乗はかけ算で（べき乗は端末で答えがずれることがある）
  JM.dsin = dsin; JM.dcos = dcos;
  // ---------- 決まった並びの乱数（欠片の種の位置に使う） ----------
  function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // ---------- 多角形の道具 ----------
  function polyArea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i += 2) { const j = (i + 2) % n; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return a / 2; }
  function polyProps(p) {   // 面積・重心・慣性（重心まわり、密度1）
    let a = 0, cx = 0, cy = 0, ix = 0;
    for (let i = 0, n = p.length; i < n; i += 2) {
      const j = (i + 2) % n, x0 = p[i], y0 = p[i + 1], x1 = p[j], y1 = p[j + 1], c = x0 * y1 - x1 * y0;
      a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; ix += c * (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1);
    }
    a /= 2; if (Math.abs(a) < 1e-12) return { a: 0, cx: p[0], cy: p[1], i: 0 };
    cx /= 6 * a; cy /= 6 * a; const io = ix / 12;
    return { a: Math.abs(a), cx, cy, i: Math.abs(io) - Math.abs(a) * (cx * cx + cy * cy) };
  }
  function inPoly(x, y, p) {
    let c = false;
    for (let i = 0, n = p.length, j = n - 2; i < n; j = i, i += 2) {
      const yi = p[i + 1], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < (p[j] - p[i]) * (y - yi) / (yj - yi) + p[i]) c = !c;
    }
    return c;
  }
  // 凸の切り取り（半平面 nx*x+ny*y <= d のがわを残す）。新しくできた辺には tag をつける
  function clipHalf(pts, tags, nx, ny, d, tag) {
    const out = [], ot = [], n = pts.length / 2; if (!n) return [out, ot];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * j], by = pts[2 * j + 1];
      const da = nx * ax + ny * ay - d, db = nx * bx + ny * by - d;
      if (da <= 0) { out.push(ax, ay); ot.push(tags[i]); }
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push(ax + (bx - ax) * t, ay + (by - ay) * t); ot.push(da <= 0 ? tag : tags[i]); }
    }
    return [out, ot];
  }
  // ---------- 形から欠片を作る ----------
  // parts: [[x,y,x,y...]]（面積が 1 になるよう正規化済みの座標をさらに world に拡大したもの）
  // 辺の tag：-1 = もとの輪郭（外がわ）、0以上 = となりの欠片の種の番号
  function makeFragments(parts, key) {
    const rnd = lcg(hashStr(key));
    // 輪の向きを反時計回り（面積が正）にそろえる
    parts = parts.map(p => { if (polyArea(p) >= 0) return p; const q = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(p[i], p[i + 1]); return q; });
    // 外形の頂点の「とがり」：前後に少し離れた点との角度で測る
    const sharpOf = [];
    for (const p of parts) {
      const n = p.length / 2, sh = new Float64Array(n);
      let per = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; per += Math.sqrt(sq(p[2 * j] - p[2 * i]) + sq(p[2 * j + 1] - p[2 * i + 1])); }
      const reach = per * 0.02;
      for (let i = 0; i < n; i++) {
        // reach だけ前後に進んだ点
        let a = i, acc = 0; while (acc < reach) { const b = (a - 1 + n) % n; acc += Math.sqrt(sq(p[2 * a] - p[2 * b]) + sq(p[2 * a + 1] - p[2 * b + 1])); a = b; if (a === i) break; }
        let c = i; acc = 0; while (acc < reach) { const b = (c + 1) % n; acc += Math.sqrt(sq(p[2 * c] - p[2 * b]) + sq(p[2 * c + 1] - p[2 * b + 1])); c = b; if (c === i) break; }
        const ux = p[2 * a] - p[2 * i], uy = p[2 * a + 1] - p[2 * i + 1], vx = p[2 * c] - p[2 * i], vy = p[2 * c + 1] - p[2 * i + 1];
        const lu = Math.sqrt(ux * ux + uy * uy) || 1, lv = Math.sqrt(vx * vx + vy * vy) || 1;
        const cosA = (ux * vx + uy * vy) / (lu * lv), cross = vx * uy - vy * ux;   // 反時計回りの輪で cross>0 が出っぱり
        // 角度が小さい（cos が 1 に近い）出っぱりほどとがっている
        sh[i] = cross > 0 ? Math.max(0, (cosA + 0.2) / 1.2) : 0;
      }
      sharpOf.push(sh);
    }
    // 種：六角形にならべて、形の中にあるものだけ。少しずらす
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, area = 0;
    for (const p of parts) { area += Math.abs(polyArea(p)); for (let i = 0; i < p.length; i += 2) { minx = Math.min(minx, p[i]); maxx = Math.max(maxx, p[i]); miny = Math.min(miny, p[i + 1]); maxy = Math.max(maxy, p[i + 1]); } }
    const sp = Math.sqrt(area / 34) * 1.07, seeds = [];
    for (let row = 0, y = miny + sp * 0.4; y < maxy; y += sp * 0.866, row++) {
      for (let x = minx + (row % 2 ? sp * 0.5 : 0) + sp * 0.3; x < maxx; x += sp) {
        const jx = x + (rnd() - 0.5) * sp * 0.5, jy = y + (rnd() - 0.5) * sp * 0.5;
        if (parts.some(p => inPoly(jx, jy, p))) seeds.push(jx, jy);
      }
    }
    // 小さい島などで種がない部分には、その部分の重心に1つ置く
    for (const p of parts) { let has = false; for (let i = 0; i < seeds.length; i += 2) if (inPoly(seeds[i], seeds[i + 1], p)) { has = true; break; } if (!has) { const q = polyProps(p); seeds.push(q.cx, q.cy); } }
    const ns = seeds.length / 2, frags = [];
    const big = (maxx - minx + maxy - miny) * 2;
    for (let s = 0; s < ns; s++) {
      const sx = seeds[2 * s], sy = seeds[2 * s + 1];
      // ボロノイの領域（凸）を各部分に当てて切る
      const planes = [], far = [];
      for (let t = 0; t < ns; t++) {
        if (t === s) continue; const tx = seeds[2 * t], ty = seeds[2 * t + 1], dx = tx - sx, dy = ty - sy;
        (dx * dx + dy * dy > sp * sp * 9 ? far : planes).push([dx, dy, (dx * (sx + tx) + dy * (sy + ty)) / 2, t]);
      }
      parts.forEach((p, pi) => {
        let pts = Array.from(p), tags = new Array(p.length / 2).fill(-1), vsh = Array.from(sharpOf[pi]);
        // 頂点のとがりは、頂点の位置で引き継ぐ（切ってできた点は 0）
        let shp = vsh;
        const clip = list => {
          for (const [nx, ny, d, t] of list) {
            const out = [], ot = [], os = [], n = pts.length / 2; if (!n) break;
            for (let i = 0; i < n; i++) {
              const j = (i + 1) % n, ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * j], by = pts[2 * j + 1];
              const da = nx * ax + ny * ay - d, db = nx * bx + ny * by - d;
              if (da <= 0) { out.push(ax, ay); ot.push(tags[i]); os.push(shp[i]); }
              if ((da <= 0) !== (db <= 0)) { const k = da / (da - db); out.push(ax + (bx - ax) * k, ay + (by - ay) * k); ot.push(da <= 0 ? t : tags[i]); os.push(0); }
            }
            pts = out; tags = ot; shp = os;
          }
        };
        clip(planes);
        // 欠片が種から 1.5 マスより遠くまで広がっているときだけ、遠い種でも切る。
        // （離れた島の種の領域が本土全体にかぶると「割れない大きな欠片」ができて無敵になる。北海道など）
        // ふつうの欠片は遠い種では切れないので、前と同じ形・同じ結果のまま
        let ext = false; for (let i = 0; i < pts.length; i += 2) if (sq(pts[i] - sx) + sq(pts[i + 1] - sy) > sp * sp * 2.25) { ext = true; break; }
        if (ext) clip(far);
        if (pts.length < 6) return;
        const pr = polyProps(pts); if (pr.a < area * 0.0015) return;
        frags.push({ seed: s, part: pi, poly: pts, tags, sharp: shp, a: pr.a, cx: pr.cx, cy: pr.cy, inertia: pr.i });
      });
    }
    // となりどうし（seed番号→欠片の番号）
    const bySeed = new Map(); frags.forEach((f, i) => { if (!bySeed.has(f.seed)) bySeed.set(f.seed, []); bySeed.get(f.seed).push(i); });
    for (const f of frags) {
      f.nb = []; for (const t of f.tags) if (t >= 0 && bySeed.has(t)) for (const k of bySeed.get(t)) if (!f.nb.includes(k) && frags[k].part === f.part) f.nb.push(k);
      let r = 0; for (let i = 0; i < f.poly.length; i += 2) r = Math.max(r, sq(f.poly[i] - f.cx) + sq(f.poly[i + 1] - f.cy)); f.r = Math.sqrt(r);
    }
    return frags;
  }
  JM.makeFragments = makeFragments;
  // ---------- 市町村の体 ----------
  JM.HPA = 80; JM.DMG = 0.08; JM.BIG_MAX = 1.6;   // 広がった形の加点の上限
  JM.K = { atk0: 0.8, atk1: 0.5, def0: 0.8, def1: 0.5, hp0: 0.8, hp1: 0.5, acc0: 8, acc1: 12, vm0: 5.5, vm1: 6, sh1: 4.2, m0: 0.9, m1: 0.25 };
  JM.CASTLE_MAX = 0.22;              // 城下町保存：割れない中心部の広さの上限（全体に対して）
  const WORLD_AREA = 10.2;           // ならした面積（半径 1.8 の円くらい）
  const R_FIT = 5.0;                 // 形の大きさの上限（重心からいちばん遠い点まで）。土俵の半径は 7.2
  class Body {
    constructor(def, side) {
      // def: { key, parts(int配列：面積 1000^2), st: {hp,atk,def,shp,spd} 0-100, pol: [政策のキー] }
      this.def = def; this.side = side;
      let s = Math.sqrt(WORLD_AREA) / 1000;
      // 細長い・島が散らばる形（チリ、ノルウェー、マーシャル諸島など）は、土俵に入りきらず押し合ったまま動けなくなる。
      // 重心からいちばん遠い点が R_FIT をこえる形だけ小さくする（体力と重さは、もとの大きさの分のまま）
      this.big = 1;
      {
        let A = 0, cx = 0, cy = 0;
        for (const p of def.parts) {   // 輪の向きがばらばらでも重心が正しく出るよう、部分ごとに向きをそろえる
          let a = 0, x = 0, y = 0;
          for (let i = 0, n = p.length; i < n; i += 2) { const j = (i + 2) % n, c = p[i] * p[j + 1] - p[j] * p[i + 1]; a += c; x += (p[i] + p[j]) * c; y += (p[i + 1] + p[j + 1]) * c; }
          const sg = a < 0 ? -1 : 1; A += a * sg; cx += x * sg; cy += y * sg;
        }
        if (A) { cx /= 3 * A; cy /= 3 * A; }
        let r2 = 0; for (const p of def.parts) for (let i = 0; i < p.length; i += 2) r2 = Math.max(r2, sq(p[i] - cx) + sq(p[i + 1] - cy));
        const r = Math.sqrt(r2) * s;
        if (r > R_FIT) { const k = R_FIT / r; s *= k; this.big = Math.min(JM.BIG_MAX, 1 / (k * k)); }
      }
      const parts = def.parts.map(p => p.map(v => v * s));
      this.frags = makeFragments(parts, def.key);
      // 重心を原点に
      let A = 0, cx = 0, cy = 0; for (const f of this.frags) { A += f.a; cx += f.cx * f.a; cy += f.cy * f.a; }
      cx /= A; cy /= A;
      for (const f of this.frags) { for (let i = 0; i < f.poly.length; i += 2) { f.poly[i] -= cx; f.poly[i + 1] -= cy; } f.cx -= cx; f.cy -= cy; }
      this.area0 = A;
      const st = def.st;
      // 能力の効き（漢ノ字用に調整。数字は JM.K で変えられる）
      const K = JM.K;
      this.atk = K.atk0 + st.atk / 100 * K.atk1;
      this.dfn = K.def0 + st.def / 100 * K.def1;
      this.hpk = (K.hp0 + st.hp / 100 * K.hp1) * (def.hpx || 1);
      this.acc = K.acc0 + st.spd / 100 * K.acc1; this.vmax = K.vm0 + st.spd / 100 * K.vm1;
      this.sharpK = 1.0 + st.shp / 100 * K.sh1; this.shpK = 0.85 + st.shp / 100 * 0.35;
      this.massK = (K.m0 + st.atk / 100 * K.m1) * this.big;
      for (const f of this.frags) { f.hp = f.a * JM.HPA * this.hpk * this.big; f.max = f.hp; f.alive = true; f.core = false; }
      this.p = new Set(def.pol || []);
      // 城下町保存：真ん中の欠片は割れない
      // ※割れない部分は「面積で全体の22%まで」。欠片の数で決めると、形によっては割れない部分が35%をこえて、絶対に負けなくなってしまう
      if (this.p.has('castle')) {
        const sorted = this.frags.map((f, i) => [f.cx * f.cx + f.cy * f.cy, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let core = 0; const cap = A * JM.CASTLE_MAX;
        for (const [, i] of sorted) { const f = this.frags[i]; if (core + f.a > cap) continue; f.core = true; core += f.a; }
      }
      this.x = 0; this.y = 0; this.a = 0; this.vx = 0; this.vy = 0; this.w = 0; this.c = 1; this.s = 0;
      this.mode = 0; this.modeT = 0; this.hits = 0; this.shield = this.p.has('drill') ? 1 : 0; this.first = this.p.has('shinkansen');
      this.mass(); this.alive = A;
    }
    // 生きている欠片から重さ・慣性を計算しなおす（見た目の位置はそのまま）
    mass() {
      let A = 0, cx = 0, cy = 0;
      for (const f of this.frags) if (f.alive) { A += f.a; cx += f.cx * f.a; cy += f.cy * f.a; }
      if (A <= 0) { this.m = 1; this.I = 1; return; }
      cx /= A; cy /= A;
      // 重心がずれた分だけ体の位置を動かす
      if (Math.abs(cx) + Math.abs(cy) > 1e-12) {
        for (const f of this.frags) { for (let i = 0; i < f.poly.length; i += 2) { f.poly[i] -= cx; f.poly[i + 1] -= cy; } f.cx -= cx; f.cy -= cy; }
        this.x += this.c * cx - this.s * cy; this.y += this.s * cx + this.c * cy;
        this.ox = (this.ox || 0) + cx; this.oy = (this.oy || 0) + cy;
      }
      let I = 0; for (const f of this.frags) if (f.alive) I += f.inertia + f.a * (f.cx * f.cx + f.cy * f.cy);
      const k = this.massK; this.m = A * k; this.I = I * k; this.alive = A;
    }
    toWorld(x, y) { return [this.x + this.c * x - this.s * y, this.y + this.s * x + this.c * y]; }
    toLocal(x, y) { const dx = x - this.x, dy = y - this.y; return [this.c * dx + this.s * dy, -this.s * dx + this.c * dy]; }
    ratio() { return this.alive / this.area0; }
  }
  JM.Body = Body;
  // ---------- 試合 ----------
  const DT = 1 / 120, R_ARENA = 7.2, TMAX = 60, LOSE = 0.35;
  JM.DT = DT; JM.TMAX = TMAX; JM.R_ARENA = R_ARENA; JM.LOSE = LOSE;
  class Match {
    // a, b: def。dirA/dirB：0〜7（45度ずつ。0 = 地図の北が上のまま）
    constructor(a, b, dirA, dirB) {
      this.A = new Body(a, 0); this.B = new Body(b, 1);
      this.A.x = -3.9; this.B.x = 3.9;
      // 向き：B は相手（左）を向くように 180度回してから、自分の向きを足す（同じ条件なら点対称）
      this.A.a = dirA * PI / 4; this.B.a = PI + dirB * PI / 4;
      for (const o of [this.A, this.B]) { o.c = dcos(o.a); o.s = dsin(o.a); }
      this.t = 0; this.step = 0; this.ev = []; this.over = false; this.winner = -2; this.debris = [];
      this.hitN = 0; this.mirror = a.key === b.key && dirA === dirB && JSON.stringify(a.pol || []) === JSON.stringify(b.pol || []);
    }
    run(maxSteps) { let n = 0; while (!this.over && n < maxSteps) { this.tick(); n++; } }
    tick() {
      if (this.over) return;
      const A = this.A, B = this.B; this.step++; this.t = this.step * DT;
      for (const [o, e] of [[A, B], [B, A]]) this.drive(o, e);
      for (const o of [A, B]) {
        o.x += o.vx * DT; o.y += o.vy * DT; o.a += o.w * DT; o.c = dcos(o.a); o.s = dsin(o.a);
        o.vx *= 0.9985; o.vy *= 0.9985; o.w *= 0.994;
        this.wall(o);
      }
      this.collide();
      // 欠片（見た目だけ）
      for (const d of this.debris) { d.x += d.vx * DT; d.y += d.vy * DT; d.a += d.w * DT; d.vx *= 0.985; d.vy *= 0.985; d.t += DT; }
      if (this.step % 30 === 0) this.debris = this.debris.filter(d => d.t < 2.5);
      // 勝ち負け
      const ra = A.ratio(), rb = B.ratio();
      if (ra < LOSE || rb < LOSE || this.t >= TMAX) {
        this.over = true;
        if (this.mirror) this.winner = -1;
        else if (ra < LOSE && rb < LOSE) this.winner = ra === rb ? -1 : (ra > rb ? 0 : 1);
        else if (ra < LOSE) this.winner = 1; else if (rb < LOSE) this.winner = 0;
        else this.winner = ra === rb ? -1 : (ra > rb ? 0 : 1);
        this.endBy = this.t >= TMAX && ra >= LOSE && rb >= LOSE ? 'time' : 'break';
      }
    }
    // 相手に向かって突っこむ → 当たったら少し下がる → また突っこむ
    drive(o, e) {
      o.modeT -= DT;
      let dx = e.x - o.x, dy = e.y - o.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; dx /= d; dy /= d;
      let acc = o.acc;
      if (e.p.has('pr')) acc *= 1.3;                       // 観光PR：相手が引き寄せられる
      if (o.mode === 1) { acc = -o.acc * 0.55; if (o.modeT <= 0) o.mode = 0; }   // 下がる
      o.vx += dx * acc * DT; o.vy += dy * acc * DT;
      // 中心に寄せる弱い力（はしで止まらないように）
      o.vx -= o.x * 0.25 * DT; o.vy -= o.y * 0.25 * DT;
      const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy), vm = o.vmax * (o.p.has('port') && o.portT > this.t ? 1.35 : 1);
      if (sp > vm) { o.vx *= vm / sp; o.vy *= vm / sp; }
    }
    wall(o) {
      // いちばん外の頂点が土俵の外なら押し戻して跳ね返す
      let best = 0, bx = 0, by = 0;
      for (const f of o.frags) {
        if (!f.alive) continue;
        const [wx, wy] = o.toWorld(f.cx, f.cy); if (Math.sqrt(wx * wx + wy * wy) + f.r < R_ARENA) continue;
        for (let i = 0; i < f.poly.length; i += 2) { const [x, y] = o.toWorld(f.poly[i], f.poly[i + 1]); const r = Math.sqrt(x * x + y * y) - R_ARENA; if (r > best) { best = r; bx = x; by = y; } }
      }
      if (best <= 0) return;
      const r = Math.sqrt(bx * bx + by * by), nx = -bx / r, ny = -by / r;
      o.x += nx * best; o.y += ny * best;
      const rx = bx - o.x, ry = by - o.y, vpx = o.vx - o.w * ry, vpy = o.vy + o.w * rx, vn = vpx * nx + vpy * ny;
      if (vn >= 0) return;
      const e = o.p.has('port') ? 0.95 : 0.6, rn = rx * ny - ry * nx, j = -(1 + e) * vn / (1 / o.m + rn * rn / o.I);
      o.vx += j * nx / o.m; o.vy += j * ny / o.m; o.w += rn * j / o.I;
      if (o.p.has('port')) o.portT = this.t + 0.8;
      if (-vn > 2) this.ev.push({ k: 'wall', x: bx, y: by, v: -vn });
    }
    // ---------- ぶつかり ----------
    collide() {
      const A = this.A, B = this.B;
      if (Math.sqrt(sq(A.x - B.x) + sq(A.y - B.y)) > 9) return;
      const cs = [];
      this.points(A, B, cs, 0); this.points(B, A, cs, 1);
      if (!cs.length) { this.press = 0; return; }
      // ふれたまま強く当たらない時間が続いたら、両方いったん下がる（押し合ったまま止まらないように）
      this.press = (this.press || 0) + 1;
      if (this.press > 180) { this.press = 0; for (const o of [A, B]) { o.mode = 1; o.modeT = 0.6; } }
      // 深い順に4つまで（同じ深さなら、作られた順。点対称のときも同じ順になるよう A,B を交互に）
      cs.sort((p, q) => q.d - p.d || p.o - q.o);
      const use = cs.slice(0, 4);
      // 押し戻し（深さの平均）
      let nx = 0, ny = 0, dep = 0; for (const c of use) { nx += c.nx; ny += c.ny; dep += c.d; }
      const nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl; dep /= use.length;
      const tot = A.m + B.m; A.x -= nx * dep * B.m / tot; A.y -= ny * dep * B.m / tot; B.x += nx * dep * A.m / tot; B.y += ny * dep * A.m / tot;
      // 接触点（平均）での衝撃
      let px = 0, py = 0; for (const c of use) { px += c.x; py += c.y; } px /= use.length; py /= use.length;
      const rax = px - A.x, ray = py - A.y, rbx = px - B.x, rby = py - B.y;
      const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax, vbx = B.vx - B.w * rby, vby = B.vy + B.w * rbx;
      const vn = (vbx - vax) * nx + (vby - vay) * ny;   // 負ならお互いに近づいている
      if (vn < 0) {
        const ran = rax * ny - ray * nx, rbn = rbx * ny - rby * nx;
        const kn = 1 / A.m + 1 / B.m + ran * ran / A.I + rbn * rbn / B.I, e = 0.45, j = -(1 + e) * vn / kn;
        A.vx -= j * nx / A.m; A.vy -= j * ny / A.m; A.w -= ran * j / A.I;
        B.vx += j * nx / B.m; B.vy += j * ny / B.m; B.w += rbn * j / B.I;
        // こすれ（回転が生まれる）
        const tx = -ny, ty = nx, vt = (vbx - vax) * tx + (vby - vay) * ty, rat = rax * ty - ray * tx, rbt = rbx * ty - rby * tx;
        const kt = 1 / A.m + 1 / B.m + rat * rat / A.I + rbt * rbt / B.I; let jt = -vt / kt; const lim = j * 0.3; if (jt > lim) jt = lim; if (jt < -lim) jt = -lim;
        A.vx -= jt * tx / A.m; A.vy -= jt * ty / A.m; A.w -= rat * jt / A.I; B.vx += jt * tx / B.m; B.vy += jt * ty / B.m; B.w += rbt * jt / B.I;
        // どちらが勢いよく突っこんだか（速い方が強く当てる）
        const ua = Math.max(0, vax * nx + vay * ny), ub = Math.max(0, -(vbx * nx + vby * ny)), us = ua + ub || 1;
        if (-vn > 1.2) this.damage(use, -vn, px, py, [ua / us, ub / us]);
        // 当たったら少し下がる
        if (-vn > 1.2) { this.press = 0; for (const o of [A, B]) { o.mode = 1; o.modeT = 0.45; } }
      }
    }
    // o の頂点が e の欠片に入っている点を集める
    points(o, e, cs, who) {
      for (const f of o.frags) {
        if (!f.alive) continue;
        const [fx, fy] = o.toWorld(f.cx, f.cy);
        for (const g of e.frags) {
          if (!g.alive) continue;
          const [gx, gy] = e.toWorld(g.cx, g.cy), rr = f.r + g.r;
          if (sq(fx - gx) + sq(fy - gy) > rr * rr) continue;
          for (let i = 0; i < f.poly.length; i += 2) {
            const [wx, wy] = o.toWorld(f.poly[i], f.poly[i + 1]);
            const [lx, ly] = e.toLocal(wx, wy);
            if (!inPoly(lx, ly, g.poly)) continue;
            // いちばん近い「外に出ている辺」で向きと深さを決める
            let bd = 1e9, bnx = 0, bny = 0;
            for (let k = 0, n = g.poly.length; k < n; k += 2) {
              const t = g.tags[k / 2]; if (t >= 0 && this.nbAlive(e, g, t)) continue;
              const ax = g.poly[k], ay = g.poly[k + 1], bx = g.poly[(k + 2) % n], by = g.poly[(k + 3) % n];
              const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-12; let u = ((lx - ax) * ex + (ly - ay) * ey) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
              const qx = ax + ex * u - lx, qy = ay + ey * u - ly, d = Math.sqrt(qx * qx + qy * qy);
              if (d < bd) { bd = d; const el = Math.sqrt(l2); bnx = ey / el; bny = -ex / el; }   // 反時計回りの輪の外向き
            }
            if (bd > 0.5) continue;
            // e の外向き法線を world に。A→B の向き（o が A なら -n、B なら +n）
            let nx = e.c * bnx - e.s * bny, ny = e.s * bnx + e.c * bny;
            if (who === 0) { nx = -nx; ny = -ny; }
            cs.push({ x: wx, y: wy, nx, ny, d: bd, o: cs.length * 2 + who, who, sh: f.sharp[i / 2] || 0, fo: f, fe: g });
          }
        }
      }
    }
    nbAlive(e, g, seed) { for (const k of g.nb) { const h = e.frags[k]; if (h.seed === seed && h.alive) return true; } return false; }
    // ---------- 割れる ----------
    damage(use, vn, px, py, share) {
      const A = this.A, B = this.B, mu = A.m * B.m / (A.m + B.m), E = 0.5 * mu * vn * vn * JM.DMG;
      // とがりはいちばんとがった接触点で決める（A の点が B を刺す / B の点が A を刺す）
      let shA = 0, shB = 0; for (const c of use) { if (c.who === 0) shA = Math.max(shA, c.sh); else shB = Math.max(shB, c.sh); }
      const hit = [[A, B, shA], [B, A, shB]], dm = [0, 0];
      for (let k = 0; k < 2; k++) {
        const [o, e, sh] = hit[k], sh2 = hit[1 - k][2];
        let d = E * (1 + o.sharpK * sh) * o.atk * (1 + o.hits * (o.p.has('furusato') ? 0.06 : 0)) / e.dfn * (0.4 + 1.2 * share[k]) * (o.portT > this.t ? 1.35 : 1) * o.shpK;
        d *= 1 + e.sharpK * 0.25 * sh2 * 0;   // （予約）
        // とがった所で当てた側も少し欠けやすい
        if (o.first) d *= 3.4;
        dm[1 - k] += d;           // e が受ける
        dm[k] += E * 0.22 * (1 + sh * 0.5) * e.atk / o.dfn;   // 当てた反動
      }
      for (const o of [A, B]) if (o.first) o.first = false;
      this.hitN++;
      const ev = { k: 'hit', x: px, y: py, v: vn, d: [dm[0], dm[1]], br: [0, 0] };
      for (let k = 0; k < 2; k++) {
        const o = hit[k][0]; let d = dm[k];
        if (o.shield && d > 12) { o.shield = 0; d *= 0.1; ev.shield = k; }
        ev.br[k] = this.apply(o, d, px, py);
        if (ev.br[k] && hit[1 - k][0].p.has('gappei')) this.heal(hit[1 - k][0], ev.br[k] * 0.22);
        if (dm[1 - k] > 2) hit[1 - k][0].hits = Math.min(4, hit[1 - k][0].hits + 1);
      }
      this.ev.push(ev);
    }
    // 接触点の近くの欠片に分けてダメージ。割れた面積を返す
    apply(o, dmg, px, py) {
      const [lx, ly] = o.toLocal(px, py), R = 1.15, ws = [];
      let tw = 0;
      for (let i = 0; i < o.frags.length; i++) {
        const f = o.frags[i]; if (!f.alive || f.core) continue;   // 城下町の割れない部分にはダメージを分けない（吸われて減らなくなるため）
        const d = Math.sqrt(sq(f.cx - lx) + sq(f.cy - ly)); if (d > R) continue;
        const w = (1 - d / R) * (1 - d / R); ws.push([i, w]); tw += w;
      }
      if (!tw) {
        // 近くが割れない部分だけのときは、いちばん近い割れる欠片に当てる
        let bi = -1, bd = 1e9;
        for (let i = 0; i < o.frags.length; i++) { const f = o.frags[i]; if (!f.alive || f.core) continue; const d = sq(f.cx - lx) + sq(f.cy - ly); if (d < bd) { bd = d; bi = i; } }
        if (bi < 0) return 0; ws.push([bi, 1]); tw = 1;
      }
      let broken = 0; const brk = [];
      for (const [i, w] of ws) { const f = o.frags[i]; if (f.core) continue; f.hp -= dmg * w / tw; if (f.hp <= 0) { f.alive = false; brk.push(i); broken += f.a; } }
      if (!brk.length) return 0;
      // つながっていない欠片も落ちる（いちばん大きいかたまりだけ残る）
      broken += this.cut(o);
      for (const i of brk) this.spawn(o, o.frags[i], px, py);
      o.mass();
      return broken;
    }
    cut(o) {
      const fr = o.frags, seen = new Int32Array(fr.length).fill(-1); let best = -1, bestA = -1, gid = 0; const groups = [];
      for (let i = 0; i < fr.length; i++) {
        if (!fr[i].alive || seen[i] >= 0) continue;
        let a = 0; const st = [i]; seen[i] = gid; const mem = [];
        while (st.length) { const k = st.pop(); mem.push(k); a += fr[k].a; for (const n of fr[k].nb) if (fr[n].alive && seen[n] < 0) { seen[n] = gid; st.push(n); } }
        groups.push(mem); if (a > bestA + 1e-12) { bestA = a; best = gid; } gid++;
      }
      // 別の島（もともと離れている部分）は、元の形でつながっていなくても残す：部分ごとに一番大きいかたまりを残す
      let lost = 0; const keepPart = new Map();
      groups.forEach((mem, g) => { const part = fr[mem[0]].part, a = mem.reduce((s, k) => s + fr[k].a, 0); const cur = keepPart.get(part); if (!cur || a > cur[1] + 1e-12) keepPart.set(part, [g, a]); });
      groups.forEach((mem, g) => { const part = fr[mem[0]].part; if (keepPart.get(part)[0] === g) return; for (const k of mem) { if (fr[k].core) continue; fr[k].alive = false; lost += fr[k].a; this.spawn(o, fr[k], o.x, o.y); } });
      return lost;
    }
    spawn(o, f, px, py) {
      const [wx, wy] = o.toWorld(f.cx, f.cy); let dx = wx - px, dy = wy - py; const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (f.seed * 2654435761 >>> 0) / 4294967296;   // 決まった値（見た目だけ）
      this.debris.push({ side: o.side, f, x: wx, y: wy, a: o.a, vx: o.vx + dx / l * (2 + k * 2.5), vy: o.vy + dy / l * (2 + k * 2.5), w: (k - 0.5) * 14, t: 0 });
    }
    heal(o, amt) {
      let need = []; for (const f of o.frags) if (f.alive && f.hp < f.max) need.push(f);
      need.sort((p, q) => (p.hp / p.max) - (q.hp / q.max) || p.seed - q.seed);
      let left = amt * JM.HPA * o.hpk * o.big;
      for (const f of need) { const add = Math.min(left, f.max - f.hp); f.hp += add; left -= add; if (left <= 0) break; }
    }
    // 結果の要約（オンラインで両方の画面の結果が同じか確かめる）
    digest() { return [this.winner, this.step, Math.round(this.A.ratio() * 1e6), Math.round(this.B.ratio() * 1e6), this.hitN].join(':'); }
  }
  JM.Match = Match;
})(typeof window !== 'undefined' ? window : globalThis);
