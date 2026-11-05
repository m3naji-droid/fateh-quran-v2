"""خادم إشعارات مقرأة الفاتح (Google Cloud Run).

- /send      : يرسل تنبيهاً محفوظاً (notifs/{id} لصف، أو roster/{طالب}/notifs/{id}) إلى أجهزة أصحابه.
- /announce  : ينشر إعلاناً كتبه المعلم (announcements/{id}) في جرس الطلاب ويرسله إلى جوالاتهم.
- /feedback  : الطالب يرسل ملاحظة (رأيك يهمنا) فيصل تنبيهها إلى أجهزة المعلم.
- /cron      : يستدعيه Cloud Scheduler كل ١٠ دقائق: الإعلانات المجدولة، وتذكيرات الواجبات.
نص الإشعار يُقرأ دائماً من قاعدة البيانات لا من الطلب، فلا يستطيع أحد إرسال نص من عنده.
"""
from __future__ import annotations

import datetime as dt
import hmac
import os
from zoneinfo import ZoneInfo

import firebase_admin
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth, firestore, messaging
from pydantic import BaseModel

PROJECT = os.environ.get("FIREBASE_PROJECT", "quran-c16c8")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "https://m3naji-droid.github.io,http://localhost:8000,http://127.0.0.1:8000"
).split(",") if o.strip()]
CRON_SECRET = os.environ.get("CRON_SECRET", "")
TZ = ZoneInfo(os.environ.get("SCHOOL_TZ", "Asia/Riyadh"))

firebase_admin.initialize_app(options={"projectId": PROJECT})
db = firestore.client()

app = FastAPI(title="Fateh Maqraa - Notifications")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

# رموز الأجهزة التي لم تعد صالحة (حُذف التطبيق أو أُلغي الإذن) نحذفها
DEAD = (messaging.UnregisteredError, messaging.SenderIdMismatchError)
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]


