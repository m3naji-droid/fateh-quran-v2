// محرك المطابقة: محاذاة عامة (Needleman–Wunsch) بين كلمات المصحف وكلمات التلاوة المتعرَّف عليها
// يدعم: كلمة صحيحة / خطأ في النطق / كلمة محذوفة / كلمة زائدة / كلمتان التصقتا أو كلمة انقسمت
import { normalize } from './quran.js';

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // تجاهل الفروق الإملائية الشائعة في مخرجات التعرف على الكلام
  const sa = a.replace(/ا/g, ''), sb = b.replace(/ا/g, '');
  if (sa && sa === sb) return 0.95;
  const ea = a.replace(/[اي]$/, 'ا'), eb = b.replace(/[اي]$/, 'ا');
  if (ea === eb) return 0.95;
  // رسم المصحف يخالف الإملاء في آخر الكلمة المهموزة والمقصورة: رءا/رأى، نبؤا/نبأ، هوى، أوى
  const ta = a.replace(/[اويى]+$/, ''), tb = b.replace(/[اويى]+$/, '');
  if (ta.length >= 2 && ta === tb) return 0.9;
  // اللام المدغمة واللام المكررة (الّٰئي/اللائي)
  const la = a.replace(/لل/g, 'ل').replace(/ي+/g, 'ي'), lb = b.replace(/لل/g, 'ل').replace(/ي+/g, 'ي');
  if (la.length >= 3 && la === lb) return 0.9;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

const OK = 0.72; // عتبة الكلمة الصحيحة
const NEAR = 0.4; // عتبة الكلمة القريبة (خطأ نطق)

const ISTI = ['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم'].map(normalize);
const BASM = ['بسم', 'الله', 'الرحمن', 'الرحيم'].map(normalize);

/** كم كلمة من بداية التلاوة تطابق عبارة (الاستعاذة أو البسملة) بالترتيب؛ يُحتمل سقوط كلمة واحدة من التعرف */
function phraseLen(spoken, at, phrase) {
  let j = 0, k = at, hit = 0, skips = 0;
  while (j < phrase.length && k < spoken.length) {
    if (similarity(phrase[j], spoken[k]) >= 0.8) { hit++; j++; k++; }
    else if (skips < 1 && j + 1 < phrase.length && similarity(phrase[j + 1], spoken[k]) >= 0.8) { skips++; j++; }
    else break;
  }
  const first = at < spoken.length && (similarity(phrase[0], spoken[at]) >= 0.8 || similarity(phrase[1], spoken[at]) >= 0.8);
  return first && hit >= Math.max(2, phrase.length - 1) ? k - at : 0;
}

/**
 * حذف الاستعاذة والبسملة من بداية التلاوة إن لم تكن جزءاً من المقطع.
 * تُحذف العبارة كاملة فقط، فلا تُحذف كلمة مفردة مثل «من» أو «الله» تبدأ بها الآية.
 */
export function stripPrefix(spoken, expected) {
  const E = expected.map((w) => w.norm);
  const startsWith = (ph) => E.length >= 2 && similarity(E[0], ph[0]) >= 0.8 && similarity(E[1], ph[1]) >= 0.8;
  let i = 0;
  for (let round = 0; round < 3; round++) {
    let n = 0;
    if (!startsWith(ISTI)) n = phraseLen(spoken, i, ISTI);
    if (!n && !startsWith(BASM)) n = phraseLen(spoken, i, BASM);
    if (!n) break;
    i += n;
  }
  return spoken.slice(i);
}

export function tokenize(transcript) {
  return transcript.split(/\s+/).map(normalize).filter(Boolean);
}

/**
 * محاذاة كلمات المقطع مع كلمات التلاوة.
 * partial=true: التلاوة ما زالت جارية، فالكلمات بعد آخر موضع وصل إليه القارئ تُعدّ "لم تُقرأ بعد" لا "محذوفة".
 */
