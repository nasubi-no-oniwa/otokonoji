// =============================================
//  漢ノ字  部屋番号で対戦（Firebase Realtime Database）
//  ・地元の最強の「あいことば対戦」と同じしくみ
//  ・お互いに作品をこっそり決めて「準備OK」→ 2人そろったら同時に公開して試合
//  ・結果は毎回同じになるので、試合はそれぞれの画面で計算する（最後に結果が同じか確かめる）
//  ・書きこみは匿名ログインしてから
//
//  データの形： ok/{部屋番号}/
//    players/{0|1}: { id, name }   watchers/{id}: { name }   ready/{0|1}: 何試合目をやりたいか
//    game: { m }（0番の人が書く）   sel/{0|1}: { ok }
//    pick/{m}/{0|1}: { w: 作品 }（準備OKのときに書く）   res/{m}/{0|1}: 結果の要約
// =============================================
(function () {
  const OK = window.OK;
  const $ = id => document.getElementById(id);
  const clean = s => String(s || '').normalize('NFKC').replace(/[.#$\[\]\/\s]/g, '').slice(0, 20);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('通信できませんでした。電波のよいところでもう一度ためしてください')); document.head.appendChild(el); }); }
  OK.hasDb = () => !!(OK.FIREBASE_CONFIG && OK.FIREBASE_CONFIG.databaseURL);
  // Firebase につないで、匿名ログインする
  let dbP = null;
  async function getDb() {
    if (OK._db) return OK._db;
    if (!OK.hasDb()) throw new Error('通信の準備がまだです（管理人：firebase-config.js に設定を貼ってください）');
    if (dbP) return dbP;
    dbP = (async () => {
      const v = '10.12.2';
      if (!window.firebase || !firebase.database) {
        await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/' + v + '/firebase-database-compat.js');
      }
      if (!firebase.apps.length) firebase.initializeApp(OK.FIREBASE_CONFIG);
      try { if (firebase.auth && !firebase.auth().currentUser) await firebase.auth().signInAnonymously(); }
      catch (e) { throw new Error('ログインできませんでした（管理人：Firebase の「Authentication」で「匿名」を有効にしてください）'); }
      return OK._db = firebase.database();
    })();
    try { return await dbP; } catch (e) { dbP = null; throw e; }
  }
  OK.getDb = getDb;
  OK.uid = () => (window.firebase && firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null);
  OK.idToken = async () => { try { await getDb(); return await firebase.auth().currentUser.getIdToken(); } catch (e) { return null; } };

  let R = null;
  const st = () => OK.st;
  class Room {
    constructor(db, code) { this.db = db; this.code = clean(code); this.name = '漢'; this.id = uid(); this.slot = -1; this.watching = false; this.players = {}; this.subs = []; this.ms = []; this.game = null; this.sel = {}; this.left = false; this.root = db.ref('ok/' + this.code); }
    on(ref, ev, fn, list) { ref.on(ev, fn); (list || this.subs).push([ref, ev, fn]); }
    async join() {
      if (!this.code) throw new Error('部屋番号を入れてください');
      for (const s of [0, 1]) {
        const r = await this.root.child('players/' + s).transaction(cur => (cur ? undefined : { id: this.id, name: this.name }));
        if (r.committed && r.snapshot.val() && r.snapshot.val().id === this.id) { this.slot = s; break; }
      }
      if (this.slot < 0) {
        const w = (await this.root.child('watchers').once('value')).val() || {};
        if (Object.keys(w).length >= 10) throw new Error('この部屋は観戦の人でいっぱいです（10人まで）');
        this.watching = true; const me = this.root.child('watchers/' + this.id); await me.set({ name: this.name }); me.onDisconnect().remove();
      } else {
        for (const k of ['players/', 'ready/', 'sel/']) this.root.child(k + this.slot).onDisconnect().remove();
        const other = (await this.root.child('players/' + (1 - this.slot)).once('value')).val();
        const g0 = (await this.root.child('game').once('value')).val();
        if (!other) { for (const k of ['game', 'ready', 'sel', 'pick', 'res']) await this.root.child(k).remove(); this.joinM = 1; }
        else this.joinM = ((g0 && g0.m) || 0) + 1;
      }
      this.on(this.root.child('players'), 'value', s => {
        const prev = this.players; this.players = s.val() || {}; ui.people();
        const gone = this.watching ? ((prev[0] && !this.players[0]) || (prev[1] && !this.players[1])) : (prev[1 - this.slot] && !this.players[1 - this.slot]);
        if (gone) ui.left();
        this.tryStart();
      });
      this.on(this.root.child('ready'), 'value', s => { this.ready = s.val() || {}; this.tryStart(); });
      this.on(this.root.child('game'), 'value', s => this.onGame(s.val()));
      this.on(this.root.child('sel'), 'value', s => { this.sel = s.val() || {}; ui.sel(); });
      if (this.slot >= 0) await this.root.child('ready/' + this.slot).set(this.joinM);
      return { slot: this.slot, watching: this.watching };
    }
    tryStart() {
      if (this.slot !== 0 || this.left || !this.joinM) return;
      const r = this.ready || {}, next = ((this.game && this.game.m) || 0) + 1;
      if (!this.players[0] || !this.players[1]) return;
      if (!(r[0] >= next && r[1] >= next) || this.starting === next) return;
      if (this.game && this.game.m && !this.game.done) return;
      this.starting = next;
      this.root.child('sel').remove(); this.root.child('pick').remove(); this.root.child('res').remove();
      this.root.child('game').set({ m: next });
    }
    onGame(g) {
      if (this.left) return; this.game = g; if (!g || !g.m) return;
      if (!this.watching && g.m < (this.joinM || 0)) return;
      if (this.gm === g.m) return; this.gm = g.m;
      for (const [r, e, f] of this.ms) r.off(e, f); this.ms = [];
      this.picks = {};
      this.on(this.root.child('pick/' + g.m), 'value', s => { this.picks = s.val() || {}; ui.picks(); }, this.ms);
      this.on(this.root.child('res/' + g.m), 'value', s => ui.res(s.val() || {}), this.ms);
      ui.newGame(g.m);
    }
    setSel(o) { if (this.slot >= 0 && !this.left) this.root.child('sel/' + this.slot).set(o); }
    pick(o) { if (this.slot >= 0 && this.game) this.root.child('pick/' + this.game.m + '/' + this.slot).set(o); }
    unpick() { if (this.slot >= 0 && this.game) this.root.child('pick/' + this.game.m + '/' + this.slot).remove(); }
    result(d) { if (this.slot >= 0 && this.game) this.root.child('res/' + this.game.m + '/' + this.slot).set(d); }
    done() { if (this.slot === 0 && this.game && !this.game.done) this.root.child('game').set({ m: this.game.m, done: 1 }); }
    again() { if (this.slot >= 0 && this.game) this.root.child('ready/' + this.slot).set(this.game.m + 1); }
    leave() {
      if (this.left) return; this.left = true;
      for (const [r, e, f] of this.subs.concat(this.ms)) r.off(e, f); this.subs = []; this.ms = [];
      if (this.watching) this.root.child('watchers/' + this.id).remove();
      else if (this.slot >= 0) for (const k of ['players/', 'ready/', 'sel/']) this.root.child(k + this.slot).remove();
    }
  }
  const ui = {
    people() {
      if (!R) return; const n = (R.players[0] ? 1 : 0) + (R.players[1] ? 1 : 0);
      $('on-people').textContent = `部屋にいる人：${n}人` + (R.watching ? '（あなたは観戦）' : '');
      if (st().mode !== 'local') ui.status();
    },
    status() {
      if (!R) return; const s = st();
      let t = R.watching ? '観戦中' : (QM.isRandom() ? 'だれかと対戦' : '部屋番号 ' + R.code);
      if (!s.reveal && s.mode === 'net') {
        const fo = R.sel[1 - R.slot];
        if (fo && fo.ok) t += '　あいては準備OK！'; else t += '　あいては作品をえらんでいます';
      }
      s.netStatus = t; $('on-st').textContent = t;
    },
    sel() {
      if (!R) return; const s = st(); const fo = R.sel[1 - R.slot];
      s.foeReady = !!(fo && fo.ok); if (s.mode === 'net' && !s.reveal) OK.renderSlots(); ui.status();
    },
    newGame() {
      const s = st();
      const prev = s.mode === 'net' && s.my >= 0 ? s.slots[s.my] : s.slots[0];
      const mine = prev.w;
      s.mode = R.watching ? 'watch' : 'net'; s.chal = null; s.practice = false;
      QM.started({ code: R.code, watch: R.watching });
      s.rnd = QM.isRandom(); s.my = R.slot; s.reveal = false; s.myReady = false; s.foeReady = false; s.netNote = '';
      if (!R.watching) { s.slots[R.slot].w = mine || OK.Works.lastMade(); s.slots[1 - R.slot].w = null; }
      else { s.slots[0].w = null; s.slots[1].w = null; }
      $('result').classList.remove('on'); OK.openSetup(R.watching ? '観戦' : (s.rnd ? 'だれかと対戦' : '部屋番号で対戦')); ui.status();
      if (!R.watching) R.setSel({ ok: 0 });
    },
    async picks() {
      const s = st(), P = R.picks || {};
      if (!P[0] || !P[1] || s.reveal) return;
      try {
        const ws = await Promise.all([OK.SH.make(P[0].w), OK.SH.make(P[1].w)]);
        if (s.reveal) return;
        s.reveal = true; s.slots[0].w = ws[0]; s.slots[1].w = ws[1];
      } catch (e) { OK.toast('相手の作品を読みこめませんでした'); return; }
      OK.renderSlots();
      setTimeout(() => { const r = OK.startBattle(true); if (r && !R.watching) R.result(r.digest); s.myDigest = r && r.digest; }, 900);
    },
    res(v) {
      const s = st(); if (!v[0] || !v[1]) return;
      s.netNote = v[0] === v[1] ? 'ふたりの画面で同じ結果になりました。' : '※ふたりの画面で結果がずれました（お知らせください）';
      if (R && R.slot === 0) R.done();
    },
    left() {
      if (QM.isRandom()) {
        const after = !!(st().result && $('result').classList.contains('on'));
        QM.notice(after ? '相手が部屋から出ました' : 'あなたの勝ち！', after ? 'また別の人と対戦できます。' : '相手が抜けたので、あなたの勝ち！', [
          { label: '次の相手をさがす', fn: () => QM.next() },
          { label: 'タイトルへ', sub: true, fn: () => { Net.leave(); OK.toTitle(); } },
        ]);
        return;
      }
      OK.toast('あいてがいなくなりました'); setTimeout(() => { Net.leave(); OK.toTitle(); }, 1500);
    },
  };
  const Net = OK.Net = {
    async join(name, code) {
      $('on-err').textContent = '';
      if (!clean(code)) { $('on-err').textContent = '部屋番号を入れてください'; return; }
      if (!OK.Works.list().length) { $('on-err').textContent = '先に「字をばらして作る」で作品を1つ作ってください'; if (QM.state() !== 'idle') QM.cancel(); return; }
      store('ok_room', code);
      $('btn-join').disabled = true;
      try {
        const db = await getDb(); R = new Room(db, code); OK.room = R;
        const r = await R.join();
        $('on-form').classList.add('hide'); $('on-wait').classList.remove('hide');
        $('on-msg').textContent = r.watching ? '観戦します。試合を待っています…' : 'あいてを待っています…';
      } catch (e) { $('on-err').textContent = e.message || 'つながりませんでした'; R = null; }
      $('btn-join').disabled = false;
    },
    changed() {
      if (!R || R.watching) return; const s = st();
      if (s.myReady) { s.myReady = false; R.unpick(); OK.toast('変更したので、準備OKを取り消しました'); }
      R.setSel({ ok: 0 }); OK.renderSlots(); ui.status();
    },
    ready() {
      if (!R || R.watching) return; const s = st(), sl = s.slots[R.slot]; if (!sl.w) return;
      s.myReady = true; R.setSel({ ok: 1 }); R.pick({ w: sl.w.s });
      OK.renderSlots(); ui.status();
    },
    again() { if (R && !R.watching) { R.again(); st().netNote = ''; OK.toast('あいてを待っています…'); } },
    leave() { QM.ended(); if (R) { R.leave(); R = null; OK.room = null; } },
  };
})();
