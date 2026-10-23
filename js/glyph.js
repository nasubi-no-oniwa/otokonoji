// =============================================
//  漢ノ字  字の画（ストローク）を読みこむ
//  ・漢字・かな：data/g/{番号}.json（j＝日本の字形 KanjiVG、c＝中国・台湾の字形 Make Me a Hanzi）
//  ・英字・数字：同じファイルの l（Hershey）
//  ・ハングル：部品（字母）の画をここで組み合わせて作る
//  座標は 0〜1000 の箱（y は下向き）。画は中心線の折れ線 [x,y,x,y,...]
// =============================================
(function (G) {
  const OK = G.OK = G.JM = G.OK || G.JM || {};
  const GL = OK.GL = {};
  let meta = null; const chunks = {};
  GL.url = name => (OK.ASSETS && OK.ASSETS[name]) || ('data/' + name);
  async function getJSON(name) {
    if (OK.DATA && OK.DATA[name]) return OK.DATA[name];
    const r = await fetch(GL.url(name)); if (!r.ok) throw new Error('読みこめませんでした'); return r.json();
  }
  GL.meta = async () => meta || (meta = await getJSON('gmeta.json?v=' + (OK.VER || 1)));
  // 入力をそろえる：全角英数字→半角、1文字だけ取り出す
  GL.first = function (s) {
    s = String(s || '').normalize('NFKC').replace(/\s+/g, '');
    const it = s[Symbol.iterator]().next(); return it.done ? '' : it.value;
  };
  GL.kind = function (ch) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xAC00 && cp <= 0xD7A3) return 'h';
    if (cp >= 0x3131 && cp <= 0x3163) return 'h';
    if (cp >= 33 && cp <= 126) return 'l';
    return 'x';
  };
  // その字の画を探す。{ forms: { j?, c?, l?, h? } } か null
  GL.get = async function (ch) {
    if (!ch) return null;
    const k = GL.kind(ch);
    if (k === 'h') { const s = hangul(ch); return s ? { ch, forms: { h: s } } : null; }
    const m = await GL.meta(), key = (ch.codePointAt(0) >> 10).toString(16);
    if (!m.chunks.includes(key)) return null;
    if (!chunks[key]) chunks[key] = getJSON('g/' + key + '.json?v=' + (OK.VER || 1));
    const pack = await chunks[key];
    const e = pack[ch]; if (!e) return null;
    return { ch, forms: e };
  };
  // 字形の名前
  GL.FORM = { j: '日本の字形', c: '中国・台湾の字形', l: '英字', h: 'ハングル' };
  GL.formsOf = g => ['j', 'c', 'l', 'h'].filter(k => g.forms[k]);

  // ---------- ハングル ----------
  // 字母の画（0〜100 の箱）
  const circ = (cx, cy, r) => { const o = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; o.push(cx + Math.round(Math.sin(a) * r * 100) / 100, cy - Math.round(Math.cos(a) * r * 100) / 100); } return o; };
  const C = {
    'ㄱ': [[10, 15, 85, 15, 85, 92]],
    'ㄴ': [[15, 8, 15, 85, 92, 85]],
    'ㄷ': [[15, 15, 85, 15], [15, 15, 15, 85, 90, 85]],
    'ㄹ': [[12, 12, 85, 12, 85, 48], [15, 48, 85, 48], [15, 48, 15, 88, 90, 88]],
    'ㅁ': [[15, 12, 15, 88], [15, 12, 85, 12, 85, 88], [15, 88, 85, 88]],
    'ㅂ': [[18, 8, 18, 90], [82, 8, 82, 90], [18, 48, 82, 48], [18, 90, 82, 90]],
    'ㅅ': [[52, 8, 42, 50, 10, 92], [48, 46, 72, 72, 94, 92]],
    'ㅇ': [circ(50, 50, 40)],
    'ㅈ': [[12, 14, 88, 14], [56, 14, 42, 55, 10, 92], [50, 48, 72, 72, 94, 92]],
    'ㅊ': [[42, 0, 62, 8], [12, 26, 88, 26], [56, 26, 42, 62, 10, 94], [50, 58, 72, 78, 94, 94]],
    'ㅋ': [[10, 15, 85, 15, 85, 92], [12, 52, 85, 52]],
    'ㅌ': [[15, 12, 85, 12], [15, 48, 80, 48], [15, 12, 15, 88, 90, 88]],
    'ㅍ': [[8, 12, 92, 12], [33, 12, 30, 88], [67, 12, 70, 88], [6, 88, 94, 88]],
    'ㅎ': [[40, 0, 62, 8], [10, 26, 90, 26], circ(50, 66, 26)],
  };
  // 2つならぶもの（左右）
  const PAIR = { 'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ', 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  const VV = {   // たての母音（0〜100）
    'ㅏ': [[35, 0, 35, 100], [35, 48, 78, 48]],
    'ㅐ': [[22, 0, 22, 100], [22, 48, 52, 48], [72, 0, 72, 100]],
    'ㅑ': [[35, 0, 35, 100], [35, 34, 78, 34], [35, 64, 78, 64]],
    'ㅒ': [[22, 0, 22, 100], [22, 34, 52, 34], [22, 64, 52, 64], [72, 0, 72, 100]],
    'ㅓ': [[22, 48, 65, 48], [65, 0, 65, 100]],
    'ㅔ': [[8, 48, 40, 48], [40, 0, 40, 100], [78, 0, 78, 100]],
    'ㅕ': [[22, 34, 65, 34], [22, 64, 65, 64], [65, 0, 65, 100]],
    'ㅖ': [[8, 34, 40, 34], [8, 64, 40, 64], [40, 0, 40, 100], [78, 0, 78, 100]],
    'ㅣ': [[50, 0, 50, 100]],
  };
  const HV = {   // よこの母音
    'ㅗ': [[50, 18, 50, 62], [0, 62, 100, 62]],
    'ㅛ': [[34, 18, 34, 62], [66, 18, 66, 62], [0, 62, 100, 62]],
    'ㅜ': [[0, 38, 100, 38], [50, 38, 50, 88]],
    'ㅠ': [[0, 38, 100, 38], [34, 38, 34, 88], [66, 38, 66, 88]],
    'ㅡ': [[0, 50, 100, 50]],
  };
  const MIX = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
  const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', T = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  // 0〜100 の画を箱 [x0,y0,x1,y1]（0〜1000）に入れる
  const fit = (strokes, b) => strokes.map(s => { const o = []; for (let i = 0; i < s.length; i += 2) o.push(Math.round(b[0] + s[i] / 100 * (b[2] - b[0])), Math.round(b[1] + s[i + 1] / 100 * (b[3] - b[1]))); return o; });
  function cons(j, b) {
    if (C[j]) return fit(C[j], b);
    const p = PAIR[j]; if (!p) return [];
    const mid = (b[0] + b[2]) / 2, gap = (b[2] - b[0]) * 0.04;
    return cons(p[0], [b[0], b[1], mid - gap, b[3]]).concat(cons(p[1], [mid + gap, b[1], b[2], b[3]]));
  }
  function hangul(ch) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x3131 && cp <= 0x3163) {   // 字母だけ
      const B = [120, 120, 880, 880];
      if (C[ch] || PAIR[ch]) return cons(ch, B);
      if (VV[ch]) return fit(VV[ch], [250, 60, 750, 940]);
      if (HV[ch]) return fit(HV[ch], [60, 250, 940, 750]);
      if (MIX[ch]) return fit(HV[MIX[ch][0]], [60, 250, 640, 750]).concat(fit(VV[MIX[ch][1]], [640, 60, 940, 940]));
      return null;
    }
    const s = cp - 0xAC00, li = Math.floor(s / 588), vi = Math.floor((s % 588) / 28), ti = s % 28;
    const l = L[li], v = V[vi], t = T[ti].trim();
    let out = [];
    if (VV[v]) {
      if (!t) out = cons(l, [80, 120, 560, 880]).concat(fit(VV[v], [600, 60, 930, 940]));
      else out = cons(l, [80, 80, 560, 500]).concat(fit(VV[v], [600, 40, 930, 600]), cons(t, [170, 630, 830, 950]));
    } else if (HV[v]) {
      if (!t) out = cons(l, [230, 70, 770, 470]).concat(fit(HV[v], [80, 500, 920, 920]));
      else out = cons(l, [250, 50, 750, 340]).concat(fit(HV[v], [80, 360, 920, 620]), cons(t, [190, 650, 810, 960]));
    } else {
      const m = MIX[v];
      if (!t) out = cons(l, [80, 80, 540, 440]).concat(fit(HV[m[0]], [60, 470, 690, 900]), fit(VV[m[1]], [690, 40, 950, 960]));
      else out = cons(l, [80, 50, 540, 320]).concat(fit(HV[m[0]], [60, 330, 690, 610]), fit(VV[m[1]], [690, 30, 950, 640]), cons(t, [170, 670, 830, 960]));
    }
    return out;
  }
  GL.hangul = hangul;
})(typeof window !== 'undefined' ? window : globalThis);