export function align(expected, transcript, { partial = false } = {}) {
  let spoken = Array.isArray(transcript) ? transcript : tokenize(transcript);
  spoken = stripPrefix(spoken, expected);
  const E = expected.map((w) => w.norm);
  const m = E.length, n = spoken.length;
  const INF = 1e9;
  const D = Array.from({ length: m + 1 }, () => new Float64Array(n + 1).fill(INF));
  const B = Array.from({ length: m + 1 }, () => new Int8Array(n + 1));
  const GAP_E = 1.0; // كلمة محذوفة
  const GAP_S = 0.75; // كلمة زائدة (غالباً ضجيج من التعرف)
  const subCost = (s) => (s >= OK ? (1 - s) * 0.5 : s >= NEAR ? 0.55 + (OK - s) : 2.2);
  D[0][0] = 0;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const d = D[i][j];
      if (d >= INF) continue;
      if (i < m && j < n) {
        const c = d + subCost(similarity(E[i], spoken[j]));
        if (c < D[i + 1][j + 1]) { D[i + 1][j + 1] = c; B[i + 1][j + 1] = 1; }
      }
      if (i < m) {
        const c = d + GAP_E;
        if (c < D[i + 1][j]) { D[i + 1][j] = c; B[i + 1][j] = 2; }
      }
      if (j < n) {
        const c = d + GAP_S;
        if (c < D[i][j + 1]) { D[i][j + 1] = c; B[i][j + 1] = 3; }
      }
      // كلمتان منطوقتان = كلمة واحدة في المصحف (يٰقوم -> يا قوم)
      if (i < m && j + 1 < n) {
        const s = similarity(E[i], spoken[j] + spoken[j + 1]);
        if (s >= OK) {
          const c = d + (1 - s) * 0.5 + 0.05;
          if (c < D[i + 1][j + 2]) { D[i + 1][j + 2] = c; B[i + 1][j + 2] = 4; }
        }
      }
      // كلمة منطوقة واحدة = كلمتان في المصحف (التصاق)
      if (i + 1 < m && j < n) {
        const s = similarity(E[i] + E[i + 1], spoken[j]);
        if (s >= OK) {
          const c = d + (1 - s) * 0.5 + 0.05;
          if (c < D[i + 2][j + 1]) { D[i + 2][j + 1] = c; B[i + 2][j + 1] = 5; }
        }
      }
    }
  }

  // نقطة النهاية: في الوضع الجزئي نختار أفضل موضع وصل إليه القارئ
  let endI = m;
  if (partial) {
    let best = INF;
    for (let i = 0; i <= m; i++) {
      // تكلفة تقريبية للكلمات المتبقية = 0 لأنها لم تُقرأ بعد
      if (D[i][n] < best - 1e-9) { best = D[i][n]; endI = i; }
    }
  }

  const status = new Array(m).fill(partial ? 'pending' : 'missing');
  const heard = new Array(m).fill('');
  const extras = [];
  let i = endI, j = n;
  while (i > 0 || j > 0) {
    const b = B[i][j];
    if (b === 1) {
      const s = similarity(E[i - 1], spoken[j - 1]);
      status[i - 1] = s >= OK ? 'correct' : s >= NEAR ? 'wrong' : 'missing';
      heard[i - 1] = spoken[j - 1];
      if (s < NEAR) extras.push({ before: i - 1, word: spoken[j - 1] });
      i--; j--;
    } else if (b === 2) {
      status[i - 1] = 'missing';
      i--;
    } else if (b === 3) {
      extras.push({ before: i, word: spoken[j - 1] });
      j--;
    } else if (b === 4) {
      status[i - 1] = 'correct';
      heard[i - 1] = spoken[j - 2] + ' ' + spoken[j - 1];
      i--; j -= 2;
    } else if (b === 5) {
      status[i - 1] = status[i - 2] = 'correct';
      heard[i - 1] = heard[i - 2] = spoken[j - 1];
      i -= 2; j--;
    } else break;
  }
  extras.reverse();

  const counts = { correct: 0, wrong: 0, missing: 0, pending: 0 };
  status.forEach((s) => counts[s]++);
  const done = m - counts.pending;
  return { status, heard, extras, counts, position: endI, total: m, done, spokenCount: n };
}

/** تحويل نتيجة المحاذاة إلى درجات صادقة دون حدود دنيا مصطنعة */
export function score(result, durationSec = 0, expected = []) {
  const { counts, total, extras } = result;
  const accuracy = total ? (counts.correct + 0.4 * counts.wrong) / total : 0;
  const extrasPenalty = Math.min(0.15, (extras.length / Math.max(1, total)) * 0.3);
  const memorization = Math.max(0, accuracy - extrasPenalty);
  const wpm = durationSec > 0 ? (result.spokenCount / durationSec) * 60 : 0;
  // مرجع تقريبي لسرعة الترتيل: 60-110 كلمة في الدقيقة
  let pace = 'مناسبة';
  if (wpm && wpm < 35) pace = 'بطيئة جداً';
  else if (wpm > 140) pace = 'سريعة جداً - تمهّل وأعطِ الحروف حقها';
  const percent = Math.round(memorization * 100);
  let grade = 'تحتاج إلى مراجعة';
  if (percent >= 95) grade = 'ممتاز';
  else if (percent >= 85) grade = 'جيد جداً';
  else if (percent >= 70) grade = 'جيد';
  else if (percent >= 50) grade = 'مقبول';
  return {
    percent,
    outOf10: Math.round(memorization * 100) / 10,
    grade,
    wpm: Math.round(wpm),
    pace,
  };
}