def now_iso() -> str:
    """نفس صيغة toISOString في المتصفح، ليقارن الموقع التواريخ نصياً."""
    t = dt.datetime.now(dt.timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def where(q, field, op, value):
    return q.where(filter=firestore.FieldFilter(field, op, value))


def teacher_uid(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "سجّل الدخول كمعلم.")
    try:
        claims = auth.verify_id_token(authorization[7:])
    except Exception:
        raise HTTPException(401, "انتهت جلسة الدخول. حدّث الصفحة ثم أعد المحاولة.")
    uid = claims["uid"]
    if not db.collection("teachers").document(uid).get().exists:
        raise HTTPException(403, "هذا الحساب ليس حساب معلم.")
    return uid


# ------------------------------------------------------------ الإرسال
def tokens_for(class_id: str | None = None, students: list[str] | None = None) -> list:
    """أجهزة الطلاب: لطلاب بأعينهم، أو لصف، أو للجميع."""
    base = where(db.collection("pushTokens"), "role", "==", "student")
    if students is not None:
        out = []
        ids = sorted(set(students))
        for i in range(0, len(ids), 30):  # حد «in» في Firestore
            out += list(where(base, "studentId", "in", ids[i:i + 30]).stream())
        return out
    if class_id and class_id != "all":
        base = where(base, "classId", "==", class_id)
    return list(base.stream())


def push(docs: list, n: dict, kind: str | None = None, defer: bool = True) -> dict:
    """يرسل إلى الأجهزة. في أوقات الهدوء تُؤجَّل إشعارات الطلاب إلى الصباح، ويُحترم ما أوقفه الطالب من أنواع."""
    data = {k: str(n.get(k) or "") for k in ("title", "body", "link", "tag")}
    if kind:
        docs = [d for d in docs if kind not in (d.get("mute") or [])]
    deferred = 0
    if defer and quiet(dt.datetime.now(TZ)):
        later = [d for d in docs if d.get("role") == "student"]
        if later:
            db.collection("deferred").document().set({"tokens": [d.reference.path for d in later], "data": data, "at": now_iso()})
            deferred = len(later)
            docs = [d for d in docs if d.get("role") != "student"]
    sent = failed = removed = 0
    for i in range(0, len(docs), 500):
        chunk = docs[i:i + 500]
        msgs = [messaging.Message(
            token=d.get("token"),
            data=data,
            webpush=messaging.WebpushConfig(headers={"Urgency": "high", "TTL": str(3 * 24 * 3600)}),
        ) for d in chunk]
        res = messaging.send_each(msgs)
        for d, r in zip(chunk, res.responses):
            if r.success:
                sent += 1
            else:
                failed += 1
                if isinstance(r.exception, DEAD):
                    d.reference.delete()
                    removed += 1
    return {"sent": sent, "failed": failed, "removed": removed, "deferred": deferred}


def add(stats: dict, r: dict) -> dict:
    return {k: stats.get(k, 0) + r.get(k, 0) for k in ("sent", "failed", "removed", "deferred")}


def flush_deferred() -> int:
    """بعد انتهاء أوقات الهدوء: يرسل الإشعارات المؤجلة."""
    n = 0
    for d in db.collection("deferred").stream():
        x = d.to_dict()
        toks = [s for s in (db.document(p).get() for p in x.get("tokens", [])) if s.exists]
        if toks:
            n += push(toks, x.get("data") or {}, defer=False)["sent"]
        d.reference.delete()
    return n


def notif_ref(notif: str, student: str | None):
    if student:
        return db.collection("roster").document(student).collection("notifs").document(notif)
    return db.collection("notifs").document(notif)


# ------------------------------------------------------------ الإعلانات
def publish_announcement(aid: str) -> dict:
    """ينشئ تنبيهات الإعلان في جرس الطلاب ويرسل الإشعارات. يعمل مرة واحدة لكل إعلان."""
    ref = db.collection("announcements").document(aid)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "الإعلان غير موجود.")
    a = snap.to_dict()
    if a.get("status") == "sent":
        return {"sent": 0, "failed": 0, "removed": 0, "already": True}
    img = bool(a.get("hasImage"))
    n = {
        "type": "ann", "annId": aid, "hasImage": img,
        "title": "📢 " + (a.get("title") or "إعلان من معلمك"),
        "body": a.get("body", ""),
        "link": "./#/student/ann/" + aid, "tag": "ann-" + aid,
        "createdAt": now_iso(),
    }
    # إشعار الجوال لا يعرض الصورة، فننبّه إلى وجودها في النص
    pn_ = {**n, "title": n["title"] + " 📷", "body": n["body"] + "\n📷 مع صورة، افتح الإعلان لتراها."} if img else n
    t = a.get("target") or {"type": "all"}
    paths, stats = [], {"sent": 0, "failed": 0, "removed": 0}
    if t.get("type") == "student" and t.get("studentId"):
        pn = t["studentId"]
        r = db.collection("roster").document(pn).collection("notifs").document("ann-" + aid)
        r.set({**n, "studentId": pn})
        paths.append(r.path)
        stats = push(tokens_for(students=[pn]), pn_)
    else:
        classes = ["all"] if t.get("type") != "classes" else (t.get("classIds") or [])
        for cid in classes:
            r = db.collection("notifs").document(f"ann-{aid}-{cid}")
            r.set({**n, "classId": cid})
            paths.append(r.path)
            stats = add(stats, push(tokens_for(class_id=cid), pn_))
    ref.update({"status": "sent", "sentAt": n["createdAt"], "notifPaths": paths, "push": stats})
    return stats


def resend_announcement(aid: str, students: list[str]) -> dict:
    a = db.collection("announcements").document(aid).get()
    if not a.exists:
        raise HTTPException(404, "الإعلان غير موجود.")
    a = a.to_dict()
    n = {"title": "📢 تذكير: " + (a.get("title") or "إعلان من معلمك") + (" 📷" if a.get("hasImage") else ""), "body": a.get("body", ""),
         "link": "./#/student/ann/" + aid, "tag": "ann-" + aid}
    return push(tokens_for(students=students), n) if students else {"sent": 0, "failed": 0, "removed": 0}


# ------------------------------------------------------------ تذكيرات الواجبات
def students_of(class_id: str) -> list[str]:
    q = db.collection("roster") if class_id in (None, "", "all") else where(db.collection("roster"), "classId", "==", class_id)
    return [d.id for d in q.stream()]


def submitted(pn: str, task_id: str) -> bool:
    subs = db.collection("roster").document(pn).collection("subs")
    return any(True for _ in where(subs, "taskId", "==", task_id).limit(1).stream())


def day_label(due: str) -> str:
    try:
        d = dt.date.fromisoformat(due)
        return f"{DAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}".translate(AR_DIGITS)
    except Exception:
        return due


