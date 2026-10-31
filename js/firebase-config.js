// إعدادات Firebase لمشروع quran-c16c8. لتشغيل المنصة محلياً فقط على جهاز واحد اجعل enabled: false
export const FIREBASE = {
  enabled: true,
  config: {
    apiKey: 'AIzaSyBPaasG5pKCw9r8YhFiwp9iyYfrvEvSny4',
    authDomain: 'quran-c16c8.firebaseapp.com',
    projectId: 'quran-c16c8',
    storageBucket: 'quran-c16c8.firebasestorage.app',
    messagingSenderId: '960354071194',
    appId: '1:960354071194:web:1a3388d1450144a3b32523',
  },
  // اتركه فارغاً لاستخدام قاعدة البيانات الافتراضية "(default)"
  databaseId: '',
};

// خادم تحليل التجويد (Google Cloud Run). ضع رابط الخدمة هنا بعد نشرها، مثل:
// 'https://fateh-tajweed-xxxxxxxxxx-ew.a.run.app'  (اتركه فارغاً لإخفاء التحليل الآلي)
export const TAJWEED_API = {
  url: 'https://fateh-quran-v2-960354071194.europe-west1.run.app',
  // true: التحليل داخل الطلب نفسه (مطلوب في Google Cloud Run)
  sync: true,
  // مقادير المدود المعتمدة في التصحيح (رواية حفص من طريق الشاطبية)
  madd: { monfasel: 4, mottasel: 4, aared: 4 },
};
