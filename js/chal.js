// =============================================
//  漢ノ字  挑戦状
//  ・作品を挑戦状にすると、8けたの合言葉がつく（見まちがえやすい 0 O 1 I は使わない）
//  ・合言葉を入れて戦う／ランダムな挑戦状と戦う／リンク（?c=合言葉）から戦う
//  ・挑戦状ごとに成績（勝ち・負け）がつく（1つの挑戦状に、1台1回だけ）
//
//  データの形
//   ok_chal/{合言葉}      : { w: 作品, t: 置いた時刻, wn: 勝ち, ln: 負け, u: 置いた人 }
//   ok_res/{合言葉}/{id}  : { w: 挑んだ作品, r: 1=挑戦状が負けた 0=勝った, t, u }
//   ok_last/{人} ・ ok_rlast/{人} : 最後に書いた時刻（連投の制限）
//   ※管理人が Firebase の画面で ok_chal/{合言葉}/x = true をつけると、その挑戦状はどこにも出なくなる（消してもよい）
// =============================================
(function () {
  const OK = window.OK, SH = OK.SH;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const URL_GAME = 'https://nasubi-no-oniwa.github.io/otokonoji/';
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 0 O 1 I をのぞいた32文字
  const LIST_N = 100, DONE_MAX = 400;
  const C = OK.Chal = {};
  let cache = null, cacheAt = 0;
  const done = () => store.get('ok_chaldone', []);
  const st = () => OK.st;
  C.fmt = c => String(c || '').slice(0, 4) + '-' + String(c || '').slice(4);
  C.norm = s => String(s || '').normalize('NFKC').toUpperCase().replace(/O/g, '0').replace(/I/g, '1').replace(/[^A-Z0-9]/g, '');
  C.valid = c => c.length === 8 && [...c].every(x => CH.includes(x));
  C.link = c => URL_GAME + '?c=' + c;
  const recText = c => (c.wn || c.ln) ? `${c.wn || 0}勝${c.ln || 0}敗` : 'まだだれも挑戦していない';
  C.recText = recText;

  // ---------- 通信 ----------
  const DBURL = () => OK.FIREBASE_CONFIG.databaseURL;
  async function rest(path, q) {
    if (!OK.hasDb()) throw new Error('通信の準備がまだです');
    const qs = q ? '?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(k === 'orderBy' ? JSON.stringify(v) : String(v))).join('&') : '';
    const r = await fetch(DBURL() + '/' + path + '.json' + qs, { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }
  C.rest = rest;
  const late = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  let sdkSlow = false;
  // いくつかの場所をまとめて書く（ふだんは常時接続、だめならふつうの通信）
  async function update(obj) {
    if (!sdkSlow) {
      try {
        const d = await Promise.race([OK.getDb(), late(8000)]);
        await Promise.race([d.ref().update(obj), late(8000)]);
        return;
      } catch (e) {
        if (e && /permission/i.test(String(e.code || e.message || ''))) throw e;
        if (e && /準備|ログイン/.test(e.message || '')) throw e;
        sdkSlow = true;
      }
    }
    const tok = await OK.idToken();
    const body = {}; for (const k in obj) body[k] = obj[k];
    const r = await fetch(DBURL() + '/.json' + (tok ? '?auth=' + encodeURIComponent(tok) : ''), { method: 'PATCH', body: JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
  }
  async function bump(code, chalWon) {
    const f = cur => { if (!cur) return cur; if (chalWon) cur.wn = (cur.wn || 0) + 1; else cur.ln = (cur.ln || 0) + 1; return cur; };
    if (!sdkSlow) {
      try {
        const d = await Promise.race([OK.getDb(), late(8000)]);
        const res = await Promise.race([d.ref('ok_chal/' + code).transaction(f), late(8000)]);
        return res.snapshot && res.snapshot.val();
      } catch (e) { if (e && /permission/i.test(String(e.code || e.message || ''))) return null; sdkSlow = true; }
    }
    const cur = await rest('ok_chal/' + code); if (!cur) return null;
    const nv = f(cur); const tok = await OK.idToken();
    await fetch(DBURL() + '/ok_chal/' + code + '.json' + (tok ? '?auth=' + encodeURIComponent(tok) : ''), { method: 'PUT', body: JSON.stringify(nv) });
    return nv;
  }
  const usable = c => c && !c.x && SH.decode(c.w);
  async function list(force) {
    if (!force && cache && Date.now() - cacheAt < 120000) return cache;
    const v = await rest('ok_chal', { orderBy: 't', limitToLast: LIST_N });
    const out = []; for (const id in v || {}) { const c = Object.assign({ id }, v[id]); if (usable(c)) out.push(c); }
    out.sort((a, b) => a.t - b.t);
    cache = out; cacheAt = Date.now(); return out;
  }
  async function getChal(code) { const v = await rest('ok_chal/' + code); return v ? Object.assign({ id: code }, v) : null; }
  C.get = getChal;

  // ---------- 合言葉をつける（保存するたびに。作品＝挑戦状） ----------
  const newCode = () => { let c = ''; const r = new Uint32Array(8); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(r); else for (let i = 0; i < 8; i++) r[i] = Math.floor(Math.random() * 1e9); for (let i = 0; i < 8; i++) c += CH[r[i] % CH.length]; return c; };
  C.register = async function (s) {
    const ent = OK.Works.find(s); if (ent && ent.code) return ent.code;
    const w = await SH.make(s);
    if (!w.b.connected) throw new Error('はなれた画がある作品には、合言葉をつけられません');
    if (w.orig) throw new Error('元の字のままでは、合言葉をつけられません');
    await OK.getDb();
    const u = OK.uid();
    for (let tries = 0; tries < 6; tries++) {
      const c = newCode();
      try {
        await update({ ['ok_chal/' + c]: { w: s, t: { '.sv': 'timestamp' }, wn: 0, ln: 0, u }, ['ok_last/' + u]: { '.sv': 'timestamp' } });
        OK.Works.setCode(s, c); cache = null; C.mineSummary(true);
        return c;
      } catch (e) {
        if (e && /permission/i.test(String(e.code || e.message || ''))) {
          const ex = await getChal(c).catch(() => null);
          if (!ex) { await new Promise(r => setTimeout(r, 5200)); continue; }   // 続けて保存しすぎ：少し待ってもう一度
        } else throw e;
      }
    }
    throw new Error('合言葉をつけられませんでした');
  };
  C.put = async function (s) {
    const ent = OK.Works.find(s);
    if (ent && ent.code) { C.showCode(s, ent.code); return; }
    const dlg = OK.QM.dialog(`<h3>合言葉をつける</h3><p class="qm-err" id="cp-e">合言葉をつけています…</p><button class="qm-b sub" id="cp-x">とじる</button>`);
    dlg.querySelector('#cp-x').onclick = () => OK.QM.close();
    try { const code = await C.register(s); C.showCode(s, code); }
    catch (e) { const el = dlg.querySelector('#cp-e'); if (el) el.textContent = e.message && !/^http/.test(e.message) ? e.message : 'つけられませんでした。通信を確認してね'; }
  };
  const boshu = (w, code) => `漢ノ字「${w.ch}」の挑戦状！ 合言葉【${C.fmt(code)}】\n倒せるものなら倒してみて→ ${C.link(code)}\n#オトコノジ #漢ノ字`;
  C.showCode = async function (s, code) {
    let w; try { w = await SH.make(s); } catch (e) { return; }
    const dlg = OK.QM.dialog(`<h3>合言葉</h3>
      <p class="qm-sub">「${esc(w.ch)}」の作品</p><p class="xf-code">${C.fmt(code)}</p>
      <p class="qm-sub">形の画像と合言葉をXに投稿しよう。合言葉を「挑戦状と戦う」に入れると、だれでも戦えます。</p>
      <button class="qm-b" id="cs-x">Xに投稿（画像つき）</button><button class="qm-b alt" id="cs-cp">合言葉をコピー</button><button class="qm-b sub" id="cs-ok">とじる</button>`);
    dlg.querySelector('#cs-x').onclick = () => C.shareWork(w, code);
    dlg.querySelector('#cs-cp').onclick = () => copy(C.fmt(code));
    dlg.querySelector('#cs-ok').onclick = () => OK.QM.close();
  };
  C.shareWork = async function (w, code) {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 675;
    await OK.drawWorkImage(cv, w, code, URL_GAME);
    const text = boshu(w, code);
    await OK.shareImage(cv, text, 'otokonoji-' + code + '.png');
    OK.R.free(cv);
  };
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); OK.toast('コピーしました'); }
    catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); OK.toast('コピーしました'); } catch (e2) { OK.toast('コピーできませんでした'); } a.remove(); }
  }
  C.copy = copy;

  // ---------- 挑戦状と戦う ----------
  C.random = async function (fromWait) {
    try {
      OK.toast('挑戦状をさがしています…');
      const L = await list();
      const mineC = new Set(OK.Works.codes()), dn = new Set(done());
      let cand = L.filter(c => !mineC.has(c.id) && !dn.has(c.id));
      if (!cand.length) cand = L.filter(c => !mineC.has(c.id));
      if (!cand.length) { OK.toast(L.length ? 'いまある挑戦状は、ぜんぶあなたのものです' : 'まだ挑戦状がありません。作品を挑戦状にしてみよう'); if (fromWait) C.end(); return false; }
      let sum = 0; const wts = cand.map((c, i) => (sum += 1 + i / cand.length * 2));
      const r = Math.random() * sum; const c = cand[wts.findIndex(x => x >= r)] || cand[cand.length - 1];
      await C.start(c); return true;
    } catch (e) { OK.toast(e.message && !/^http/.test(e.message) ? e.message : '挑戦状を読みこめませんでした'); return false; }
  };
  C.byCode = async function (raw) {
    const code = C.norm(raw), err = $('ch-err'); err.textContent = '';
    if (!C.valid(code)) { err.textContent = '8けたの合言葉を入れてください（例：AB3K-7XQM）'; return; }
    try {
      const c = await getChal(code);
      if (!c || !usable(c)) { err.textContent = 'その合言葉の挑戦状は見つかりませんでした'; return; }
      await C.start(c);
    } catch (e) { err.textContent = e.message && !/^http/.test(e.message) ? e.message : '読みこめませんでした。通信を確認してね'; }
  };
  C.start = async function (c) {
    const s = st(); let w;
    try { w = await SH.make(c.w); } catch (e) { OK.toast('この挑戦状の作品を読めませんでした'); return; }
    s.mode = 'local'; s.my = -1; s.reveal = true; s.chal = c; s.chalRec = false; s.rnd = false; s.practice = false;
    s.slots[1].w = w;
    if (!s.slots[0].w) { const L = OK.Works.lastMade(); if (L) s.slots[0].w = L; }
    OK.openSetup('挑戦状 ' + C.fmt(c.id));
    C.header();
  };
  C.fromLink = async function () {
    let id = null; try { id = new URLSearchParams(location.search).get('c'); } catch (e) {}
    if (!id) return false;
    const code = C.norm(id); if (!C.valid(code)) return false;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    try {
      const c = await getChal(code);
      if (!c || !usable(c)) { OK.toast('この挑戦状は見つかりませんでした'); return false; }
      await C.start(c); OK.toast('挑戦状が届きました！'); return true;
    } catch (e) { OK.toast('挑戦状を読みこめませんでした'); return false; }
  };
  C.header = function () {
    const s = st(), c = s.chal, el = $('on-st'); if (!el) return;
    if (!c) { if (s.mode === 'local') el.textContent = ''; return; }
    el.innerHTML = `挑戦状 <b>${C.fmt(c.id)}</b>（${esc(recText(c))}）<span class="chal-h">左にあなたの作品をえらんで、はっけよい！</span>`;
  };
  C.end = function () { const s = st(); s.chal = null; s.chalRec = false; C.header(); };
  // 成績をつける（1つの挑戦状に1台1回だけ。自分の挑戦状・引き分けはつけない）
  C.onResult = async function (winner) {
    const s = st(), c = s.chal; if (!c) return null;
    const note = winner === 0 ? '挑戦状に勝った！' : winner === 1 ? '挑戦状に負けた…' : '挑戦状と引き分け';
    const dn = done();
    if (s.chalRec || dn.includes(c.id) || winner < 0 || OK.Works.codes().includes(c.id)) { s.chalRec = true; return note + `（この挑戦状：${recText(c)}）`; }
    s.chalRec = true; dn.push(c.id); store.set('ok_chaldone', dn.slice(-DONE_MAX));
    try {
      await OK.getDb(); const u = OK.uid();
      const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const mine = OK.Works.find(s.slots[0].w.s), rec = { w: s.slots[0].w.s, r: winner === 0 ? 1 : 0, t: { '.sv': 'timestamp' }, u };
      if (mine && mine.code) rec.c = mine.code;
      await update({ ['ok_res/' + c.id + '/' + rid]: rec, ['ok_rlast/' + u]: { '.sv': 'timestamp' } });
      const v = await bump(c.id, winner === 1); if (v) { c.wn = v.wn; c.ln = v.ln; } C.header();
    } catch (e) {}
    return note + `（この挑戦状：${recText(c)}）`;
  };

  // ---------- タイトル：自分の挑戦状の成績 ----------
  let sumAt = 0;
  C.mineSummary = async function (force) {
    const el = $('chal-mine'), nb = $('chal-news'); if (!el || !OK.hasDb()) return;
    const codes = OK.Works.codes();
    if (!codes.length) { el.textContent = ''; nb.hidden = true; return; }
    if (!force && Date.now() - sumAt < 180000) return; sumAt = Date.now();
    let w = 0, l = 0, n = 0, fresh = 0; const seen = store.get('ok_seen', {}), recs = {};
    await Promise.all(codes.map(async code => {
      try { const v = await rest('ok_chal/' + code); if (!v) return; n++; w += v.wn || 0; l += v.ln || 0; recs[code] = (v.wn || 0) + (v.ln || 0); fresh += Math.max(0, recs[code] - (seen[code] || 0)); } catch (e) {}
    }));
    C.recs = recs;
    el.textContent = n ? `あなたの挑戦状 ${n}枚：${w}勝${l}敗` : '';
    nb.hidden = !fresh; nb.innerHTML = `🔔 あなたの挑戦状に、新しい挑戦者が<b>${fresh}人</b>`;
  };
  C.markSeen = function () { if (C.recs) { const sn = store.get('ok_seen', {}); Object.assign(sn, C.recs); store.set('ok_seen', sn); } const nb = $('chal-news'); if (nb) nb.hidden = true; };
  // ---------- 番号で作品を取り出す ----------
  C.fetchWork = async function (raw) {
    const code = C.norm(raw); if (!C.valid(code)) throw new Error('8けたの番号を入れてください');
    const c = await getChal(code); if (!c || !usable(c)) throw new Error('その番号の作品は見つかりませんでした');
    const L = OK.Works.list(); if (L.some(x => x.s === c.w)) return { already: true };
    L.push({ s: c.w, t: Date.now(), code, own: false }); OK.Works.save(L); return { ok: true };
  };
  // ---------- アカウントの引き継ぎ ----------
  const XCH = 'abcdefghjkmnpqrstuvwxyz23456789';
  C.acctOut = async function () {
    const L = OK.Works.list(); if (!L.length) throw new Error('まだ作品がありません');
    let code = ''; for (let i = 0; i < 10; i++) code += XCH[Math.floor(Math.random() * XCH.length)];
    const v = JSON.stringify(L.map(e => [e.s, e.code || '', e.own === false ? 0 : 1, e.t || 0]));
    if (v.length > 60000) throw new Error('作品が多すぎます');
    await update({ ['ok_acct/' + code]: { v, t: { '.sv': 'timestamp' } } });
    return code;
  };
  C.acctIn = async function (raw) {
    const code = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (code.length !== 10) throw new Error('10文字のコードを入れてください');
    const v = await rest('ok_acct/' + code); if (!v || !v.v) throw new Error('そのコードは見つかりませんでした');
    const L = OK.Works.list(); let add = 0;
    for (const [s, c, own, t] of JSON.parse(v.v)) {
      if (!SH.decode(s)) continue;
      const e = L.find(x => x.s === s);
      if (e) { if (c && !e.code) e.code = c; if (own) e.own = true; continue; }
      L.push({ s, code: c || undefined, own: !!own, t: t || Date.now() }); add++;
    }
    OK.Works.save(L); C.mineSummary(true); return add;
  };
  // ---------- 仕返し：自分の作品（左）と、破った相手の作品（右） ----------
  C.revenge = async function (myS, r) {
    if (r.c) { try { const c = await getChal(r.c); if (c && usable(c)) { await OK.setSlot(0, myS); await C.start(c); OK.toast('仕返し！相手の挑戦状と戦います'); return; } } catch (e) {} }
    await OK.practice(myS); await OK.setSlot(1, r.w); OK.toast('仕返し！（練習試合）');
  };
  C.recent = async code => { const v = await rest('ok_res/' + code, { orderBy: 't', limitToLast: 5 }); return Object.entries(v || {}).map(([k, x]) => Object.assign({ id: k }, x)).sort((a, b) => b.t - a.t); };
})();