def notify_cfg() -> dict:
    c = db.collection("settings").document("notify").get()
    return c.to_dict() if c.exists else {}


def run_reminders(local: dt.datetime, cfg: dict | None = None) -> list[dict]:
    """تذكير مساء اليوم السابق لموعد التسليم، في الوقت الذي يضبطه المعلم."""
    cfg = notify_cfg() if cfg is None else cfg
    eve = cfg.get("eveTime", "19:00")
    if local.strftime("%H:%M") < eve:
        return []
    tomorrow = (local.date() + dt.timedelta(days=1)).isoformat()
    done = []
    for d in where(db.collection("tasks"), "remindEve", "==", True).stream():
        t = d.to_dict()
        if t.get("due") != tomorrow or (t.get("remindSent") or {}).get("eve") == t.get("due"):
            continue
        cid = t.get("classId") or "all"
        title = t.get("title") or "واجب"
        link = "./#/student/task/" + d.id
        stats = {"sent": 0, "failed": 0, "removed": 0}
        if t.get("remindTarget") == "all":
            n = {"type": "remind", "taskId": d.id, "title": f"⏰ تذكير: واجب «{title}» غداً",
                 "body": f"موعد التسليم {day_label(t['due'])}. لا تؤجّل، وتدرّب قبل التسجيل.",
                 "link": link, "tag": "remind-" + d.id, "createdAt": now_iso(), "classId": cid}
            db.collection("notifs").document(f"remind-{d.id}").set(n)
            stats = push(tokens_for(class_id=cid), n)
            count = len(students_of(cid))
        else:
            pending = [pn for pn in students_of(cid) if not submitted(pn, d.id)]
            n = {"type": "remind", "taskId": d.id, "title": f"⏰ تذكير: واجب «{title}» غداً",
                 "body": f"لم تسلّمه بعد. موعد التسليم {day_label(t['due'])}، فلا تؤجّل.",
                 "link": link, "tag": "remind-" + d.id, "createdAt": now_iso()}
            for pn in pending:
                db.collection("roster").document(pn).collection("notifs").document(f"remind-{d.id}").set({**n, "studentId": pn})
            if pending:
                stats = push(tokens_for(students=pending), n)
            count = len(pending)
        d.reference.update({"remindSent": {"eve": t["due"], "at": now_iso(), "students": count, **stats}})
        done.append({"task": d.id, "students": count, **stats})
    return done


# ------------------------------------------------------------ حافظ على سلسلتك
def active_days(pn: str, since: str) -> set[str]:
    days = set()
    for d in where(db.collection("roster").document(pn).collection("activity"), "d", ">=", since).stream():
        days.add(d.get("d"))
    return days


def run_streaks(local: dt.datetime, cfg: dict) -> dict | None:
    """مرة يومياً في الساعة التي يختارها المعلم: يحسب سلسلة كل طالب، ويذكّر من له يومان فأكثر ولم ينشط اليوم."""
    at = cfg.get("streakTime", "12:00")
    today = local.date().isoformat()
    state_ref = db.collection("settings").document("streak")
    state = state_ref.get()
    if at == "off" or local.strftime("%H:%M") < at or (state.exists and state.to_dict().get("day") == today):
        return None
    yesterday = (local.date() - dt.timedelta(days=1)).isoformat()
    since = (local.date() - dt.timedelta(days=60)).isoformat()
    reminded = []
    for st in db.collection("roster").stream():
        pn = st.id
        days = active_days(pn, since)
        # أيام التسليمات تُحسب أيضاً (ومنها ما سبق سجل النشاط)
        for sub in st.reference.collection("subs").stream():
            c = sub.get("createdAt")
            try:
                days.add(dt.datetime.fromisoformat(str(c).replace("Z", "+00:00")).astimezone(TZ).date().isoformat())
            except Exception:
                pass
        n, d = 0, (local.date() if today in days else local.date() - dt.timedelta(days=1))
        while d.isoformat() in days:
            n += 1
            d -= dt.timedelta(days=1)
        st.reference.update({"streak": {"days": n, "on": today if today in days else yesterday, "at": now_iso()}})
        if today not in days and n >= 2:
            reminded.append((pn, n))
    stats = {"sent": 0, "failed": 0, "removed": 0}
    for pn, n in reminded:
        unit = "يومان" if n == 2 else f"{n} أيام".translate(AR_DIGITS) if n <= 10 else f"{n} يوماً".translate(AR_DIGITS)
        nt = {"type": "streak", "title": "🔥 حافظ على سلسلتك",
              "body": f"لديك {unit} متتالية مع القرآن. سمّع أو تدرّب دقيقة واحدة اليوم حتى لا تنقطع!",
              "link": "./#/student/practice", "tag": "streak-" + today, "createdAt": now_iso(), "studentId": pn}
        db.collection("roster").document(pn).collection("notifs").document("streak-" + today).set(nt)
        stats = add(stats, push(tokens_for(students=[pn]), nt, kind="streak"))
    state_ref.set({"day": today, "reminded": len(reminded), **stats, "at": now_iso()})
    return {"reminded": len(reminded), **stats}


