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
    async docs(col, c) { const s = await F.getDocs(F.query(F.collection(db, col), ...c)); return s.docs.map(snap); },
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
    window.addEventListener('hashchange', () => { if (!user) start(); });
  }
  let startSeq = 0;
  async function start() {
    const seq = ++startSeq; me = null; editing = null;
    if (!user) { renderNav(); const m = /^#\/panduan-(pj|pp)$/.exec(location.hash); if (m) renderPanduan(m[1]); else renderAuth(); return; }
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
  function go(v) { view = v; editing = null; renderNav(); ({ berkas: renderBerkas, laporan: renderLaporan, impor: renderImpor, pp: renderPP, users: renderUsers, panduan: () => { guideKind = null; renderPanduan(); } }[v] || renderBerkas)(); }
  function renderNav() {
    if (!me) { nav.innerHTML = ''; return; }
    const tabs = (me.role === 'pp' ? [['berkas', 'Berkas Saya']] : [['laporan', 'Laporan TUK'], ['impor', 'Impor Data'], ['pp', 'PP Saya']].concat(me.role === 'admin' ? [['users', 'Pengguna']] : [])).concat([['panduan', 'Panduan']]);
    nav.innerHTML = tabs.map(([k, l]) => `<button data-v="${k}" class="${view === k ? 'active' : ''}">${l}</button>`).join('') +
      `<span class="who">${esc(me.full_name || me.email)} · ${ROLE[me.role]}</span><button id="out">Keluar</button>`;
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
    app.innerHTML = `<div class="authwrap"><aside class="hero"><div class="hero-logos"><img src="assets/logo-kiri.png" alt=""><img src="assets/logo-kanan.png" alt=""></div>
      <h1>Dokumen Keuangan<br>Tempat Uji Kompetensi</h1><p>Tim Ad Hoc Uji Kompetensi Nasional Rekam Medis dan Manajemen Informasi Kesehatan</p>
      <ol><li><span>1</span>PJ Keuangan menyusun biaya operasional tiap TUK</li><li><span>2</span>Pengawas Pusat melengkapi nama petugas dan dokumen mandiri</li><li><span>3</span>Seluruh berkas diunduh siap cetak di kertas A4</li></ol></aside>
      <div class="card auth">
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
      ${window.DEMO ? `<div style="margin-top:14px"><p class="muted" style="margin:0 0 6px;font-size:13px">Masuk cepat (kata sandi demo: demo123):</p><div class="row"><button class="btn sm" data-q="admin@demo.test">Admin</button><button class="btn sm" data-q="pj@demo.test">PJ Keuangan</button><button class="btn sm" data-q="pp1@demo.test">Pengawas Pusat</button></div></div>` : '<p class="center" style="margin:14px 0 0;font-size:13px"><a href="?demo=1">Coba mode demo (data tidak disimpan)</a></p>'}
      <p class="center" style="margin:12px 0 0;font-size:13px">Panduan penggunaan: <a href="#/panduan-pj">PJ Keuangan</a> · <a href="#/panduan-pp">Pengawas Pusat</a></p></div></div>`;
    app.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => F.signInWithEmailAndPassword(auth, b.dataset.q, 'demo123')));
    app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.m)));
    const rs = $('#reset'); if (rs) rs.onclick = async () => { const em = $('[name=email]').value; if (!em) return toast('Isi email dulu'); try { await F.sendPasswordResetEmail(auth, em); toast('Tautan reset dikirim ke email'); } catch (e) { toast(msgOf(e)); } };
    $('#f').onsubmit = async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); $('#go').disabled = true;
      try {
        if (mode === 'login') { await F.signInWithEmailAndPassword(auth, f.email.trim(), f.password); return; }
        const code = (f.kode_pj || '').trim().toUpperCase();
        const cred = await F.createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
        let pj_id = null, rost = null;
        try { const rs = await F.getDoc(F.doc(db, 'roster', cred.user.email.toLowerCase())); if (rs.exists()) { rost = rs.data(); pj_id = rost.pj_id; } } catch (_) {}
        if (!pj_id && code) { try { const c = await F.getDoc(F.doc(db, 'pjCodes', code)); if (c.exists()) pj_id = c.data().pj_id; } catch (_) {} }
        await F.setDoc(F.doc(db, 'users', cred.user.uid), { email: cred.user.email, full_name: f.full_name.trim() || (rost && rost.nama) || '', institusi: (f.institusi || '').trim() || (rost && rost.institusi) || '', role: 'pp', pj_id, kode_used: rost ? null : (pj_id ? code : null), kode_pj: null, created_at: Date.now() });
        if ((cred.user.email || '').toLowerCase() === ADMIN) { try { await F.sendEmailVerification(cred.user); } catch (_) {} }
        if (code && !pj_id) toast('Kode PJ tidak dikenal; minta PJ menambahkan email Anda.');
        start();
      } catch (e2) { renderAuth(mode, msgOf(e2)); }
    };
  }

  /* ---------------- Unduhan ---------------- */
  const people = (r) => ({ pj: { full_name: (r.personnel || {}).pj_name || '' }, pp: { full_name: (r.personnel || {}).pp_name || '' } });
  function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function downloadOne(r, id) {
    const { pj, pp } = people(r); const f = U.fileList(r, pj, pp).find((x) => x.id === id);
    try { saveBlob(await f.make('blob'), f.name); } catch (e) { toast('Gagal membuat berkas: ' + msgOf(e)); }
  }
  async function downloadZip(r, btn) {
    btn.disabled = true; const t = btn.textContent; btn.textContent = 'Menyiapkan…';
    try {
      const { pj, pp } = people(r); const zip = new JSZip();
      for (const f of U.fileList(r, pj, pp)) (f.folder ? zip.folder(f.folder) : zip).file(f.name, await f.make('arraybuffer'));
      saveBlob(await zip.generateAsync({ type: 'blob' }), `Keuangan UKOMNAS - ${U.safe(r.tuk_name)}.zip`);
    } catch (e) { toast('Gagal membuat ZIP: ' + msgOf(e)); }
    btn.disabled = false; btn.textContent = t;
  }
  function filesHtml(r) {
    const { pj, pp } = people(r);
    const files = U.fileList(r, pj, pp), one = (f) => `<div class="file"><div>${esc(f.label)}<small>${esc(f.folder || 'Satu file untuk seluruh TUK')}</small></div><button class="btn sm primary" data-dl="${f.id}">Unduh ${f.ext === 'docx' ? 'Word' : 'PDF'}</button></div>`;
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
    const P = Object.assign({}, r.personnel || {}, r.petugas || {}), real = r.realisasi || {}, pm = r.pp_mandiri || {};
    const nm = (k, i) => { const v = P[k]; const arr = Array.isArray(v) ? v : v ? [v] : []; return arr[i] || ''; };
    const gl = (k, i) => { const v = P[k + '_gol']; return (Array.isArray(v) ? v[i] : '') || ''; };
    return `<h3 style="margin-top:16px">Nama &amp; golongan petugas TUK, rumah makan <span class="muted" style="font-weight:400">(diisi oleh PP; tercetak di kuitansi &amp; daftar penerimaan. Jumlah sesuai hitungan PJ; golongan dikosongkan bila bukan ASN)</span></h3>
      ${STAFF_LABEL.map(([k, l]) => { const n = U.headcount(r, k); return `<div style="margin-bottom:10px"><strong style="font-size:14px">${l}</strong> <span class="muted" style="font-size:13px">(${n} orang)</span><div class="grid" data-grp="${k}" style="margin-top:6px">${Array.from({ length: n }, (_, i) => `<div><label>${l}${n > 1 ? ' ' + (i + 1) : ''}</label><input data-pt="${k}" data-n="${i}" value="${esc(nm(k, i))}"></div><div><label>Golongan${n > 1 ? ' ' + (i + 1) : ''} <span class="muted">(kosongkan jika bukan ASN)</span></label><input data-pg="${k}" data-n="${i}" placeholder="mis. III/b" value="${esc(gl(k, i))}"></div>`).join('')}</div></div>`; }).join('')}
      <div class="grid"><div><label>Nama rumah makan (konsumsi)</label><input data-rm value="${esc(P.rumah_makan || '')}"></div></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-savepp>Simpan nama petugas</button><span class="muted" style="font-size:13px">Setelah menambah nama, unduh ulang berkas komponen yang terkait.</span></div>
      <h3 style="margin-top:20px">Dokumen mandiri PP <span class="muted" style="font-weight:400">(Laporan Perjalanan Dinas, Kwitansi Perjalanan Dinas, Kwitansi Biaya Operasional)</span></h3>
      <p class="muted" style="margin:0 0 6px;font-size:13px">Dibuat sendiri oleh PP dengan nominal sesuai bukti pengeluaran (bisa kurang/lebih dari anggaran). Isi lalu simpan, kemudian unduh dokumen di folder <strong>5. PP</strong>. Nominal juga masuk ke Form Kurleb.</p>
      <div class="grid">
        <div><label>Golongan</label><input data-pm="golongan" value="${esc(pm.golongan || '')}"></div>
        <div><label>No HP</label><input data-pm="no_hp" value="${esc(pm.no_hp || '')}"></div>
        <div><label>Dasar penugasan (No. Surat Penugasan)</label><input data-pm="surat_tugas" value="${esc(pm.surat_tugas || '')}"></div>
        <div><label>Nomor SPD</label><input data-pm="spd_nomor" value="${esc(pm.spd_nomor || '')}"></div>
        <div><label>Tanggal SPD</label><input type="date" data-pm="spd_tanggal" value="${esc(pm.spd_tanggal || '')}"></div>
        <div><label>Kota asal</label><input data-pm="kota_asal" value="${esc(pm.kota_asal || '')}"></div>
        <div><label>Kota CBT / tempat pembuatan</label><input data-pm="tempat" value="${esc(pm.tempat || '')}"></div>
        <div><label>Moda transportasi</label><input data-pm="moda" placeholder="pesawat / kereta / bus" value="${esc(pm.moda || '')}"></div>
        <div><label>Tanggal berangkat</label><input type="date" data-pm="tgl_berangkat" value="${esc(pm.tgl_berangkat || '')}"></div>
        <div><label>Tanggal kembali</label><input type="date" data-pm="tgl_pulang" value="${esc(pm.tgl_pulang || '')}"></div>
        <div><label>Nama hotel</label><input data-pm="hotel_nama" value="${esc(pm.hotel_nama || '')}"></div>
        <div><label>Jumlah malam</label><input type="number" min="0" data-pm="hotel_malam" data-num value="${pm.hotel_malam ?? ''}"></div>
        ${[['uang_harian', 'Uang harian'], ['hotel', 'Hotel/penginapan'], ['travel_lain', 'Travel/transport lain'], ['transport_darat', 'Transport darat'], ['tiket', 'Tiket PP'], ['taksi_asal', 'Taksi asal'], ['taksi_tujuan', 'Taksi tujuan']].map(([k, l]) => `<div><label>${l} (Rp)</label><input type="number" min="0" step="any" data-pm="${k}" data-num value="${pm[k] ?? ''}"></div>`).join('')}
        <div><label>Biaya operasional PP (Rp)</label><input type="number" min="0" step="any" data-pm="ops_pp" data-num placeholder="${(r.items.find((x) => x.key === 'ops_pp') || {}).nilai || 0}" value="${pm.ops_pp ?? ''}"></div>
        <div><label>Uraian biaya operasional</label><input data-pm="ops_uraian" value="${esc(pm.ops_uraian || '')}"></div>
      </div>
      <div class="grid" style="grid-template-columns:1fr;margin-top:10px">
        <div><label>Tujuan perjalanan (laporan)</label><textarea data-pm="maksud" rows="2">${esc(pm.maksud || '')}</textarea></div>
        <div><label>Hasil kegiatan</label><textarea data-pm="hasil" rows="4">${esc(pm.hasil || '')}</textarea></div>
        <div><label>Tindak lanjut</label><textarea data-pm="kendala" rows="3">${esc(pm.kendala || '')}</textarea></div>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-savepm>Simpan dokumen mandiri PP</button><span class="muted" style="font-size:13px">Setelah disimpan, unduh di folder 5. PP.</span></div>
      <h3 style="margin-top:20px">Form Kurleb — realisasi pelaksanaan</h3>
      <p class="muted" style="margin:0 0 6px;font-size:13px">Berdiri sendiri: tidak mengubah dokumen komponen uji di atas, jadi tidak perlu mengunduh ulang berkas lain. Kosongkan kolom bila realisasi sama dengan anggaran PJ. Honor bersifat tetap. Tiket, hotel, taksi &amp; biaya operasional PP diisi di atas (Dokumen mandiri PP).</p>
      <div class="tablewrap"><table><thead><tr><th>Komponen</th><th class="num">Anggaran PJ (Rp)</th><th>Realisasi (Rp)</th><th class="num">Selisih</th></tr></thead><tbody>${r.items.filter((it) => !String(it.key).startsWith('honor_') && !U.PP_FORM.includes(it.key)).map((it) => { const a = it.nilai * it.qty, v = real[it.key]; return `<tr${U.PP_OWN.includes(it.key) ? ' style="background:var(--chip)"' : ''}><td>${esc(it.label)}${U.PP_OWN.includes(it.key) ? ' <span class="chip">mandiri PP</span>' : ''}</td><td class="num">${U.NUM(a)}</td><td><input type="number" min="0" step="any" data-rl="${it.key}" data-a="${a}" placeholder="${a}" value="${v === undefined || v === null ? '' : v}"></td><td class="num" data-sel="${it.key}"></td></tr>`; }).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-saverl>Simpan &amp; unduh Form Kurleb</button></div>`;
  }
  function bindPPForm(root, r) {
    const bn = root.querySelector('[data-savepp]'), br = root.querySelector('[data-saverl]'); if (!bn) return;
    const diff = (el) => { const cell = root.querySelector(`[data-sel="${el.dataset.rl}"]`); if (!cell) return; if (el.value === '') { cell.textContent = ''; return; } const d = Number(el.value) - Number(el.dataset.a); cell.textContent = d === 0 ? 'pas' : d < 0 ? 'kurang ' + U.NUM(-d) : 'lebih ' + U.NUM(d); };
    root.querySelectorAll('[data-rl]').forEach((el) => { diff(el); el.oninput = () => diff(el); });
    bn.onclick = async () => {
      const petugas = { rumah_makan: (root.querySelector('[data-rm]').value || '').trim() };
      STAFF_LABEL.forEach(([k]) => { petugas[k] = Array.from(root.querySelectorAll(`[data-pt="${k}"]`)).slice(0, U.headcount(r, k)).map((el) => (el.value || '').trim()); petugas[k + '_gol'] = Array.from(root.querySelectorAll(`[data-pg="${k}"]`)).slice(0, U.headcount(r, k)).map((el) => (el.value || '').trim()); });
      bn.disabled = true;
      try { await F.updateDoc(F.doc(db, 'reports', r.id), { petugas, petugas_at: Date.now() }); r.petugas = petugas; toast('Nama tersimpan. Unduh ulang berkas komponen yang terkait.'); } catch (e) { toast(msgOf(e)); }
      bn.disabled = false;
    };
    const bm = root.querySelector('[data-savepm]');
    if (bm) bm.onclick = async () => {
      const pp_mandiri = {};
      root.querySelectorAll('[data-pm]').forEach((el) => { const v = (el.value || '').trim(); if (v === '') return; pp_mandiri[el.dataset.pm] = el.hasAttribute('data-num') ? Math.max(0, Number(v) || 0) : v; });
      bm.disabled = true;
      try { await F.updateDoc(F.doc(db, 'reports', r.id), { pp_mandiri, petugas_at: Date.now() }); r.pp_mandiri = pp_mandiri; toast('Tersimpan. Unduh dokumen mandiri PP di folder 5. PP.'); } catch (e) { toast(msgOf(e)); }
      bm.disabled = false;
    };
    br.onclick = async () => {
      const realisasi = {}; root.querySelectorAll('[data-rl]').forEach((el) => { if (el.value !== '') realisasi[el.dataset.rl] = Math.max(0, Number(el.value) || 0); });
      br.disabled = true;
      try { await F.updateDoc(F.doc(db, 'reports', r.id), { realisasi, petugas_at: Date.now() }); r.realisasi = realisasi; downloadOne(r, 'kl'); toast('Realisasi tersimpan; Form Kurleb diunduh.'); } catch (e) { toast(msgOf(e)); }
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
    app.innerHTML = verifyBanner() + data.map((r, i) => `<div class="card" id="rep${i}"><div class="row between"><div><h2 style="margin:0">${esc(r.nomor_tuk ? r.nomor_tuk + ' - ' : '')}${esc(r.tuk_name)}</h2><span class="muted">Tahun ${esc(r.tahun || '')} · Sesi ${r.jumlah_sesi} · ${r.jumlah_hari} hari · terbit ${new Date(r.published_at).toLocaleDateString('id-ID')}</span></div><div><div class="total">${U.RP(r.total)}</div><button class="btn primary" data-zip>Unduh semua (ZIP)</button></div></div>${ppFormHtml(r)}<h3 style="margin-top:16px">Dokumen per komponen uji</h3>${filesHtml(r)}</div>`).join('');
    bindBanner(); data.forEach((r, i) => { bindFiles($('#rep' + i), r); bindPPForm($('#rep' + i), r); });
  }

  /* ---------------- PJ: laporan TUK ---------------- */
  let adminAll = false;
  async function renderLaporan() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let data;
    try { data = me.role === 'admin' && adminAll ? await DB.reports() : await DB.reports(F.where('pj_id', '==', me.id)); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    data.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    app.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Laporan TUK</h2><button class="btn primary" id="new">+ Tambah TUK</button></div>
      ${me.role === 'admin' ? `<div class="row" style="margin-bottom:10px"><span class="muted" style="font-size:13px">Tampilkan:</span><button class="btn sm ${adminAll ? '' : 'primary'}" id="fmine">Milik saya (sebagai PJ)</button><button class="btn sm ${adminAll ? 'primary' : ''}" id="fall">Semua PJ</button></div>` : ''}
      ${data.length ? `<div class="tablewrap"><table><thead><tr><th>No. TUK</th><th>TUK</th><th>PP</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>${data.map((r) => `<tr><td>${esc(r.nomor_tuk || '')}</td><td>${esc(r.tuk_name || '(tanpa nama)')}</td><td>${esc((r.personnel || {}).pp_name)}</td><td class="num">${U.RP(r.total)}</td><td><span class="chip ${r.status === 'published' ? 'ok' : 'warn'}">${r.status === 'published' ? 'Terbit' : 'Draft'}</span></td><td class="num"><button class="btn sm" data-e="${r.id}">Ubah / Unduh</button> <button class="btn sm danger" data-d="${r.id}">Hapus</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Belum ada laporan. Tambahkan PP di menu “PP Saya”, lalu klik “Tambah TUK”.</p>'}</div>`;
    $('#new').onclick = newReport;
    if (me.role === 'admin') { $('#fmine').onclick = () => { adminAll = false; renderLaporan(); }; $('#fall').onclick = () => { adminAll = true; renderLaporan(); }; }
    app.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => openEditor(data.find((r) => r.id === b.dataset.e))));
    app.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Hapus laporan ini? PP tidak akan bisa mengunduhnya lagi.')) return;
      try { await F.deleteDoc(F.doc(db, 'reports', b.dataset.d)); toast('Dihapus'); renderLaporan(); } catch (e) { toast(msgOf(e)); }
    }));
  }
  async function myPPs() {
    const list = me.role === 'admin' ? (await DB.users(F.where('role', '==', 'pp'))).filter((p) => p.pj_id) : await DB.users(F.where('pj_id', '==', me.id));
    return list.filter((p) => p.role === 'pp').sort((a, b) => ((b.pj_id === me.id) - (a.pj_id === me.id)) || (a.full_name || '').localeCompare(b.full_name || ''));
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
        <div><label>Pengawas Pusat (PP)</label><select id="pp">${(me.role === 'admin' ? [['PP saya', pps.filter((x) => x.pj_id === me.id)], ['PP milik PJ lain', pps.filter((x) => x.pj_id !== me.id)]] : [['', pps]]).filter((g) => g[1].length).map(([lbl, list]) => (lbl ? `<optgroup label="${lbl}">` : '') + list.map((x) => `<option value="${x.id}" ${x.id === r.pp_id ? 'selected' : ''}>${esc(x.full_name || x.email)}</option>`).join('') + (lbl ? '</optgroup>' : '')).join('')}</select></div>
        <div><label>Asal institusi PP</label><input id="inst" value="${esc(r.pp_institusi)}"></div>
        <div><label>Nomor TUK</label><input id="notuk" value="${esc(r.nomor_tuk || '')}" placeholder="mis. 001"></div>
        <div><label>Nama TUK *</label><input id="tuk" value="${esc(r.tuk_name)}" placeholder="mis. STIKES Wira Medika Bali"></div>
        <div><label>Tahun pelaksanaan * (tercetak di kop & nomor dokumen)</label><input id="tahun" type="number" min="2000" max="2200" value="${esc(r.tahun || new Date().getFullYear())}"></div>
        <div><label>Periode (mis. I / II)</label><input id="periode" value="${esc(r.periode || '')}"></div>
        <div><label>Tanggal pelaksanaan</label><input id="tglpel" type="date" value="${esc(r.tgl_pelaksanaan || '')}"></div>
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
      r.pp_id = $('#pp').value; r.pp_institusi = $('#inst').value.trim(); r.tuk_name = $('#tuk').value.trim(); r.nomor_tuk = ($('#notuk').value || '').trim();
      r.jumlah_sesi = Math.max(1, Number($('#sesi').value) || 1); r.jumlah_hari = Math.max(1, Number($('#hari').value) || 1); r.jumlah_peserta = Math.max(0, Number($('#peserta').value) || 0);
      r.tahun = String($('#tahun').value || '').trim(); r.periode = ($('#periode').value || '').trim(); r.tgl_pelaksanaan = $('#tglpel').value || '';
      if (!/^\d{4}$/.test(r.tahun)) { $('#err').textContent = 'Isi tahun pelaksanaan dengan 4 angka, mis. 2026.'; return; }
      const x = pps.find((q) => q.id === r.pp_id); const total = U.totalOf(r.items);
      if (status === 'published' && (!r.tuk_name || total <= 0)) { $('#err').textContent = 'Untuk menerbitkan, isi nama TUK dan biaya komponen (total harus > 0).'; return; }
      const personnel = { ...r.personnel, pp_name: (x && x.full_name) || r.personnel.pp_name || '', pj_name: me.role === 'admin' && x && x.pj_id !== me.id ? ((await DB.user(x.pj_id)) || {}).full_name || '' : me.full_name };
      const now = Date.now();
      const row = { pj_id: me.role === 'admin' && x ? x.pj_id : (r.pj_id || me.id), pp_id: r.pp_id, tuk_name: r.tuk_name, nomor_tuk: r.nomor_tuk || '', pp_institusi: r.pp_institusi, jumlah_sesi: r.jumlah_sesi, jumlah_hari: r.jumlah_hari, jumlah_peserta: r.jumlah_peserta, tahun: r.tahun, periode: r.periode || '', tgl_pelaksanaan: r.tgl_pelaksanaan || '', jumlah_petugas: Object.fromEntries(['pl', 'admin', 'it_lokal', 'co_cbt'].map((k) => [k, U.headcount(r, k)])), items: r.items, personnel, total, status, updated_at: now, created_at: r.created_at || now, published_at: status === 'published' ? (r.status === 'published' && r.published_at ? r.published_at : now) : null };
      if (r.id) row.pj_id = r.pj_id || row.pj_id;
      try {
        let id = r.id;
        if (id) await F.updateDoc(F.doc(db, 'reports', id), row); else id = (await F.addDoc(F.collection(db, 'reports'), { ...row, petugas: {}, realisasi: {}, pp_mandiri: {} })).id;
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
    r.tuk_name = $('#tuk').value; r.nomor_tuk = $('#notuk').value; r.pp_institusi = $('#inst').value; r.jumlah_sesi = Math.max(1, Number($('#sesi').value) || 1); r.jumlah_hari = Math.max(1, Number($('#hari').value) || 1); r.jumlah_peserta = Number($('#peserta').value) || 0; r.pp_id = $('#pp').value; r.tahun = $('#tahun').value; r.periode = $('#periode').value; r.tgl_pelaksanaan = $('#tglpel').value;
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
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Institusi</th><th>Email</th><th></th></tr></thead><tbody>${pps.filter((p) => p.pj_id === me.id).map((p) => `<tr><td>${esc(p.full_name)}</td><td>${esc(p.institusi)}</td><td>${esc(p.email)}</td><td class="num"><button class="btn sm danger" data-r="${p.id}">Lepas</button></td></tr>`).join('') || '<tr><td colspan="4" class="muted">Belum ada PP.</td></tr>'}</tbody></table></div></div>
      ${me.role === 'admin' && pps.some((p) => p.pj_id !== me.id) ? `<div class="card"><h3>PP milik PJ lain <span class="muted" style="font-weight:400">(hanya Admin; pindahkan lewat menu Pengguna)</span></h3><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Institusi</th><th>Email</th></tr></thead><tbody>${pps.filter((p) => p.pj_id !== me.id).map((p) => `<tr><td>${esc(p.full_name)}</td><td>${esc(p.institusi)}</td><td>${esc(p.email)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
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

  /* ---------------- Impor Data: data operasional TUK & data PP (Excel/CSV) ---------------- */
  const nz = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIAS = {
    nomor_tuk: ['nomortuk', 'notuk', 'kodetuk', 'nomor', 'no'], nama_tuk: ['namatuk', 'tuk', 'tempatujikompetensi'], email_pp: ['emailpp', 'email', 'emailpengawaspusat'],
    nama_pp: ['namapp', 'pp', 'pengawaspusat', 'namapengawaspusat'], institusi_pp: ['institusipp', 'asalinstitusi', 'institusi'], tahun: ['tahun', 'tahunpelaksanaan'], periode: ['periode'],
    tgl_pelaksanaan: ['tanggalpelaksanaan', 'tglpelaksanaan', 'tanggal'], jumlah_sesi: ['jumlahsesi', 'sesi'], jumlah_hari: ['jumlahhari', 'hari'], jumlah_peserta: ['jumlahpeserta', 'peserta'],
    jumlah_pl: ['jumlahpl', 'jumlahpengawaslokal', 'pl'], jumlah_admin: ['jumlahadmin', 'admin'], jumlah_it: ['jumlahit', 'jumlahitlokal', 'itlokal', 'it'], jumlah_cocbt: ['jumlahcocbt', 'cocbt'],
    konsumsi_briefing: ['konsumsibriefing', 'porsikonsumsibriefing'], konsumsi_h1: ['konsumsih1', 'konsumsihari1'], konsumsi_h2: ['konsumsih2', 'konsumsihari2'],
    tiket: ['tiket', 'tiketpp'], hotel: ['hotel'], ops_pp: ['opspp', 'biayaoperasionalpp'],
  };
  const ALIAS_PP = { nama: ['nama', 'namapp', 'namalengkap', 'namapengawaspusat'], email: ['email', 'emailpp'], institusi: ['institusi', 'asalinstitusi', 'institusipp'], no_hp: ['nohp', 'hp', 'telepon', 'nohp'], golongan: ['golongan', 'gol'] };
  const num = (v) => { if (typeof v === 'number') return v; const s = String(v == null ? '' : v).replace(/rp/gi, '').replace(/\s/g, ''); if (s === '' || s === '-') return null; const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
  const isoDate = (v) => {
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    const s = String(v || '').trim(); if (!s) return ''; let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };
  const readWb = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => { try { res(XLSX.read(fr.result, { type: 'array', cellDates: true })); } catch (e) { rej(e); } }; fr.onerror = () => rej(fr.error); fr.readAsArrayBuffer(file); });
  const sheetRows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  // tabel datar: baris header cocok dengan alias
  function parseFlat(wb, alias, must, minCols = 2) {
    const out = [];
    wb.SheetNames.forEach((sn) => {
      const rows = sheetRows(wb.Sheets[sn]); if (rows.some((r) => r.some((c) => nz(c) === 'komponenbiaya'))) return; // format Lembar Serah Terima: dibaca parseLembar
      const known = (r) => new Set(r.map((c) => Object.keys(alias).find((k) => alias[k].includes(nz(c)) || nz(c) === nz(k))).filter(Boolean));
      const hi = rows.findIndex((r) => known(r).has(must) && known(r).size >= minCols);
      if (hi < 0) return;
      const col = {}; rows[hi].forEach((c, i) => { const k = Object.keys(alias).find((key) => alias[key].includes(nz(c)) || nz(c) === nz(key)); if (k && col[k] === undefined) col[k] = i; });
      if (col[must] === undefined) return;
      rows.slice(hi + 1).forEach((r, i) => { if (!r.some((c) => String(c).trim() !== '')) return; const o = { _sheet: sn, _row: hi + i + 2 }; Object.keys(col).forEach((k) => (o[k] = r[col[k]])); out.push(o); });
    });
    return out;
  }
  // lembar serah terima (satu sheet per TUK) seperti operasional_TUK-PP.xlsx
  function parseLembar(wb) {
    const labelKey = {}; U.defaultItems().forEach((it) => (labelKey[nz(it.label)] = it.key)); const out = [];
    wb.SheetNames.forEach((sn) => {
      const rows = sheetRows(wb.Sheets[sn]); const head = rows.findIndex((r) => r.some((c) => nz(c) === 'komponenbiaya')); if (head < 0) return;
      const ci = (name) => rows[head].findIndex((c) => nz(c) === name);
      const cN = ci('nilai'), cQ = ci('banyak'); if (cN < 0 || cQ < 0) return;
      const o = { _sheet: sn, _row: 1, items: {} };
      const after = (r, i) => { for (let j = i + 1; j < r.length; j++) if (String(r[j]).trim() !== '') return r[j]; return ''; };
      rows.slice(0, head).forEach((r) => r.forEach((c, i) => {
        const k = nz(c);
        if (k === 'namapp') o.nama_pp = String(after(r, i)); else if (k === 'asalinstitusi') o.institusi_pp = String(after(r, i)); else if (k === 'tuk') o.nama_tuk = String(after(r, i));
        else if (k === 'jumlahsesi') o.jumlah_sesi = num(after(r, i)); else if (k === 'jumlahhari') o.jumlah_hari = num(after(r, i));
      }));
      rows.slice(head + 1).forEach((r) => { const li = r.findIndex((c) => labelKey[nz(c)]); if (li < 0) return; const key = labelKey[nz(r[li])]; const nilai = num(r[cN]), qty = num(r[cQ]); o.items[key] = { nilai: nilai == null ? 0 : nilai, qty: qty == null ? 0 : qty }; });
      if (o.nama_tuk) { const ops = o.items.ops_cbt; if (ops) o.jumlah_peserta = ops.qty; out.push(o); }
    });
    return out;
  }
  function parseTuk(wb) { const flat = parseFlat(wb, ALIAS, 'nama_tuk', 3), lem = parseLembar(wb); return flat.concat(lem); }
  function buildDraft(row, pp, pjId) {
    const sesi = Math.max(1, num(row.jumlah_sesi) || 1), hari = Math.max(1, num(row.jumlah_hari) || 1), peserta = Math.max(0, num(row.jumlah_peserta) || 0);
    const r = { jumlah_sesi: sesi, jumlah_hari: hari, items: U.defaultItems({ peserta }) };
    const set = (k, f) => { const it = r.items.find((i) => i.key === k); if (it) f(it); };
    if (row.items && Object.keys(row.items).length) r.items.forEach((it) => { const v = row.items[it.key]; if (v) { it.nilai = v.nilai; it.qty = v.qty; } else it.qty = 0; });
    else {
      const cnt = { pl: num(row.jumlah_pl), admin: num(row.jumlah_admin), it_lokal: num(row.jumlah_it), co_cbt: num(row.jumlah_cocbt) }, def = { pl: 2, admin: 1, it_lokal: 1, co_cbt: 1 };
      Object.keys(cnt).forEach((k) => U.applyHeadcount(r, k, cnt[k] || def[k]));
      [['konsumsi_briefing', row.konsumsi_briefing], ['konsumsi_h1', row.konsumsi_h1], ['konsumsi_h2', row.konsumsi_h2]].forEach(([k, v]) => { const n = num(v); if (n != null) set(k, (it) => (it.qty = n)); });
      [['tiket', row.tiket], ['hotel', row.hotel], ['ops_pp', row.ops_pp]].forEach(([k, v]) => { const n = num(v); if (n != null) set(k, (it) => (it.nilai = n)); });
    }
    const now = Date.now(), total = U.totalOf(r.items);
    return { pj_id: pjId, pp_id: pp.id, nomor_tuk: String(row.nomor_tuk == null ? '' : row.nomor_tuk).trim(), tuk_name: String(row.nama_tuk || '').trim(), pp_institusi: String(row.institusi_pp || pp.institusi || '').trim(),
      jumlah_sesi: sesi, jumlah_hari: hari, jumlah_peserta: peserta, tahun: String(num(row.tahun) || new Date().getFullYear()), periode: String(row.periode == null ? '' : row.periode).trim(), tgl_pelaksanaan: isoDate(row.tgl_pelaksanaan),
      jumlah_petugas: Object.fromEntries(['pl', 'admin', 'it_lokal', 'co_cbt'].map((k) => [k, U.headcount(r, k)])), items: r.items, personnel: { pp_name: pp.full_name || '', pj_name: '' }, total, status: 'draft', petugas: {}, realisasi: {}, pp_mandiri: {}, updated_at: now, created_at: now, published_at: null };
  }
  const dl = (wb, name) => XLSX.writeFile(wb, name);
  const sheetFrom = (aoa, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map((w) => ({ wch: w })); return ws; };
  function buildTemplateTuk() {
    const wb = XLSX.utils.book_new(), y = new Date().getFullYear();
    const head = ['nomor_tuk', 'nama_tuk', 'email_pp', 'nama_pp', 'institusi_pp', 'tahun', 'periode', 'tanggal_pelaksanaan', 'jumlah_sesi', 'jumlah_hari', 'jumlah_peserta', 'jumlah_pl', 'jumlah_admin', 'jumlah_it', 'jumlah_cocbt', 'konsumsi_briefing', 'konsumsi_h1', 'konsumsi_h2', 'tiket', 'hotel', 'ops_pp'];
    XLSX.utils.book_append_sheet(wb, sheetFrom([head,
      ['001', 'STIKES Wira Medika Bali', 'pp1@contoh.id', 'Dr I Made Sudarma Adiputra, S.Kep., Ns., M.Kes', 'STIKES Wira Medika Bali', y, 'II', '2026-08-15', 1, 1, 44, 2, 1, 1, 1, 6, 6, 0, 0, 0, 500000],
      ['002', 'Universitas Contoh', 'pp2@contoh.id', 'Contoh Pengawas Kedua, S.KM., M.Kes', 'Universitas Lain', y, 'II', '2026-08-16', 2, 2, 80, 3, 2, 1, 1, 8, 8, 8, 1200000, 900000, 500000]],
      [10, 28, 24, 36, 28, 8, 9, 20, 11, 11, 14, 10, 12, 9, 12, 16, 12, 12, 11, 11, 11]), 'Data TUK');
    XLSX.utils.book_append_sheet(wb, sheetFrom([['Kolom', 'Wajib?', 'Contoh', 'Keterangan'],
      ['nomor_tuk', 'Disarankan', '001', 'Nomor TUK; tercetak di dokumen dan nama file'],
      ['nama_tuk', 'WAJIB', 'STIKES Wira Medika Bali', 'Nama Tempat Uji Kompetensi'],
      ['email_pp', 'WAJIB*', 'pp1@contoh.id', 'Email akun PP (untuk mencocokkan PP). *Boleh diganti nama_pp bila email kosong'],
      ['nama_pp', 'Opsional', 'Dr Contoh, S.Kep., M.Kes', 'Dipakai bila email_pp kosong (harus sama dengan nama akun PP)'],
      ['institusi_pp', 'Opsional', 'STIKES Wira Medika Bali', 'Asal institusi PP; kosong = ikut data akun PP'],
      ['tahun', 'Opsional', y, '4 angka; kosong = tahun berjalan'],
      ['periode', 'Opsional', 'II', 'Periode ujian (I, II, ...)'],
      ['tanggal_pelaksanaan', 'Opsional', '2026-08-15', 'Format tahun-bulan-tanggal atau hh/bb/tttt'],
      ['jumlah_sesi', 'Opsional', 1, 'Kosong = 1'], ['jumlah_hari', 'Opsional', 1, 'Kosong = 1'], ['jumlah_peserta', 'Opsional', 44, 'Menentukan Biaya Operasional CBT (Rp 40.000 / peserta)'],
      ['jumlah_pl', 'Opsional', 2, 'Banyak Pengawas Lokal; kosong = 2. Honor (× sesi) & transport (× hari) otomatis'],
      ['jumlah_admin', 'Opsional', 1, 'Kosong = 1'], ['jumlah_it', 'Opsional', 1, 'Kosong = 1'], ['jumlah_cocbt', 'Opsional', 1, 'Kosong = 1'],
      ['konsumsi_briefing', 'Opsional', 6, 'Jumlah porsi konsumsi briefing; kosong = 6'], ['konsumsi_h1', 'Opsional', 6, 'Porsi konsumsi hari 1; kosong = 6'], ['konsumsi_h2', 'Opsional', 0, 'Porsi konsumsi hari 2; kosong = 0'],
      ['tiket / hotel / ops_pp', 'Opsional', 500000, 'Rupiah (at cost). Kosong = 0 (diisi PP di dokumen mandiri)'],
      [], ['Cara lain', '', '', 'Anda juga dapat mengunggah file operasional_TUK-PP.xlsx berformat Lembar Serah Terima (satu sheet per TUK) tanpa memakai template ini.'],
      ['Catatan', '', '', 'Hasil impor berupa DRAFT. Periksa lalu terbitkan dari menu Laporan TUK. Baris yang sudah ada (nomor + nama TUK + PP sama) dilewati.']],
      [26, 13, 28, 90]), 'Petunjuk');
    return wb;
  }
  function buildTemplatePP() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetFrom([['nama', 'email', 'institusi', 'no_hp', 'golongan'],
      ['Dr I Made Sudarma Adiputra, S.Kep., Ns., M.Kes', 'pp1@contoh.id', 'STIKES Wira Medika Bali', '08123456789', 'III/b'],
      ['Contoh Pengawas Kedua, S.KM., M.Kes', 'pp2@contoh.id', 'Universitas Contoh', '08129876543', 'III/a']], [44, 28, 30, 16, 10]), 'Data PP');
    XLSX.utils.book_append_sheet(wb, sheetFrom([['Kolom', 'Wajib?', 'Keterangan'],
      ['nama', 'Disarankan', 'Nama lengkap beserta gelar'], ['email', 'WAJIB', 'Email yang akan dipakai PP untuk mendaftar (huruf kecil). Dipakai juga untuk mencocokkan impor TUK'],
      ['institusi', 'Opsional', 'Asal institusi'], ['no_hp', 'Opsional', 'Nomor HP'], ['golongan', 'Opsional', 'Golongan, mis. III/b'],
      [], ['Catatan', '', 'PP yang mendaftar dengan email yang sama otomatis terhubung ke PJ yang mengunggah data ini, tanpa Kode PJ.']], [14, 13, 100]), 'Petunjuk');
    return wb;
  }
  const templateTuk = () => dl(buildTemplateTuk(), 'Template Data TUK.xlsx');
  const templatePP = () => dl(buildTemplatePP(), 'Template Data PP.xlsx');

  let imp = { rows: [], sel: new Set(), pps: [], free: {}, existing: [] };
  async function renderImpor() {
    app.innerHTML = '<p class="muted center">Memuat…</p>';
    let pps, roster, reps;
    try { pps = await myPPs(); roster = await DB.docs('roster', me.role === 'admin' ? [] : [F.where('pj_id', '==', me.id)]); reps = me.role === 'admin' ? await DB.reports() : await DB.reports(F.where('pj_id', '==', me.id)); } catch (e) { return (app.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`); }
    imp.pps = pps; imp.existing = reps;
    const regd = new Set(pps.map((p) => (p.email || '').toLowerCase()));
    app.innerHTML = `<div class="card"><h2>Impor Data Operasional TUK</h2>
      <p class="muted" style="margin:0 0 8px">Unggah file Excel/CSV berisi nomor TUK, nama TUK, PP, dan data operasional. Laporan dibuat sebagai <strong>draft</strong>; periksa lalu terbitkan dari menu Laporan TUK. Mendukung template di bawah, atau file <em>operasional_TUK-PP.xlsx</em> (Lembar Serah Terima, satu sheet per TUK).</p>
      <div class="row"><button class="btn" id="tpl1">Unduh template Data TUK</button><input type="file" id="f1" accept=".xlsx,.xls,.csv" style="max-width:320px"></div><div class="err" id="err1"></div><div id="prev"></div></div>
      <div class="card"><h2>Data PP (Pengawas Pusat)</h2>
      <p class="muted" style="margin:0 0 8px">Unggah daftar PP (nama, email, institusi, no HP, golongan). PP yang <strong>mendaftar dengan email yang sama</strong> otomatis terhubung ke Anda tanpa Kode PJ. Impor TUK mencocokkan PP lewat email.</p>
      <div class="row"><button class="btn" id="tpl2">Unduh template Data PP</button><input type="file" id="f2" accept=".xlsx,.xls,.csv" style="max-width:320px"></div><div class="err" id="err2"></div>
      <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Nama</th><th>Email</th><th>Institusi</th><th>No HP</th><th>Gol</th><th>Status</th><th></th></tr></thead><tbody>${roster.map((x) => `<tr><td>${esc(x.nama)}</td><td>${esc(x.email)}</td><td>${esc(x.institusi)}</td><td>${esc(x.no_hp)}</td><td>${esc(x.golongan)}</td><td><span class="chip ${regd.has((x.email || '').toLowerCase()) ? 'ok' : 'warn'}">${regd.has((x.email || '').toLowerCase()) ? 'Terdaftar' : 'Belum mendaftar'}</span></td><td class="num"><button class="btn sm danger" data-rd="${esc(x.id)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Belum ada data PP.</td></tr>'}</tbody></table></div></div>`;
    $('#tpl1').onclick = templateTuk; $('#tpl2').onclick = templatePP;
    $('#f1').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; $('#err1').textContent = ''; try { await previewTuk(f); } catch (x) { $('#err1').textContent = 'Gagal membaca file: ' + msgOf(x); } };
    $('#f2').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; $('#err2').textContent = ''; try { await importRoster(f); } catch (x) { $('#err2').textContent = msgOf(x); } };
    app.querySelectorAll('[data-rd]').forEach((b) => (b.onclick = async () => { if (!confirm('Hapus PP ini dari daftar?')) return; try { await F.deleteDoc(F.doc(db, 'roster', b.dataset.rd)); renderImpor(); } catch (x) { toast(msgOf(x)); } }));
  }
  async function importRoster(file) {
    const wb = await readWb(file), rows = parseFlat(wb, ALIAS_PP, 'email');
    if (!rows.length) throw new Error('Kolom "email" tidak ditemukan. Gunakan template Data PP.');
    let n = 0, bad = 0;
    for (const r of rows) {
      const email = String(r.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { bad++; continue; }
      await F.setDoc(F.doc(db, 'roster', email), { pj_id: me.id, email, nama: String(r.nama || '').trim(), institusi: String(r.institusi || '').trim(), no_hp: String(r.no_hp == null ? '' : r.no_hp).trim(), golongan: String(r.golongan == null ? '' : r.golongan).trim(), created_at: Date.now() }); n++;
    }
    toast(`${n} PP disimpan${bad ? `, ${bad} baris dilewati (email tidak valid)` : ''}`); renderImpor();
  }
  async function previewTuk(file) {
    const wb = await readWb(file), rows = parseTuk(wb);
    if (!rows.length) throw new Error('Data TUK tidak ditemukan. Pastikan ada kolom nama_tuk atau gunakan format Lembar Serah Terima.');
    const mine = imp.pps, byEmail = {}, byName = {}; mine.forEach((p) => { byEmail[(p.email || '').toLowerCase()] = p; byName[nz(p.full_name)] = p; });
    imp.free = {}; imp.rows = [];
    for (const [i, r] of rows.entries()) {
      const email = String(r.email_pp || '').trim().toLowerCase(); let pp = byEmail[email] || byName[nz(r.nama_pp)], note = '', ok = true;
      if (!pp && email) { try { const f = await DB.users(F.where('email', '==', email), F.where('role', '==', 'pp'), F.where('pj_id', '==', null)); if (f.length) { pp = f[0]; imp.free[pp.id] = true; note = 'PP akan ditautkan ke Anda'; } } catch (_) {} }
      if (!r.nama_tuk || !String(r.nama_tuk).trim()) { ok = false; note = 'Nama TUK kosong'; } else if (!pp) { ok = false; note = 'PP belum mendaftar / tidak ditemukan'; }
      else if (imp.existing.some((x) => x.pp_id === pp.id && (String(x.nomor_tuk || '') === String(r.nomor_tuk || '') && String(x.tuk_name || '').toLowerCase() === String(r.nama_tuk).trim().toLowerCase()))) { ok = false; note = 'Sudah ada (duplikat)'; }
      imp.rows.push({ ...r, _pp: pp, _ok: ok, _note: note || 'Siap diimpor', _i: i });
    }
    imp.sel = new Set(imp.rows.filter((x) => x._ok).map((x) => x._i));
    drawPreview();
  }
  function drawPreview() {
    const box = $('#prev'); const okn = imp.rows.filter((x) => x._ok).length;
    box.innerHTML = `<h3 style="margin:14px 0 6px">Pratinjau (${imp.rows.length} baris, ${okn} siap)</h3><div class="tablewrap"><table><thead><tr><th></th><th>No. TUK</th><th>TUK</th><th>PP</th><th>Tahun/Periode</th><th>Sesi/Hari</th><th class="num">Peserta</th><th>Status</th></tr></thead><tbody>${imp.rows.map((x) => `<tr><td><input type="checkbox" data-sel="${x._i}" ${x._ok ? '' : 'disabled'} ${imp.sel.has(x._i) ? 'checked' : ''}></td><td>${esc(x.nomor_tuk)}</td><td>${esc(x.nama_tuk)}</td><td>${esc(x._pp ? x._pp.full_name : x.nama_pp || x.email_pp || '')}</td><td>${esc(x.tahun || '')} ${esc(x.periode || '')}</td><td>${esc(x.jumlah_sesi || 1)} / ${esc(x.jumlah_hari || 1)}</td><td class="num">${esc(x.jumlah_peserta || 0)}</td><td><span class="chip ${x._ok ? 'ok' : 'warn'}">${esc(x._note)}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="go1" ${okn ? '' : 'disabled'}>Impor yang dipilih sebagai draft</button></div><div class="err" id="err3"></div>`;
    box.querySelectorAll('[data-sel]').forEach((c) => (c.onchange = () => { const i = Number(c.dataset.sel); c.checked ? imp.sel.add(i) : imp.sel.delete(i); }));
    $('#go1').onclick = async () => {
      const picks = imp.rows.filter((x) => imp.sel.has(x._i)); if (!picks.length) return;
      $('#go1').disabled = true; let n = 0;
      try {
        for (const x of picks) {
          if (imp.free[x._pp.id]) { await F.updateDoc(F.doc(db, 'users', x._pp.id), { pj_id: me.id }); x._pp.pj_id = me.id; delete imp.free[x._pp.id]; }
          const pjId = me.role === 'admin' ? x._pp.pj_id : me.id, d = buildDraft(x, x._pp, pjId);
          d.personnel.pj_name = me.role === 'admin' ? ((await DB.user(pjId)) || {}).full_name || '' : me.full_name;
          await F.addDoc(F.collection(db, 'reports'), d); n++;
        }
        toast(`${n} laporan draft dibuat`); go('laporan');
      } catch (e) { $('#err3').textContent = `Berhenti setelah ${n} laporan: ${msgOf(e)}`; $('#go1').disabled = false; }
    };
  }


  /* ---------------- Panduan / sosialisasi ---------------- */
  let guideKind = null;
  function renderPanduan(kind) {
    const G = window.PANDUAN, pub = !me, onlyPP = me && me.role === 'pp', onlyPJ = me && me.role === 'pj', single = onlyPP || onlyPJ;
    // panduan mengikuti akun: PJ hanya panduan PJ, PP hanya panduan PP (Admin & halaman publik: kedua panduan)
    kind = onlyPP ? 'pp' : onlyPJ ? 'pj' : (kind || guideKind || 'pj'); guideKind = kind;
    const g = G[kind], md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const link = location.origin + location.pathname + '#/panduan-' + kind;
    app.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">${esc(g.title)}</h2>
      <div class="row">${pub ? '<button class="btn" id="gback">← Masuk</button>' : ''}<button class="btn primary" id="gpdf">Unduh PDF (A4)</button></div></div>
      ${single ? '' : `<div class="tabs" style="margin-top:14px"><button class="btn ${kind === 'pj' ? 'primary' : ''}" data-gk="pj">Panduan PJ Keuangan</button><button class="btn ${kind === 'pp' ? 'primary' : ''}" data-gk="pp">Panduan Pengawas Pusat</button></div>`}
      <p style="margin:14px 0 0">${md(g.intro)}</p>
      <div class="row" style="margin-top:10px"><span class="muted" style="font-size:13px">Tautan untuk dibagikan:</span><input id="glink" readonly value="${esc(link)}" style="max-width:420px"><button class="btn sm" id="gcopy">Salin</button></div></div>
      ${g.sections.map((s) => `<div class="card"><h3>${esc(s.h)}</h3><ol class="guide">${s.steps.map((t) => `<li>${md(t)}</li>`).join('')}</ol>${s.tip ? `<div class="tip"><strong>Catatan:</strong> ${md(s.tip)}</div>` : ''}</div>`).join('')}`;
    app.querySelectorAll('[data-gk]').forEach((b) => (b.onclick = () => { if (pub) location.hash = '#/panduan-' + b.dataset.gk; else renderPanduan(b.dataset.gk); }));
    $('#gpdf').onclick = () => { try { saveBlob(U.panduanPdf(g).output('blob'), `Panduan ${g.short} - Keuangan UKOMNAS PMIK.pdf`); } catch (e) { toast('Gagal membuat PDF: ' + msgOf(e)); } };
    $('#gcopy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Tautan disalin'); } catch (_) { $('#glink').select(); toast('Tekan Ctrl+C untuk menyalin'); } };
    const back = $('#gback'); if (back) back.onclick = () => { location.hash = ''; renderAuth(); };
  }

  boot();
})();
