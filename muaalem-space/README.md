---
title: Fateh Maqraa Tajweed
emoji: 📖
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
license: other
license_name: quran-muaalem-license-qml-1.0
license_link: LICENSE
---

# خادم تحليل التجويد - مقرأة الفاتح

> **تنبيه:** هذا المعلّم القرآني نموذج ذكاء اصطناعي قد يخطئ؛ فهو للإعانة فقط ولا يُعتمد عليه، وليس بديلاً عن معلّمٍ مُتقِنٍ مُجاز؛ لأنّ القرآن لا يُؤخذ إلا بالمشافهة.
>
> This Quranic Teacher is an artificial-intelligence model that may make mistakes. It is intended for assistance only and must not be relied upon. It is not a replacement for a proficient, authorized teacher, because the Quran is only received through oral transmission (mushafahah).

يستقبل تسجيل التلاوة ونطاق الآيات، ويشغّل نموذج [المعلّم القرآني](https://github.com/obadx/quran-muaalem) لاستخراج الرسم الصوتي، ثم يقارنه بالمرجع ويعيد أخطاء الحروف والحركات وأحكام التجويد (المدود والقلقلة والغنة) لكل كلمة.

## الواجهة

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/health` | حالة الخادم وجاهزية النموذج |
| POST | `/analyze` | `file` (صوت) و`surah` و`start` و`end` ← يعيد رقم مهمة |
| GET | `/jobs/{id}` | حالة المهمة ونتيجتها |

أي واجهة تُبنى على هذا الخادم يجب أن تعرض التنبيه أعلاه للمستخدم قبل أول استخدام وتبقيه متاحاً (الترخيص QML، القسم 2.1).

## الإعدادات (Settings ← Variables and secrets)

- `ALLOWED_ORIGINS`: المواقع المسموح لها بالاتصال (الافتراضي: `https://m3naji-droid.github.io`).
- `HF_TOKEN` (سرّي، اختياري): مطلوب فقط إن طلب النموذج قبول شروطه قبل التحميل.
- `MAX_SECONDS`: أقصى طول للتسجيل بالثواني (الافتراضي 300).

## الترخيص

النموذج ومكتبتا `quran-muaalem` و`quran-transcript` من مشروع المعلّم القرآني، ومرخّصة بـ Quran Muaalem License (QML) 1.0. راجع `LICENSE` و`NOTICE`.
