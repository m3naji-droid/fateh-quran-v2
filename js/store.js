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

/** كلمة سر من ٦ أرقام (سهلة الكتابة على جوال الطالب) */
export function genPassword() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0] % 900000));
}
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, n);
const byName = (a, b) => a.name.localeCompare(b.name, 'ar');

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
  // حسابات الطلاب (محلياً: كلمة السر محفوظة في هذا المتصفح فقط)
  async listDirectory(classId) {
    return Object.entries(LS.get('roster', {})).filter(([, v]) => v.classId === classId).map(([id, v]) => ({ id, name: v.name, hasAccount: !!v.pw })).sort(byName);
  },
  async studentSignIn(classId, id, password) {
    const s = LS.get('roster', {})[id];
    if (!s || s.classId !== classId) throw new Error('لم نجد هذا الطالب في الصف المختار.');
    if (!s.pw) throw new Error('لم يُنشأ حساب لهذا الطالب بعد. راجع معلمك.');
    if (s.pw !== String(password).trim()) throw new Error('كلمة السر غير صحيحة.');
    const { pw, ...rest } = s;
    return { id, ...rest };
  },
  async isStudentAuthed() { return true; },
  async changePassword(student, current, next) {
    const r = LS.get('roster', {});
    if (!r[student.id] || r[student.id].pw !== current) throw new Error('كلمة السر الحالية غير صحيحة.');
    r[student.id] = { ...r[student.id], pw: next, pwChanged: true, pwChangedAt: now() };
    LS.set('roster', r);
  },
  async createAccounts(list, onProgress = () => {}) {
    const r = LS.get('roster', {});
    const created = [];
    list.forEach((s, k) => { const pw = genPassword(); r[s.id] = { ...r[s.id], pw, hasAccount: true, pwChanged: false }; created.push({ id: s.id, password: pw }); onProgress(k + 1, list.length); });
    LS.set('roster', r);
    return { created, failed: [] };
  },
  async resetPassword(student) { const { created } = await this.createAccounts([student]); return created[0].password; },
  async listCards() {
    const out = {};
    Object.entries(LS.get('roster', {})).forEach(([id, v]) => { if (v.pw) out[id] = { password: v.pwChanged ? null : v.pw, name: v.name, classId: v.classId }; });
    return out;
  },
  async rebuildDirectory() {},
  // الصفوف
  async listClasses() { return LS.get('classes', []); },
  async saveClass(c) { const all = LS.get('classes', []); const i = all.findIndex((x) => x.id === c.id); if (i >= 0) all[i] = { ...all[i], ...c }; else all.push({ id: uid(), createdAt: now(), ...c }); LS.set('classes', all); },
  async deleteClass(id) { LS.set('classes', LS.get('classes', []).filter((c) => c.id !== id)); },
  // الطلاب
  async listStudents() { const r = LS.get('roster', {}); return Object.entries(r).map(([id, v]) => { const { pw, ...rest } = v; return { id, ...rest, hasAccount: !!pw }; }); },
  async saveStudents(list) { const r = LS.get('roster', {}); list.forEach((s) => { r[s.id] = { ...r[s.id], name: s.name, classId: s.classId, createdAt: r[s.id]?.createdAt || now() }; }); LS.set('roster', r); },
  async deleteStudent(id) { const r = LS.get('roster', {}); delete r[id]; LS.set('roster', r); },
  // الواجبات
  async listTasks() { return LS.get('tasks', []); },
  async saveTask(t) { const all = LS.get('tasks', []); const i = all.findIndex((x) => x.id === t.id); if (i >= 0) all[i] = { ...all[i], ...t }; else all.push({ id: uid(), createdAt: now(), ...t }); LS.set('tasks', all); },
  async deleteTask(id) { LS.set('tasks', LS.get('tasks', []).filter((t) => t.id !== id)); },
  // التسليمات
  async addSubmission(pn, sub, audio) {
    const id = uid();
    const all = LS.get('subs', []);
    all.push({ ...sub, id, pn, createdAt: now(), hasAudio: !!audio, audioBytes: audio ? Math.ceil(audio.size * 4 / 3) : 0 });
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
  async deleteAudio(pn, id) {
    try { const db = await idb(); await new Promise((res) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').delete(id); tx.oncomplete = res; tx.onerror = res; }); } catch {}
    await this.updateSubmission(pn, id, { hasAudio: false, audioBytes: 0, audioDeletedAt: now() });
  },
  async getModel() { return LS.get('model', null); },
  async setModel(m) { LS.set('model', m); },
  // لوحة الشرف
  async getBoard() { return LS.get('board', null); },
  async getAiUsage() { return LS.get('aiUsage', null); },
  async setBoard(b) { LS.set('board', b); },
  async saveRanks(ranks) { const r = LS.get('roster', {}); Object.entries(ranks).forEach(([id, v]) => { if (r[id]) r[id].rank = v; }); LS.set('roster', r); },
  async getMyRank(me) { return LS.get('roster', {})[me.id]?.rank || null; },
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
  let creator = null;

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

    /* ---- حسابات الطلاب: لكل طالب حساب في Firebase Authentication (كلمة السر لا تُحفظ في قاعدة البيانات) ---- */
    async listDirectory(classId) {
      await ensureAnon();
      const d = await getDoc(doc(db, 'directory', classId));
      return d.exists() ? (d.data().students || []).map(({ id, name, email }) => ({ id, name, hasAccount: !!email })).sort(byName) : [];
    },
    async studentSignIn(classId, id, password) {
      await ensureAnon();
      const d = await getDoc(doc(db, 'directory', classId));
      const entry = d.exists() ? (d.data().students || []).find((x) => x.id === id) : null;
      if (!entry) throw new Error('لم نجد هذا الطالب في الصف المختار.');
      if (!entry.email) throw new Error('لم يُنشأ حساب لهذا الطالب بعد. راجع معلمك.');
      try {
        await au.signInWithEmailAndPassword(auth, entry.email, String(password).trim());
      } catch (e) {
        const map = {
          'auth/invalid-credential': 'كلمة السر غير صحيحة.',
          'auth/wrong-password': 'كلمة السر غير صحيحة.',
          'auth/user-not-found': 'حساب هذا الطالب غير موجود. راجع معلمك.',
          'auth/too-many-requests': 'محاولات كثيرة خاطئة. انتظر دقائق ثم أعد المحاولة.',
          'auth/network-request-failed': 'تحقق من اتصال الإنترنت.',
        };
        throw new Error(map[e.code] || 'تعذر الدخول: ' + (e.code || e.message));
      }
      const r = await getDoc(doc(db, 'roster', id));
      return { id, ...r.data() };
    },
    async isStudentAuthed(student) {
      await ready;
      const u = auth.currentUser;
      return !!(u && !u.isAnonymous && student?.uid && u.uid === student.uid);
    },
    async changePassword(student, current, next) {
      const u = auth.currentUser;
      if (!u || u.isAnonymous) throw new Error('انتهت جلسة الدخول. ادخل من جديد.');
      try {
        await au.reauthenticateWithCredential(u, au.EmailAuthProvider.credential(u.email, current));
      } catch (e) {
        throw new Error(e.code === 'auth/too-many-requests' ? 'محاولات كثيرة. انتظر قليلاً.' : 'كلمة السر الحالية غير صحيحة.');
      }
      try { await au.updatePassword(u, next); }
      catch (e) { throw new Error(e.code === 'auth/weak-password' ? 'كلمة السر الجديدة ضعيفة: ٦ خانات على الأقل.' : 'تعذر تغيير كلمة السر: ' + (e.code || e.message)); }
      await updateDoc(doc(db, 'roster', student.id), { pwChanged: true, pwChangedAt: now() }).catch(() => {});
    },
    /** المعلم ينشئ حسابات الطلاب دون أن يخرج من حسابه (تطبيق Firebase ثانٍ في الذاكرة) */
    async createAccounts(list, onProgress = () => {}) {
      if (!creator) {
        const app2 = initializeApp(FIREBASE.config, 'account-creator');
        creator = au.initializeAuth(app2, { persistence: au.inMemoryPersistence });
      }
      const created = [], failed = [];
      for (let k = 0; k < list.length; k++) {
        const s = list[k];
        const password = genPassword();
        const email = `s${randHex(12)}@students.fateh-maqraa.app`;
        try {
          const cred = await au.createUserWithEmailAndPassword(creator, email, password);
          const b = writeBatch(db);
          b.set(doc(db, 'roster', s.id), { uid: cred.user.uid, email, pwChanged: false, accountAt: now() }, { merge: true });
          b.set(doc(db, 'cards', s.id), { password, email, name: s.name, classId: s.classId, at: now() });
          await b.commit();
          await au.signOut(creator).catch(() => {});
          created.push({ id: s.id, password });
        } catch (e) {
          const msg = e.code === 'auth/too-many-requests' || e.code === 'auth/quota-exceeded'
            ? 'وصلت Firebase إلى حد إنشاء الحسابات المؤقت. أكمل الباقين بعد ساعة.'
            : e.code === 'auth/operation-not-allowed' ? 'فعّل Email/Password في Firebase Authentication.' : (e.code || e.message);
          failed.push({ id: s.id, error: msg });
          if (e.code === 'auth/too-many-requests' || e.code === 'auth/quota-exceeded' || e.code === 'auth/operation-not-allowed') {
            list.slice(k + 1).forEach((x) => failed.push({ id: x.id, error: msg }));
            break;
          }
        }
        onProgress(k + 1, list.length);
      }
      return { created, failed };
    },
    async resetPassword(student) {
      const { created, failed } = await this.createAccounts([student]);
      if (!created.length) throw new Error(failed[0]?.error || 'تعذر إنشاء كلمة سر جديدة.');
      return created[0].password;
    },
    async listCards() {
      const out = {};
      (await list('cards')).forEach((c) => { out[c.id] = c; });
      return out;
    },
    /** قائمة أسماء كل صف لشاشة الدخول (بلا أي بيانات سرية) */
    async rebuildDirectory(classIds, students) {
      for (const cid of new Set(classIds)) {
        const arr = students.filter((s) => s.classId === cid).map((s) => ({ id: s.id, name: s.name, email: s.email || null }));
        await setDoc(doc(db, 'directory', cid), { students: arr, at: now() });
      }
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
    async deleteStudent(id) { await deleteDoc(doc(db, 'cards', id)).catch(() => {}); await deleteDoc(doc(db, 'roster', id)); },
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
      await setDoc(doc(db, 'roster', pn, 'subs', id), { ...sub, pn, createdAt: now(), hasAudio: !!audioDoc, audioBytes: audioDoc ? audioDoc.b64.length : 0 });
      if (audioDoc) await setDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main'), audioDoc);
      return id;
    },
    async studentSubmissions(pn) { await ensureAnon(); return list(`roster/${pn}/subs`); },
    async allSubmissions() { return (await getDocs(query(collectionGroup(db, 'subs'), limit(10000)))).docs.map((d) => ({ id: d.id, ...d.data() })); },
    watchSubmissions(cb, onErr) {
      return onSnapshot(query(collectionGroup(db, 'subs'), limit(10000)), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    },
    async getAudio(pn, id) {
      const d = await getDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main'));
      return d.exists() ? b64ToBlob(d.data().b64, d.data().mime) : null;
    },
    async updateSubmission(pn, id, patch) { await updateDoc(doc(db, 'roster', pn, 'subs', id), patch); },
    async deleteSubmission(pn, id) { await deleteDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main')).catch(() => {}); await deleteDoc(doc(db, 'roster', pn, 'subs', id)); },
    /** حذف التسجيل الصوتي فقط مع إبقاء التسليم ودرجاته */
    async deleteAudio(pn, id) {
      await deleteDoc(doc(db, 'roster', pn, 'subs', id, 'audio', 'main'));
      await updateDoc(doc(db, 'roster', pn, 'subs', id), { hasAudio: false, audioBytes: 0, audioDeletedAt: now() });
    },
    // نموذج التعلم من تقييمات المعلم (يقرؤه الطلاب، ويكتبه المعلم)
    async getModel() { await ensureAnon(); try { const d = await getDoc(doc(db, 'model', 'tajweed')); return d.exists() ? d.data() : null; } catch { return null; } },
    async setModel(m) { await setDoc(doc(db, 'model', 'tajweed'), m); },
    // لوحة الشرف: يحسبها المعلم وينشرها (الأسماء والنقاط فقط)، ومرتبة كل طالب في مستنده
    async getAiUsage(month) { const d = await getDoc(doc(db, 'usage', 'ai-' + month)); return d.exists() ? d.data() : null; },
    async getBoard() { await ensureAnon(); const d = await getDoc(doc(db, 'leaderboard', 'main')); return d.exists() ? d.data() : null; },
    async setBoard(b) { await setDoc(doc(db, 'leaderboard', 'main'), b); },
    async saveRanks(ranks, students) {
      const changed = students.filter((s) => ranks[s.id] && JSON.stringify(s.rank || null) !== JSON.stringify(ranks[s.id]));
      for (let i = 0; i < changed.length; i += 400) {
        const b = writeBatch(db);
        changed.slice(i, i + 400).forEach((s) => b.set(doc(db, 'roster', s.id), { rank: ranks[s.id] }, { merge: true }));
        await b.commit();
      }
      changed.forEach((s) => (s.rank = ranks[s.id]));
    },
    async getMyRank(me) { const d = await getDoc(doc(db, 'roster', me.id)); return d.exists() ? d.data().rank || null : null; },
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
