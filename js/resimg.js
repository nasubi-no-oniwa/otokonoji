// =============================================
//  漢ノ字  画像（SNSに貼る 1200×675）
//  ・結果画像：左に決着の一撃、右に勝ち名乗り（地元の最強と同じ作り）
//  ・挑戦状の画像：作った形を大きく、合言葉と強さ
// =============================================
(function () {
  const OK = window.OK, R = OK.R;
  const W = 1200, H = 675, LW = 700, RX = 935;
  const F_BIG = '"Dela Gothic One", sans-serif', F_FUDE = '"Yuji Syuku", serif', F_UI = '"M PLUS Rounded 1c", sans-serif';
  const sum = st => st.hp + st.atk + st.def + st.shp + st.spd;

  // 自慢の一言
  OK.resultTags = function (r, w0, w1) {
    const out = [];
    if (r.winner < 0) { if (r.endBy === 'time') out.push({ t: '時間切れ判定' }); return out; }
    const w = r.winner ? w1 : w0, l = r.winner ? w0 : w1, wr = r.winner ? r.rb : r.ra;
    if (sum(l.st) - sum(w.st) >= 40) out.push({ t: '下剋上！', gold: true });
    if (r.endBy === 'break' && r.hitN === 1) out.push({ t: '一撃！', gold: true });
    if (w.ch === l.ch) out.push({ t: '同じ字対決' });
    if (l.orig && !w.orig) out.push({ t: '元の字を超えた' });
    if (w.prep.length < l.prep.length - 8) out.push({ t: '画数の差をはね返した', gold: true });
    if (r.endBy === 'break' && wr < 0.45) out.push({ t: 'ギリギリの勝ち' });
    if (r.endBy === 'time') out.push({ t: '時間切れ判定' });
    return out.slice(0, 2);
  };
  OK.workName = w => '「' + w.ch + '」' + (w.orig ? '（元の字）' : '');

  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    const wait = Promise.all([
      document.fonts.load('400 80px "Dela Gothic One"', '漢ノ字勝ち'),
      document.fonts.load('400 60px "Yuji Syuku"', '勝負ありの勝ち！引き分け挑戦状'),
      document.fonts.load('800 20px "M PLUS Rounded 1c"', 'のこり破る合言葉'),
    ]);
    await Promise.race([wait, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  }
  function logo(c, x, y, size) {
    c.textAlign = 'left'; c.font = `400 ${size}px ${F_FUDE}`;
    c.lineWidth = 6; c.strokeStyle = 'rgba(15,11,8,.8)'; c.lineJoin = 'round';
    c.strokeText('漢ノ字', x, y); c.fillStyle = '#fff'; c.fillText('漢', x, y);
    const a = c.measureText('漢').width; c.fillStyle = '#e8462f'; c.fillText('ノ', x + a, y);
    c.fillStyle = '#fff'; c.fillText('字', x + a + c.measureText('ノ').width, y);
  }
  // 大きな字（作品の元の字）を、はんこのように
  function bigChar(c, ch, x, y, s, col) {
    c.save(); c.font = `400 ${s}px ${F_FUDE}, ${F_BIG}, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = Math.max(6, s * 0.08); c.strokeStyle = '#3a0c06'; c.strokeText(ch, x, y);
    const gr = c.createLinearGradient(0, y - s / 2, 0, y + s / 2); gr.addColorStop(0, '#fff6d8'); gr.addColorStop(1, col || '#ffcf3a'); c.fillStyle = gr; c.fillText(ch, x, y);
    c.restore();
  }

  // ---------- 結果画像 ----------
  // o：{ m, r, w:[w0,w1], chal, url }
  OK.drawResultImage = async function (cv, o) {
    await fontsReady();
    const c = cv.getContext('2d'), { m, r } = o, [w0, w1] = o.w;
    c.setTransform(1, 0, 0, 1, 0, 0); c.textBaseline = 'middle';
    c.fillStyle = '#120e0b'; c.fillRect(0, 0, W, H);
    const SNAP = 900;
    let snap = null; try { snap = R.snapshot(m, SNAP, r.endBy === 'break' ? r.lastEv : null); } catch (e) { snap = null; }
    const hx = r.endBy === 'break' && r.lastEv ? r.lastEv.x : (m.A.x + m.B.x) / 2, hy = r.endBy === 'break' && r.lastEv ? r.lastEv.y : (m.A.y + m.B.y) / 2;
    const zoom = 0.85, sw = LW / zoom, sh = H / zoom;
    let fx = LW / 2, fy = H / 2;
    c.save(); c.beginPath(); c.rect(0, 0, LW, H); c.clip();
    if (snap) {
      const sc = snap.sc;
      let sx = SNAP / 2 + hx * sc - sw / 2, sy = SNAP / 2 + hy * sc - sh / 2;
      sx = Math.max(0, Math.min(SNAP - sw, sx)); sy = Math.max(0, Math.min(SNAP - sh, sy));
      c.drawImage(snap, sx, sy, sw, sh, 0, 0, LW, H); R.free(snap);
      fx = (SNAP / 2 + hx * sc - sx) * zoom; fy = (SNAP / 2 + hy * sc - sy) * zoom;
    }
    if (r.winner >= 0) {
      c.save(); c.translate(fx, fy); c.globalAlpha = 0.16; c.fillStyle = '#fff';
      for (let i = 0; i < 72; i++) { const an = i / 72 * Math.PI * 2 + (i % 3) * 0.021, r0 = 240 + (i * 37 % 70); c.beginPath(); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an + 0.011) * 1000, Math.sin(an + 0.011) * 1000); c.lineTo(Math.cos(an - 0.011) * 1000, Math.sin(an - 0.011) * 1000); c.fill(); }
      c.restore();
    }
    const vg = c.createRadialGradient(fx, fy, 170, fx, fy, 600); vg.addColorStop(0, 'rgba(18,14,11,0)'); vg.addColorStop(1, 'rgba(18,14,11,.85)'); c.fillStyle = vg; c.fillRect(0, 0, LW, H);
    const fade = c.createLinearGradient(LW - 230, 0, LW, 0); fade.addColorStop(0, 'rgba(18,14,11,0)'); fade.addColorStop(1, 'rgba(18,14,11,1)'); c.fillStyle = fade; c.fillRect(LW - 230, 0, 230, H);
    c.restore();
    logo(c, 30, 46, 40);
    const draw = r.winner < 0, w = draw ? null : (r.winner ? w1 : w0), l = draw ? null : (r.winner ? w0 : w1);
    // 朱のはんこ
    c.save(); c.translate(1100, 92); c.rotate(0.12);
    c.fillStyle = draw ? '#6a5a4a' : '#c8281c'; c.beginPath(); c.arc(0, 0, 58, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f6eedb'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#f6eedb'; c.textAlign = 'center'; c.font = '400 34px ' + F_FUDE;
    if (draw) { c.fillText('痛み', 0, -16); c.fillText('分け', 0, 22); } else { c.fillText('勝負', 0, -16); c.fillText('あり', 0, 22); }
    c.restore();
    c.textAlign = 'center';
    if (draw) {
      c.font = '400 92px ' + F_FUDE; c.fillStyle = '#fff'; c.fillText('引き分け', RX, 230);
      bigChar(c, w0.ch, RX - 90, 350, 96, '#ff9a7a'); bigChar(c, w1.ch, RX + 90, 350, 96, '#9ac0ff');
      c.font = '400 40px ' + F_FUDE; c.fillStyle = '#d8c6a4'; c.fillText('と', RX, 352);
    } else {
      c.font = '800 22px ' + F_UI; c.fillStyle = '#d8c6a4';
      c.fillText(w.orig ? '元の字のまま' : '組み替えた「' + w.ch + '」', RX, 150);
      bigChar(c, w.ch, RX, 248, 150);
      c.font = '400 60px ' + F_FUDE; c.fillStyle = '#fff'; c.fillText('の勝ち！', RX, 350);
      c.font = '800 26px ' + F_UI; c.fillStyle = '#e9dcc0';
      c.fillText(OK.workName(l) + ' を破る', RX, 404);
    }
    const by = 462;
    const bar = (yy, wk, b, side) => {
      const x0 = RX - 210, bw = 420, p = Math.round(b.ratio() * 100);
      c.textAlign = 'left'; c.font = '800 20px ' + F_UI; c.fillStyle = '#efe4cc'; c.fillText(OK.workName(wk), x0, yy);
      c.textAlign = 'right'; c.font = '400 26px ' + F_BIG; c.fillStyle = side === r.winner ? '#ffcf3a' : '#a89c90'; c.fillText(p + '%', x0 + bw, yy);
      c.fillStyle = 'rgba(255,255,255,.13)'; c.fillRect(x0, yy + 18, bw, 10);
      c.fillStyle = R.COL[side].f; c.fillRect(x0, yy + 18, bw * Math.max(0, Math.min(1, b.ratio())), 10);
      c.fillStyle = '#fff'; c.fillRect(x0 + bw * OK.LOSE - 1, yy + 14, 2, 18);
    };
    bar(by, w0, m.A, 0); bar(by + 54, w1, m.B, 1);
    const tags = OK.resultTags(r, w0, w1).slice();
    if (o.chal) tags.push({ t: '挑戦状 ' + OK.Chal.fmt(o.chal.id) });
    let tx = RX - 210, ty = by + 98; c.textAlign = 'left'; c.font = '800 19px ' + F_UI;
    for (const gg of tags) {
      const tw = c.measureText(gg.t).width + 26; if (tx + tw > RX + 215) break;
      c.fillStyle = gg.gold ? '#ffcf3a' : 'rgba(255,255,255,.15)'; c.beginPath(); (c.roundRect ? c.roundRect(tx, ty, tw, 34, 17) : c.rect(tx, ty, tw, 34)); c.fill();
      c.fillStyle = gg.gold ? '#2a211b' : '#efe4cc'; c.fillText(gg.t, tx + 13, ty + 18); tx += tw + 9;
    }
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, H - 44, W, 44);
    c.font = '800 18px ' + F_UI; c.fillStyle = '#d8c6a4'; c.textAlign = 'left'; c.fillText('#オトコノジ #漢ノ字', 24, H - 22);
    c.textAlign = 'right'; c.fillText(o.url.replace('https://', '').replace(/\/$/, ''), W - 24, H - 22);
  };

  // ---------- 挑戦状の画像（作った形と合言葉） ----------
  OK.drawWorkImage = async function (cv, w, code, url) {
    await fontsReady();
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.textBaseline = 'middle';
    c.fillStyle = '#120e0b'; c.fillRect(0, 0, W, H);
    // 左：半紙に形
    const px = 40, py = 40, ps = H - 80;
    c.fillStyle = '#f6f0e1'; c.fillRect(px, py, ps, ps);
    c.strokeStyle = 'rgba(200,40,28,.2)'; c.lineWidth = 2; if (c.setLineDash) c.setLineDash([10, 10]);
    c.beginPath(); c.moveTo(px + ps / 2, py); c.lineTo(px + ps / 2, py + ps); c.moveTo(px, py + ps / 2); c.lineTo(px + ps, py + ps / 2); c.stroke(); if (c.setLineDash) c.setLineDash([]);
    c.strokeStyle = '#4a382a'; c.lineWidth = 4; c.strokeRect(px, py, ps, ps);
    R.shapeIcon(c, w.b.parts, px + ps / 2, py + ps / 2, ps * 0.82, 0, 0, { fill: '#1d1813', stroke: '#000', lw: 2 });
    // 元の字（小さく）
    c.fillStyle = 'rgba(200,40,28,.9)'; c.beginPath(); c.arc(px + ps - 50, py + 50, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = `400 40px ${F_FUDE}`; c.textAlign = 'center'; c.fillText(w.ch, px + ps - 50, py + 52);
    // 右
    const X = 900;
    logo(c, X - 120, 70, 54);
    c.textAlign = 'center'; c.fillStyle = '#d8c6a4'; c.font = '800 24px ' + F_UI;
    c.fillText(w.orig ? '元の字のまま' : '「' + w.ch + '」をばらして組み替えた', X, 140);
    c.font = '400 54px ' + F_FUDE; c.fillStyle = '#fff'; c.fillText('挑戦状', X, 200);
    c.font = '800 22px ' + F_UI; c.fillStyle = '#d8c6a4'; c.fillText('合言葉', X, 262);
    c.fillStyle = '#ffcf3a'; c.font = '400 70px ' + F_BIG; c.fillText(code ? OK.Chal.fmt(code) : '— — —', X, 318);
    // 強さ
    c.save(); R.radar(c, X - 110, 470, 82, OK.STATS.map(x => w.st[x.k]), null, { fs: 16, fill: 'rgba(217,69,46,.55)', stroke: '#ffcf3a', light: true });
    c.restore();
    c.font = '800 19px ' + F_UI; c.textAlign = 'left';
    OK.STATS.forEach((x, i) => { c.fillStyle = '#d8c6a4'; c.fillText(x.n, X + 30, 405 + i * 32); c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(String(w.st[x.k]), X + 170, 405 + i * 32); c.textAlign = 'left'; });
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, H - 44, W, 44);
    c.font = '800 18px ' + F_UI; c.fillStyle = '#d8c6a4'; c.textAlign = 'left'; c.fillText('#オトコノジ #漢ノ字', 24, H - 22);
    c.textAlign = 'right'; c.fillText(url.replace('https://', '').replace(/\/$/, ''), W - 24, H - 22);
  };
})();
