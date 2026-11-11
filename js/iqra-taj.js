// التجريد على طريقة «اقرأ وارتقِ»: تُبنى الكلمة حرفاً حرفاً، اسم الحرف ثم اسم حركته فيخرج صوته،
// ويُضم إلى ما قبله: «فاء فتحة = فَ، راء فتحة = رَ ← فَرَ، ضاد فتحة = ضَ ← فَرَضَ».
// الساكن: «ميم ساكنة = أَمْ». المشدد يُنطق مرتين: «شين شدّة = يَشْ، شين فتحة = شَ ← يَشَّ».
// المد: «كاف فتحة ألف = كَا». والحرف الذي لا يُنطق (ألف الوصل في الدرج، واللام الشمسية…) يُنبَّه عليه.
import { NAMES } from './iqra-data.js';
import { MARK_NAMES as M } from './iqra-audio.js';

const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SHADDA = 'ّ';
const TF = 'ً', TD = 'ٌ', TK = 'ٍ', DAGGER = 'ٰ', MADDA = 'ٓ';
const MARK = /[ً-ٰٕۖ-ۭ]/;
const HAMZA = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ']);

const nameOf = (c) => (HAMZA.has(c) ? NAMES['ء'] : c === 'ة' ? 'تَاءْ مَرْبُوطَة' : c === 'ى' ? NAMES['ي'] : NAMES[c] || c);
const harakaName = (m) => (m.includes(TF) ? M.tf : m.includes(TD) ? M.td : m.includes(TK) ? M.tk : m.includes(FATHA) ? M.fatha : m.includes(KASRA) ? M.kasra : m.includes(DAMMA) ? M.damma : '');
const vowelOf = (m) => (m.includes(FATHA) || m.includes(TF) ? FATHA : m.includes(KASRA) || m.includes(TK) ? KASRA : m.includes(DAMMA) || m.includes(TD) ? DAMMA : '');

/** وحدات الكلمة: الحرف مع علاماته، ومكانه في النص */
function units(word) {
  const out = []; let pos = 0;
  for (const ch of word) {
    if (ch === 'ـ') { pos += ch.length; continue; }
    if (MARK.test(ch) && out.length) out[out.length - 1].m += ch;
    else out.push({ c: ch, m: '', at: pos });
    pos += ch.length;
    if (out.length) out[out.length - 1].end = pos;
  }
  return out;
}

/**
 * خطوات التجريد لنص (كلمة أو أكثر).
 * كل خطوة: { at, end (موضع الحرف في النص), say: [أسماء تُنطق], syl: صوت الخطوة, cum: ما بُني حتى الآن, silent, note }
 */
export function tajSteps(text) {
  const t = String(text).normalize('NFC').trim();
  const steps = [];
  let base = 0;
  t.split(' ').forEach((w, wi) => {
    const U = units(w);
    let built = ''; // ما بُني من هذه الكلمة (نصاً)
    for (let i = 0; i < U.length; i++) {
      const u = U[i], prev = steps[steps.length - 1];
      const at = base + u.at, end = base + u.end;
      const seg = w.slice(u.at, u.end);
      const pv = U[i - 1] ? vowelOf(U[i - 1].m) : '';
      const sameWordPrev = prev && prev.wi === wi;
      // همزة الوصل
      if (u.c === 'ٱ') {
        if (wi === 0 && i === 0) { const v = U[i + 1]?.c === 'ل' ? FATHA : U[i + 2] && U[i + 2].m.includes(DAMMA) ? DAMMA : KASRA; steps.push({ wi, at, end, say: [M.wasl, harakaName(v)], syl: 'أ' + v, cum: built + seg, note: 'همزة الوصل تُنطق في أول الكلام' }); built += seg; }
        else { steps.push({ wi, at, end, silent: true, note: 'همزة الوصل لا تُنطق في وسط الكلام', cum: built + seg }); built += seg; }
        continue;
      }
      // حروف المد بعد حركتها: تُضمّ إلى الخطوة السابقة «كاف فتحة ألف = كَا»
      const bare = !u.m || u.m === MADDA;
      if (bare && sameWordPrev && !prev.silent && ((u.c === 'ا' && pv === FATHA && !U[i - 1].m.includes(TF)) || (u.c === 'و' && pv === DAMMA) || (u.c === 'ي' && pv === KASRA) || (u.c === 'ى' && (pv === FATHA || pv === KASRA)))) {
        prev.say.push(u.c === 'ى' && pv === FATHA ? M.maqsura : nameOf(u.c));
        if (u.m === MADDA) prev.say.push(M.madda);
        prev.syl += seg; prev.end = end; built += seg; prev.cum = built;
        continue;
      }
      // حرف لا يُنطق: ألف بعد تنوين الفتح، أو ألف فارقة «۟»، أو لام شمسية، أو حرف بلا علامة
      if (u.m.includes('۟') || u.m.includes('۠') || (bare && (u.c === 'ا' || u.c === 'ى' || u.c === 'و' || (u.c === 'ل' && U[i + 1]?.m.includes(SHADDA))))) {
        steps.push({ wi, at, end, silent: true, note: u.c === 'ل' ? 'اللام الشمسية لا تُنطق' : 'حرف لا يُنطق', cum: built + seg });
        built += seg;
        continue;
      }
      const name = nameOf(u.c);
      const v = vowelOf(u.m);
      const smallMadd = u.m.includes('ۥ') ? M.swaw : (u.m.includes('ۦ') || u.m.includes('ۧ')) ? M.syaa : u.m.includes(DAGGER) ? M.dagger : '';
      if (u.m.includes(SHADDA)) {
        // المشدد حرفان: الأول ساكن مع ما قبله، والثاني متحرك
        steps.push({ wi, at, end, say: [name, M.shadda], syl: '', cum: built + u.c + SUKUN, note: 'المشدد يُنطق مرتين: ساكناً ثم متحركاً' });
        built += seg;
        const say = [name, harakaName(u.m)]; if (smallMadd) say.push(smallMadd); if (u.m.includes(MADDA)) say.push(M.madda);
        steps.push({ wi, at, end, say, syl: u.c + (v || '') + (u.m.includes(TF) ? 'ا' : ''), cum: built, also: true });
        continue;
      }
      if (!v) {
        // ساكن (مرسوم أو غير مرسوم)
        steps.push({ wi, at, end, say: [name, M.sukun], syl: '', cum: built + seg });
        built += seg;
        continue;
      }
      const say = [name, harakaName(u.m)];
      if (smallMadd) say.push(smallMadd);
      if (u.m.includes(MADDA)) say.push(M.madda);
      const sylBase = (HAMZA.has(u.c) ? (v === KASRA ? 'إ' : 'أ') : u.c === 'ة' ? 'ت' : u.c) + (u.m.match(/[ً-ِ]/)?.[0] || '');
      built += seg;
      steps.push({ wi, at, end, say, syl: sylBase + (u.m.includes(TF) ? 'ا' : '') + (u.m.includes(DAGGER) ? 'ا' : smallMadd === M.swaw ? 'و' : smallMadd === M.syaa ? 'ي' : ''), cum: built });
    }
    base += w.length + 1;
  });
  return steps;
}

/** هل في النص ما يستحق التجريد (أكثر من حرف منطوق)؟ */
export const worthTaj = (text) => tajSteps(text).filter((s) => !s.silent).length >= 1;
