"""خادم إشعارات مقرأة الفاتح (Google Cloud Run).

يستقبل من المعلم معرّف تنبيه محفوظ في Firestore (notifs/{id})، فيرسله إشعاراً
إلى أجهزة طلاب الصف المسجلة في pushTokens عبر Firebase Cloud Messaging.
نص الإشعار يُقرأ من قاعدة البيانات لا من الطلب، فلا يستطيع أحد إرسال نص من عنده.
"""
from __future__ import annotations

import os

import firebase_admin
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth, firestore, messaging
from pydantic import BaseModel

PROJECT = os.environ.get("FIREBASE_PROJECT", "quran-c16c8")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "https://m3naji-droid.github.io,http://localhost:8000,http://127.0.0.1:8000"
).split(",") if o.strip()]

firebase_admin.initialize_app(options={"projectId": PROJECT})
db = firestore.client()

app = FastAPI(title="Fateh Maqraa - Notifications")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

# رموز الأجهزة التي لم تعد صالحة (حُذف التطبيق أو أُلغي الإذن) نحذفها
DEAD = (messaging.UnregisteredError, messaging.SenderIdMismatchError)


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


def targets(class_id: str) -> list:
    q = db.collection("pushTokens").where(filter=firestore.FieldFilter("role", "==", "student"))
    if class_id and class_id != "all":
        q = q.where(filter=firestore.FieldFilter("classId", "==", class_id))
    return list(q.stream())


def send_to(docs: list, n: dict) -> dict:
    data = {k: str(n.get(k) or "") for k in ("title", "body", "link", "tag")}
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
    return {"sent": sent, "failed": failed, "removed": removed}


class SendReq(BaseModel):
    notif: str


@app.get("/")
@app.get("/health")
def health():
    return {"ok": True, "project": PROJECT}


@app.post("/send")
def send(req: SendReq, authorization: str | None = Header(None)):
    teacher_uid(authorization)
    ref = db.collection("notifs").document(req.notif)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(404, "التنبيه غير موجود.")
    n = snap.to_dict()
    if n.get("pushedAt"):
        return {"sent": 0, "failed": 0, "removed": 0, "already": True}
    docs = targets(n.get("classId", "all"))
    r = send_to(docs, n) if docs else {"sent": 0, "failed": 0, "removed": 0}
    ref.update({"pushedAt": firestore.SERVER_TIMESTAMP, "push": r})
    return r
