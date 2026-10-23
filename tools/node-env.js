// node でゲームの js を動かすための準備（glyph はファイルから直接読む）
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function (root) {
  globalThis.window = undefined;
  const load = f => vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), { filename: f });
  globalThis.fetch = async (u) => {
    const p = path.join(root, 'data', String(u).replace(/^data\//, '').replace(/\?.*$/, ''));
    const t = fs.readFileSync(p, 'utf8');
    return { ok: true, json: async () => JSON.parse(t) };
  };
  for (const f of ['glyph.js', 'shape.js', 'sim.js']) load(f);
  if (fs.existsSync(path.join(root, 'js', 'pct.js'))) load('pct.js');
  return globalThis.OK;
};
