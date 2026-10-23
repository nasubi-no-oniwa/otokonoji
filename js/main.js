// =============================================
//  漢ノ字  画面と進行
// =============================================
(function () {
  const OK = window.OK, R = OK.R, SH = OK.SH, GL = OK.GL;
  const $ = id => document.getElementById(id);
  const URL_GAME = 'https://nasubi-no-oniwa.github.io/otokonoji/';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => OK.S || { play() {}, bgm() {} };
  OK.QM = window.QM;
  OK.STATS = [
    { k: 'hp', n: '体力', from: '線の広さ' },
    { k: 'atk', n: '勢い', from: '画数' },
    { k: 'def', n: 'かたさ', from: 'すき間の少なさ' },
    { k: 'shp', n: '鋭さ', from: '出っぱり' },
    { k: 'spd', n: '速さ', from: '軽さ' },
  ];
  // 練習の「おまかせ」や、タイトルの後ろで戦う字
  const PICKS = '龍鬼炎雷風山川木森林火水金月日刀力虎鳥魚馬犬漢戦夢光闇剣鉄氷雪花竹石岩舟車門王神轟麗鷹鷲象亀蛇蝶蟹爪牙翼拳盾弓矢槍城塔星雲嵐波海空天地人心鳳凰麒麟獅狼熊鯨鮫鰐蜂蠍蜘蛛蟷螂竜嵐爆斬撃';
  // 試合：どちらの字も正しい向きのまま向き合う（右の字も逆さにしない）。同じ作品どうしは必ず引き分け
  OK.newMatch = (a, b) => { const m = new OK.Match(SH.def(a), SH.def(b), 0, 4); if (a.s === b.s) m.mirror = true; return m; };
  OK.randomChar = () => { const a = [...PICKS]; return a[Math.floor(Math.random() * a.length)]; };

  // ---------- 状態 ----------
  const st = OK.st = { mode: 'local', practice: true, chal: null, slots: [{ w: null }, { w: null }], my: -1, reveal: true, live: null, speed: 1, result: null, myLast: null };
  function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id); }
  OK.show = show;
  let toastT = null;
  function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2400); }
  OK.toast = toast;

  // ---------- あなたの作品（この端末に覚える） ----------
  const WMAX = 60;
  const Works = OK.Works = {
    list: () => store.get('ok_works', []),
    save(L) { store.set('ok_works', L.slice(-WMAX)); },
    find(s) { return Works.list().find(x => x.s === s) || null; },
    add(s) { const L = Works.list(); if (L.some(x => x.s === s)) return false; L.push({ s, t: Date.now() }); Works.save(L); return true; },
    setCode(s, code) { const L = Works.list(); let e = L.find(x => x.s === s); if (!e) { e = { s, t: Date.now() }; L.push(e); } e.code = code; Works.save(L); },
    remove(s) { Works.save(Works.list().filter(x => x.s !== s)); },
    codes: () => Works.list().filter(x => x.code).map(x => x.code),
    lastMade: () => st.myLast,
  };

  // ---------- 試合の前（えらぶ） ----------
  const editable = i => (st.mode === 'local' && (i === 0 || (st.practice && !st.chal))) || st.my === i;
  function slotHtml(i) {
    const s = st.slots[i], w = s.w, side = ['左・朱', '右・藍'][i];
    if (st.mode !== 'local' && i !== st.my && !st.reveal) {
      return `<span class="sl-side">${side}</span><div class="hidden-foe">${st.mode === 'watch' ? 'ふたりが準備中…' : (st.foeReady ? 'あいては準備OK！' : 'あいてが作品をえらんでいます…')}<br>（公開まで見えません）</div>`;
    }
    if (!w) {
      if (i === 0 || st.mode !== 'local') return `<span class="sl-side">${side}</span><div class="sl-empty"><div>あなたの作品をえらんでください</div><div class="row"><button class="btn hot" data-wpick="${i}">作品をえらぶ</button>${st.mode === 'local' ? '<button class="btn" data-make="1">作る</button>' : ''}</div></div>`;
      return `<span class="sl-side">${side}</span><div class="sl-empty"><div>練習の相手をえらんでください</div><div class="row"><button class="btn hot" data-cpick="1">相手をえらぶ</button></div></div>`;
    }
    const ed = editable(i);
    let h = `<span class="sl-side">${side}</span>
      <div class="sl-top">
        <div class="sl-shape"><canvas width="240" height="240" style="width:120px;height:120px" data-shape="${i}"></canvas></div>
        <div class="sl-info">
          <div class="sl-name"><span class="sl-ch">${esc(w.ch)}</span><small>${w.orig ? '元の字のまま' : '組み替えた作品'}・${w.prep.length}画</small><small>${esc(GL.FORM[w.form])}</small></div>
          ${i === 1 && st.chal ? `<span class="badge">挑戦状 ${OK.Chal.fmt(st.chal.id)}</span>` : ''}
        </div>
      </div>
      <div class="sl-mid"><canvas width="300" height="270" style="width:150px;height:135px" data-radar="${i}"></canvas><div class="st-list">`;
    for (const x of OK.STATS) h += `<div><b>${x.n} <span>${x.from}</span></b><b>${w.st[x.k]}</b></div>`;
    h += `</div></div>`;
    if (ed) {
      if (i === 0 || st.mode !== 'local') h += `<div class="sl-btns"><button class="btn sm" data-wpick="${i}">べつの作品</button>${st.mode === 'local' ? '<button class="btn sm" data-make="1">作る</button>' : ''}</div>`;
      else h += `<div class="sl-btns"><button class="btn sm" data-cpick="1">べつの相手</button></div>`;
    }
    return h;
  }
  function renderSlot(i) {
    const el = $('slot' + i); R.freeIn(el); el.innerHTML = slotHtml(i);
    const w = st.slots[i].w; if (!w) return;
    const cv = el.querySelector('[data-shape]');
    if (cv && cv.getContext('2d')) { const c = cv.getContext('2d'); c.clearRect(0, 0, 240, 240); R.shapeIcon(c, w.b.parts, 120, 120, 190, 0, i, { lw: 3 }); }
    const rv = el.querySelector('[data-radar]');
    if (rv && rv.getContext('2d')) { const c = rv.getContext('2d'); c.clearRect(0, 0, 300, 270); c.save(); c.scale(2, 2); R.radar(c, 75, 70, 48, OK.STATS.map(x => w.st[x.k]), null, { fs: 10 }); c.restore(); }
  }
  function renderSlots() { renderSlot(0); renderSlot(1); updateFight(); }
  OK.renderSlots = renderSlots;
  function updateFight() {
    const b = $('btn-fight');
    if (st.mode === 'local') { b.disabled = !(st.slots[0].w && st.slots[1].w); b.textContent = 'はっけよい！'; return; }
    if (st.mode === 'watch') { b.disabled = true; b.textContent = '観戦中'; return; }
    b.disabled = !st.slots[st.my].w || !!st.myReady; b.textContent = st.myReady ? '準備OK（あいて待ち）' : '準備OK！';
  }
  function openSetup(title) {
    if (title) $('su-title').textContent = title;
    show('s-setup'); $('on-st').textContent = st.mode === 'local' ? '' : st.netStatus || '';
    if (OK.Chal) OK.Chal.header(); renderSlots(); S().bgm('title');
  }
  OK.openSetup = openSetup;
  async function setSlot(i, s) {
    let w; try { w = await SH.make(s); } catch (e) { toast(e.message || '読みこめませんでした'); return; }
    st.slots[i].w = w; if (i === 0 || i === st.my) st.myLast = w;
    if (st.mode === 'local' && st.practice) store.set('ok_prac', [st.slots[0].w && st.slots[0].w.s, st.slots[1].w && st.slots[1].w.s]);
    renderSlots(); if (st.mode !== 'local' && OK.Net) OK.Net.changed();
  }
  OK.setSlot = setSlot;
  // 練習試合：左＝自分の作品、右＝元の字（好きな字）
  OK.practice = async function (s) {
    st.mode = 'local'; st.practice = true; st.chal = null; st.my = -1; st.reveal = true; st.rnd = false;
    const prev = store.get('ok_prac', [null, null]);
    openSetup('練習試合');
    const left = s || (st.myLast && st.myLast.s) || prev[0] || (Works.list().slice(-1)[0] || {}).s;
    if (left) await setSlot(0, left); else { st.slots[0].w = null; }
    if (!st.slots[1].w || st.slots[1].w === st.slots[0].w) {
      if (prev[1]) await setSlot(1, prev[1]); else await setOriginal(1, OK.randomChar());
    }
    renderSlots();
  };
  async function setOriginal(i, raw) {
    const ch = GL.first(raw); if (!ch) return false;
    const g = await GL.get(ch).catch(() => null); if (!g) return false;
    const f = GL.formsOf(g)[0], prep = SH.prep(g.forms[f]);
    await setSlot(i, SH.originalOf(f, ch, prep)); return true;
  }

  // ---------- 作品をえらぶ ----------
  let wpFor = 0;
  function openWorkPick(i) {
    wpFor = i; const box = $('wp-list'); R.freeIn(box);
    const L = Works.list().slice().reverse();
    box.innerHTML = L.length ? '' : '<p class="mc-empty">まだ作品がありません。<br>「作る」から字をばらして作ってください。</p>';
    const add = document.createElement('button'); add.className = 'wp-new'; add.textContent = '＋ 新しく作る'; add.onclick = () => { $('wpick').classList.remove('on'); OK.E.open(); }; box.appendChild(add);
    for (const e of L) {
      const b = document.createElement('button'); b.className = 'wp-item';
      const cv = thumb(e.s, 64, i); b.appendChild(cv);
      const t = document.createElement('div'); t.className = 'wp-t'; t.innerHTML = `<b>${esc((SH.decode(e.s) || {}).ch || '?')}</b><small>${e.code ? '挑戦状 ' + OK.Chal.fmt(e.code) : ''}</small>`; b.appendChild(t);
      b.onclick = () => { S().play('ui'); $('wpick').classList.remove('on'); setSlot(wpFor, e.s); };
      box.appendChild(b);
    }
    $('wpick').classList.add('on');
  }
  function thumb(s, px, side) {
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2; cv.style.width = cv.style.height = px + 'px'; cv.className = 'mc-shape';
    SH.make(s).then(w => { const c = cv.getContext('2d'); if (c) R.shapeIcon(c, w.b.parts, px, px, px * 1.7, 0, side || 0, { lw: 2.5 }); }).catch(() => {});
    return cv;
  }
  OK.thumb = thumb;

  // ---------- あなたの作品（画面） ----------
  async function openWorks() {
    show('s-works'); OK.Chal.markSeen();
    const box = $('works-list'); R.freeIn(box); box.innerHTML = '';
    const L = Works.list().slice().reverse();
    if (!L.length) { box.innerHTML = '<p class="mc-empty">まだ作品がありません。<br>タイトルの「字をばらして作る」から作れます。</p>'; return; }
    for (const e of L) {
      const el = document.createElement('div'); el.className = 'mc';
      const head = document.createElement('div'); head.className = 'mc-head'; head.appendChild(thumb(e.s, 64, 0));
      const info = document.createElement('div'); info.className = 'mc-info';
      const d = SH.decode(e.s) || {};
      info.innerHTML = `<b>「${esc(d.ch || '?')}」</b><small>${esc(GL.FORM[d.form] || '')}・${new Date(e.t).toLocaleDateString('ja-JP')}に作った</small>` +
        (e.code ? `<div class="mc-rec"><span class="code">挑戦状 ${OK.Chal.fmt(e.code)}</span><span class="rec" data-rec="${e.code}">…</span></div>` : '');
      head.appendChild(info); el.appendChild(head);
      const bt = document.createElement('div'); bt.className = 'mc-btns';
      bt.innerHTML = `<button class="btn sm hot" data-a="pr">練習試合</button><button class="btn sm" data-a="ed">作り直す</button>${e.code ? '<button class="btn sm" data-a="cd">合言葉・投稿</button>' : '<button class="btn sm" data-a="ch">挑戦状にする</button>'}<button class="btn sm" data-a="rm">消す</button>`;
      bt.onclick = ev => {
        const a = ev.target.closest('button'); if (!a) return; S().play('ui');
        if (a.dataset.a === 'pr') OK.practice(e.s);
        else if (a.dataset.a === 'ed') OK.E.open(e.s);
        else if (a.dataset.a === 'ch') OK.Chal.put(e.s);
        else if (a.dataset.a === 'cd') OK.Chal.showCode(e.s, e.code);
        else if (a.dataset.a === 'rm') {
          const dlg = OK.QM.dialog(`<h3>この作品を消しますか？</h3><p class="qm-sub">${e.code ? '挑戦状はそのまま残り、ほかの人は戦えます。' : ''}この端末の一覧から消えます。</p><button class="qm-b" id="rm-ok">消す</button><button class="qm-b sub" id="rm-x">やめる</button>`);
          dlg.querySelector('#rm-ok').onclick = () => { Works.remove(e.s); OK.QM.close(); openWorks(); };
          dlg.querySelector('#rm-x').onclick = () => OK.QM.close();
        }
      };
      el.appendChild(bt); box.appendChild(el);
      if (e.code && OK.hasDb()) OK.Chal.get(e.code).then(c => { const r = el.querySelector('[data-rec]'); if (r) r.textContent = c ? OK.Chal.recText(c) : '見つかりません'; }).catch(() => { const r = el.querySelector('[data-rec]'); if (r) r.textContent = ''; });
    }
  }

  // ---------- 試合 ----------
  function startBattle() {
    const a = st.slots[0].w, b = st.slots[1].w; if (!a || !b) return null;
    const pre = OK.newMatch(a, b); let lastHit = 0, lastEv = null;
    while (!pre.over) { pre.tick(); for (const e of pre.ev) if (e.k === 'hit') { lastHit = pre.step; lastEv = e; } pre.ev.length = 0; }
    st.result = { winner: pre.winner, digest: pre.digest(), t: pre.t, ra: pre.A.ratio(), rb: pre.B.ratio(), endBy: pre.endBy, lastHit, lastEv, hitN: pre.hitN };
    st.live = OK.newMatch(a, b); st.liveT = -1.4; st.acc = 0; st.done = false; st.goSaid = false; st.slow = false;
    $('hn0').textContent = a.ch; $('hn1').textContent = b.ch;
    show('s-battle'); $('result').classList.remove('on'); R.fx = [];
    call('はっけよい', 1.1); S().play('start'); S().bgm('battle');
    return st.result;
  }
  OK.startBattle = startBattle;
  let callT = null;
  function call(t, sec) { const c = $('call'); c.innerHTML = t; c.classList.add('on'); clearTimeout(callT); if (sec) callT = setTimeout(() => c.classList.remove('on'), sec * 1000); }
  function liveStep(dt) {
    const m = st.live; if (!m) return;
    st.liveT += dt; if (st.liveT < 0) return;
    if (st.liveT < 0.3 && !st.goSaid) { st.goSaid = true; call('のこった！', 0.7); S().play('go'); }
    let k = st.speed; const toEnd = st.result.lastHit - m.step;
    if (st.result.endBy === 'break' && toEnd >= 0 && toEnd < 60) k = 0.22;
    st.slow = k < 0.5;
    st.acc += dt * k; let n = 0;
    while (st.acc >= OK.DT && !m.over && n < 40) {
      m.tick(); st.acc -= OK.DT; n++;
      for (const e of m.ev) {
        if (e.k === 'hit') { R.hit(e); const br = e.br[0] + e.br[1]; S().play(br > 0.4 ? 'break' : br > 0 ? 'crack' : 'hit', Math.min(1, e.v / 14)); }
        else if (e.k === 'wall') S().play('wall', Math.min(1, e.v / 10));
      }
      m.ev.length = 0;
    }
    if (m.over && !st.done) { st.done = true; setTimeout(finish, 900); }
  }
  const nm = w => '「' + w.ch + '」' + (w.orig ? '（元の字）' : '');
  function finish() {
    const r = st.result, w0 = st.slots[0].w, w1 = st.slots[1].w;
    let t, line;
    if (r.winner < 0) { t = '引き分け'; line = `${nm(w0)}と${nm(w1)}は引き分け！`; }
    else { const w = r.winner ? w1 : w0, l = r.winner ? w0 : w1; t = `「${w.ch}」の勝ち！`; line = `${nm(w)}が${nm(l)}に勝った！`; }
    const tags = OK.resultTags(r, w0, w1);
    const gk = tags.some(x => x.t === '下剋上！');
    call((gk ? '下剋上！\n' : '') + t + (r.endBy === 'time' ? '<small>時間切れ・残りの多さで勝負</small>' : ''), gk ? 2.2 : 1.6);
    S().play(r.winner < 0 ? 'draw' : 'win');
    setTimeout(() => {
      $('res-t').innerHTML = (gk ? '<span class="gk">下剋上</span><br>' : '') + esc(t); $('res-line').textContent = line + (r.endBy === 'time' ? '（時間切れ判定）' : '');
      prepareImage(line, tags);
      $('res-note').textContent = st.mode === 'local' ? '同じ作品どうしなら、いつでも同じ結果になります。' : (st.netNote || '');
      $('btn-chal-next').hidden = !st.chal; $('btn-remake').hidden = st.mode !== 'local';
      if (st.chal) { $('res-line').textContent = line + '　…成績をつけています'; OK.Chal.onResult(r.winner).then(x => { if (x) $('res-line').textContent = x; }); }
      $('btn-change').textContent = st.mode === 'local' ? (st.chal ? '自分の作品を変える' : '組み合わせを変える') : (st.mode === 'watch' ? 'もどる' : 'もう一戦（えらびなおす）');
      $('result').classList.add('on');
    }, 1500);
  }
  function prepareImage(line, tags) {
    const r = st.result, me = st.mode === 'local' ? 0 : st.my;
    st.imgReady = false;
    const lose = me >= 0 && r.winner >= 0 && r.winner !== me;
    $('btn-img').textContent = r.winner < 0 || lose ? '結果画像を出す' : '勝利画像を出す';
    const tg = tags.map(x => x.t.replace(/！$/, ''));
    let text = (tg.length ? '【' + tg.join('・') + '】' : '') + line;
    if (st.chal) text += `\n挑戦状【${OK.Chal.fmt(st.chal.id)}】に挑戦！あなたも→ ${OK.Chal.link(st.chal.id)}`;
    else text += '\n' + URL_GAME;
    st.shareText = text + '\n#オトコノジ #漢ノ字';
  }
  async function openImage() {
    const r = st.result; if (!r || !st.live) return;
    const cv = $('res-img'), btn = $('btn-img'); btn.disabled = true; const t0 = btn.textContent; btn.textContent = '画像を作っています…';
    try {
      if (!st.imgReady) { await OK.drawResultImage(cv, { m: st.live, r, w: [st.slots[0].w, st.slots[1].w], chal: st.chal, url: URL_GAME }); st.imgReady = true; }
      showImage(cv, st.shareText, 'otokonoji.png');
    } catch (e) { console.error(e); toast('画像を作れませんでした'); }
    btn.disabled = false; btn.textContent = t0;
  }
  let ivShare = null;
  async function showImage(cv, text, fname) {
    const old = $('iv-img').src; if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
    $('iv-img').src = await new Promise(res => cv.toBlob(b => res(b ? URL.createObjectURL(b) : cv.toDataURL('image/png')), 'image/png'));
    ivShare = { cv, text, fname };
    $('imgview').classList.add('on');
  }
  // 画像つきで投稿：スマホは画像と文をまとめてXのアプリへ。できない端末は画像を保存して投稿画面を開く
  OK.shareImage = async function (cv, text, fname) {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const file = new File([blob], fname || 'otokonoji.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    saveImg(blob, fname);
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
    toast('画像を保存しました。投稿画面に画像をつけてください');
  };
  function saveImg(blob, fname) {
    const go = b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname || 'otokonoji.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    if (blob) go(blob); else if (ivShare) ivShare.cv.toBlob(go, 'image/png');
  }

  // ---------- 毎フレーム ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const scr = document.querySelector('.screen.active');
    if (scr && scr.id === 's-battle' && st.live) {
      liveStep(dt);
      const m = st.live;
      try { R.draw(m, { names: [st.slots[0].w.ch, st.slots[1].w.ch], dt: st.slow ? dt * 0.3 : dt, top: 46, bot: 10 }); } catch (e) { if (!st.drawErr) { st.drawErr = 1; console.error(e); } }
      for (let i = 0; i < 2; i++) { const r = (i ? m.B : m.A).ratio(); $('hg' + i).style.width = Math.max(0, Math.min(100, r * 100)) + '%'; $('hv' + i).textContent = Math.round(r * 100) + '%'; }
      $('clock').textContent = Math.max(0, Math.ceil(OK.TMAX - m.t));
    } else if (st.idle && scr && (scr.id === 's-title' || scr.id === 's-howto' || scr.id === 's-chal' || scr.id === 's-online')) idleDraw(dt);
  }
  function idleDraw(dt) {
    const m = st.idle; let n = 0; st.idleAcc = (st.idleAcc || 0) + dt * 0.7;
    while (st.idleAcc >= OK.DT && n < 20) { m.tick(); st.idleAcc -= OK.DT; n++; for (const e of m.ev) if (e.k === 'hit') R.hit(e); m.ev.length = 0; }
    try { R.draw(m, { dt, names: st.idleN }); } catch (e) {}
    if (m.over) { st.idleWait = (st.idleWait || 0) + dt; if (st.idleWait > 2) { st.idleWait = 0; newIdle(); } }
  }
  async function newIdle() {
    try {
      const mk = async () => { for (let k = 0; k < 6; k++) { const ch = OK.randomChar(), g = await GL.get(ch).catch(() => null); if (g) { const f = GL.formsOf(g)[0]; return SH.make(SH.originalOf(f, ch, SH.prep(g.forms[f]))); } } return null; };
      const [a, b] = await Promise.all([mk(), mk()]); if (!a || !b) return;
      st.idle = OK.newMatch(a, b); st.idleN = [a.ch, b.ch];
    } catch (e) {}
  }

  // ---------- タイトルへ ----------
  function toTitle() {
    if (window.QM) QM.ended(); st.rnd = false;
    if (st.mode !== 'local' && OK.Net) OK.Net.leave();
    st.mode = 'local'; st.my = -1; st.reveal = true; st.live = null; st.chal = null;
    $('result').classList.remove('on'); show('s-title'); S().bgm('title');
    OK.Chal.mineSummary();
    if (pendingReload) location.reload();
    if (!st.idle) newIdle();
  }
  OK.toTitle = toTitle;

  // ---------- 版が上がったら読みなおす ----------
  let pendingReload = false;
  async function checkVersion() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = await r.json();
      if (v && v.v > OK.VER) {
        const scr = document.querySelector('.screen.active');
        if (scr && scr.id === 's-title' && !document.querySelector('.qm-ov.on')) location.reload(); else pendingReload = true;
      }
    } catch (e) {}
  }

  // ---------- ボタン ----------
  function bind() {
    $('btn-make').onclick = () => { S().unlock(); S().play('ui'); OK.E.open(); };
    $('btn-practice').onclick = () => { S().unlock(); S().play('ui'); OK.practice(); };
    $('btn-chal').onclick = () => { S().unlock(); S().play('ui'); if (!OK.hasDb()) { toast('通信の準備がまだです'); return; } $('ch-err').textContent = ''; show('s-chal'); };
    $('ch-go').onclick = () => { S().play('ui'); OK.Chal.byCode($('ch-code').value); };
    $('ch-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('ch-go').click(); });
    $('ch-rand').onclick = () => { S().play('ui'); OK.Chal.random(); };
    $('ch-back').onclick = () => { S().play('ui'); toTitle(); };
    $('btn-works').onclick = () => { S().play('ui'); openWorks(); };
    $('chal-news').onclick = () => { S().play('ui'); openWorks(); };
    $('btn-works-back').onclick = () => { S().play('ui'); toTitle(); };
    $('btn-howto').onclick = () => { S().play('ui'); show('s-howto'); };
    $('btn-how-back').onclick = () => { S().play('ui'); toTitle(); };
    $('btn-setup-back').onclick = () => { S().play('ui'); toTitle(); };
    $('btn-snd').onclick = () => { S().unlock(); const m = !OK.mute(); OK.mute(m); $('snd-name').textContent = m ? 'なし' : 'あり'; };
    document.addEventListener('click', ev => {
      const t = ev.target.closest('[data-wpick],[data-cpick],[data-make]'); if (!t) return;
      S().play('ui');
      if (t.dataset.wpick != null) openWorkPick(+t.dataset.wpick);
      else if (t.dataset.cpick != null) { $('cp-err').textContent = ''; $('cp-q').value = ''; $('cpick').classList.add('on'); setTimeout(() => { try { $('cp-q').focus(); } catch (e) {} }, 60); }
      else if (t.dataset.make != null) OK.E.open();
    });
    $('wp-close').onclick = () => $('wpick').classList.remove('on');
    $('cp-close').onclick = () => $('cpick').classList.remove('on');
    const cpGo = async raw => { const ok = await setOriginal(1, raw); if (ok) $('cpick').classList.remove('on'); else $('cp-err').textContent = '「' + (GL.first(raw) || '') + '」は画のデータがないため使えません'; };
    $('cp-go').onclick = () => cpGo($('cp-q').value);
    $('cp-q').addEventListener('keydown', e => { if (e.key === 'Enter') cpGo($('cp-q').value); });
    $('cp-rand').onclick = () => cpGo(OK.randomChar());
    $('cp-mine').onclick = () => { $('cpick').classList.remove('on'); openWorkPick(1); };
    $('btn-fight').onclick = () => { S().unlock(); if (st.mode === 'local') startBattle(); else if (OK.Net) OK.Net.ready(); };
    $('btn-speed').onclick = () => { st.speed = st.speed === 1 ? 2 : st.speed === 2 ? 4 : 1; $('btn-speed').textContent = '×' + st.speed; };
    $('btn-skip').onclick = () => { const m = st.live; if (!m || m.over) return; while (!m.over) { m.tick(); m.ev.length = 0; } };
    $('btn-img').onclick = () => { S().play('ui'); openImage(); };
    $('btn-share').onclick = () => { if (ivShare) OK.shareImage(ivShare.cv, ivShare.text, ivShare.fname); };
    $('btn-save').onclick = () => saveImg(null, ivShare && ivShare.fname);
    $('iv-close').onclick = () => $('imgview').classList.remove('on');
    $('imgview').onclick = ev => { if (ev.target.id === 'imgview') $('imgview').classList.remove('on'); };
    $('btn-replay').onclick = () => { S().play('ui'); startBattle(); };
    $('btn-change').onclick = () => { S().play('ui'); $('result').classList.remove('on'); if (st.mode === 'watch') { toTitle(); return; } if (st.mode !== 'local' && OK.Net) OK.Net.again(); openSetup(); };
    $('btn-remake').onclick = () => { S().play('ui'); $('result').classList.remove('on'); OK.E.open(st.slots[0].w.s); };
    $('btn-chal-next').onclick = () => { S().play('ui'); $('result').classList.remove('on'); OK.Chal.random(); };
    $('btn-online').onclick = () => { S().unlock(); S().play('ui'); if (!OK.hasDb()) { toast('通信の準備がまだです'); return; } $('in-code').value = store.get('ok_room_v', '') || ''; $('on-form').classList.remove('hide'); $('on-wait').classList.add('hide'); $('on-err').textContent = ''; show('s-online'); };
    $('btn-on-back').onclick = () => { S().play('ui'); if (OK.Net) OK.Net.leave(); toTitle(); };
    $('btn-join').onclick = () => { store.set('ok_room_v', $('in-code').value); if (OK.Net) OK.Net.join('', $('in-code').value); };
  }
  function setupQM() {
    QM.setup({
      game: 'otokonoji', ver: 'v1', name: '漢ノ字',
      getDb: () => OK.getDb(), anchor: '#btn-online', anchorWhere: 'before', btnClass: 'btn big hot', nextClass: 'btn', nameKey: 'ok_name',
      check: () => { if (!OK.hasDb()) { toast('通信の準備がまだです'); return false; } if (!Works.list().length) { toast('先に「字をばらして作る」で作品を1つ作ってください'); return false; } return true; },
      join: (code) => { S().unlock(); if (!st.myLast) { const L = Works.list(); if (L.length) SH.make(L[L.length - 1].s).then(w => { st.myLast = w; }).catch(() => {}); } OK.Net.join('', code); },
      cpu: () => OK.Chal.random(true), cpuLabel: '挑戦状と戦いながら待つ',
      quit: () => { if (OK.Net) OK.Net.leave(); toTitle(); },
      colors: { main: 'var(--red)', alt: 'var(--blue)', bg: '#f6f0e1', fg: '#1d1813' },
    });
    QM.resultSlot('#result .sheet-in', '#chal-row');
  }
  async function boot() {
    R.init($('arena'));
    bind(); OK.E.bind(); setupQM();
    $('snd-name').textContent = OK.mute() ? 'なし' : 'あり';
    requestAnimationFrame(frame);
    try {
      const m = await GL.meta();
      $('loading').textContent = `漢字 約${(Math.floor(m.han / 100) * 100).toLocaleString('ja-JP')}字・かな・英数字・ハングルが使えます`;
      $('how-chars').innerHTML = `※使える字：漢字 約${(Math.floor(m.han / 100) * 100).toLocaleString('ja-JP')}字（日本の字形・中国／台湾の字形）、ひらがな・カタカナ、英字・数字、ハングル（約1万1千字）。<br>旧字や、とてもめずらしい字は、画のデータがないため使えません。<br>ハングルは、部品（字母）の画を組み合わせて作っているので、ふつうの字体と少し形がちがう字があります。`;
    } catch (e) { $('loading').textContent = '読みこめませんでした。再読みこみしてください'; return; }
    // 前に使った作品
    const L = Works.list(); if (L.length) SH.make(L[L.length - 1].s).then(w => { if (!st.myLast) st.myLast = w; }).catch(() => {});
    newIdle();
    OK.Chal.mineSummary(true);
    OK.Chal.fromLink();
    checkVersion(); setInterval(checkVersion, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
