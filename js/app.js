/* Aplikasi Keuangan UKOMNAS PMIK - Firebase Auth + Firestore */
(function () {
  const U = window.UKOM, F = window.FB;
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app'), nav = $('#nav');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROLE = { admin: 'Admin', pj: 'PJ Keuangan', pp: 'Pengawas Pusat' };
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.firebase && cfg.firebase.apiKey && !cfg.firebase.apiKey.startsWith('ISI_');
  const ADMIN = String(cfg.ADMIN_EMAIL || '').toLowerCase();

  let auth, db, user = null, me = null, view = 'laporan', editing = null, toastT;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500); };
  const msgOf = (e) => {
    const c = (e && e.code) || '';
    const map = { 'auth/invalid-credential': 'Email atau kata sandi salah.', 'auth/wrong-password': 'Email atau kata sandi salah.', 'auth/user-not-found': 'Email atau kata sandi salah.', 'auth/email-already-in-use': 'Email sudah terdaftar.', 'auth/weak-password': 'Kata sandi minimal 6 karakter.', 'auth/invalid-email': 'Format email tidak valid.', 'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti.', 'permission-denied': 'Akses ditolak oleh aturan keamanan.' };
    return map[c] || (e && e.message) || String(e);
  };

  /* ---------------- Lapisan data (Firestore) ---------------- */
  const snap = (d) => ({ id: d.id, ...d.data() });
  const DB = {
    async user(uid) { const s = await F.getDoc(F.doc(db, 'users', uid)); return s.exists() ? snap(s) : null; },
    async users(...c) { const s = await F.getDocs(F.query(F.collection(db, 'users'), ...c)); return s.docs.map(snap); },
    async reports(...c) { const s = await F.getDocs(F.query(F.collection(db, 'reports'), ...c)); return s.docs.map(snap); },
  };
  const randCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

  /* ---------------- Boot ---------------- */
  function boot() {
    if (window.DEMO) { const b = document.createElement('div'); b.className = 'demobar'; b.innerHTML = 'MODE DEMO — data hanya di browser ini & tidak masuk database. Muat ulang = kembali bersih. <a href="./">Keluar dari demo</a>'; document.body.insertBefore(b, document.body.firstChild); }
    if (!configured || !F) { app.innerHTML = '<div class="card"><h2>Konfigurasi belum diisi</h2><p>Isi data Firebase pada <code>js/config.js</code> (lihat README).</p></div>'; return; }
    const fapp = F.initializeApp(cfg.firebase);
    auth = F.getAuth(fapp); db = F.getFirestore(fapp);
    F.onAuthStateChanged(auth, (u) => { user = u; start(); });
  }
  let startSeq = 0;
  async function start() {
    const seq = ++startSeq; me = null; editing = null;
    if (!user) { renderAuth(); renderNav(); return; }
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    try {
      let p = null;
      for (let i = 0; i < 8 && !p; i++) { p = await DB.user(user.uid); if (!p) await new Promise((r) => setTimeout(r, 500)); }
      if (seq !== startSeq) return;
      if (!p) { app.innerHTML = '<div class="card"><p class="err">Profil belum ada. Coba muat ulang halaman.</p><button class="btn" id="out">Keluar</button></div>'; $('#out').onclick = () => F.signOut(auth); return; }
      // pemilik email admin (terverifikasi) -> otomatis menjadi admin
      if ((user.email || '').toLowerCase() === ADMIN && p.role !== 'admin') {
        if (user.emailVerified) {
          const code = randCode();
          try {
            await F.updateDoc(F.doc(db, 'users', user.uid), { role: 'admin', kode_pj: code });
            await F.setDoc(F.doc(db, 'pjCodes', code), { pj_id: user.uid });
            p = await DB.user(user.uid);
          } catch (e) { toast(msgOf(e)); }
        }
      }
      me = p;
    } catch (e) { app.innerHTML = `<div class="card"><p class="err">${esc(msgOf(e))}</p><button class="btn" id="out">Keluar</button></div>`; $('#out').onclick = () => F.signOut(auth); return; }
    view = me.role === 'pp' ? 'berkas' : 'laporan';
    go(view);
  }
  function go(v) { view = v; editing = null; renderNav(); ({ berkas: renderBerkas, laporan: renderLaporan, pp: renderPP, users: renderUsers }[v] || renderBerkas)(); }
  function renderNav() {
    if (!me) { nav.innerHTML = ''; return; }
    const tabs = me.role === 'pp' ? [['berkas', 'Berkas Saya']] : [['laporan', 'Laporan TUK'], ['pp', 'PP Saya']].concat(me.role === 'admin' ? [['users', 'Pengguna']] : []);
    nav.innerHTML = tabs.map(([k, l]) => `<button data-v="${k}" class="${view === k ? 'active' : ''}">${l}</button>`).join('') +
      `<span class="muted" style="font-size:13px;margin-left:8px">${esc(me.full_name || me.email)} · ${ROLE[me.role]}</span><button id="out">Keluar</button>`;
    nav.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => go(b.dataset.v)));
    $('#out').onclick = () => F.signOut(auth);
  }
  function verifyBanner() {
    if (!me || (me.email || '').toLowerCase() !== ADMIN || me.role === 'admin' || user.emailVerified) return '';
    return '<div class="card"><strong>Verifikasi email dibutuhkan.</strong> Akun ini berhak menjadi Admin setelah email diverifikasi. <button class="btn sm" id="vf">Kirim email verifikasi</button> <button class="btn sm" id="rl">Saya sudah verifikasi</button></div>';
  }
  function bindBanner() {
    const v = $('#vf'); if (v) v.onclick = async () => { try { await F.sendEmailVerification(user); toast('Email verifikasi dikirim'); } catch (e) { toast(msgOf(e)); } };
    const r = $('#rl'); if (r) r.onclick = async () => { await user.reload(); start(); };
  }

  /* ---------------- Auth ---------------- */
  function renderAuth(mode = 'login', err = '') {
    app.innerHTML = `<div class="card auth">
      <div class="tabs"><button class="btn ${mode === 'login' ? 'primary' : ''}" data-m="login">Masuk</button><button class="btn ${mode === 'daftar' ? 'primary' : ''}" data-m="daftar">Daftar</button></div>
      <form id="f" class="grid" style="grid-template-columns:1fr">
        ${mode === 'daftar' ? `<div><label>Nama lengkap (beserta gelar)</label><input name="full_name" required></div>
        <div><label>Asal institusi</label><input name="institusi"></div>` : ''}
        <div><label>Email</label><input name="email" type="email" required autocomplete="username"></div>
        <div><label>Kata sandi</label><input name="password" type="password" minlength="6" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></div>
        ${mode === 'daftar' ? `<div><label>Kode PJ Keuangan (dari PJ Anda)</label><input name="kode_pj" placeholder="mis. A2B3C4" style="text-transform:uppercase"></div>
        <p class="muted" style="margin:0;font-size:13px">Pendaftaran berperan sebagai Pengawas Pusat (PP). Akun PJ Keuangan ditetapkan oleh Admin.</p>` : ''}
        ${err ? `<div class="err">${esc(err)}</div>` : ''}
        <button class="btn primary" id="go">${mode === 'login' ? 'Masuk' : 'Daftar'}</button>
        ${mode === 'login' ? '<button type="button" class="btn sm" id="reset">Lupa kata sandi</button>' : ''}
      </form>
      ${window.DEMO ? `<div style="margin-top:14px"><p class="muted" style="margin:0 0 6px;font-size:13px">Masuk cepat (kata sandi demo: demo123):</p><div class="row"><button class="btn sm" data-q="admin@demo.test">Admin</button><button class="btn sm" data-q="pj@demo.test">PJ Keuangan</button><button class="btn sm" data-q="pp1@demo.test">Pengawas Pusat</button></div></div>` : '<p class="center" style="margin:14px 0 0;font-size:13px"><a href="?demo=1">Coba mode demo (data tidak disimpan)</a></p>'}</div>`;
    app.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => F.signInWithEmailAndPassword(auth, b.dataset.q, 'demo123')));
    app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.m)));
    const rs = $('#reset'); if (rs) rs.onclick = async () => { const em = $('[name=email]').value; if (!em) return toast('Isi email dulu'); try { await F.sendPasswordResetEmail(auth, em); toast('Tautan reset dikirim ke email'); } catch (e) { toast(msgOf(e)); } };
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); $('#go').disabled = true;
      try {
        if (mode === 'login') { await F.signInWithEmailAndPassword(auth, f.email.trim(), f.password); return; }
        const code = (f.kode_pj || '').trim().toUpperCase();
        const cred = await F.createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
        let pj_id = null;
        if (code) { try { const c = await F.getDoc(F.doc(db, 'pjCodes', code)); if (c.exists()) pj_id = c.data().pj_id; } catch (_) {} }
        await F.setDoc(F.doc(db, 'users', cred.user.uid), { email: cred.user.email, full_name: f.full_name.trim(), institusi: (f.institusi || '').trim(), role: 'pp', pj_id, kode_used: pj_id ? code : null, kode_pj: null, created_at: Date.now() });
        if ((cred.user.email || '').toLowerCase() === ADMIN) { try { await F.sendEmailVerification(cred.user); } catch (_) {} }
        if (code && !pj_id) toast('Kode PJ tidak dikenal; minta PJ menambahkan email Anda.');
        start();
      } catch (e2) { renderAuth(mode, msgOf(e2)); }
    };
  }

  /* ---------------- Unduhan ---------------- */
  const people = (r) => ({ pj: { full_name: (r.personnel || {}).pj_name || '' }, pp: { full_name: (r.personnel || {}).pp_name || '' } });
  function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function downloadOne(r, id) {
    const { pj, pp } = people(r); const f = U.fileList(r, pj, pp).find((x) => x.id === id);
    try { saveBlob(f.build().output('blob'), f.name); } catch (e) { toast('Gagal membuat PDF: ' + msgOf(e)); }
  }
  async function downloadZip(r, btn) {
    btn.disabled = true; const t = btn.textContent; btn.textContent = 'Menyiapkan…';
    try {
      const { pj, pp } = people(r); const zip = new JSZip();
      U.fileList(r, pj, pp).forEach((f) => (f.folder ? zip.folder(f.folder) : zip).file(f.name, f.build().output('arraybuffer')));
      saveBlob(await zip.generateAsync({ type: 'blob' }), `Keuangan UKOMNAS - ${U.safe(r.tuk_name)}.zip`);
    } catch (e) { toast('Gagal membuat ZIP: ' + msgOf(e)); }
    btn.disabled = false; btn.textContent = t;
  }
  function filesHtml(r) {
    const { pj, pp } = people(r);
    const files = U.fileList(r, pj, pp), one = (f) => `<div class="file"><div>${esc(f.label)}<small>${esc(f.folder || 'Satu file untuk seluruh TUK')}</small></div><button class="btn sm primary" data-dl="${f.id}">Unduh PDF</button></div>`;
    const top = files.filter((f) => !f.group), groups = [...new Set(files.filter((f) => f.group).map((f) => f.group))];
    return `<div class="files">${top.map(one).join('')}</div>` + groups.map((g) => `<h4 style="margin:14px 0 6px">${esc(files.find((f) => f.group === g).folder)} — ${esc(g)}</h4><div class="files">${files.filter((f) => f.group === g).map(one).join('')}</div>`).join('');
  }
  function bindFiles(root, r) {
    root.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => downloadOne(r, b.dataset.dl)));
    const z = root.querySelector('[data-zip]'); if (z) z.onclick = () => downloadZip(r, z);
  }

  /* ---------------- PP: nama petugas & rumah makan ---------------- */
  const STAFF_LABEL = [['co_cbt', 'Co CBT'], ['admin', 'Admin'], ['it_lokal', 'IT Lokal'], ['pl', 'Pengawas Lokal (PL)']];
  function ppFormHtml(r) {
    const P = Object.assign({}, r.personnel || {}, r.petugas || {}), real = r.realisasi || {};
    const nm = (k, i) => { const v = P[k]; const arr = Array.isArray(v) ? v : v ? [v] : []; return arr[i] || ''; };
    return `<h3 style="margin-top:16px">Nama petugas TUK &amp; rumah makan <span class="muted" style="font-weight:400">(diisi oleh PP; tercetak di kuitansi &amp; daftar penerimaan. Jumlah sesuai hitungan PJ)</span></h3>
      ${STAFF_LABEL.map(([k, l]) => { const n = U.headcount(r, k); return `<div style="margin-bottom:10px"><strong style="font-size:14px">${l}</strong> <span class="muted" style="font-size:13px">(${n} orang)</span><div class="grid" data-grp="${k}" style="margin-top:6px">${Array.from({ length: n }, (_, i) => `<div><label>${l}${n > 1 ? ' ' + (i + 1) : ''}</label><input data-pt="${k}" data-n="${i}" value="${esc(nm(k, i))}"></div>`).join('')}</div></div>`; }).join('')}
      <div class="grid"><div><label>Nama rumah makan (konsumsi)</label><input data-rm value="${esc(P.rumah_makan || '')}"></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-savepp>Simpan nama petugas</button><span class="muted" style="font-size:13px">Setelah menambah nama, unduh ulang berkas komponen yang terkait.</span></div>
      <h3 style="margin-top:20px">Lembar Kurang/Lebih — realisasi pelaksanaan</h3>
      <p class="muted" style="margin:0 0 6px;font-size:13px">Berdiri sendiri: tidak mengubah dokumen komponen uji di atas, jadi tidak perlu mengunduh ulang berkas lain. Kosongkan kolom bila realisasi sama dengan anggaran PJ. Honor bersifat tetap.</p>
      <div class="tablewrap"><table><thead><tr><th>Komponen</th><th class="num">Anggaran PJ (Rp)</th><th>Realisasi (Rp)</th><th class="num">Selisih</th></tr></thead><tbody>${r.items.filter((it) => !String(it.key).startsWith('honor_')).map((it) => { const a = it.nilai * it.qty, v = real[it.key]; return `<tr${U.PP_OWN.includes(it.key) ? ' style="background:var(--chip)"' : ''}><td>${esc(it.label)}${U.PP_OWN.includes(it.key) ? ' <span class="chip">mandiri PP</span>' : ''}</td><td class="num">${U.NUM(a)}</td><td><input type="number" min="0" step="any" data-rl="${it.key}" data-a="${a}" placeholder="${a}" value="${v === undefined || v === null ? '' : v}"></td><td class="num" data-sel="${it.key}"></td></tr>`; }).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-saverl>Simpan &amp; unduh Lembar Kurang/Lebih</button></div>`;
  }
  function bindPPForm(root, r) {
    const bn = root.querySelector('[data-savepp]'), br = root.querySelector('[data-saverl]'); if (!bn) return;
    const diff = (el) => { const cell = root.querySelector(`[data-sel="${el.dataset.rl}"]`); if (!cell) return; if (el.value === '') { cell.textContent = ''; return; } const d = Number(el.value) - Number(el.dataset.a); cell.textContent = d === 0 ? 'pas' : d < 0 ? 'kurang ' + U.NUM(-d) : 'lebih ' + U.NUM(d); };
    root.querySelectorAll('[data-rl]').forEach((el) => { diff(el); el.oninput = () => diff(el); });
    bn.onclick = async () => {
      const petugas = { rumah_makan: (root.querySelector('[data-rm]').value || '').trim() };
      STAFF_LABEL.forEach(([k]) => { petugas[k] = Array.from(root.querySelectorAll(`[data-pt="${k}"]`)).slice(0, U.headcount(r, k)).map((el) => (el.value || '').trim()); });
      bn.disabled = true;
      try { await F.updateDoc(F.doc(db, 'reports', r.id), { petugas, petugas_at: Date.now() }); r.petugas = petugas; toast('Nama tersimpan. Unduh ulang berkas komponen yang terkait.'); } catch (e) { toast(msgOf(e)); }
      bn.disabled = false;
    };
    br.onclick = async () => {
      const realisasi = {}; root.querySelectorAll('[data-rl]').forEach((el) => { if (el.value !== '') realisasi[el.dataset.rl] = Math.max(0, Number(el.value) || 0); });
      br.disabled = true;
      try { await F.updateDoc(F.doc(db, 'reports', r.id), { realisasi, petugas_at: Date.now() }); r.realisasi = realisasi; downloadOne(r, 'kl'); toast('Realisasi tersimpan; Lembar Kurang/Lebih diunduh.'); } catch (e) { toast(msgOf(e)); }
      br.disabled = false;
    };
  }

  /* ---------------- PP: berkas saya ---------------- */
  async function renderBerkas() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let data;
    try { data = await DB.reports(F.where('pp_id', '==', me.id), F.where('status', '==', 'published')); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    data.sort((a, b) => (b.published_at || 0) - (a.published_at || 0));
    if (!data.length) return (app.innerHTML = verifyBanner() + `<div class="card"><h2>Berkas Saya</h2><p class="muted">Belum ada dokumen. Dokumen akan tersedia setelah PJ Keuangan memasukkan nama TUK dan biaya komponen uji untuk Anda.</p>${me.pj_id ? '' : '<p class="err">Akun Anda belum terhubung ke PJ Keuangan. Minta PJ menambahkan email Anda di menu “PP Saya”.</p>'}</div>`) && bindBanner();
    app.innerHTML = verifyBanner() + data.map((r, i) => `<div class="card" id="rep${i}"><div class="row between"><div><h2 style="margin:0">${esc(r.tuk_name)}</h2><span class="muted">Tahun ${esc(r.tahun || '')} · Sesi ${r.jumlah_sesi} · ${r.jumlah_hari} hari · terbit ${new Date(r.published_at).toLocaleDateString('id-ID')}</span></div><div><div class="total">${U.RP(r.total)}</div><button class="btn primary" data-zip>Unduh semua (ZIP)</button></div></div>${ppFormHtml(r)}<h3 style="margin-top:16px">Dokumen per komponen uji</h3>${filesHtml(r)}</div>`).join('');
    bindBanner(); data.forEach((r, i) => { bindFiles($('#rep' + i), r); bindPPForm($('#rep' + i), r); });
  }

  /* ---------------- PJ: laporan TUK ---------------- */
  async function renderLaporan() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let data;
    try { data = me.role === 'admin' ? await DB.reports() : await DB.reports(F.where('pj_id', '==', me.id)); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    data.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    app.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Laporan TUK</h2><button class="btn primary" id="new">+ Tambah TUK</button></div>
      ${data.length ? `<div class="tablewrap"><table><thead><tr><th>TUK</th><th>PP</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>${data.map((r) => `<tr><td>${esc(r.tuk_name || '(tanpa nama)')}</td><td>${esc((r.personnel || {}).pp_name)}</td><td class="num">${U.RP(r.total)}</td><td><span class="chip ${r.status === 'published' ? 'ok' : 'warn'}">${r.status === 'published' ? 'Terbit' : 'Draft'}</span></td><td class="num"><button class="btn sm" data-e="${r.id}">Ubah / Unduh</button> <button class="btn sm danger" data-d="${r.id}">Hapus</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada laporan. Tambahkan PP di menu “PP Saya”, lalu klik “Tambah TUK”.</p>'}</div>`;
    $('#new').onclick = newReport;
    app.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => openEditor(data.find((r) => r.id === b.dataset.e))));
    app.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Hapus laporan ini? PP tidak akan bisa mengunduhnya lagi.')) return;
      try { await F.deleteDoc(F.doc(db, 'reports', b.dataset.d)); toast('Dihapus'); renderLaporan(); } catch (e) { toast(msgOf(e)); }
    }));
  }
  async function myPPs() {
    const list = me.role === 'admin' ? (await DB.users(F.where('role', '==', 'pp'))).filter((p) => p.pj_id) : await DB.users(F.where('pj_id', '==', me.id));
    return list.filter((p) => p.role === 'pp').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }
  async function newReport() {
    let pps; try { pps = await myPPs(); } catch (e) { return toast(msgOf(e)); }
    if (!pps.length) return toast('Tambahkan PP dulu di menu “PP Saya”.');
    openEditor({ id: null, pj_id: me.id, pp_id: pps[0].id, tuk_name: '', pp_institusi: pps[0].institusi || '', jumlah_sesi: 1, jumlah_hari: 1, jumlah_peserta: 0, tahun: String(new Date().getFullYear()), items: U.defaultItems(), personnel: {}, status: 'draft' }, pps);
  }
  async function openEditor(r, pps) {
    try { pps = pps || (await myPPs()); } catch (e) { return toast(msgOf(e)); }
    editing = JSON.parse(JSON.stringify(r)); editing.personnel = editing.personnel || {};
    renderEditor(pps);
  }
  function renderEditor(pps) {
    const r = editing, p = r.personnel, plN = Math.max(1, Number((r.items.find((i) => i.key === 'honor_pl') || {}).qty) || 1);
    const rowsHtml = (sec, label) => `<tr class="sec"><td colspan="5">${label}</td></tr>` + r.items.map((it, idx) => it.sec !== sec ? '' : `<tr><td>${esc(it.label)}</td><td><input type="number" min="0" step="any" data-i="${idx}" data-f="nilai" value="${it.nilai}"></td><td><input type="number" min="0" step="any" data-i="${idx}" data-f="qty" value="${it.qty}" style="width:80px"></td><td class="num" id="sum${idx}">${U.NUM(it.nilai * it.qty)}</td><td><input data-i="${idx}" data-f="ket" value="${esc(it.ket)}"></td></tr>`).join('');
    app.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">${r.id ? 'Ubah' : 'Tambah'} Laporan TUK</h2><button class="btn" id="back">← Kembali</button></div>
      <div class="grid" style="margin-top:12px">
        <div><label>Pengawas Pusat (PP)</label><select id="pp">${pps.map((x) => `<option value="${x.id}" ${x.id === r.pp_id ? 'selected' : ''}>${esc(x.full_name || x.email)}</option>`).join('')}</select></div>
        <div><label>Asal institusi PP</label><input id="inst" value="${esc(r.pp_institusi)}"></div>
        <div><label>Nama TUK *</label><input id="tuk" value="${esc(r.tuk_name)}" placeholder="mis. STIKES Wira Medika Bali"></div>
        <div><label>Tahun pelaksanaan * (tercetak di kop & nomor dokumen)</label><input id="tahun" type="number" min="2000" max="2200" value="${esc(r.tahun || new Date().getFullYear())}"></div>
        <div><label>Jumlah sesi</label><input id="sesi" type="number" min="1" value="${r.jumlah_sesi}"></div>
        <div><label>Jumlah hari</label><input id="hari" type="number" min="1" value="${r.jumlah_hari}"></div>
        <div><label>Jumlah peserta uji (→ Biaya Operasional CBT)</label><input id="peserta" type="number" min="0" value="${r.jumlah_peserta}"></div>
      </div>
      <h3 style="margin-top:18px">Jumlah petugas TUK <span class="muted" style="font-weight:400">(boleh lebih dari 1; “Banyak” honor &amp; transport dihitung otomatis. Nama petugas &amp; rumah makan diisi oleh PP)</span></h3>
      <div class="grid">
        ${[['pl', 'Pengawas Lokal (PL)'], ['admin', 'Admin'], ['it_lokal', 'IT Lokal'], ['co_cbt', 'Co CBT']].map(([k, l]) => `<div><label>${l}</label><input type="number" min="1" data-hc="${k}" value="${U.headcount(r, k)}"></div>`).join('')}
      </div>
      <h3 style="margin-top:18px">Rincian Operasional TUK</h3>
      <div class="tablewrap"><table><thead><tr><th>Komponen biaya</th><th>Nilai (Rp)</th><th>Banyak</th><th class="num">Jumlah netto</th><th>Keterangan</th></tr></thead><tbody>${rowsHtml('perjadin', 'MASUK KWITANSI PERJADIN')}${rowsHtml('sendiri', 'KUITANSI SENDIRI')}</tbody>
      <tfoot><tr><td colspan="3"><strong>TOTAL</strong></td><td class="num total" id="total">${U.NUM(U.totalOf(r.items))}</td><td></td></tr></tfoot></table></div>
      <div class="err" id="err"></div>
      <div class="row" style="margin-top:14px"><button class="btn" id="draft">Simpan draft</button><button class="btn primary" id="pub">Simpan &amp; ${r.status === 'published' ? 'perbarui terbitan' : 'terbitkan ke PP'}</button>${r.status === 'published' ? '<button class="btn danger" id="unpub">Tarik dari PP</button>' : ''}</div>
      ${r.id ? '<h3 style="margin-top:20px">Unduh dokumen</h3><p class="muted" style="margin:0 0 8px">Simpan perubahan terlebih dahulu agar dokumen memakai data terbaru.</p><div id="files"></div><div style="margin-top:10px"><button class="btn primary" data-zip>Unduh semua (ZIP)</button></div>' : ''}</div>`;
    const sync = () => { r.items.forEach((it, i) => { const el = $('#sum' + i); if (el) el.textContent = U.NUM(it.nilai * it.qty); }); $('#total').textContent = U.NUM(U.totalOf(r.items)); };
    app.querySelectorAll('[data-i]').forEach((el) => (el.oninput = () => { const it = r.items[+el.dataset.i]; it[el.dataset.f] = el.dataset.f === 'ket' ? el.value : Number(el.value) || 0; sync(); }));
    app.querySelectorAll('[data-p]').forEach((el) => (el.oninput = () => (r.personnel[el.dataset.p] = el.value)));
    app.querySelectorAll('[data-pl]').forEach((el) => (el.oninput = () => { r.personnel.pl = r.personnel.pl || []; r.personnel.pl[+el.dataset.pl] = el.value; }));
    $('#pp').onchange = (e) => { r.pp_id = e.target.value; const x = pps.find((q) => q.id === r.pp_id); if (x && !$('#inst').value) $('#inst').value = x.institusi || ''; };
    $('#peserta').oninput = (e) => { const it = r.items.find((i) => i.key === 'ops_cbt'); it.qty = Number(e.target.value) || 0; setTimeout(() => keepAndRender(pps), 0); };
    app.querySelectorAll('[data-hc]').forEach((el) => (el.onchange = () => { collect(); U.applyHeadcount(r, el.dataset.hc, el.value); setTimeout(() => keepAndRender(pps, null), 0); }));
    const recalcStaff = () => { const old = {}; ['pl', 'admin', 'it_lokal', 'co_cbt'].forEach((k) => (old[k] = U.headcount(r, k))); collect(); ['pl', 'admin', 'it_lokal', 'co_cbt'].forEach((k) => U.applyHeadcount(r, k, old[k])); setTimeout(() => keepAndRender(pps, null), 0); };
    $('#sesi').onchange = recalcStaff; $('#hari').onchange = recalcStaff;
    $('#back').onclick = () => go('laporan');
    const save = async (status) => {
      r.pp_id = $('#pp').value; r.pp_institusi = $('#inst').value.trim(); r.tuk_name = $('#tuk').value.trim();
      r.jumlah_sesi = Math.max(1, Number($('#sesi').value) || 1); r.jumlah_hari = Math.max(1, Number($('#hari').value) || 1); r.jumlah_peserta = Math.max(0, Number($('#peserta').value) || 0);
      r.tahun = String($('#tahun').value || '').trim();
      if (!/^\d{4}$/.test(r.tahun)) { $('#err').textContent = 'Isi tahun pelaksanaan dengan 4 angka, mis. 2026.'; return; }
      const x = pps.find((q) => q.id === r.pp_id); const total = U.totalOf(r.items);
      if (status === 'published' && (!r.tuk_name || total <= 0)) { $('#err').textContent = 'Untuk menerbitkan, isi nama TUK dan biaya komponen (total harus > 0).'; return; }
      const personnel = { ...r.personnel, pp_name: (x && x.full_name) || r.personnel.pp_name || '', pj_name: me.role === 'admin' && x && x.pj_id !== me.id ? ((await DB.user(x.pj_id)) || {}).full_name || '' : me.full_name };
      const now = Date.now();
      const row = { pj_id: me.role === 'admin' && x ? x.pj_id : (r.pj_id || me.id), pp_id: r.pp_id, tuk_name: r.tuk_name, pp_institusi: r.pp_institusi, jumlah_sesi: r.jumlah_sesi, jumlah_hari: r.jumlah_hari, jumlah_peserta: r.jumlah_peserta, tahun: r.tahun, jumlah_petugas: Object.fromEntries(['pl', 'admin', 'it_lokal', 'co_cbt'].map((k) => [k, U.headcount(r, k)])), items: r.items, personnel, total, status, updated_at: now, created_at: r.created_at || now, published_at: status === 'published' ? (r.status === 'published' && r.published_at ? r.published_at : now) : null };
      if (r.id) row.pj_id = r.pj_id || row.pj_id;
      try {
        let id = r.id;
        if (id) await F.updateDoc(F.doc(db, 'reports', id), row); else id = (await F.addDoc(F.collection(db, 'reports'), { ...row, petugas: {}, realisasi: {} })).id;
        toast(status === 'published' ? 'Tersimpan & terbit — PP dapat mengunduh dokumen' : 'Draft tersimpan');
        openEditor({ ...r, id, ...row }, pps);
      } catch (e) { $('#err').textContent = msgOf(e); }
    };
    $('#draft').onclick = () => save('draft'); $('#pub').onclick = () => save('published');
    const u = $('#unpub'); if (u) u.onclick = () => save('draft');
    if (r.id) { $('#files').innerHTML = filesHtml(r); bindFiles(app, r); }
  }
  function collect() {
    const r = editing;
    r.tuk_name = $('#tuk').value; r.pp_institusi = $('#inst').value; r.jumlah_sesi = Math.max(1, Number($('#sesi').value) || 1); r.jumlah_hari = Math.max(1, Number($('#hari').value) || 1); r.jumlah_peserta = Number($('#peserta').value) || 0; r.pp_id = $('#pp').value; r.tahun = $('#tahun').value;
  }
  function keepAndRender(pps, focusSel = '#peserta') {
    collect();
    const pos = focusSel ? $(focusSel).selectionStart : 0; renderEditor(pps);
    if (focusSel) { const el = $(focusSel); el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} }
  }

  /* ---------------- PJ: PP saya ---------------- */
  async function renderPP() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let pps; try { pps = await myPPs(); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    app.innerHTML = `<div class="card"><h2>PP yang saya ampu</h2>
      <p>Kode PJ Anda: <strong style="font-size:18px;letter-spacing:.1em">${esc(me.kode_pj || '-')}</strong> <span class="muted">— bagikan ke PP saat mendaftar agar otomatis terhubung.</span></p>
      <div class="row"><input id="em" type="email" placeholder="Email PP yang sudah mendaftar" style="max-width:340px"><button class="btn primary" id="add">Tambahkan PP</button></div><div class="err" id="err"></div></div>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Institusi</th><th>Email</th><th></th></tr></thead><tbody>${pps.map((p) => `<tr><td>${esc(p.full_name)}</td><td>${esc(p.institusi)}</td><td>${esc(p.email)}</td><td class="num"><button class="btn sm danger" data-r="${p.id}">Lepas</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada PP.</td></tr>'}</tbody></table></div></div>`;
    $('#add').onclick = async () => {
      const em = $('#em').value.trim().toLowerCase(); if (!em) return;
      try {
        const found = await DB.users(F.where('email', '==', em), F.where('role', '==', 'pp'), F.where('pj_id', '==', null));
        if (!found.length) { $('#err').textContent = 'Email tidak ditemukan, belum mendaftar, atau PP sudah diampu PJ lain.'; return; }
        await F.updateDoc(F.doc(db, 'users', found[0].id), { pj_id: me.id }); toast('PP ditambahkan'); renderPP();
      } catch (e) { $('#err').textContent = msgOf(e); }
    };
    app.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Lepas PP ini dari ampuan Anda?')) return;
      try {
        const used = await DB.reports(F.where('pj_id', '==', me.id), F.where('pp_id', '==', b.dataset.r));
        if (used.length && !confirm(`PP ini punya ${used.length} laporan. Laporan tetap ada tetapi PP tidak bisa lagi dikaitkan ke laporan baru. Lanjutkan?`)) return;
        await F.updateDoc(F.doc(db, 'users', b.dataset.r), { pj_id: null }); renderPP();
      } catch (e) { toast(msgOf(e)); }
    }));
  }

  /* ---------------- Admin: pengguna ---------------- */
  async function renderUsers() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let data; try { data = (await DB.users()).sort((a, b) => (a.created_at || 0) - (b.created_at || 0)); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    const pjs = data.filter((p) => p.role === 'pj' || p.role === 'admin');
    app.innerHTML = `<div class="card"><h2>Pengguna</h2><p class="muted">Ubah peran menjadi “PJ Keuangan” untuk akun yang berhak mengelola biaya TUK. Hubungkan PP ke PJ-nya di kolom terakhir.</p>
      <div class="tablewrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Diampu oleh PJ</th></tr></thead><tbody>${data.map((p) => `<tr><td>${esc(p.full_name)}<br><small class="muted">${esc(p.institusi)}</small></td><td>${esc(p.email)}</td>
      <td><select data-role="${p.id}" ${p.id === me.id ? 'disabled' : ''}>${['pp', 'pj', 'admin'].map((r) => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select>${p.kode_pj ? `<br><small class="muted">Kode: ${esc(p.kode_pj)}</small>` : ''}</td>
      <td>${p.role === 'pp' ? `<select data-pj="${p.id}"><option value="">— belum —</option>${pjs.map((j) => `<option value="${j.id}" ${p.pj_id === j.id ? 'selected' : ''}>${esc(j.full_name || j.email)}</option>`).join('')}</select>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
    app.querySelectorAll('[data-role]').forEach((s) => (s.onchange = async () => {
      const u = data.find((x) => x.id === s.dataset.role), role = s.value;
      try {
        const b = F.writeBatch(db); const ref = F.doc(db, 'users', u.id);
        if (role === 'pp') { b.update(ref, { role }); if (u.kode_pj) b.delete(F.doc(db, 'pjCodes', u.kode_pj)); b.update(ref, { kode_pj: null }); }
        else { const code = u.kode_pj || randCode(); b.update(ref, { role, kode_pj: code, pj_id: null }); if (!u.kode_pj) b.set(F.doc(db, 'pjCodes', code), { pj_id: u.id }); }
        await b.commit(); toast('Peran diperbarui'); renderUsers();
      } catch (e) { toast(msgOf(e)); renderUsers(); }
    }));
    app.querySelectorAll('[data-pj]').forEach((s) => (s.onchange = async () => { try { await F.updateDoc(F.doc(db, 'users', s.dataset.pj), { pj_id: s.value || null }); toast('Tersimpan'); } catch (e) { toast(msgOf(e)); } }));
  }

  boot();
})();