# ------------------------------------------------------------ لوحة الشرف
def num(v) -> str:
    v = round(float(v or 0), 1)
    return (str(int(v)) if v == int(v) else str(v).replace(".", "٫")).translate(AR_DIGITS)


def run_board(local: dt.datetime, cfg: dict) -> dict | None:
    """مرة يومياً: يقارن ترتيب اليوم بترتيب الأمس، ويرسل لكل طالب إشعاراً واحداً على الأكثر بأهم تقدّم له."""
    at = cfg.get("boardTime", "20:30")
    today = local.date().isoformat()
    snap_ref = db.collection("settings").document("boardSnap")
    snap = snap_ref.get()
    snap = snap.to_dict() if snap.exists else {}
    if at == "off" or local.strftime("%H:%M") < at or snap.get("day") == today:
        return None
    board = db.collection("leaderboard").document("main").get()
    board = board.to_dict() if board.exists else {}
    month = board.get("month") or {}
    ym = month.get("ym")
    classes = [c.get("id") for c in (month.get("classes") or []) if (c.get("score") or 0) > 0]
    class_pos = {cid: i + 1 for i, cid in enumerate(classes)}
    roster = list(db.collection("roster").stream())
    cur = {}
    for st in roster:
        r = ((st.to_dict() or {}).get("rank") or {}).get("month") or {}
        cur[st.id] = {"cls": r.get("cls"), "stage": r.get("stage"), "points": r.get("points", 0), "classId": st.get("classId")}
    new_snap = {"day": today, "ym": ym, "students": {k: {"cls": v["cls"], "stage": v["stage"]} for k, v in cur.items()}, "classes": class_pos, "at": now_iso()}
    # شهر جديد أو أول تشغيل: نحفظ الترتيب فقط، حتى لا يصل للجميع «دخلت الخمسة الأوائل» في أول يوم
    if not ym or snap.get("ym") != ym:
        snap_ref.set(new_snap)
        return {"baseline": True}
    prev, prev_cls = snap.get("students") or {}, snap.get("classes") or {}
    improved = {cid: p for cid, p in class_pos.items() if p < (prev_cls.get(cid) or 99)}
    sent = []
    for pn, c in cur.items():
        p = prev.get(pn) or {}
        was = lambda k, top: (p.get(k) or 99) <= top
        n = None
        if c["stage"] == 1 and not was("stage", 1):
            n = ("👑 أنت الآن شيخ المرحلة!", f"تصدّرت كل صفوف المرحلة هذا الشهر بـ{num(c['points'])} نقطة. حافظ على مكانك!")
        elif c["cls"] == 1 and not was("cls", 1):
            n = ("🏆 أنت الآن قارئ الصف!", f"المركز الأول في صفك هذا الشهر بـ{num(c['points'])} نقطة. واصل يا بطل!")
        elif c["stage"] and c["stage"] <= 5 and not was("stage", 5):
            n = ("🌟 دخلت الخمسة الأوائل على المرحلة", f"أنت في المركز {num(c['stage'])} على المرحلة كلها هذا الشهر. خطوة نحو القمة!")
        elif c["cls"] and c["cls"] <= 5 and not was("cls", 5):
            n = ("🎉 دخلت الخمسة الأوائل في صفك", f"أنت في المركز {num(c['cls'])} في صفك هذا الشهر. واصل لتصل إلى الأول!")
        elif c["classId"] in improved:
            pos = improved[c["classId"]]
            n = ("🏁 صفك يتصدّر تحدي الصفوف!" if pos == 1 else "🏁 صفك تقدّم في تحدي الصفوف",
                 "كل واجب منك يرفع صفك، فحافظوا على الصدارة!" if pos == 1 else f"صعد صفك إلى المركز {num(pos)} هذا الشهر. كل واجب منك يرفعه أكثر!")
        if n:
            sent.append((pn, n))
    stats = {"sent": 0, "failed": 0, "removed": 0}
    toks = {}
    for t in tokens_for(students=[pn for pn, _ in sent]) if sent else []:
        toks.setdefault(t.get("studentId"), []).append(t)
    for pn, (title, body) in sent:
        nt = {"type": "board", "title": title, "body": body, "link": "./#/student/honor", "tag": "board-" + today, "createdAt": now_iso(), "studentId": pn}
        db.collection("roster").document(pn).collection("notifs").document("board-" + today).set(nt)
        if toks.get(pn):
            stats = add(stats, push(toks[pn], nt, kind="board"))
    snap_ref.set(new_snap)
    return {"notified": len(sent), **stats}


