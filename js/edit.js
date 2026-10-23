// =============================================
//  漢ノ字  作る画面（字をばらして組み替える）
//  ・素材箱：画が書き順にならぶ。ドラッグで台へ置く（タップで元の位置に置く）
//  ・台：画をドラッグで動かす。⟲⟳で15度ずつ回す。台の外（下）へドラッグすると箱にもどる
//  ・画は必ずどこかの画とくっつけること（はなれた画は赤くなり、保存できない）
// =============================================
(function () {
  const OK = window.OK, SH = OK.SH, GL = OK.GL;
  const $ = id => document.getElementById(id);
  const E = OK.E = {};
  const st = { ch: '', form: '', forms: [], g: null, prep: null, pls: [], sel: -1, hist: [], b: null, full: null, from: null };
  E.st = st;
  let cv, g, S = 300, dpr = 1;
  const K = () => S / SH.CANVAS;            // 台の座標 → 画面
  const INK = '#1d1813', SEL = '#c8281c', LOOSE = '#e0782a';

  // ---------- 字をえらぶ ----------
  E.open = async function (work) {
    OK.show('s-make'); OK.S && OK.S.bgm('title');
    resize();
    if (work) { await loadWork(work); return; }
    if (!st.ch) showEmpty(true); else draw();
  };
  function showEmpty(on) {
    $('mk-empty').classList.toggle('on', on);
    if (on) { $('mk-q').value = ''; setTimeout(() => { try { $('mk-q').focus(); } catch (e) {} }, 60); }
  }
  async function pick(raw, keepForm) {
    const ch = GL.first(raw);
    if (!ch) { OK.toast('字を1つ入れてください'); return false; }
    let gd = null; try { gd = await GL.get(ch); } catch (e) { OK.toast('読みこめませんでした。通信を確認してね'); return false; }
    if (!gd) { OK.toast(`「${ch}」は画のデータがないため使えません`); return false; }
    st.g = gd; st.ch = ch; st.forms = GL.formsOf(gd);
    st.form = keepForm && st.forms.includes(keepForm) ? keepForm : st.forms[0];
    setForm(st.form, true);
    showEmpty(false);
    let seen = false; try { seen = localStorage.getItem('ok_tut') === '1'; } catch (e) {}
    if (!seen) { try { localStorage.setItem('ok_tut', '1'); } catch (e) {} setTimeout(() => E.tutorial(0), 350); }
    return true;
  }
  E.pick = pick;
  function setForm(f, fresh) {
    st.form = f; st.prep = SH.prep(st.g.forms[f]);
    st.pls = SH.original(st.prep); st.sel = -1; st.hist = []; st.from = null;
    const sel = $('mk-form');
    sel.hidden = st.forms.length < 2;
    sel.innerHTML = st.forms.map(k => `<option value="${k}">${GL.FORM[k]}</option>`).join('');
    sel.value = f;
    $('mk-ch-t').textContent = st.ch;
    buildBox(); update(true);
  }
  async function loadWork(s) {
    const w = SH.decode(s); if (!w) { OK.toast('作品が読めませんでした'); return; }
    if (!(await pick(w.ch, w.form))) return;
    if (st.form !== w.form) { OK.toast('この字形はありません'); return; }
    if (w.pls.length === st.prep.length) st.pls = w.pls.map(p => Object.assign({}, p));
    st.from = s; st.hist = []; st.sel = -1;
    buildBox(); update(true);
  }

  // ---------- 台の大きさ ----------
  function resize() {
    cv = $('mk-cv'); g = cv.getContext('2d');
    const board = cv.parentElement, r = board.getBoundingClientRect();
    const ns = Math.max(120, Math.floor(Math.min(r.width, r.height)));
    if (ns === S && cv.width === Math.round(S * (Math.min(2, window.devicePixelRatio || 1)))) { draw(); return; }
    S = ns;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cv.style.height = S + 'px'; cv.width = cv.height = Math.round(S * dpr);
    draw();
  }
  window.addEventListener('resize', () => { if (document.querySelector('#s-make.active')) resize(); });
  if (window.ResizeObserver) { let rt = null; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (document.querySelector('#s-make.active')) resize(); }, 30); }).observe(document.querySelector('.mk-board')); }

  // ---------- 描く ----------
  function strokePath(ctx, pts, k) {
    ctx.beginPath(); ctx.moveTo(pts[0] * k, pts[1] * k);
    if (pts.length === 2) ctx.lineTo(pts[0] * k + 0.01, pts[1] * k);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * k, pts[i + 1] * k);
  }
  function draw() {
    if (!g) return;
    const k = K();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 半紙
    g.fillStyle = '#f6f0e1'; g.fillRect(0, 0, S, S);
    // 田の字の罫（朱）と、元の字の箱
    g.strokeStyle = 'rgba(200,40,28,.16)'; g.lineWidth = 1;
    if (g.setLineDash) g.setLineDash([6, 6]);
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
    if (g.setLineDash) g.setLineDash([]);
    g.strokeStyle = 'rgba(200,40,28,.22)'; g.strokeRect(SH.OFF * k, SH.OFF * k, 1000 * k, 1000 * k);
    g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    if (!st.prep) return;
    const loose = new Set(st.b ? st.b.loose : []);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // かげ
    g.lineWidth = SH.HW * 2 * k; g.strokeStyle = 'rgba(40,25,10,.13)';
    g.save(); g.translate(2.5, 3.5);
    for (const pl of st.pls) { strokePath(g, SH.points(st.prep[pl.i], pl), k); g.stroke(); }
    g.restore();
    for (const pl of st.pls) {
      const pts = SH.points(st.prep[pl.i], pl);
      g.lineWidth = SH.HW * 2 * k;
      g.strokeStyle = pl.i === st.sel ? SEL : loose.has(pl.i) ? LOOSE : INK;
      strokePath(g, pts, k); g.stroke();
    }
    // えらんだ画：番号と向き
    const sp = st.pls.find(p => p.i === st.sel);
    if (sp) {
      const pts = SH.points(st.prep[sp.i], sp);
      g.lineWidth = 2; g.strokeStyle = '#fff'; if (g.setLineDash) g.setLineDash([4, 4]);
      strokePath(g, pts, k); g.stroke(); if (g.setLineDash) g.setLineDash([]);
      // 書きはじめの点
      g.fillStyle = '#fff'; g.beginPath(); g.arc(pts[0] * k, pts[1] * k, Math.max(4, SH.HW * k * 0.55), 0, Math.PI * 2); g.fill();
      g.fillStyle = SEL; g.font = `900 ${Math.max(10, Math.round(SH.HW * k * 0.9))}px "M PLUS Rounded 1c",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(sp.i + 1), pts[0] * k, pts[1] * k + 0.5);
    }
    // 箱にもどす場所
    if (drag && drag.out) { g.fillStyle = 'rgba(200,40,28,.12)'; g.fillRect(0, S - 26, S, 26); g.fillStyle = SEL; g.font = '900 13px "M PLUS Rounded 1c",sans-serif'; g.textAlign = 'center'; g.fillText('はなすと箱にもどる', S / 2, S - 12); }
  }

  // ---------- 素材箱 ----------
  function buildBox() {
    const box = $('mk-box'); OK.R.freeIn(box); box.innerHTML = '';
    st.prep.forEach((p, i) => {
      const b = document.createElement('button'); b.className = 'mk-tile'; b.dataset.i = i;
      const c = document.createElement('canvas'); c.width = c.height = 96; c.style.width = c.style.height = '48px';
      const x = c.getContext('2d');
      if (x) {
        const s = 72 / Math.max(160, p.r * 2 + SH.HW * 2);
        x.translate(48, 48); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = SH.HW * 2 * s; x.strokeStyle = INK;
        x.beginPath(); x.moveTo(p.rel[0] * s, p.rel[1] * s); if (p.rel.length === 2) x.lineTo(p.rel[0] * s + 0.01, p.rel[1] * s);
        for (let k = 2; k < p.rel.length; k += 2) x.lineTo(p.rel[k] * s, p.rel[k + 1] * s); x.stroke();
      }
      b.appendChild(c); const n = document.createElement('i'); n.textContent = i + 1; b.appendChild(n);
      box.appendChild(b);
    });
    syncBox();
  }
  function syncBox() {
    const on = new Set(st.pls.map(p => p.i));
    for (const t of document.querySelectorAll('.mk-tile')) { const i = +t.dataset.i; t.classList.toggle('used', on.has(i)); t.classList.toggle('sel', i === st.sel); }
    $('mk-box-n').textContent = st.prep ? `${on.size}/${st.prep.length}画を台に置いた` : '';
  }

  // ---------- 形と強さを計算しなおす ----------
  let fullT = null;
  function update(fullNow) {
    if (!st.prep) return;
    st.b = SH.build(st.prep, st.pls);
    syncBox(); draw(); msg();
    clearTimeout(fullT);
    const run = () => {
      const all = st.pls.length === st.prep.length;
      if (!all || !st.pls.length) { st.full = null; stats(); return; }
      st.full = SH.build(st.prep, st.pls, { full: true }); stats();
    };
    if (fullNow) run(); else fullT = setTimeout(run, 120);
  }
  function msg() {
    const m = $('mk-msg'), all = st.pls.length === st.prep.length, ok = all && st.b && st.b.connected;
    let t = '';
    if (!st.pls.length) t = '素材箱から画を台に置いてください';
    else if (st.b && st.b.loose.length) t = `はなれている画があります（${st.b.loose.map(i => i + 1).join('・')}画目）。どこかにくっつけてね`;
    else if (!all) t = `あと${st.prep.length - st.pls.length}画、置いてください（画はぜんぶ使います）`;
    else t = SH.isOriginal(st.prep, st.pls) ? '元の字のままです。1画でも動かすと保存できます' : 'ぜんぶつながっています。保存すると合言葉がつきます';
    m.textContent = t; m.classList.toggle('bad', !!(st.b && st.b.loose.length));
    $('mk-save').disabled = !ok || SH.isOriginal(st.prep, st.pls);
    $('mk-st').textContent = st.ch ? `${st.prep.length}画` + (st.forms.length > 1 ? '' : '・' + GL.FORM[st.form]) : '';
    for (const id of ['mk-rl', 'mk-rr', 'mk-out']) $(id).disabled = st.sel < 0 || !st.pls.some(p => p.i === st.sel);
    $('mk-undo').disabled = !st.hist.length;
  }
  function stats() {
    const box = $('mk-stl'), rv = $('mk-radar'), c = rv.getContext('2d');
    if (!st.full || !st.full.parts || !st.full.parts.length) {
      box.innerHTML = '<p class="note">画をぜんぶ置くと、強さが出ます</p>'; if (c) c.clearRect(0, 0, 300, 270); return;
    }
    const s = SH.stats(st.full);
    let big = 1; try { big = new OK.Body({ key: 'x', parts: st.full.parts, st: s, pol: [] }, 0).big; } catch (e) {}
    box.innerHTML = OK.STATS.map(x => `<div><b>${x.n} <span>${x.from}</span></b><b>${s[x.k]}</b></div>`).join('') +
      (big > 1.01 ? `<div class="bonus"><b>広がり加点 <span>体力</span></b><b>×${(Math.round(big * 100) / 100).toFixed(2)}</b></div>` : '') +
      (SH.hpx(st.prep.length) > 1.01 ? `<div class="bonus2"><b>画数の分 <span>体力</span></b><b>×${SH.hpx(st.prep.length).toFixed(2)}</b></div>` : '');
    if (c) { c.clearRect(0, 0, 300, 270); c.save(); c.scale(2, 2); OK.R.radar(c, 75, 70, 48, OK.STATS.map(x => s[x.k]), null, { fs: 10 }); c.restore(); }
  }
  function remember() { st.hist.push(JSON.stringify(st.pls)); if (st.hist.length > 60) st.hist.shift(); }

  // ---------- さわる ----------
  let drag = null;
  function toBoard(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / K(), (ev.clientY - r.top) / K(), ev.clientY - r.top > S + 4 || ev.clientY - r.top > S - 26 && drag && drag.mayOut]; }
  function hit(x, y) {
    let best = -1, bd = (SH.HW + 26) * (SH.HW + 26);
    // 上に描いた画（あとの画）を先に
    for (let n = st.pls.length - 1; n >= 0; n--) {
      const pl = st.pls[n], pts = SH.points(st.prep[pl.i], pl);
      for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2 < pts.length ? i + 2 : i], by = pts[i + 2 < pts.length ? i + 3 : i + 1];
        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey; let t = l2 ? ((x - ax) * ex + (y - ay) * ey) / l2 : 0; t = Math.max(0, Math.min(1, t));
        const d = (ax + ex * t - x) ** 2 + (ay + ey * t - y) ** 2 + (pl.i === st.sel ? -400 : 0);
        if (d < bd) { bd = d; best = pl.i; }
      }
    }
    return best;
  }
  function onDown(ev) {
    if (!st.prep) return;
    const [x, y] = toBoard(ev), i = hit(x, y);
    if (i < 0) { st.sel = -1; update(true); return; }
    const pl = st.pls.find(p => p.i === i);
    st.sel = i; drag = { i, dx: pl.x - x, dy: pl.y - y, x0: pl.x, y0: pl.y, moved: false, saved: JSON.stringify(st.pls), mayOut: true };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    syncBox(); draw(); msg();
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag || drag.tile) return;
    const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / K(), y = (ev.clientY - r.top) / K();
    const pl = st.pls.find(p => p.i === drag.i); if (!pl) return;
    pl.x = Math.round(x + drag.dx); pl.y = Math.round(y + drag.dy); SH.clamp(st.prep[pl.i], pl);
    drag.out = ev.clientY - r.top > S + 10;
    if (Math.abs(pl.x - drag.x0) + Math.abs(pl.y - drag.y0) > 3) drag.moved = true;
    if (!drag.t || performance.now() - drag.t > 60) { drag.t = performance.now(); st.b = SH.build(st.prep, st.pls); }
    draw(); ev.preventDefault();
  }
  function onUp(ev) {
    if (!drag || drag.tile) return;
    const d = drag; drag = null;
    if (d.out) { st.hist.push(d.saved); st.pls = st.pls.filter(p => p.i !== d.i); st.sel = -1; OK.S && OK.S.play('ui'); update(); return; }
    if (d.moved) { st.hist.push(d.saved); if (st.hist.length > 60) st.hist.shift(); OK.S && OK.S.play('place'); }
    update();
  }
  // 箱の画をドラッグして台へ
  let ghost = null;
  function tileDown(ev) {
    const t = ev.target.closest('.mk-tile'); if (!t || !st.prep) return;
    const i = +t.dataset.i;
    drag = { tile: true, i, sx: ev.clientX, sy: ev.clientY, moved: false, used: st.pls.some(p => p.i === i) };
    try { t.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  }
  function tileMove(ev) {
    if (!drag || !drag.tile) return;
    if (!drag.moved && Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) < 8) return;
    drag.moved = true;
    if (!ghost) {
      ghost = document.createElement('canvas'); ghost.className = 'mk-ghost';
      const p = st.prep[drag.i], k = K(), w = Math.ceil((p.r + SH.HW) * 2 * k) + 4;
      ghost.width = ghost.height = Math.round(w * dpr); ghost.style.width = ghost.style.height = w + 'px';
      const x = ghost.getContext('2d');
      if (x) { x.scale(dpr, dpr); x.translate(w / 2, w / 2); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = SH.HW * 2 * k; x.strokeStyle = 'rgba(200,40,28,.85)'; x.beginPath(); x.moveTo(p.rel[0] * k, p.rel[1] * k); if (p.rel.length === 2) x.lineTo(p.rel[0] * k + 0.01, p.rel[1] * k); for (let n = 2; n < p.rel.length; n += 2) x.lineTo(p.rel[n] * k, p.rel[n + 1] * k); x.stroke(); }
      document.body.appendChild(ghost); ghost.w = w;
    }
    ghost.style.transform = `translate(${ev.clientX - ghost.w / 2}px,${ev.clientY - ghost.w / 2}px)`;
  }
  function tileUp(ev) {
    if (!drag || !drag.tile) return;
    const d = drag; drag = null;
    if (ghost) { ghost.remove(); ghost = null; }
    const p = st.prep[d.i];
    if (!d.moved) {
      // タップ：台にあればえらぶ、なければ元の位置に置く
      if (!d.used) { remember(); st.pls.push(SH.clamp(p, { i: d.i, x: p.cx + SH.OFF, y: p.cy + SH.OFF, r: 0 })); OK.S && OK.S.play('place'); }
      st.sel = d.i; update(); return;
    }
    const r = cv.getBoundingClientRect();
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (!inside) { update(); return; }
    remember();
    const x = Math.round((ev.clientX - r.left) / K()), y = Math.round((ev.clientY - r.top) / K());
    const old = st.pls.find(q => q.i === d.i);
    if (old) { old.x = x; old.y = y; SH.clamp(p, old); }
    else st.pls.push(SH.clamp(p, { i: d.i, x, y, r: 0 }));
    st.sel = d.i; OK.S && OK.S.play('place'); update();
  }

  // ---------- ボタン ----------
  function rot(dir) {
    const pl = st.pls.find(p => p.i === st.sel); if (!pl) return;
    remember(); pl.r = (pl.r + dir + 24) % 24; SH.clamp(st.prep[pl.i], pl); OK.S && OK.S.play('ui'); update();
  }
  E.bind = function () {
    cv = $('mk-cv'); g = cv.getContext('2d');
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    const box = $('mk-box');
    box.addEventListener('pointerdown', tileDown); box.addEventListener('pointermove', tileMove);
    box.addEventListener('pointerup', tileUp); box.addEventListener('pointercancel', tileUp);
    $('mk-rl').onclick = () => rot(-1); $('mk-rr').onclick = () => rot(1);
    $('mk-out').onclick = () => { if (st.sel < 0) return; remember(); st.pls = st.pls.filter(p => p.i !== st.sel); st.sel = -1; update(); };
    $('mk-undo').onclick = () => { const h = st.hist.pop(); if (!h) return; st.pls = JSON.parse(h); OK.S && OK.S.play('ui'); update(); };
    $('mk-reset').onclick = () => { if (!st.prep) return; remember(); st.pls = SH.original(st.prep); st.sel = -1; update(); };
    $('mk-clear').onclick = () => { if (!st.prep) return; remember(); st.pls = []; st.sel = -1; update(); };
    $('mk-form').onchange = () => { setForm($('mk-form').value); };
    $('mk-ch').onclick = () => { showEmpty(true); };
    $('mk-go').onclick = () => pick($('mk-q').value);
    $('mk-q').addEventListener('keydown', e => { if (e.key === 'Enter') pick($('mk-q').value); });
    $('mk-rand').onclick = () => pick(OK.randomChar());
    $('mk-back').onclick = () => { OK.S && OK.S.play('ui'); if ($('mk-empty').classList.contains('on') && st.ch) { showEmpty(false); return; } OK.toTitle(); };
    $('mk-save').onclick = save;
    $('mk-help').onclick = () => E.tutorial(0);
    $('mk-stats').onclick = () => { $('mk-stats').classList.toggle('open'); stats(); };
    document.addEventListener('keydown', e => {
      if (!document.querySelector('#s-make.active') || /input|select|textarea/i.test(document.activeElement && document.activeElement.tagName)) return;
      const pl = st.pls.find(p => p.i === st.sel);
      if (e.key === 'q' || e.key === 'Q') rot(-1); else if (e.key === 'e' || e.key === 'E') rot(1);
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') $('mk-undo').click();
      else if (pl && e.key.startsWith('Arrow')) { remember(); const s = e.shiftKey ? 40 : 8; if (e.key === 'ArrowLeft') pl.x -= s; if (e.key === 'ArrowRight') pl.x += s; if (e.key === 'ArrowUp') pl.y -= s; if (e.key === 'ArrowDown') pl.y += s; SH.clamp(st.prep[pl.i], pl); update(); e.preventDefault(); }
      else if (pl && (e.key === 'Delete' || e.key === 'Backspace')) $('mk-out').click();
    });
  };
  E.tutorial = function (k) {
    const T = [
      ['✋', '画を動かす', '台の画をドラッグして動かします。<br>素材箱の画は、ドラッグで台に置けます（タップすると元の位置に置きます）。<br>台の下へドラッグすると、箱にもどります。'],
      ['⟲ ⟳', '回す', '画をタップしてえらび、⟲ ⟳ で15度ずつ回します。<br>縦に積むのではなく、<b>重ねて</b>1つの形にします。'],
      ['🔗', 'くっつけて保存', '画は<b>必ずどこかの画とくっつけます</b>。はなれた画は赤くなります。<br>画をぜんぶ使って保存すると、<b>合言葉</b>がつき、その作品が挑戦状になります。'],
    ];
    const t = T[k];
    const card = OK.QM.dialog(`<p class="tut-step">作り方 ${k + 1}/3</p><div class="tut-pic">${t[0]}</div><h3>${t[1]}</h3><p>${t[2]}</p>
      <div class="tut-dots">${T.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>
      <button class="qm-b" id="tu-n">${k < 2 ? 'つぎへ' : 'はじめる'}</button>${k > 0 ? '<button class="qm-b sub" id="tu-p">もどる</button>' : ''}`);
    card.querySelector('#tu-n').onclick = () => { if (k < 2) E.tutorial(k + 1); else OK.QM.close(); };
    const pb = card.querySelector('#tu-p'); if (pb) pb.onclick = () => E.tutorial(k - 1);
  };
  async function save() {
    if (!st.b || !st.b.connected || st.pls.length !== st.prep.length || SH.isOriginal(st.prep, st.pls)) return;
    const s = SH.encode(st.form, st.ch, st.pls);
    const had = OK.Works.find(s);
    OK.Works.add(s);
    $('mk-save').disabled = true;
    OK.S && OK.S.play('win');
    let code = had && had.code;
    const card = OK.QM.dialog(`<h3>${had ? 'この形はもう保存してあります' : '保存しました！'}</h3>
      <p class="qm-sub">合言葉</p><p class="xf-code" id="sv-code">${code ? OK.Chal.fmt(code) : '…'}</p>
      <p class="qm-sub" id="sv-note">${code ? 'この合言葉で、だれでもこの作品と戦えます。' : '合言葉をつけています…'}</p>
      <button class="qm-b" id="sv-x" ${code ? '' : 'disabled'}>Xに投稿（画像つき）</button>
      <button class="qm-b alt" id="sv-pr">この作品で練習試合</button>
      <button class="qm-b sub" id="sv-go">続けて作る</button>`);
    card.querySelector('#sv-pr').onclick = () => { OK.QM.close(); OK.practice(s); };
    card.querySelector('#sv-go').onclick = () => { OK.QM.close(); msg(); };
    card.querySelector('#sv-x').onclick = async () => { const w = await SH.make(s); OK.Chal.shareWork(w, code); };
    if (!code) {
      try { code = await OK.Chal.register(s); }
      catch (e) { code = null; const n = card.querySelector('#sv-note'); if (n) n.textContent = (e && e.message && !/^http/.test(e.message) ? e.message : '通信できませんでした') + '。作品はこの端末に保存してあります。「あなたの作品」から、あとで合言葉をつけられます'; const c = card.querySelector('#sv-code'); if (c) c.textContent = '—'; }
      if (code && card.querySelector('#sv-code')) {
        card.querySelector('#sv-code').textContent = OK.Chal.fmt(code);
        card.querySelector('#sv-note').textContent = 'この合言葉で、だれでもこの作品と戦えます。';
        card.querySelector('#sv-x').disabled = false;
      }
    }
    msg();
  }
})();
