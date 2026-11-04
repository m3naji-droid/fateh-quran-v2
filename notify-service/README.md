# خادم الإشعارات (Cloud Run)

خادم صغير يرسل إشعارات الجوال للطلاب عبر Firebase Cloud Messaging. يبدأ في أقل من ثانية ولا يحتاج ذاكرة كبيرة.

| الإعداد | القيمة |
|---|---|
| مصدر البناء | هذا المستودع، فرع `main`، ملف `/notify-service/Dockerfile` |
| فلتر الملفات في المشغّل | `notify-service/**` |
| المنطقة | `europe-west1` |
| الدخول | السماح بالوصول العام (الخادم يتحقق بنفسه أن المرسل معلم) |
| الفوترة | حسب الطلب (Request-based) |
| الذاكرة / المعالج | 512 MiB / 1 |
| عدد النسخ | الأدنى 0، الأقصى 1 |
| متغيرات البيئة | `FIREBASE_PROJECT=quran-c16c8` و `ALLOWED_ORIGINS=https://m3naji-droid.github.io` |

ثم في `js/firebase-config.js`:
- `PUSH.vapidKey`: من Firebase ← إعدادات المشروع ← Cloud Messaging ← Web Push certificates ← Generate key pair.
- `PUSH.url`: رابط هذه الخدمة.

## كيف يعمل
1. ينشئ المعلم واجباً، فيحفظ الموقع تنبيهاً في `notifs/{id}` (يظهر فوراً في جرس الطالب).
2. يطلب الموقع `POST /send {notif}` مع رمز دخول المعلم.
3. يقرأ الخادم التنبيه من قاعدة البيانات، ويرسله إلى أجهزة طلاب الصف في `pushTokens`، ويحذف رموز الأجهزة غير الصالحة.