# ------------------------------------------------------------ إشعارات المعلم
QUIET = (os.environ.get("QUIET_FROM", "22:00"), os.environ.get("QUIET_TO", "06:00"))
AI_INSTANCE = (float(os.environ.get("AI_VCPU", "2")), float(os.environ.get("AI_GIB", "8")))
DB_QUOTA = 1024 ** 3


def quiet(local: dt.datetime) -> bool:
    t = local.strftime("%H:%M")
    a, b = QUIET
    return (t >= a or t < b) if a > b else (a <= t < b)


def teacher_tokens() -> list:
    return list(where(db.collection("pushTokens"), "role", "==", "teacher").stream())


def to_teachers(title: str, body: str, tag: str, link: str = "./#/teacher") -> dict:
    toks = teacher_tokens()
    return push(toks, {"title": title, "body": body, "tag": tag, "link": link}, defer=False) if toks else {"sent": 0, "failed": 0, "removed": 0}


def run_teacher(local: dt.datetime) -> dict | None:
    """كل ساعة (خارج أوقات الهدوء): ملخّص التسليمات الجديدة، والإعادات التي وصلت، وتنبيهات الاستهلاك."""
    if quiet(local):
        return None
    st_ref = db.collection("settings").document("teacherDigest")
    st = st_ref.get()
    st = st.to_dict() if st.exists else {}
    now = now_iso()
    last = st.get("lastAt")
    if last and (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(last.replace("Z", "+00:00"))) < dt.timedelta(minutes=55):
        return None
    out = {"subs": 0, "retakes": 0}
    if last:
        by_class, retakes, feedbacks, total = {}, [], [], 0
        names = {}
        for r in db.collection("roster").stream():
            names[r.id] = (r.get("name"), r.get("classId"))
            for sub in where(r.reference.collection("subs"), "createdAt", ">", last).stream():
                x = sub.to_dict()
                if x.get("teacher"):
                    continue
                total += 1
                cname = x.get("className") or ""
                by_class[cname] = by_class.get(cname, 0) + 1
                if x.get("retakeId"):
                    retakes.append(x)
            for fb in where(r.reference.collection("feedback"), "createdAt", ">", last).stream():
                fx = fb.to_dict()
                if not fx.get("notified") and not fx.get("seen"):
                    feedbacks.append((fx, fb.reference))
        if total:
            word = "تسليم جديد" if total == 1 else "تسليمان جديدان" if total == 2 else f"{num(total)} تسليمات جديدة" if total <= 10 else f"{num(total)} تسليماً جديداً"
            detail = " · ".join(f"{k or 'بلا صف'}: {num(v)}" for k, v in sorted(by_class.items()))
            to_teachers(f"📥 {'وصلت' if 3 <= total <= 10 else 'وصل'} {word} بانتظار تقييمك", detail, "digest-" + now[:13], "./#/teacher")
        for x in retakes[:10]:
            rng = f"{x.get('taskTitle') or ''}".strip()
            to_teachers("🔁 وصلت إعادة طلبتها", f"أعاد {x.get('studentName') or 'طالب'} تسميع «{rng}» كما طلبت. استمع وقيّم.", "retake-" + str(x.get("retakeId")))
        for fx, ref in feedbacks[:10]:  # ملاحظات وصلت في أوقات الهدوء أو تعذّر تنبيهها فوراً
            feedback_push(fx, ref)
        out = {"subs": total, "retakes": len(retakes), "feedback": len(feedbacks)}
    # تنبيهات الاستهلاك: مرة واحدة لكل عتبة
    alerts = st.get("alerts") or {}
    try:
        ym = local.strftime("%Y-%m")
        u = db.collection("usage").document("ai-" + ym).get()
        if u.exists:
            d = u.to_dict()
            free = min(180000 / AI_INSTANCE[0], 360000 / AI_INSTANCE[1])
            pct = ((d.get("billed_seconds") or 0) + (d.get("startup_seconds") or 0)) / free
            lvl = 90 if pct >= 0.9 else 70 if pct >= 0.7 else 0
            if lvl and alerts.get("ai-" + ym, 0) < lvl:
                to_teachers(f"⚠️ خادم التجويد: استُهلك {num(round(pct * 100))}٪ من الحصة المجانية",
                            "تفاصيل الاستهلاك في لوحة المعلم ← الإعدادات. لإيقاف التحليل مؤقتاً اجعل أقصى عدد للنسخ صفراً في Cloud Run.", "usage-ai")
                alerts["ai-" + ym] = lvl
        if alerts.get("dbDay") != local.date().isoformat():  # المساحة: فحص واحد يومياً
            alerts["dbDay"] = local.date().isoformat()
            total, students = 200 * 1024, 0
            for r in db.collection("roster").stream():
                students += 1
                for sub in r.reference.collection("subs").stream():
                    x = sub.to_dict()
                    total += len(str(x)) + 300 + (x.get("audioBytes") or (int((x.get("duration") or 30) * 3400) if x.get("hasAudio") else 0))
            total += students * 1500
            for im in db.collection("annImages").stream():
                total += len(im.to_dict().get("b64") or "") + 200
            pct = total / DB_QUOTA
            lvl = 90 if pct >= 0.9 else 70 if pct >= 0.7 else 0
            if lvl > alerts.get("db", 0):
                to_teachers(f"⚠️ مساحة قاعدة البيانات: {num(round(pct * 100))}٪ من ١ GB",
                            "احذف التسجيلات القديمة من لوحة المعلم ← الإعدادات ← مساحة قاعدة البيانات. تبقى الدرجات كما هي.", "usage-db")
            alerts["db"] = lvl  # إن نزلت المساحة بعد التنظيف يعود التنبيه للعمل
    except Exception as e:
        out["usageError"] = str(e)[:200]
    st_ref.set({"lastAt": now, "alerts": alerts, **out})
    return out


