// الاحتفال بالدرجات العالية (٨ من ١٠ فأعلى) والتحفيز لما دونها

export const HIGH = [
  'ما شاء الله تبارك الله! تلاوة متقنة تسرّ القلب.',
  'أحسنت يا بطل! أنت من أهل القرآن بإذن الله، فواصل.',
  'بارك الله فيك وفي والديك، هذا إتقان يُفتخر به.',
  'رفع الله قدرك بالقرآن كما رفعت صوتك به.',
  'ممتاز! حفظك ثابت كالجبل، زادك الله نوراً وتوفيقاً.',
  'تلاوة رائعة! هكذا يكون حامل القرآن.',
];
export const HIGH_HADITH = [
  { text: 'خيركم من تعلّم القرآن وعلّمه', src: 'رواه البخاري' },
  { text: 'يُقال لصاحب القرآن: اقرأ وارتقِ ورتّل كما كنت ترتّل في الدنيا، فإن منزلك عند آخر آية تقرؤها', src: 'رواه أبو داود والترمذي' },
];
export const LOW = [
  'كل محاولة تقرّبك من الإتقان، وأنت على الطريق الصحيح.',
  'لا تستسلم! أنت قريب جداً من الإتقان، والمحاولة القادمة أفضل بإذن الله.',
  'الحفظ يثبت بالتكرار، وأنت تبني شيئاً عظيماً آية بعد آية.',
  'اجتهادك مأجور عليه، والإتقان قادم بإذن الله.',
];
export const LOW_HADITH = { text: 'الماهر بالقرآن مع السفرة الكرام البررة، والذي يقرأ القرآن ويتتعتع فيه وهو عليه شاق له أجران', src: 'متفق عليه' };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const pickHigh = () => ({ phrase: pick(HIGH), hadith: pick(HIGH_HADITH) });
export const pickLow = () => ({ phrase: pick(LOW), hadith: LOW_HADITH });

/** قصاصات احتفال تتساقط على الشاشة لثلاث ثوانٍ (لا تعمل إن طلب الجهاز تقليل الحركة) */
export function confetti(duration = 3200) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  resize();
  const colors = ['#0d5c46', '#1f8a3c', '#d9b45a', '#a77a1c', '#f3e7c6', '#4cc09a'];
  const N = Math.min(180, Math.round(innerWidth / 6));
  const parts = Array.from({ length: N }, () => ({
    x: Math.random() * cv.width,
    y: -Math.random() * cv.height * 0.6,
    w: (6 + Math.random() * 8) * dpr,
    h: (8 + Math.random() * 10) * dpr,
    vx: (Math.random() - 0.5) * 2.4 * dpr,
    vy: (2.5 + Math.random() * 3.5) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.25,
    c: colors[Math.floor(Math.random() * colors.length)],
    star: Math.random() < 0.25,
  }));
  const t0 = performance.now();
  const star = (r) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  const frame = (t) => {
    const el = t - t0;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const fade = el > duration - 600 ? Math.max(0, (duration - el) / 600) : 1;
    ctx.globalAlpha = fade;
    parts.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.03 * dpr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.star) star(p.w * 0.9); else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (el < duration) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}
