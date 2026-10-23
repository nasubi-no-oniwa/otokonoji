// =============================================
//  漢ノ字  描画（2D canvas。地元の最強と同じしくみ）
//  ・土俵（半紙の上の円）、作品の形、割れた欠片、火花
// =============================================
(function () {
  const JM = window.JM || window.OK, R = JM.R = {};
  const COL = [{ f: '#d9452e', d: '#6e140b', l: '#ffd9d2' }, { f: '#2f63ad', d: '#102a55', l: '#d9e6ff' }];
  R.COL = COL;
  let cv, g, W = 0, H = 0, dpr = 1;
  let main = null;
  R.init = function (canvas) {
    main = cv = canvas; g = cv.getContext('2d'); R.resize(); window.addEventListener('resize', R.resize);
    // 端末によっては、描く場所（キャンバス）がこわれることがある → 作り直す
    canvas.addEventListener('contextlost', ev => { ev.preventDefault(); paper = null; });
    canvas.addEventListener('contextrestored', () => { g = canvas.getContext('2d'); paper = null; R.resize(); });
  };
  R.resize = function () {
    if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  };
  // 使い終わったキャンバスを片づける（スマホはキャンバスのメモリに上限があり、ためると何も描けなくなる）
  R.free = function (c) { try { if (c && c.getContext) { c.width = 0; c.height = 0; } } catch (e) {} };
  R.freeIn = function (el) { if (el) for (const c of el.querySelectorAll('canvas')) R.free(c); };
  // 紙のもよう（1回だけ作る）
  let paper = null;
  let paperCv = null;
  function paperPat() {
    if (paper) return paper;
    const c = paperCv || (paperCv = document.createElement('canvas')); c.width = c.height = 256; const p = c.getContext('2d');
    if (!p) return '#f6f0e1';
    p.fillStyle = '#f6f0e1'; p.fillRect(0, 0, 256, 256);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 900; i++) { p.fillStyle = `rgba(120,90,50,${0.02 + rnd() * 0.04})`; p.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 40; i++) { p.strokeStyle = `rgba(150,110,60,${0.03 + rnd() * 0.04})`; p.beginPath(); const x = rnd() * 256, y = rnd() * 256; p.moveTo(x, y); p.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60); p.stroke(); }
    paper = g.createPattern(c, 'repeat') || '#f6f0e1'; return paper;
  }
  R.fx = []; R.shake = 0; R.flash = 0;
  // 1フレーム描く。m：JM.Match、o：{ names, slow }
  R.draw = function (m, o = {}) {
    if (!g) return;
    // 画面の大きさが変わっていたら合わせる（アプリ内ブラウザなどで、開いた直後の大きさが 0 のことがある）
    if (cv === main && (cv.clientWidth !== W || cv.clientHeight !== H)) R.resize();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; if (g.setLineDash) g.setLineDash([]);
    // まわり
    g.fillStyle = '#16120f'; g.fillRect(0, 0, W, H);
    const top = o.top || 0, bot = o.bot || 0, hh = H - top - bot;
    const sc = Math.min(W, hh) * 0.47 / JM.R_ARENA, cx = W / 2, cy = top + hh / 2;
    let sx = 0, sy = 0; if (R.shake > 0.01) { sx = (Math.sin(performance.now() * 0.09) * R.shake); sy = (Math.cos(performance.now() * 0.13) * R.shake); }
    g.save(); g.translate(cx + sx, cy + sy);
    // 土俵（半紙）
    const ar = JM.R_ARENA * sc;
    g.fillStyle = '#2b231d'; g.beginPath(); g.arc(0, 0, ar + 14, 0, Math.PI * 2); g.fill();
    // 紙：まず紙の色でぬってから、もようを重ねる（もようが作れない端末でも、紙は必ず見える）
    g.fillStyle = '#f6f0e1'; g.beginPath(); g.arc(0, 0, ar, 0, Math.PI * 2); g.fill();
    try { const pt = paperPat(); if (pt && pt !== '#f6f0e1') { g.fillStyle = pt; g.fill(); } } catch (e) { paper = '#f6f0e1'; }
    g.save(); g.beginPath(); g.arc(0, 0, ar, 0, Math.PI * 2); g.clip();
    // 田の字の罫（朱の点線）
    g.strokeStyle = 'rgba(200,40,28,.13)'; g.lineWidth = 1.2;
    if (g.setLineDash) g.setLineDash([8, 8]);
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * ar / 2, -ar); g.lineTo(i * ar / 2, ar); g.stroke(); g.beginPath(); g.moveTo(-ar, i * ar / 2); g.lineTo(ar, i * ar / 2); g.stroke(); }
    if (g.setLineDash) g.setLineDash([]);
    // 仕切り線
    g.strokeStyle = 'rgba(30,20,10,.45)'; g.lineWidth = 3;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * ar * 0.12, -ar * 0.09); g.lineTo(s * ar * 0.12, ar * 0.09); g.stroke(); }
    g.restore();
    g.strokeStyle = '#4a382a'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, ar, 0, Math.PI * 2); g.stroke();
    if (g.setLineDash) { g.setLineDash([10, 8]); g.strokeStyle = 'rgba(74,56,42,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, ar - 9, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    // 欠片（飛んでいくもの）
    for (const d of m.debris) {
      const al = Math.max(0, 1 - d.t / 2.5); if (al <= 0) continue;
      g.save(); g.globalAlpha = al; g.translate(d.x * sc, d.y * sc); g.rotate(d.a); g.translate(-d.f.cx * sc, -d.f.cy * sc);
      fragPath(d.f, sc); g.fillStyle = COL[d.side].f; g.fill(); g.strokeStyle = COL[d.side].d; g.lineWidth = 1.2; g.stroke(); g.restore();
    }
    // 体
    for (const b of [m.A, m.B]) { try { drawBody(b, sc); } catch (e) { try { g.restore(); } catch (e2) {} } }
    // 名前
    if (o.names) for (const b of [m.A, m.B]) {
      const t = o.names[b.side]; if (!t) continue;
      g.font = `400 ${Math.max(16, Math.round(sc * 1.0))}px "Yuji Syuku",serif`; g.textAlign = 'center';
      const y = b.y * sc - sc * 3.2;
      g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(t, b.x * sc, y); g.fillStyle = COL[b.side].d; g.fillText(t, b.x * sc, y);
    }
    // 火花
    for (const f of R.fx) {
      f.t += o.dt || 0.016; const k = f.t / f.life; if (k >= 1) continue;
      if (f.kind === 'ring') { g.strokeStyle = `rgba(255,240,200,${1 - k})`; g.lineWidth = 6 * (1 - k); g.beginPath(); g.arc(f.x * sc, f.y * sc, (0.3 + k * 1.6 * f.s) * sc, 0, Math.PI * 2); g.stroke(); }
      else { const x = (f.x + f.vx * f.t) * sc, y = (f.y + f.vy * f.t) * sc; g.strokeStyle = `rgba(255,${200 + 55 * (1 - k) | 0},120,${1 - k})`; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - f.vx * 0.04 * sc, y - f.vy * 0.04 * sc); g.stroke(); }
    }
    R.fx = R.fx.filter(f => f.t < f.life);
    g.restore();
    if (R.flash > 0) { g.fillStyle = `rgba(255,250,235,${R.flash})`; g.fillRect(0, 0, W, H); R.flash *= 0.85; if (R.flash < 0.01) R.flash = 0; }
    R.shake *= 0.86;
    R.sc = sc; R.cx = cx; R.cy = cy;
  };
  // 結果画像用：試合の今の様子を、別のキャンバス（正方形 size px）に描く。
  // ev：最後の一撃（火花を出す）。飛んでいく欠片は少し先まで進めて、飛び散っている感じにする
  R.snapshot = function (m, size, ev) {
    const keep = { cv, g, W, H, dpr, fx: R.fx, shake: R.shake, flash: R.flash, sc: R.sc, cx: R.cx, cy: R.cy };
    const c = document.createElement('canvas'); c.width = c.height = size;
    const cg = c.getContext('2d'); if (!cg) return null;   // 作れない端末では null（画面の絵を使ってもらう）
    cv = c; g = cg; W = H = size; dpr = 1;
    R.fx = []; R.shake = 0; R.flash = 0;
    if (ev) { R.hit(ev); R.shake = 0; R.flash = 0; for (const f of R.fx) f.t = f.kind === 'ring' ? 0.05 : 0.07; }
    const deb = m.debris; m.debris = deb.map(d => { const t = 0.16; return Object.assign({}, d, { x: d.x + d.vx * t, y: d.y + d.vy * t, a: d.a + d.w * t, t: d.t + 0.1 }); });
    try { R.draw(m, { dt: 0 }); } finally {
      m.debris = deb;
      const out = { sc: R.sc, cx: R.cx, cy: R.cy };
      cv = keep.cv; g = keep.g; W = keep.W; H = keep.H; dpr = keep.dpr; R.fx = keep.fx; R.shake = keep.shake; R.flash = keep.flash; R.sc = keep.sc; R.cx = keep.cx; R.cy = keep.cy;
      c.sc = out.sc;
    }
    return c;   // 使い終わったら R.free(c) で片づける
  };
  function fragPath(f, sc) {
    g.beginPath(); const p = f.poly;
    g.moveTo(p[0] * sc, p[1] * sc); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * sc, p[i + 1] * sc); g.closePath();
  }
  function drawBody(b, sc) {
    g.save(); g.translate(b.x * sc, b.y * sc); g.rotate(b.a);
    const C = COL[b.side];
    // かげ
    g.save(); g.translate(sc * 0.12, sc * 0.16); g.fillStyle = 'rgba(40,25,10,.22)';
    for (const f of b.frags) if (f.alive) { fragPath(f, sc); g.fill(); }
    g.restore();
    // ぬり
    for (const f of b.frags) {
      if (!f.alive) continue; fragPath(f, sc);
      const dmg = 1 - Math.max(0, f.hp / f.max);
      g.fillStyle = dmg > 0.02 ? mix(C.f, '#4a3a30', dmg * 0.45) : C.f; g.fill();
      if (f.core) { g.fillStyle = 'rgba(255,215,90,.35)'; g.fill(); }
    }
    // ひび（内がわの辺：傷んだ欠片ほど濃い）と輪郭
    g.lineJoin = 'round';
    for (const f of b.frags) {
      if (!f.alive) continue; const p = f.poly, n = p.length, dmg = 1 - Math.max(0, f.hp / f.max);
      for (let i = 0; i < n; i += 2) {
        const t = f.tags[i / 2], j = (i + 2) % n;
        let outer = t < 0;
        if (!outer) { let al = false; for (const k of f.nb) { const h = b.frags[k]; if (h.seed === t && h.alive) { al = true; break; } } outer = !al; }
        g.beginPath(); g.moveTo(p[i] * sc, p[i + 1] * sc); g.lineTo(p[j] * sc, p[j + 1] * sc);
        if (outer) { g.strokeStyle = C.d; g.lineWidth = 2.2; g.stroke(); }
        else if (dmg > 0.12) { g.strokeStyle = `rgba(30,15,5,${Math.min(0.85, dmg)})`; g.lineWidth = 1 + dmg * 1.5; g.stroke(); }
        else { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.8; g.stroke(); }
      }
    }
    g.restore();
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bb = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${gg},${bb})`;
  }
  R.hit = function (e) {
    const n = Math.min(26, 6 + Math.round(e.v * 1.2));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + e.v, s = 3 + (i % 5) * 1.6 + e.v * 0.3; R.fx.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.35 + (i % 3) * 0.1 }); }
    R.fx.push({ kind: 'ring', x: e.x, y: e.y, s: Math.min(2, e.v / 8), t: 0, life: 0.4 });
    R.shake = Math.min(14, 2 + e.v * 0.7);
    if (e.br[0] + e.br[1] > 0.2) R.flash = Math.min(0.5, 0.1 + (e.br[0] + e.br[1]) * 0.25);
  };
  // ---------- 小さな絵（選ぶ画面・結果画像） ----------
  // 形を箱の中に描く。dir：0〜7（45度ずつ）、side：色
  R.shapeIcon = function (ctx, parts, x, y, size, dir, side, opt = {}) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    const ang = (dir || 0) * Math.PI / 4 + (side === 1 && opt.facing ? Math.PI : 0), c = Math.cos(ang), s = Math.sin(ang);
    const rp = parts.map(p => { const q = []; for (let i = 0; i < p.length; i += 2) { const X = c * p[i] - s * p[i + 1], Y = s * p[i] + c * p[i + 1]; q.push(X, Y); minx = Math.min(minx, X); maxx = Math.max(maxx, X); miny = Math.min(miny, Y); maxy = Math.max(maxy, Y); } return q; });
    const k = size / Math.max(maxx - minx, maxy - miny), mx = (minx + maxx) / 2, my = (miny + maxy) / 2;
    ctx.save(); ctx.lineJoin = 'round';
    for (const q of rp) {
      ctx.beginPath(); ctx.moveTo(x + (q[0] - mx) * k, y + (q[1] - my) * k); for (let i = 2; i < q.length; i += 2) ctx.lineTo(x + (q[i] - mx) * k, y + (q[i + 1] - my) * k); ctx.closePath();
      ctx.fillStyle = opt.fill || COL[side || 0].f; ctx.fill(); ctx.strokeStyle = opt.stroke || COL[side || 0].d; ctx.lineWidth = opt.lw || 2; ctx.stroke();
    }
    ctx.restore();
  };
  // 五角形のグラフ。base：[5]、add：{k:[ふつう,交付金]}
  R.radar = function (ctx, x, y, r, base, add, opt = {}) {
    const ks = JM.STATS.map(s => s.k), n = 5, pt = (i, v) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return [x + Math.cos(a) * r * v / 100, y + Math.sin(a) * r * v / 100]; };
    ctx.save();
    for (const lv of [25, 50, 75, 100]) { ctx.beginPath(); for (let i = 0; i < n; i++) { const [px, py] = pt(i, lv); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.strokeStyle = opt.light ? (lv === 100 ? 'rgba(255,240,210,.5)' : 'rgba(255,240,210,.18)') : (lv === 100 ? 'rgba(60,40,20,.45)' : 'rgba(60,40,20,.15)'); ctx.lineWidth = 1; ctx.stroke(); }
    for (let i = 0; i < n; i++) { const [px, py] = pt(i, 100); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.strokeStyle = 'rgba(60,40,20,.12)'; ctx.stroke(); }
    const layer = (vals, fill, stroke) => { ctx.beginPath(); vals.forEach((v, i) => { const [px, py] = pt(i, Math.max(0, Math.min(110, v))); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke(); } };
    const a0 = add ? ks.map((k, i) => base[i] + Math.max(0, add[k][0])) : base;
    const a1 = add ? ks.map((k, i) => base[i] + Math.max(0, add[k][0]) + Math.max(0, add[k][1])) : base;
    const net = add ? ks.map((k, i) => base[i] + add[k][0] + add[k][1]) : base;
    if (add) { layer(a1, 'rgba(70,170,90,.55)'); layer(a0, 'rgba(230,180,40,.6)'); }
    layer(add ? ks.map((k, i) => Math.min(base[i], net[i])) : base, opt.fill || 'rgba(90,80,70,.45)', opt.stroke || 'rgba(60,40,20,.8)');
    if (opt.labels !== false) {
      ctx.fillStyle = opt.light ? '#efe4cc' : '#3a2a1c'; ctx.font = `800 ${opt.fs || 11}px "M PLUS Rounded 1c",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      JM.STATS.forEach((s, i) => { const [px, py] = pt(i, 128); ctx.fillText(s.n, px, py); });
    }
    ctx.restore();
  };
})();