# ------------------------------------------------------------ الواجهات
class SendReq(BaseModel):
    notif: str
    student: str | None = None  # تنبيه خاص بطالب واحد (roster/{student}/notifs/{notif})


class BatchReq(BaseModel):
    items: list[dict]  # [{"notif": id, "student": pn}] تنبيهات خاصة بطلاب (مثل نتائج الشهر)


class FeedbackReq(BaseModel):
    student: str
    feedback: str


FB_KINDS = {"comment": "💬 تعليق", "complaint": "⚠️ شكوى", "suggest": "💡 اقتراح", "note": "📝 ملاحظة"}


def feedback_push(x: dict, ref) -> dict:
    kind = FB_KINDS.get(x.get("kind"), "💬 ملاحظة")
    text = (x.get("text") or "").strip().replace("\n", " ")
    who = x.get("name") or "طالب"
    cls = f" ({x['className']})" if x.get("className") else ""
    r = to_teachers(f"{kind} جديد من {who}{cls}" if x.get("kind") in ("comment", "suggest") else f"{kind} جديدة من {who}{cls}",
                    text[:140] + ("…" if len(text) > 140 else ""), "fb-" + ref.id, "./#/teacher/feedback")
    ref.update({"notified": True})
    return r


class AnnReq(BaseModel):
    ann: str
    resend: list[str] | None = None  # إعادة الإشعار لهؤلاء الطلاب فقط (من لم يقرأ)


@app.get("/")
@app.get("/health")
def health():
    return {"ok": True, "project": PROJECT, "cron": bool(CRON_SECRET)}


