// =============================================
//  漢ノ字  音
//  ・効果音：Kenney「Impact Sounds」（CC0）
//  ・音楽：その場でプログラムが鳴らす（和の音階：太鼓・琴・三味線ふう）。ファイルはいらない
// =============================================
(function () {
  const OK = window.OK;
  let ac = null, bus = null, master = null, mus = null, nbuf = null, sfx = null, SP = null, mark = 0;
  let muted = (() => { try { return localStorage.getItem('ok_mute') === '1'; } catch (e) { return false; } })();
  const url = n => (OK.ASSETS && OK.ASSETS[n]) || ('assets/' + n);
  function A() {
    try {
      if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const c = ac.createDynamicsCompressor(); c.threshold.value = -14; c.ratio.value = 4;
        master = ac.createGain(); master.gain.value = muted ? 0 : 1; c.connect(master); master.connect(ac.destination); bus = c;
        mus = ac.createGain(); mus.gain.value = 0.42; mus.connect(master);
        nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        load(); ac.onstatechange = () => { if (ac.state === 'running' && bg.want && !bg.on) bg.start(bg.want); };
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {} return ac;
  }
  async function buf(n) { const r = await fetch(url(n)); const b = await r.arrayBuffer(); return await new Promise((res, rej) => ac.decodeAudioData(b, res, rej)); }
  function first(b, th) { const d = b.getChannelData(0), n = Math.min(d.length, b.sampleRate * 0.4); for (let i = 0; i < n; i++) if (Math.abs(d[i]) > th) return i / b.sampleRate; return 0; }
  async function load() { try { const [b, j] = await Promise.all([buf('sfx.mp3'), fetch(url('sfx.json')).then(r => r.json())]); sfx = b; SP = j; mark = first(b, 0.5); } catch (e) {} }
  const ok = () => { const a = A(); return a && a.state === 'running' ? a : null; };
  function smp(name, v = 1, rate = 1, delay = 0) {
    const a = ok(); if (!a || !sfx || !SP || !SP[name]) return;
    const L = SP[name], it = L[(Math.random() * L.length) | 0], s = a.createBufferSource(), g = a.createGain();
    s.buffer = sfx; s.playbackRate.value = rate; g.gain.value = v; s.connect(g); g.connect(bus); s.start(a.currentTime + delay, mark + it[0], it[1] + 0.02);
  }
  function tone(f, d, type = 'triangle', v = 0.07, delay = 0, f2, out) { const a = ok(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(out || bus); o.start(t); o.stop(t + d + 0.02); }
  function noise(d, v = 0.15, f = 1200, type = 'lowpass', delay = 0, f2) { const a = ok(); if (!a) return; const t = a.currentTime + delay, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.buffer = nbuf; s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, 0, d + 0.05); }
  const rr = (a, b) => a + Math.random() * (b - a);
  const FX = {
    ui() { tone(880, 0.05, 'square', 0.03); },
    place() { smp('wood', 0.35, rr(1.1, 1.3)); },
    start() { tone(70, 0.6, 'sine', 0.35, 0, 45); noise(0.4, 0.2, 300); tone(70, 0.6, 'sine', 0.3, 0.32, 45); },
    go() { tone(80, 0.5, 'sine', 0.4, 0, 40); noise(0.3, 0.25, 900, 'lowpass', 0, 200); },
    hit(v = 1) { smp('stone', 0.4 + v * 0.5, rr(0.85, 1.05)); tone(90, 0.25, 'sine', 0.18 * v, 0, 45); },
    crack(v = 1) { smp('rock', 0.6 + v * 0.4, rr(0.9, 1.1)); smp('stone', 0.4 * v, rr(0.8, 0.95), 0.01); tone(110, 0.3, 'sine', 0.2 * v, 0, 50); },
    break(v = 1) { smp('rock', 0.9, rr(0.75, 0.9)); smp('rock', 0.7, rr(1.0, 1.2), 0.05); smp('punch', 0.6, 0.8); noise(0.6, 0.25, 1500, 'lowpass', 0, 200); tone(60, 0.5, 'sine', 0.35, 0, 35); },
    wall(v = 1) { smp('wood', 0.3 + v * 0.4, rr(0.9, 1.1)); },
    win() { [587, 698, 880, 1175].forEach((f, i) => tone(f, 0.45, 'triangle', 0.08, i * 0.12)); smp('bell', 0.5, 1, 0.1); },
    draw() { [587, 587, 440].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, i * 0.15)); },
  };

  // ---------- 音楽（その場で鳴らす） ----------
  // 都節（みやこぶし）の音階：ミ ファ ラ シ ド
  const SC = [0, 1, 5, 7, 8];
  const hz = (deg, oct = 0) => { const n = SC.length, o = Math.floor(deg / n), k = ((deg % n) + n) % n; return 329.63 * Math.pow(2, (SC[k] + 12 * (o + oct)) / 12); };
  function koto(t, f, v) {   // 琴：三角波＋すぐ消える
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f * 2.003;
    const g2 = ac.createGain(); g2.gain.value = 0.08;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(mus);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }
  function shami(t, f, v) {   // 三味線ふう：のこぎり波を細い帯に
    const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    fl.type = 'bandpass'; fl.frequency.value = f * 3; fl.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(fl); fl.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.36);
  }
  function don(t, v) {   // 太鼓
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.32);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.52);
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g2 = ac.createGain(); fl.type = 'lowpass'; fl.frequency.value = 260;
    g2.gain.setValueAtTime(v * 0.7, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.buffer = nbuf; s.connect(fl); fl.connect(g2); g2.connect(mus); s.start(t, Math.random() * 0.5, 0.2);
  }
  function ka(t, v) {   // ふちを打つ音
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'bandpass'; fl.frequency.value = 2600; fl.Q.value = 2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.buffer = nbuf; s.connect(fl); fl.connect(g); g.connect(mus); s.start(t, Math.random() * 0.5, 0.06);
  }
  // 曲：16分音符ごとの譜面
  const SONG = {
    title: { bpm: 76, len: 64, step(i, t, d) {
      const mel = [4, null, 3, null, 2, null, null, null, 1, null, 2, null, 0, null, null, null, 2, null, 3, null, 4, null, 6, null, 5, null, null, 4, 3, null, null, null];
      const m = mel[i % 32]; if (m != null && i % 2 === 0) koto(t, hz(m), 0.16);
      if (i % 16 === 0) { koto(t, hz(0, -1), 0.12); koto(t + d * 0.5, hz(2, -1), 0.06); }
      if (i % 32 === 24) koto(t, hz(-3, 0), 0.07);
      if (i % 16 === 8) don(t, 0.18);
    } },
    battle: { bpm: 150, len: 64, step(i, t, d) {
      const b = i % 16;
      if (b === 0 || b === 6 || b === 10) don(t, b === 0 ? 0.55 : 0.4);
      if (b === 4 || b === 12) ka(t, 0.22);
      if (b === 14 || b === 15) ka(t, 0.12);
      const riff = [0, null, 2, 3, null, 4, 3, null, 2, null, 1, 0, null, -1, 0, null];
      const r2 = [5, null, 4, 3, null, 4, 5, null, 7, null, 6, 5, null, 4, 3, null];
      const ph = Math.floor(i / 16) % 4, m = (ph === 3 ? r2 : riff)[b];
      if (m != null) shami(t, hz(m + (ph === 2 ? 2 : 0)), 0.2);
      if (i % 32 === 0) koto(t, hz(0, -1), 0.14);
    } },
  };
  const bg = {
    want: null, on: null, timer: null, next: 0, i: 0, g: null,
    start(k) {
      this.want = k; const a = ok(); if (!a) return; if (this.on === k) return;
      this.stop(); this.want = k; this.on = k; this.i = 0; this.next = a.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 60); this.tick();
    },
    tick() {
      if (!ac || !this.on) return; const S = SONG[this.on], d = 60 / S.bpm / 4;
      if (this.next < ac.currentTime - 1) this.next = ac.currentTime + 0.05;   // 画面が止まっていたとき
      while (this.next < ac.currentTime + 0.3) { try { S.step(this.i, this.next, d); } catch (e) {} this.i++; this.next += d; }
    },
    stop() { clearInterval(this.timer); this.timer = null; this.on = null; },
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) bg.stop(); else if (bg.want) bg.start(bg.want); });
  OK.S = {
    unlock() { A(); if (bg.want) bg.start(bg.want); },
    play(k, v) { if (FX[k]) FX[k](v == null ? 1 : v); },
    bgm(k) { bg.want = k === 'battle' ? 'battle' : 'title'; bg.start(bg.want); },
  };
  OK.mute = v => { if (v != null) { muted = v; try { localStorage.setItem('ok_mute', v ? '1' : '0'); } catch (e) {} if (master) master.gain.value = v ? 0 : 1; } return muted; };
  window.addEventListener('pointerdown', () => OK.S.unlock(), { once: false, passive: true });
})();
