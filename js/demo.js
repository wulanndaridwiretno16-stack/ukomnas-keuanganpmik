/* MODE DEMO: aktif hanya jika alamat memakai ?demo=1
   Menggantikan Firebase dengan penyimpanan di memori browser.
   Tidak ada data yang dikirim ke Firebase; muat ulang halaman = data kembali bersih. */
(function () {
  if (!/[?&]demo(=1|&|$)/.test(location.search)) return;
  window.DEMO = true;
  window.APP_CONFIG = { firebase: { apiKey: 'demo', authDomain: 'demo', projectId: 'demo', appId: 'demo' }, ADMIN_EMAIL: 'admin@demo.test' };
  const U = window.UKOM;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const store = { users: {}, reports: {}, pjCodes: {} };
  const pass = {};
  let seq = 0; const newId = () => 'demo' + (++seq) + Math.random().toString(36).slice(2, 7);

  // ---- data contoh ----
  const addUser = (id, email, name, inst, role, pj, kode) => { store.users[id] = { email, full_name: name, institusi: inst, role, pj_id: pj || null, kode_used: null, kode_pj: kode || null, created_at: Date.now() - seq++ * 1000 }; pass[email] = 'demo123'; };
  addUser('u_admin', 'admin@demo.test', 'Admin Demo', 'Tim Ad Hoc PMIK', 'admin', null, 'ADMIN1');
  addUser('u_pj', 'pj@demo.test', 'Dwi Retno Wulanndari (PJ Demo)', 'Tim Ad Hoc PMIK', 'pj', null, 'DEMOPJ');
  addUser('u_pp1', 'pp1@demo.test', 'Dr I Made Sudarma Adiputra, S.Kep., Ns., M.Kes', 'STIKES Wira Medika Bali', 'pp', 'u_pj');
  addUser('u_pp2', 'pp2@demo.test', 'Contoh Pengawas Kedua, S.KM., M.Kes', 'Universitas Contoh', 'pp', 'u_pj');
  store.pjCodes.ADMIN1 = { pj_id: 'u_admin' }; store.pjCodes.DEMOPJ = { pj_id: 'u_pj' };
  const items = U.defaultItems({ peserta: 44 });
  const now = Date.now();
  store.reports.r_demo = { pj_id: 'u_pj', pp_id: 'u_pp1', tuk_name: 'STIKES Wira Medika Bali', pp_institusi: 'STIKES Wira Medika Bali', jumlah_sesi: 1, jumlah_hari: 1, jumlah_peserta: 44, tahun: '2026', items, total: U.totalOf(items), status: 'published', created_at: now, updated_at: now, published_at: now, personnel: { pp_name: store.users.u_pp1.full_name, pj_name: store.users.u_pj.full_name, co_cbt: 'Contoh Co CBT', admin: 'Contoh Admin', it_lokal: 'Contoh IT Lokal', rumah_makan: 'Rumah Makan Contoh', pl: ['Pengawas Lokal 1', 'Pengawas Lokal 2'] } };

  // ---- Firestore tiruan ----
  const ref = (col, id) => ({ col, id });
  const snapOf = (col, id) => { const d = store[col][id]; return { id, exists: () => !!d, data: () => clone(d) }; };
  const match = (d, c) => { const v = d[c.f] === undefined ? null : d[c.f]; return c.op === '==' ? v === c.v : true; };
  // ---- Auth tiruan ----
  let cur = null, listener = null;
  const emit = () => listener && setTimeout(() => listener(cur), 0);
  const err = (code, message) => Object.assign(new Error(message || code), { code });

  window.FB = {
    initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => ({}),
    onAuthStateChanged: (_a, cb) => { listener = cb; emit(); },
    signInWithEmailAndPassword: async (_a, email, pw) => {
      const id = Object.keys(store.users).find((k) => store.users[k].email.toLowerCase() === email.toLowerCase());
      if (!id || pass[store.users[id].email] !== pw) throw err('auth/invalid-credential');
      cur = { uid: id, email: store.users[id].email, emailVerified: true }; emit();
    },
    createUserWithEmailAndPassword: async (_a, email, pw) => {
      if (Object.values(store.users).some((u) => u.email.toLowerCase() === email.toLowerCase())) throw err('auth/email-already-in-use');
      const id = newId(); pass[email] = pw; cur = { uid: id, email, emailVerified: true }; emit(); return { user: cur };
    },
    signOut: async () => { cur = null; emit(); },
    sendEmailVerification: async () => {}, sendPasswordResetEmail: async () => {},
    doc: (_d, col, id) => ref(col, id),
    collection: (_d, col) => ({ col }),
    where: (f, op, v) => ({ f, op, v }),
    query: (c, ...cons) => ({ col: c.col, cons }),
    getDoc: async (r) => snapOf(r.col, r.id),
    getDocs: async (q) => ({ docs: Object.keys(store[q.col]).filter((id) => q.cons.every((c) => match(store[q.col][id], c))).map((id) => snapOf(q.col, id)) }),
    setDoc: async (r, data) => { store[r.col][r.id] = clone(data); },
    updateDoc: async (r, data) => { if (!store[r.col][r.id]) throw err('not-found', 'Dokumen tidak ada'); Object.assign(store[r.col][r.id], clone(data)); },
    deleteDoc: async (r) => { delete store[r.col][r.id]; },
    addDoc: async (c, data) => { const id = newId(); store[c.col][id] = clone(data); return { id }; },
    writeBatch: () => { const ops = []; return { update: (r, d) => ops.push(() => window.FB.updateDoc(r, d)), set: (r, d) => ops.push(() => window.FB.setDoc(r, d)), delete: (r) => ops.push(() => window.FB.deleteDoc(r)), commit: async () => { for (const o of ops) await o(); } }; },
  };
})();