@app.post("/send")
def send(req: SendReq, authorization: str | None = Header(None)):
    teacher_uid(authorization)
    ref = notif_ref(req.notif, req.student)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "التنبيه غير موجود.")
    n = snap.to_dict()
    if n.get("pushedAt"):
        return {"sent": 0, "failed": 0, "removed": 0, "already": True}
    docs = tokens_for(students=[req.student]) if req.student else tokens_for(class_id=n.get("classId", "all"))
    r = push(docs, n) if docs else {"sent": 0, "failed": 0, "removed": 0}
    ref.update({"pushedAt": firestore.SERVER_TIMESTAMP, "push": r})
    return r


@app.post("/send-batch")
def send_batch(req: BatchReq, authorization: str | None = Header(None)):
    teacher_uid(authorization)
    items = [i for i in req.items if i.get("notif") and i.get("student")][:1000]
    toks = {}
    for t in tokens_for(students=[i["student"] for i in items]) if items else []:
        toks.setdefault(t.get("studentId"), []).append(t)
    stats = {"sent": 0, "failed": 0, "removed": 0}
    for i in items:
        ref = notif_ref(i["notif"], i["student"])
        snap = ref.get()
        if not snap.exists or snap.to_dict().get("pushedAt"):
            continue
        r = push(toks.get(i["student"], []), snap.to_dict()) if toks.get(i["student"]) else {"sent": 0, "failed": 0, "removed": 0}
        ref.update({"pushedAt": firestore.SERVER_TIMESTAMP, "push": r})
        stats = add(stats, r)
    return stats


@app.post("/feedback")
def feedback(req: FeedbackReq, authorization: str | None = Header(None)):
    """يتحقق أن المرسل هو صاحب الملاحظة نفسه، ثم يرسل تنبيهها للمعلم مرة واحدة فقط."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "سجّل الدخول.")
    try:
        uid = auth.verify_id_token(authorization[7:])["uid"]
    except Exception:
        raise HTTPException(401, "انتهت جلسة الدخول.")
    r = db.collection("roster").document(req.student).get()
    if not r.exists or r.to_dict().get("uid") != uid:
        raise HTTPException(403, "غير مسموح.")
    ref = r.reference.collection("feedback").document(req.feedback)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "الملاحظة غير موجودة.")
    x = snap.to_dict()
    if x.get("notified"):
        return {"sent": 0, "already": True}
    if quiet(dt.datetime.now(TZ)):
        return {"sent": 0, "deferred": True}  # يرسلها ملخّص المعلم بعد الساعة ٦ صباحاً
    return feedback_push(x, ref)


@app.post("/announce")
def announce(req: AnnReq, authorization: str | None = Header(None)):
    teacher_uid(authorization)
    if req.resend is not None:
        return resend_announcement(req.ann, req.resend)
    return publish_announcement(req.ann)


@app.post("/cron")
def cron(x_cron_secret: str | None = Header(None)):
    if not CRON_SECRET or not x_cron_secret or not hmac.compare_digest(x_cron_secret, CRON_SECRET):
        raise HTTPException(403, "غير مسموح.")
    now = now_iso()
    anns = []
    for d in where(db.collection("announcements"), "status", "==", "scheduled").stream():
        if (d.to_dict().get("sendAt") or "9999") <= now:
            try:
                anns.append({"ann": d.id, **publish_announcement(d.id)})
            except Exception as e:  # إعلان واحد معطوب لا يوقف الباقي
                anns.append({"ann": d.id, "error": str(e)[:200]})
    local, cfg = dt.datetime.now(TZ), notify_cfg()
    flushed = 0
    if not quiet(local):
        try:
            flushed = flush_deferred()
        except Exception as e:
            print("flush error", e, flush=True)
    reminders = run_reminders(local, cfg)
    try:
        streaks = run_streaks(local, cfg)
    except Exception as e:
        streaks = {"error": str(e)[:200]}
    try:
        board = run_board(local, cfg)
    except Exception as e:
        board = {"error": str(e)[:200]}
    try:
        teacher = run_teacher(local)
    except Exception as e:
        teacher = {"error": str(e)[:200]}
    db.collection("settings").document("cron").set({"lastRun": now, "announcements": len(anns), "reminders": len(reminders)})
    return {"announcements": anns, "reminders": reminders, "streaks": streaks, "board": board, "teacher": teacher, "deferredSent": flushed}
