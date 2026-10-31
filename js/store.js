// طبقة البيانات: سحابية (Firebase) مع بديل محلي تلقائي (localStorage + IndexedDB)
import { FIREBASE } from './firebase-config.js';

const FB_VER = '10.12.2';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

export const blobToB64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
export const b64ToBlob = (b64, mime) => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || 'audio/webm' });
};

/* ---------------- النسخة المحلية ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('fp_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fp_' + k, JSON.stringify(v)); } catch (e) { console.warn(e); } },
};
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('fateh-plus', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('audio');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(key, val) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('audio').objectStore('audio').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const DEFAULT_CLASSES = [
  ...[1, 2, 3, 4, 5].map((n) => ({ id: `g2-${n}`, name: `الثاني الإعدادي ${'٠١٢٣٤٥٦٧٨٩'[n]}`, createdAt: now() })),
];

const local = {
  mode: 'local',
  async init() { if (!LS.get('classes')) LS.set('classes', DEFAULT_CLASSES); },
  // المعلم
  async teacherState() { return { hasPassword: !!LS.get('tpass'), name: LS.get('tname', '') }; },
  async teacherSignIn(name, password) {
    const h = await sha(password);
    const saved = LS.get('tpass');
    if (!saved) { LS.set('tpass', h); LS.set('tname', name || 'المعلم'); return { name: name || 'المعلم' }; }
    if (saved !== h) throw new Error('كلمة المرور غير صحيحة.');
    return { name: LS.get('tname', 'المعلم') };
  },
  async signOut() {},
  async idToken() { return null; },
  async studentSignIn(pn) {
    const s = LS.get('roster', {})[pn];
    if (!s) throw new Error('لم نجد طالباً بهذا الرقم. تأكد من الرقم أو راجع معلمك.');
    return { id: pn, ...s };
  },
  // الصفوف
  async listClasses() { return LS.get('classes', []); },
  async saveClass(c) { const all = LS.get('classes', []); const i = all.findIndex((x) => x.id === c.id); if (i >= 0) all[i] = { ...all[i], ...c }; else all.push({ id: uid(), createdAt: now(), ...c }); LS.set('classes', all); },
  async deleteClass(id) { LS.set('classes', LS.get('classes', []).filter((c) => c.id !== id)); },
  // الطلاب
  async listStudents() { const r = LS.get('roster', {}); return Object.entries(r).map(([id, v]) => ({ id, ...v })); },
  async saveStudents(list) { const r = LS.get('roster', {}); list.forEach((s) => { r[s.id] = { name: s.name, classId: s.classId, createdAt: r[s.id]?.createdAt || now() }; }); LS.set('roster', r); },
  async deleteStudent(id) { const r = LS.get('roster', {}); delete r[id]; LS.set('roster', r); },
  // الواجبات
  async listTasks() { return LS.get('tasks', []); },
  async saveTask(t) { const all = LS.get('tasks', []); const i = all.findIndex((x) => x.id === t.id); if (i >= 0) all[i] = { ...all[i], ...t }; else all.push({ id: uid(), createdAt: now(), ...t }); LS.set('tasks', all); },
  async deleteTask(id) { LS.set('tasks', LS.get('tasks', []).filter((t) => t.id !== id)); },
  // التسليمات
  async addSubmission(pn, sub, audio) {
    const id = uid();
    const all = LS.get('subs', []);
    all.push({ ...sub, id, pn, createdAt: now(), hasAudio: !!audio });
    LS.set('subs', all);
    if (audio) await idbPut(id, audio);
    return id;
  },
  async studentSubmissions(pn) { return LS.get('subs', []).filter((s) => s.pn === pn); },
  async allSubmissions() { return LS.get('subs', []); },
  watchSubmissions(cb) { cb(LS.get('subs', [])); const h = (e) => { if (e.key === 'fp_subs') cb(LS.get('subs', [])); }; addEventListener('storage', h); return () => removeEventListener('storage', h); },
  async getAudio(pn, id) { return idbGet(id); },
  async updateSubmission(pn, id, patch) { const all = LS.get('subs', []); const i = all.findIndex((s) => s.id === id); if (i >= 0) { all[i] = { ...all[i], ...patch }; LS.set('subs', all); } },
  async deleteSubmission(pn, id) { LS.set('subs', LS.get('subs', []).filter((s) => s.id !== id)); },
  async getModel() { return LS.get('model', null); },
  async setModel(m) { LS.set('model', m); },
};

/* ---------------- النسخة السحابية ---------------- */
async function makeCloud() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const app = initializeApp(FIREBASE.config);
  const db = FIREBASE.databaseId ? fs.getFirestore(app, FIREBASE.databaseId) : fs.getFirestore(app);
  const auth = au.getAuth(app);
  const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collectionGroup, onSnapshot, query, limit } = fs;
  const list = async (path) => (await getDocs(collection(db, path))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const ready = new Promise((res) => { const u = au.onAuthStateChanged(auth, () => { u(); res(); }); });

  async function ensureAnon() {
    await ready;
    if (!auth.currentUser) {
      try { await au.signInAnonymously(auth); } catch (e) { console.warn('anon auth', e.code); }
    }
  }

  return {
    mode: 'cloud',
    async init() { await ready; },
    async teacherState() { return { hasPassword: true, cloud: true }; },
    async teacherSignIn(email, password) {
      try {
        const cred = await au.signInWithEmailAndPassword(auth, email.trim(), password);
        const t = await getDoc(doc(db, 'teachers', cred.user.uid)).catch(() => null);
        if (t && !t.exists()) {
          const err = new Error('تم تسجيل الدخول، لكن هذا الحساب غير مضاف كمعلم بعد.');
          err.uid = cred.user.uid;
          throw err;
        }
        return { name: t?.data()?.name || cred.user.email };
      } catch (e) {
        if (e.uid) throw e;
        const map = {
          'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
          'auth/wrong-password': 'كلمة المرور غير صحيحة.',
          'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
          'auth/operation-not-allowed': 'فعّل تسجيل الدخول بالبريد وكلمة المرور في Firebase Authentication.',
          'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
        };
        throw new Error(map[e.code] || 'تعذر تسجيل الدخول: ' + (e.code || e.message));
      }
    },
    async signOut() { try { await au.signOut(auth); } catch {} },
    async idToken() { await ensureAnon(); return auth.currentUser ? auth.currentUser.getIdToken() : null; },
    async studentSignIn(pn) {
      await ensureAnon();
      const d = await getDoc(doc(db, 'roster', String(pn).trim()));
      if (!d.exists()) throw new Error('لم نجد طالباً بهذا الرقم. تأكد من الرقم أو راجع معلمك.');
      return { id: d.id, ...d.data() };
    },
    async listClasses() { await ensureAnon(); return list('classes'); },
    async saveClass(c) { const id = c.id || uid(); await setDoc(doc(db, 'classes', id), { name: c.name, createdAt: c.createdAt || now() }, { merge: true }); },
    async deleteClass(id) { await deleteDoc(doc(db, 'classes', id)); },
    async listStudents() { return list('roster'); },
    async saveStudents(arr) {
      for (let i = 0; i < arr.length; i += 400) {
        const b = writeBatch(db);
        arr.slice(i, i + 400).forEach((s) => b.set(doc(db, 'roster', s.id), { name: s.name, classId: s.classId, createdAt: s.createdAt || now() }, { merge: true }));
        await b.commit();
      }
    },
    async deleteStudent(id) { await deleteDoc(doc(db, 'roster', id)); },
    async listTasks() { await ensureAnon(); return list('tasks'); },
    async saveTask(t) { const id = t.id || uid(); const { id: _, ...rest } = t; await setDoc(doc(db, 'tasks', id), { createdAt: now(), ...rest }, { merge: true }); },
    async deleteTask(id) { await deleteDoc(doc(db, 'tasks', id)); },
    async addSubmission(pn, sub, audio) {
      await ensureAnon();
      const id = uid();
      let audioDoc = null;
      if (audio) {
        const b64 = await blobToB64(audio);
        if (b64.length < 950000) audioDoc = { b64, mime: audio.type };
      }
      await setDoc(doc(db, 'roster', pn, 'subs', id), { ...sub, pn, createdAt: now(), hasAudio: !!audioDoc });
      if (audioDoc) await setDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main'), audioDoc);
      return id;
    },
    async studentSubmissions(pn) { await ensureAnon(); return list(`roster/${pn}/subs`); },
    async allSubmissions() { return (await getDocs(query(collectionGroup(db, 'subs'), limit(1000)))).docs.map((d) => ({ id: d.id, ...d.data() })); },
    watchSubmissions(cb, onErr) {
      return onSnapshot(query(collectionGroup(db, 'subs'), limit(1000)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    },
    async getAudio(pn, id) {
      const d = await getDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main'));
      return d.exists() ? b64ToBlob(d.data().b64, d.data().mime) : null;
    },
    async updateSubmission(pn, id, patch) { await updateDoc(doc(db, 'roster', pn, 'subs', id), patch); },
    async deleteSubmission(pn, id) { await deleteDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main')).catch(() => {}); await deleteDoc(doc(db, 'roster', pn, 'subs', id)); },
    // نموذج التعلم من تقييمات المعلم (يقرؤه الطلاب، ويكتبه المعلم)
    async getModel() { await ensureAnon(); try { const d = await getDoc(doc(db, 'model', 'tajweed')); return d.exists() ? d.data() : null; } catch { return null; } },
    async setModel(m) { await setDoc(doc(db, 'model', 'tajweed'), m); },
    // ترحيل بيانات النسخة القديمة (مقرأة الفاتح) إلى البنية الجديدة
    async migrateLegacy() {
      const oldStudents = await list('students').catch(() => []);
      const oldAsg = await list('assignments').catch(() => []);
      const st = oldStudents.filter((s) => s.personalNumber).map((s) => ({ id: String(s.personalNumber).trim(), name: s.name, classId: s.classId }));
      await this.saveStudents(st);
      for (const a of oldAsg) {
        await setDoc(doc(db, 'tasks', 'legacy-' + a.id), { title: a.title, classId: a.classId || 'all', surah: 36, from: a.startAyah, to: a.endAyah, mode: 'recite', notes: a.instructions || '', createdAt: a.createdAt || now() }, { merge: true });
      }
      return { students: st.length, tasks: oldAsg.length };
    },
  };
}

export let store = local;
export let cloudError = null;

export async function initStore() {
  if (FIREBASE.enabled) {
    try {
      const c = await Promise.race([makeCloud(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
      await c.init();
      store = c;
      return store;
    } catch (e) {
      cloudError = e;
      console.warn('Cloud unavailable, using local mode', e);
    }
  }
  await local.init();
  store = local;
  return store;
}
