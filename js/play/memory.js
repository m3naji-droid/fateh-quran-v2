// 🧩 بطاقات الذاكرة: اقلب بطاقتين، فإذا تطابقتا ظهر سؤال: الصحيح يثبّت الزوج ذهبياً، والخطأ يعيدهما مقلوبتين.
// البطاقات من جداول «معنى المفردات» في الدرس (الكلمة ومعناها)، وتُكمَّل برموز إن قلّت.
import { createGame, ar } from './kit.js';

const K = createGame();
export const stop = () => K.stop();
export const pause = (p) => K.pause(p);
const EMO = ['🕌', '📖', '🌙', '⭐', '🕋', '🤲', '🌴', '🐪', '💧', '🌸'];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export function run(stage, api) {
  return new Promise((resolve) => {
    const g = K.boot(stage, '', { canvas: false });
    const Q = api.qs.length, esc = api.esc;
    const wrap = document.createElement('div'); wrap.className = 'mm';
    stage.append(wrap);
    let qi = 0, okN = 0, moves = 0, pairsDone = 0, open = [], busy = false, board = 0, cards = [];
    const hud = () => api.hud({ a: `🧩 ${ar(pairsDone)}`, b: `<span>سؤال ${ar(Math.min(qi + 1, Q))}/${ar(Q)}</span> <span>🔄 ${ar(moves)}</span>`, p: qi / Q });
    const deal = () => {
      board++;
      const text = shuffle(api.pairs || []).slice(0, 6).map((p, i) => [{ id: 't' + i, s: p[0], k: 'w' }, { id: 't' + i, s: p[1], k: 'm' }]);
      const emo = shuffle(EMO).slice(0, 6 - text.length).map((e, i) => [{ id: 'e' + i, s: e, k: 'e' }, { id: 'e' + i, s: e, k: 'e' }]);
      cards = shuffle([...text, ...emo].flat()).map((x) => ({ ...x, st: 'down' }));
      wrap.innerHTML = `${board > 1 ? '<p class="mm-new">✨ لوحة جديدة</p>' : '<p class="mm-new">اقلب بطاقتين متطابقتين: الكلمة ومعناها، أو الرمزين المتشابهين</p>'}<div class="mm-grid">${cards.map((x, i) => `<button type="button" class="mm-c" data-i="${i}" aria-label="بطاقة"><span class="mm-f mm-back">؟</span><span class="mm-f mm-front ${x.k}${x.s.length > 18 ? ' long' : ''}">${esc(x.s)}</span></button>`).join('')}</div>`;
      wrap.querySelectorAll('.mm-c').forEach((b) => g.on(b, 'click', () => flip(+b.dataset.i)));
      if (location.hostname === 'localhost') wrap.querySelectorAll('.mm-c').forEach((b) => (b._id = cards[+b.dataset.i].id));
      open = []; busy = false; hud();
    };
    const el = (i) => wrap.querySelector(`.mm-c[data-i="${i}"]`);
    const flip = (i) => {
      if (busy || g.paused) return;
      const x = cards[i]; if (!x || x.st !== 'down' || open.includes(i)) return;
      api.sfx.tap(); x.st = 'up'; el(i).classList.add('up'); open.push(i);
      if (open.length < 2) return;
      busy = true; moves++; hud();
      const [a, b] = open;
      if (cards[a].id !== cards[b].id) { setTimeout(() => { if (!K.G) return; [a, b].forEach((j) => { cards[j].st = 'down'; el(j).classList.remove('up'); }); open = []; busy = false; }, 850); return; }
      [a, b].forEach((j) => el(j).classList.add('match'));
      setTimeout(() => {
        if (!K.G) return;
        api.ask(api.qs[qi]).then((ok) => {
          if (!K.G) return;
          qi++;
          if (ok) { okN++; pairsDone++; [a, b].forEach((j) => { cards[j].st = 'done'; el(j).classList.add('done'); }); api.sfx.coin(); }
          else [a, b].forEach((j) => { cards[j].st = 'down'; el(j).classList.remove('up', 'match'); });
          open = []; busy = false; hud();
          if (qi >= Q) { setTimeout(() => { if (!K.G) return; api.sfx.win(); const out = { stats: [{ v: `🧩 ${ar(pairsDone)}`, l: 'أزواج ثبّتها' }, { v: `🔄 ${ar(moves)}`, l: 'محاولة قلب' }] }; K.stop(); resolve(out); }, 700); return; }
          if (cards.every((x) => x.st === 'done')) setTimeout(() => K.G && deal(), 600);
        });
      }, 500);
    };
    deal();
  });
}
