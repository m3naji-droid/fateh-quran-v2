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

// خادم تحليل التجويد على Hugging Face. ضع رابط الـ Space هنا بعد إنشائه، مثل:
// 'https://m3naji-droid-fateh-tajweed.hf.space'  (اتركه فارغاً لإخفاء التحليل الآلي)
export const TAJWEED_API = {
  url: '',
  // مقادير المدود المعتمدة في التصحيح (رواية حفص من طريق الشاطبية)
  madd: { monfasel: 4, mottasel: 4, aared: 4 },
};
