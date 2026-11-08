/* Pembuat dokumen keuangan UKOMNAS (PDF, dibuat di browser) */
(function () {
  const RP = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
  const NUM = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');

  function terbilang(n) {
    n = Math.floor(Math.abs(n));
    const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    const f = (n) => {
      if (n < 12) return s[n];
      if (n < 20) return s[n - 10] + ' belas';
      if (n < 100) return s[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + s[n % 10] : '');
      if (n < 200) return 'seratus' + (n % 100 ? ' ' + f(n % 100) : '');
      if (n < 1000) return s[Math.floor(n / 100)] + ' ratus' + (n % 100 ? ' ' + f(n % 100) : '');
      if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + f(n % 1000) : '');
      if (n < 1e6) return f(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + f(n % 1000) : '');
      if (n < 1e9) return f(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + f(n % 1e6) : '');
      if (n < 1e12) return f(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + f(n % 1e9) : '');
      return String(n);
    };
    return n === 0 ? 'nol' : f(n);
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* ---------- Template biaya (nilai dasar dari Lembar Serah Terima) ---------- */
  function defaultItems(o = {}) {
    const peserta = o.peserta || 0;
    const I = (key, sec, label, nilai, qty, ket = '') => ({ key, sec, label, nilai, qty, ket });
    return [
      I('tiket', 'perjadin', 'Tiket PP - Transport Luar Kota', 0, 1, 'at cost'),
      I('hotel', 'perjadin', 'Hotel', 0, 1, 'at cost'),
      I('trans_dalam_kota', 'sendiri', 'Transport dalam kota PP', 170000, 1),
      I('trans_briefing_pp', 'sendiri', 'Transport Briefing PP', 170000, 1),
      I('honor_briefing_pp', 'sendiri', 'Honor Briefing PP', 332500, 1),
      I('honor_pelaksanaan_pp', 'sendiri', 'Honor Pelaksanaan PP', 451250, 1, 'sesi'),
      I('konsumsi_briefing', 'sendiri', 'Konsumsi Briefing H-1', 71000, 6),
      I('konsumsi_h1', 'sendiri', 'Konsumsi Hari 1', 71000, 6),
      I('konsumsi_h2', 'sendiri', 'Konsumsi Hari 2', 71000, 0),
      I('ops_cbt', 'sendiri', 'Biaya Operasional CBT', 40000, peserta),
      I('ops_pp', 'sendiri', 'Biaya Operasional PP', 500000, 1, 'at cost'),
      I('honor_pl', 'sendiri', 'Honor PL', 275500, 2, 'per sesi bertugas'),
      I('honor_cocbt', 'sendiri', 'Honor Co CBT', 380000, 1, 'per sesi bertugas'),
      I('honor_admin', 'sendiri', 'Honor Admin', 185250, 1, 'per sesi bertugas'),
      I('honor_it', 'sendiri', 'Honor IT Lokal', 332500, 1, 'per sesi bertugas'),
      I('trans_briefing_pl', 'sendiri', 'Transport Briefing PL', 170000, 2, 'per hari bertugas'),
      I('trans_pelaksanaan_pl', 'sendiri', 'Transport Pelaksanaan PL', 170000, 2, 'per hari bertugas'),
      I('trans_cocbt', 'sendiri', 'Transport Co CBT', 170000, 1, 'per hari bertugas'),
      I('trans_admin', 'sendiri', 'Transport Admin', 170000, 1, 'per hari bertugas'),
      I('trans_it', 'sendiri', 'Transport IT Lokal', 170000, 1, 'per hari bertugas'),
    ];
  }
  const totalOf = (items) => items.reduce((s, i) => s + (Number(i.nilai) || 0) * (Number(i.qty) || 0), 0);

  /* ---------- Komponen uji = folder pada Drive MASTER TEMPLATE ---------- */
  // Jumlah petugas per peran (IT, Admin, PL, Co CBT bisa lebih dari satu orang)
  const STAFF = {
    pl: { honor: 'honor_pl', trans: [['trans_briefing_pl', 'once'], ['trans_pelaksanaan_pl', 'days']] },
    admin: { honor: 'honor_admin', trans: [['trans_admin', 'days']] },
    it_lokal: { honor: 'honor_it', trans: [['trans_it', 'days']] },
    co_cbt: { honor: 'honor_cocbt', trans: [['trans_cocbt', 'days']] },
  };
  const headcount = (r, key) => {
    const j = r.jumlah_petugas && Number(r.jumlah_petugas[key]);
    if (j > 0) return Math.floor(j);
    const it = r.items.find((i) => i.key === STAFF[key].honor);
    return Math.max(1, Math.round((Number(it && it.qty) || 1) / Math.max(1, Number(r.jumlah_sesi) || 1)));
  };
  // set jumlah petugas -> Banyak honor (x sesi) dan transport (x hari) ikut dihitung
  function applyHeadcount(r, key, n) {
    n = Math.max(1, Math.floor(Number(n)) || 1);
    const sesi = Math.max(1, Number(r.jumlah_sesi) || 1), hari = Math.max(1, Number(r.jumlah_hari) || 1);
    const set = (k, q) => { const it = r.items.find((i) => i.key === k); if (it) it.qty = q; };
    set(STAFF[key].honor, n * sesi);
    STAFF[key].trans.forEach(([k, m]) => set(k, m === 'once' ? n : n * hari));
    r.jumlah_petugas = Object.assign({}, r.jumlah_petugas, { [key]: n });
  }
  // Jumlah petugas mengikuti hitungan PJ; PP hanya mengisi nama sebanyak jumlah itu.
  const ITEM_STAFF = { honor_pl: 'pl', trans_briefing_pl: 'pl', trans_pelaksanaan_pl: 'pl', honor_admin: 'admin', trans_admin: 'admin', honor_it: 'it_lokal', trans_it: 'it_lokal', honor_cocbt: 'co_cbt', trans_cocbt: 'co_cbt' };
  const actualCount = (r, k) => headcount(r, k);   // jumlah petugas mengikuti hitungan PJ (PP tidak dapat menambah)
  const staffFactor = (r, itemKey) => { const s = ITEM_STAFF[itemKey]; return s ? actualCount(r, s) / headcount(r, s) : 1; };
  const golList = (r, key) => { const v = (r.petugas || {})[key + '_gol']; const a = Array.isArray(v) ? v : []; return Array.from({ length: actualCount(r, key) }, (_, i) => String(a[i] || '').trim()); };
  const names = (r, key) => {
    const p = Object.assign({}, r.personnel || {}, r.petugas || {});
    if (key === 'rumah_makan') return [p.rumah_makan || ''];
    const v = p[key], arr = Array.isArray(v) ? v : v ? [v] : [];
    return Array.from({ length: actualCount(r, key) }, (_, i) => arr[i] || '');
  };

  const COMPONENTS = [
    {
      key: 'admin', no: 1, folder: '1. ADMIN', label: 'Berkas Admin', role: 'Admin',
      parts: [
        { key: 'honor', label: 'Honor Admin', groups: [{ title: 'Honorarium Admin', items: ['honor_admin'], who: (r) => names(r, 'admin'), gol: (r) => golList(r, 'admin'), role: 'Admin', untuk: 'Honorarium Admin', sebagai: 'Admin', unit: 'sesi', daftar: true, perPerson: true }], hadir: [{ title: 'DAFTAR HADIR ADMIN', who: (r) => names(r, 'admin'), mode: 'both' }] },
        { key: 'transport', label: 'Transport Admin', groups: [{ title: 'Transport Lokal Admin', items: ['trans_admin'], who: (r) => names(r, 'admin'), gol: (r) => golList(r, 'admin'), role: 'Admin', untuk: 'Transport Lokal Admin', sebagai: 'Admin', unit: 'hari', daftar: true, perPerson: true }], hadir: [] },
      ],
      checklist: ['SPBY Honorarium Teknisi (Admin)', 'Kuitansi Honorarium Teknisi (Admin)', 'Daftar Penerimaan Honorarium Teknisi (Admin)', 'Daftar Hadir Pelaksanaan Admin', 'Surat Tugas Admin', 'SPBY Transport Lokal Admin', 'Kuitansi Transport Lokal Admin', 'Daftar Penerimaan Transport Lokal Admin'],
    },
    {
      key: 'cocbt', no: 2, folder: '2. Co CBT', label: 'Berkas Co CBT', role: 'Co CBT',
      parts: [
        { key: 'honor', label: 'Honor Co CBT', groups: [{ title: 'Honorarium Co CBT', items: ['honor_cocbt'], who: (r) => names(r, 'co_cbt'), gol: (r) => golList(r, 'co_cbt'), role: 'Co CBT', untuk: 'Honorarium Co CBT', sebagai: 'Co CBT', unit: 'sesi', daftar: true, perPerson: true }], hadir: [{ title: 'DAFTAR HADIR KOORDINATOR CBT', who: (r) => names(r, 'co_cbt'), mode: 'both' }] },
        { key: 'transport', label: 'Transport Co CBT', groups: [{ title: 'Transport Lokal Co CBT', items: ['trans_cocbt'], who: (r) => names(r, 'co_cbt'), gol: (r) => golList(r, 'co_cbt'), role: 'Co CBT', untuk: 'Transport Lokal Co CBT', sebagai: 'Co CBT', unit: 'hari', daftar: true, perPerson: true }], hadir: [] },
      ],
      checklist: ['SPBY Honorarium Co CBT', 'Kuitansi Honorarium Co CBT', 'Daftar Penerimaan Honorarium Co CBT', 'Daftar Hadir Co CBT', 'Surat Tugas Co CBT', 'SPBY Transport Lokal Co CBT', 'Kuitansi Transport Lokal Co CBT', 'Daftar Penerimaan Transport Lokal Co CBT'],
    },
    {
      key: 'it', no: 3, folder: '3. IT Lokal', label: 'Berkas IT Lokal', role: 'IT Lokal',
      parts: [
        { key: 'honor', label: 'Honor IT Lokal', groups: [{ title: 'Honorarium IT Lokal', items: ['honor_it'], who: (r) => names(r, 'it_lokal'), gol: (r) => golList(r, 'it_lokal'), role: 'IT Lokal', untuk: 'Honorarium IT Lokal', sebagai: 'IT Lokal', unit: 'sesi', daftar: true, perPerson: true }], hadir: [{ title: 'DAFTAR HADIR IT LOKAL', who: (r) => names(r, 'it_lokal'), mode: 'both' }] },
        { key: 'transport', label: 'Transport IT Lokal', groups: [{ title: 'Transport Lokal IT Lokal', items: ['trans_it'], who: (r) => names(r, 'it_lokal'), gol: (r) => golList(r, 'it_lokal'), role: 'IT Lokal', untuk: 'Transport Lokal IT Lokal', sebagai: 'IT Lokal', unit: 'hari', daftar: true, perPerson: true }], hadir: [] },
      ],
      checklist: ['SPBY Honorarium IT Lokal', 'Kuitansi Honorarium IT Lokal', 'Daftar Penerimaan Honorarium IT Lokal', 'Daftar Hadir IT Lokal', 'Surat Tugas IT Lokal', 'SPBY Transport Lokal IT Lokal', 'Kuitansi Transport Lokal IT Lokal', 'Daftar Penerimaan Transport Lokal IT Lokal'],
    },
    {
      key: 'pl', no: 4, folder: '4. PL', label: 'Berkas Pengawas Lokal', role: 'Pengawas Lokal',
      parts: [
        { key: 'honor', label: 'Honor Pengawas Lokal', groups: [{ title: 'Honorarium Pengawas Lokal', items: ['honor_pl'], who: (r) => names(r, 'pl'), gol: (r) => golList(r, 'pl'), role: 'Pengawas Lokal', untuk: 'Honorarium Pengawas Lokal', sebagai: 'Pengawas Lokal', unit: 'sesi', daftar: true, perPerson: true }], hadir: [{ title: 'DAFTAR HADIR BRIEFING PENGAWAS LOKAL', who: (r) => names(r, 'pl'), mode: 'briefing' }, { title: 'DAFTAR HADIR PELAKSANAAN PENGAWAS LOKAL', who: (r) => names(r, 'pl'), mode: 'pelaksanaan' }] },
        { key: 'transport-briefing', label: 'Transport Briefing Pengawas Lokal', groups: [{ title: 'Transport Lokal Pengawas Lokal (Briefing)', items: ['trans_briefing_pl'], who: (r) => names(r, 'pl'), gol: (r) => golList(r, 'pl'), role: 'Pengawas Lokal', untuk: 'Transport Lokal Pengawas Lokal (Briefing)', sebagai: 'Pengawas Lokal', unit: 'hari', daftar: true, perPerson: true }], hadir: [] },
        { key: 'transport-pelaksanaan', label: 'Transport Pelaksanaan Pengawas Lokal', groups: [{ title: 'Transport Lokal Pengawas Lokal (Pelaksanaan)', items: ['trans_pelaksanaan_pl'], who: (r) => names(r, 'pl'), gol: (r) => golList(r, 'pl'), role: 'Pengawas Lokal', untuk: 'Transport Lokal Pengawas Lokal (Pelaksanaan)', sebagai: 'Pengawas Lokal', unit: 'hari', daftar: true, perPerson: true }], hadir: [] },
      ],
      checklist: ['SPBY Honorarium Pengawas Lokal', 'Kuitansi Honorarium Pengawas Lokal', 'Daftar Penerimaan Honorarium Pengawas Lokal', 'Daftar Hadir Pengawas Lokal Briefing', 'Daftar Hadir Pengawas Lokal Pelaksanaan', 'Surat Tugas Pengawas Lokal', 'SPBY Transport Lokal Pengawas Lokal', 'Kuitansi Transport Lokal Pengawas Lokal', 'Daftar Penerimaan Transport Pengawas Lokal'],
    },
    {
      key: 'pp', no: 5, folder: '5. PP', label: 'Berkas Pengawas Pusat', role: 'Pengawas Pusat',
      parts: [
        { key: 'honor-briefing', label: 'Honor Briefing Pengawas Pusat', groups: [{ title: 'Honorarium Briefing Pengawas Pusat', items: ['honor_briefing_pp'], who: (r, c) => [c.pp.full_name], gol: (r) => [(r.pp_mandiri || {}).golongan || ''], role: 'Pengawas Pusat', sebagai: 'Pengawas Pusat', untuk: 'Honorarium Briefing Pengawas Pusat', unit: 'hari', daftar: true }], hadir: [{ title: 'DAFTAR HADIR PENGAWAS PUSAT', who: (r, c) => [c.pp.full_name], mode: 'briefing', kegiatan: 'Briefing Peserta dan Panitia Lokal H-1 Kegiatan Uji Kompetensi Mahasiswa Bidang Kesehatan' }] },
        { key: 'honor-pelaksanaan', label: 'Honor Pelaksanaan Pengawas Pusat', groups: [{ title: 'Honorarium Pelaksanaan Pengawas Pusat', items: ['honor_pelaksanaan_pp'], who: (r, c) => [c.pp.full_name], gol: (r) => [(r.pp_mandiri || {}).golongan || ''], role: 'Pengawas Pusat', sebagai: 'Pengawas Pusat', untuk: 'Honorarium Pelaksanaan Pengawas Pusat', unit: 'sesi', daftar: true }], hadir: [{ title: 'DAFTAR HADIR PELAKSANAAN PENGAWAS PUSAT', who: (r, c) => [c.pp.full_name], mode: 'pelaksanaan' }] },
        { key: 'transport-briefing', label: 'Transport Briefing Pengawas Pusat', groups: [{ title: 'Transport Lokal Pengawas Pusat (Briefing)', items: ['trans_briefing_pp'], who: (r, c) => [c.pp.full_name], gol: (r) => [(r.pp_mandiri || {}).golongan || ''], role: 'Pengawas Pusat', sebagai: 'Pengawas Pusat', untuk: 'Transport Lokal Pengawas Pusat (Briefing)', unit: 'hari', daftar: true }], hadir: [] },
        { key: 'transport-pelaksanaan', label: 'Transport Pelaksanaan Pengawas Pusat', groups: [{ title: 'Transport Lokal Pengawas Pusat (Pelaksanaan)', items: ['trans_dalam_kota'], who: (r, c) => [c.pp.full_name], gol: (r) => [(r.pp_mandiri || {}).golongan || ''], role: 'Pengawas Pusat', sebagai: 'Pengawas Pusat', untuk: 'Transport Lokal Pengawas Pusat (Pelaksanaan)', unit: 'hari', daftar: true }], hadir: [] },
        { key: 'laporan', label: 'Laporan Perjalanan Dinas (dibuat PP)', custom: 'laporan', groups: [], hadir: [] },
        { key: 'kperjadin', label: 'Kwitansi Perjalanan Dinas (dibuat PP)', custom: 'kperjadin', groups: [], hadir: [] },
        { key: 'kops', label: 'Kwitansi Biaya Operasional PP (dibuat PP)', custom: 'kops', groups: [], hadir: [] },
      ],
      checklist: ['SPBY Perjalanan Dinas Pengawas Pusat', 'Kuitansi Perjalanan Dinas (luar kota & dalam kota)', 'Rincian Perjalanan Dinas', 'Daftar Pengeluaran Riil', 'SPPD Pelaksanaan (stempel CBT)', 'Invoice Hotel dan/atau Tiket Travel', 'Boarding Pass PP (luar kota)', 'Laporan Perjalanan Dinas', 'SPBY & Kuitansi Honorarium Briefing', 'Daftar Hadir H-1', 'SPBY & Kuitansi Honorarium Pelaksanaan', 'Daftar Penerimaan Pelaksanaan', 'Daftar Hadir Pelaksanaan', 'Surat Tugas PP (dari institusi)', 'SPBY, Kuitansi & Daftar Penerimaan Transport Lokal', 'SPBY, Kuitansi & Nota Biaya Operasional PP'],
    },
    {
      key: 'cbt', no: 6, folder: '6. CBT', label: 'Berkas CBT Center', role: 'CBT Center',
      parts: [
        { key: 'operasional', label: 'Biaya Operasional CBT', groups: [
          { title: 'Biaya Operasional CBT', items: ['ops_cbt'], who: (r) => names(r, 'co_cbt'), gol: (r) => golList(r, 'co_cbt'), role: 'Co CBT / CBT Center', untuk: 'Biaya Operasional', daftar: false },
        ], hadir: [] },
        { key: 'konsumsi', label: 'Konsumsi', groups: [
          { title: 'Biaya Konsumsi Pelaksanaan Briefing', items: ['konsumsi_briefing'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', untuk: 'Biaya Konsumsi Pelaksanaan Briefing', kegiatan: 'Briefing H-1 Pelaksanaan Uji Kompetensi', daftar: false, nota: true },
          { title: 'Biaya Konsumsi Pelaksanaan Hari 1', items: ['konsumsi_h1'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', untuk: 'Biaya Konsumsi Pelaksanaan', kegiatan: 'Pelaksanaan Uji Kompetensi Hari 1', daftar: false, nota: true },
          { title: 'Biaya Konsumsi Pelaksanaan Hari 2', items: ['konsumsi_h2'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', untuk: 'Biaya Konsumsi Pelaksanaan', kegiatan: 'Pelaksanaan Uji Kompetensi Hari 2', daftar: false, nota: true, skipIfZero: true },
        ], hadir: [] },
        { key: 'sptjm', label: 'SPTJM Biaya Operasional (contoh Word - gunakan kop surat TUK)', docx: true, groups: [], hadir: [] },
      ],
      checklist: ['SPBY Biaya Operasional CBT Center', 'Kuitansi Biaya Operasional CBT', 'SPTJM (surat laporan, rincian, pernyataan)', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Briefing', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Hari 1', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Hari 2'],
    },
  ];

  /* ---------- Gambar ---------- */
  const PW = 210, M = 15;
  const LINE = [70, 70, 70];
  const HEAD = { fillColor: [226, 232, 240], textColor: 20, halign: 'center', fontStyle: 'bold' };
  const FOOT = { fillColor: [239, 242, 247], textColor: 20, fontStyle: 'bold' };
  let YEAR = new Date().getFullYear();   // diisi dari r.tahun saat berkas dibuat
  const setYear = (r) => { YEAR = String((r && r.tahun) || new Date().getFullYear()); };
  const ctx = (r, pj, pp) => ({ r, pj, pp });
  // Komponen milik PP: nominal realisasinya diisi mandiri oleh PP, hanya tampil di Lembar Kurang/Lebih
  // (dokumen komponen tetap memakai hitungan PJ).
  const PP_OWN = ['tiket', 'hotel', 'trans_dalam_kota', 'trans_briefing_pp', 'ops_pp'];
  const itm = (r, key) => {
    const it = r.items.find((i) => i.key === key) || { nilai: 0, qty: 0, label: key };
    const f = staffFactor(r, key);
    if (f > 1) return Object.assign({}, it, { qty: (Number(it.qty) || 0) * f });
    return it;
  };

  function newDoc() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    try { doc.setProperties({ title: 'Dokumen Keuangan UKOMNAS PMIK', author: 'Tim Ad Hoc UKOMNAS PMIK', creator: 'Keuangan UKOMNAS PMIK' }); doc.viewerPreferences({ PrintScaling: 'None', FitWindow: true }); } catch (e) { /* abaikan */ }
    return doc;
  }
  function kop(doc) {
    const L = window.UKOM_LOGO;
    if (L) {
      try {
        doc.addImage(L.kiri.data, 'PNG', M, 9, 18 * L.kiri.w / L.kiri.h, 18);
        const wk = 20 * L.kanan.w / L.kanan.h; doc.addImage(L.kanan.data, 'PNG', PW - M - wk, 9, wk, 20);
      } catch (e) { /* logo gagal dimuat: lanjut tanpa logo */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TIM AD HOC UJI KOMPETENSI NASIONAL REKAM MEDIS', PW / 2, 15, { align: 'center' });
    doc.text('DAN MANAJEMEN INFORMASI KESEHATAN', PW / 2, 20, { align: 'center' });
    doc.text('TAHUN ' + YEAR, PW / 2, 25, { align: 'center' });
    doc.setLineWidth(0.6);
    doc.line(M, 31, PW - M, 31);
    doc.setLineWidth(0.15);
    doc.line(M, 32, PW - M, 32);
    doc.setFont('helvetica', 'normal');
    return 39;
  }
  function title(doc, y, t, sub) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(t, PW / 2, y, { align: 'center' });
    const w = doc.getTextWidth(t);
    doc.setLineWidth(0.3); doc.line(PW / 2 - w / 2, y + 1, PW / 2 + w / 2, y + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    if (sub) doc.text(sub, PW / 2, y + 6, { align: 'center' });
    return y + (sub ? 14 : 9);
  }
  function infoBlock(doc, y, rows) {
    doc.setFontSize(10);
    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal'); doc.text(k, M, y);
      doc.text(':', M + 38, y);
      doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(String(v || '-'), PW - M * 2 - 42);
      doc.text(lines, M + 42, y);
      y += 5.5 * lines.length;
    });
    doc.setFont('helvetica', 'normal');
    return y + 2;
  }
  function signBlock(doc, y, left, right, rightLabel, leftLabel) {
    if (y > 252) { doc.addPage(); y = kop(doc); }
    const W = 72, xl = M, xr = PW - M - W;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(leftLabel || 'Yang memberikan,', xl, y);
    doc.text(rightLabel || 'Yang menerima,', xr, y);
    const L = doc.splitTextToSize(left || ' ', W), R = doc.splitTextToSize(right || ' ', W);
    signName(doc, xl, y + 26, left || '', W); signName(doc, xr, y + 26, right || '', W);
    return y + 26 + 5 * Math.max(L.length, R.length) + 4;
  }
  const at = (doc) => doc.lastAutoTable.finalY;

  // Honor pada Lembar Serah Terima adalah NETTO (sudah dipotong PPh 5%). Bruto = netto / (1 - tarif).
  const taxRate = (r) => (r.pph == null ? 5 : Number(r.pph)) / 100;
  const isHonorItem = (i) => String(i.key).startsWith('honor_');
  const brutoOf = (r, net) => Math.round(net / (1 - taxRate(r)));
  const isHonorGroup = (g) => g.items.some((k) => k.startsWith('honor_'));   // grup berisi honor (boleh bercampur transport)
  const taxLabel = (r) => 'PPh ' + (taxRate(r) * 100).toString().replace('.', ',') + '%';
  const taxNote = (r) => `Honorarium telah dipotong pajak ${taxLabel(r)}; jumlah yang dibayarkan adalah netto.`;
  // Pajak hanya atas honor; transport/biaya lain tidak dipotong. total = honor netto + non-honor.
  const taxSum = (r, g) => {
    const its = groupItems(r, g), hn = totalOf(its.filter(isHonorItem)), tr = totalOf(its.filter((i) => !isHonorItem(i)));
    const br = brutoOf(r, hn);
    return { hn, br, pph: br - hn, tr, net: hn + tr, brTotal: br + tr };
  };

  function groupItems(r, g) { return g.items.map((k) => itm(r, k)); }
  const groupTotal = (r, g) => totalOf(groupItems(r, g));
  const uraian = (r, g) =>
    groupItems(r, g).map((i) => `${i.label} (${NUM(i.qty)} x ${RP(i.nilai)})`).join('; ');

  /* =====================================================================
     Halaman dokumen mengikuti template Drive "MASTER TEMPLATE":
     SPb (Surat Perintah Bayar), Kwitansi, Daftar Penerimaan, Daftar Hadir,
     Rincian Biaya Perjalanan Dinas, Daftar Pengeluaran Riil, Form Kurleb, Laporan Hasil Perjalanan Dinas.
     ===================================================================== */
  // Kop berlogo (sama dengan Lembar Serah Terima) lalu y awal halaman digeser di bawah kop
  const top = (doc, y0) => { kop(doc); return y0 + 19; };
  const PPK = () => (window.APP_CONFIG && window.APP_CONFIG.PPK_NAME) || 'Dr. Tedy Hidayat, S.ST.RMIK., M.MRS';
  const PROGRAM = 'Mahasiswa D-3 RMIK /S.Tr MIK';
  const periodeStr = (r) => `Periode ${r.periode || '......'} Tahun ${YEAR} Tanggal ${fmtDate(r.tgl_pelaksanaan)}`;
  const kindOf = (g) => (g.items[0].startsWith('honor_') ? 'honor' : g.items[0].startsWith('trans') ? 'transport' : g.items[0].startsWith('konsumsi') ? 'konsumsi' : 'ops');
  const unitOf = (g) => g.unit || (kindOf(g) === 'honor' ? 'sesi' : 'hari');
  const fontN = (doc, s = 10) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(s); };
  const fontB = (doc, s = 10) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(s); };

  // baris "label : isi" (isi bisa array baris)
  function kv(doc, y, label, val, o = {}) {
    const x = o.x || M, lw = o.lw || 34, vw = (o.w || PW - M) - (x + lw + 4);
    fontN(doc, o.size || 10.5); doc.text(label, x, y); doc.text(':', x + lw, y);
    fontB(doc, o.size || 10.5);
    (Array.isArray(val) ? val : [val]).forEach((v) => { splitLines(doc, String(v == null || v === '' ? dots : v), vw).forEach((ln) => { doc.text(ln, x + lw + 4, y); y += 6.1; }); });
    fontN(doc, o.size || 10.5);
    return y + 1.8;
  }
  const splitLines = (doc, t, w) => doc.splitTextToSize(t, w);
  // nama penanda tangan: tebal + garis bawah (ruang tanda tangan di atasnya)
  function signName(doc, x, y, text, w = 60) {
    const ls = splitLines(doc, text || '', w); fontB(doc, 9.5);
    ls.forEach((ln, j) => doc.text(ln, x, y + j * 4.6));
    const yl = y + (ls.length - 1) * 4.6 + 1.2, lw = Math.max(doc.getTextWidth(ls[ls.length - 1] || ''), 32);
    doc.setDrawColor(40); doc.setLineWidth(0.25); doc.line(x, yl, x + lw, yl); doc.setDrawColor(0); fontN(doc);
  }

  function untukLines(r, g, extra) {
    const k = kindOf(g);
    const head = k === 'konsumsi' ? `${g.untuk} kegiatan Uji Kompetensi ${PROGRAM}` : k === 'ops' ? `Biaya Operasional kegiatan Uji Kompetensi ${PROGRAM}` : `${g.untuk} dalam rangka kegiatan Uji Kompetensi ${PROGRAM}`;
    return [head, periodeStr(r), 'Di ' + r.tuk_name].concat(extra || []);
  }
  const rincianKonsumsi = (r, g) => { const i = itm(r, g.items[0]); return `Rincian : ${NUM(i.qty)} orang x ${RP(i.nilai)} = ${RP(i.nilai * i.qty)}`; };

  // blok "Label : isi" rata: titik dua sejajar tepat di satu posisi
  function kvTop(doc, x, y, rows, step = 5.8) {
    fontN(doc); const cx = x + Math.max(...rows.map(([l]) => doc.getTextWidth(l))) + 2.5;
    rows.forEach(([l, v], i) => { const yy = y + i * step; doc.text(l, x, yy); doc.text(':', cx, yy); doc.text(String(v), cx + 3, yy); });
  }
  function signCols(doc, y, cols) {
    const W = 48, xs = cols.length === 2 ? [M, PW - M - W] : [M, M + 76, M + 132];   // 2 kolom: Bendahara rata ke margin kanan
    cols.forEach((col, i) => {
      fontN(doc, 10); doc.text(col[0], xs[i], y); doc.text(col[1], xs[i], y + 5.4);
      signName(doc, xs[i], y + 34, col[2] || '', W);
    });
    fontN(doc); return y + 46;
  }

  function pageSPb(doc, c, o) {
    const { r, pj } = c; let y = top(doc, 20);
    fontB(doc, 13); doc.text('SURAT PERINTAH BAYAR', PW / 2, y, { align: 'center' }); { const tw = doc.getTextWidth('SURAT PERINTAH BAYAR'); doc.setLineWidth(0.3); doc.line(PW / 2 - tw / 2, y + 1.5, PW / 2 + tw / 2, y + 1.5); }
    kvTop(doc, 128, y + 9, [['Tanggal', dots], ['Nomor', dots]]);
    y += 28;
    doc.text('Saya yang bertanda tangan di bawah ini selaku Pejabat Pembuatan Komitmen memerintahkan', M, y);
    doc.text('Bendahara Pengeluaran Pembantu agar melakukan Pembayaran sejumlah', M, y + 6.2); y += 14;
    doc.setLineWidth(0.3); doc.setFillColor(243, 246, 250); doc.rect(M + 36, y, 74, 10.5, 'FD'); fontB(doc, 12); doc.text(RP(o.amount), M + 73, y + 7.2, { align: 'center' }); fontN(doc); y += 19;
    y = kv(doc, y, 'Terbilang', cap(terbilang(o.amount)) + ' Rupiah');
    y = kv(doc, y, 'Kepada', o.kepada);
    y = kv(doc, y, 'Untuk Pembayaran', o.untuk);
    y += 5; doc.text('atas dasar', M, y); y += 7;
    doc.text('1.', M + 6, y); doc.text('Kwitansi/bukti pembelian', M + 12, y); doc.text(': terlampir', M + 80, y); y += 6.4;
    doc.text('2.', M + 6, y); doc.text('Nota/bukti penerimaan barang/jasa', M + 12, y); doc.text(': terlampir', M + 80, y); y += 6.4;
    doc.text('(bukti lainnya)', M + 12, y); y += 10;
    doc.text('diberikan pada', M, y); y += 7;
    doc.text('Kegiatan/output/MAK', M, y); doc.text(': ' + dots, M + 42, y); y += 7;
    doc.text('Kode', M, y); doc.text(': ' + dots, M + 42, y); y += 18;
    signCols(doc, y, [['An. Kuasa Pengguna Anggaran', 'Pejabat Pembuat Komitmen', PPK()], ['Setuju dibayar', 'Bendahara Pengeluaran', pj.full_name], ['diterima tanggal ...............', 'penerima uang/uang Muka kerja', o.penerima || '']]);
  }

  function pageKwitansi(doc, c, o) {
    const { r, pj } = c; let y = top(doc, 20);
    kvTop(doc, 128, y, [['Tahun Anggaran', YEAR], ['Nomor Bukti', dots], ['Mata Anggaran', dots]]);
    fontB(doc, 13); doc.text('KWITANSI BUKTI / PEMBAYARAN', PW / 2, y + 26, { align: 'center' });
    const w = doc.getTextWidth('KWITANSI BUKTI / PEMBAYARAN'); doc.setLineWidth(0.3); doc.line(PW / 2 - w / 2, y + 27.5, PW / 2 + w / 2, y + 27.5);
    y += 38;
    y = kv(doc, y, 'Sudah terima dari', ['Pejabat Pembuatan Komitmen', 'Ad Hoc Rekam Medis dan Manajemen Informasi Kesehatan'], { lw: 32 });
    y = kv(doc, y, 'Jumlah uang', RP(o.amount), { lw: 32 });
    y = kv(doc, y, 'Terbilang', cap(terbilang(o.amount)) + ' Rupiah', { lw: 32 });
    y = kv(doc, y, 'Untuk membayar', o.untuk, { lw: 32 });
    if (o.pajak) {
      fontN(doc); [['Bruto', o.pajak.br], ['PPh 21', o.pajak.pph], ['Netto', o.pajak.net]].forEach(([l, v]) => { doc.text(l, M + 36, y); doc.text(': ' + RP(v), M + 60, y); y += 5.2; });
    } else if (o.pajakNol) {
      fontN(doc); [['Bruto', o.amount], ['Pajak', 0], ['Netto', o.amount]].forEach(([l, v]) => { doc.text(l, M + 36, y); doc.text(': ' + (v ? RP(v) : 'Rp -'), M + 60, y); y += 5.2; });
    }
    y += 12;
    fontN(doc); doc.text((o.tempat || 'Jakarta') + ', ' + dots + ' ' + YEAR, 128, y);
    doc.text(o.menerimaLabel || 'Yang Menerima', 128, y + 6.5);
    signName(doc, 128, y + 38, o.penerima || '', 62);
    fontN(doc, 8); doc.text('Meterai diperlukan apabila nilai di atas Rp 5.000.000', M, y + 44);
    if (o.withPPK) signCols(doc, y + 58, [['An. Kuasa Pengguna Anggaran', 'Pejabat Pembuat Komitmen', PPK()], ['Setuju dibayar', 'Bendahara Pengeluaran', pj.full_name]]);
    fontN(doc);
  }

  // Daftar Penerimaan: honor (Vol, Satuan, Honorium, PPh Pasal 21, Diterima) atau transport (Vol, Satuan, Diterima)
  function pageDaftarPenerimaan(doc, c, comp, g) {
    const { r, pj } = c, k = kindOf(g), it = itm(r, g.items[0]), who = g.who(r, c), n = Math.max(1, who.length);
    const vol = (Number(it.qty) || 0) / n, unit = unitOf(g), volTxt = `${NUM(vol)} ${unit}`;
    const net = (Number(it.nilai) || 0) * vol, brUnit = brutoOf(r, it.nilai), br = Math.round(brUnit * vol), pph = br - net;
    fontB(doc, 11);
    const ttl = `Daftar Penerimaan ${k === 'honor' ? 'Honorarium' : 'Transport Lokal'} sebagai ${g.sebagai || g.role} dalam rangka Uji Kompetensi ${PROGRAM.replace('/S.Tr', '/ S.Tr')}`;
    let y = top(doc, 18); splitLines(doc, ttl, PW - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5.5; });
    fontN(doc); doc.text(periodeStr(r), M, y); y += 6; doc.text('TUK', M, y); doc.text(': ' + tukLabel(r), M + 14, y); y += 5;
    const names = who.length ? who : [''], gols = g.gol ? g.gol(r, c) : [];
    const honor = k === 'honor';
    const head = honor
      ? [[{ content: 'No', rowSpan: 2 }, { content: 'Nama', rowSpan: 2 }, { content: 'Gol', rowSpan: 2 }, { content: 'Jumlah Penerimaan', colSpan: 5 }, { content: 'Tanda Tangan', rowSpan: 2 }], ['Vol', 'Satuan', 'Honorium', 'PPh Pasal 21', 'Diterima']]
      : [[{ content: 'No', rowSpan: 2 }, { content: 'Nama', rowSpan: 2 }, { content: 'Gol', rowSpan: 2 }, { content: 'Jumlah Penerimaan', colSpan: 3 }, { content: 'Tanda Tangan', rowSpan: 2 }], ['Vol', 'Satuan', 'Diterima']];
    const body = names.map((nm, i) => honor ? [i + 1, nm || '', gols[i] || '', volTxt, RP(brUnit), RP(br), RP(pph), RP(net), ''] : [i + 1, nm || '', gols[i] || '', volTxt, RP(it.nilai), RP(net), '']);
    const foot = honor ? [[{ content: 'Jumlah', colSpan: 4, styles: { halign: 'right' } }, '=', RP(br * n), RP(pph * n), RP(net * n), '']] : [[{ content: 'Jumlah', colSpan: 4, styles: { halign: 'right' } }, '=', RP(net * n), '']];
    // transport: kolom 'Satuan' (tarif) dan 'Diterima'
    if (!honor) foot[0] = [{ content: 'Jumlah', colSpan: 4, styles: { halign: 'right' } }, '=', RP(net * n), ''];
    const total = net * n;
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 8.5, minCellHeight: 11, valign: 'middle', cellPadding: 1.3, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD,
      head, body, foot, footStyles: FOOT,
      tableWidth: PW - 2 * M, columnStyles: honor ? { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 40 }, 2: { cellWidth: 9, halign: 'center' }, 3: { cellWidth: 15 }, 4: { cellWidth: 21, halign: 'right' }, 5: { cellWidth: 21, halign: 'right' }, 6: { cellWidth: 20, halign: 'right' }, 7: { cellWidth: 21, halign: 'right' }, 8: { cellWidth: 25 } } : { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 50 }, 2: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 20 }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' }, 6: { cellWidth: 36 } },
    });
    y = at(doc) + 6; fontN(doc, 9.5); doc.text('Terbilang', M, y); doc.text(': ' + cap(terbilang(total)) + ' Rupiah', M + 22, y);
    if (honor) { doc.setFontSize(8.5); doc.text(`Honorarium telah dipotong PPh 21 ${taxLabel(r).replace('PPh ', '')}; jumlah diterima adalah netto.`, M, y + 5.5); }
    signCols(doc, y + 12, [['', 'Pejabat Pembuat Komitmen', PPK()], ['', 'Bendahara Pengeluaran', pj.full_name]]);
  }

  // SPb + Kwitansi untuk satu grup biaya
  function pageSPBY(doc, c, comp, g) {
    const { r, pp } = c, k = kindOf(g), amount = groupTotal(r, g);
    const who = g.who(r, c).filter(Boolean), penerima = g.penerimaTxt ? g.penerimaTxt(r, c) : who.length === 1 ? who[0] : who.join(', ');
    const extra = k === 'konsumsi' ? [rincianKonsumsi(r, g)] : [];
    pageSPb(doc, c, { amount, kepada: g.kepada ? g.kepada(r, c) : r.tuk_name, untuk: untukLines(r, g, extra), penerima: k === 'honor' || k === 'transport' ? '' : penerima });
  }
  function pageKuitansi(doc, c, comp, g, who, amount) {
    const { r } = c, k = kindOf(g);
    const extra = k === 'konsumsi' ? [rincianKonsumsi(r, g)] : [];
    const untuk = untukLines(r, g, extra);
    const o = { amount, untuk: untuk.concat(k === 'konsumsi' || k === 'ops' ? ['Bukti terlampir.'] : ['Daftar terlampir.']), penerima: who, withPPK: true };
    if (k === 'honor') { const s = taxSum(r, g); o.pajak = { br: s.br, pph: s.pph, net: s.hn }; }
    if (k === 'konsumsi') { o.pajakNol = true; o.menerimaLabel = 'Yang Menerima/Membayarkan'; }
    pageKwitansi(doc, c, o);
  }

  // ---------- Daftar Hadir (mengikuti PDF template) ----------
  function hadirBlock(doc, y, kegiatan, nRows, names, jamTempat) {
    fontN(doc, 9.5);
    doc.text('Kegiatan', M, y); doc.text(': ' + kegiatan, M + 24, y); doc.text('Jam : ' + dots, 128, y);
    doc.text('Hari, Tanggal', M, y + 6); doc.text(': ' + dots, M + 24, y + 6); doc.text('Tempat : ' + dots, 128, y + 6);
    const body = Array.from({ length: nRows }, (_, i) => [i + 1, names[i] || '', '', '']);
    doc.autoTable({
      startY: y + 10, theme: 'grid', styles: { fontSize: 9, minCellHeight: 8.5, valign: 'middle', cellPadding: 1.2, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD, head: [['No', 'Nama', 'Tanda Tangan', 'Asal Institusi']], body,
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 48 }, 3: { cellWidth: 48 } },
    });
    return at(doc) + 8;
  }
  // h = { title: 'DAFTAR HADIR ADMIN', who: [...], mode: 'both'|'briefing'|'pelaksanaan' }
  function pageDaftarHadir(doc, c, h) {
    const { r, pp } = c, names = (typeof h.who === 'function' ? h.who(r, c) : h.who) || [], n = Math.max(names.length, 3), sesi = Math.max(1, Number(r.jumlah_sesi) || 1);
    const head = () => { const y = top(doc, 18); fontB(doc, 13); doc.text(h.title, PW / 2, y, { align: 'center' }); return y + 10; };
    let first = true;
    if (h.mode !== 'pelaksanaan') {
      let y = head(); y = hadirBlock(doc, y, 'Pelaksanaan Uji Kompetensi H-1 (Briefing)', Math.max(n, 6), names);
      first = false;
      if (h.mode === 'both') { /* briefing halaman sendiri */ }
    }
    if (h.mode !== 'briefing') {
      if (!first) doc.addPage();
      let y = head(), perPage = 0;
      for (let s = 1; s <= sesi; s++) {
        if (perPage === 3) { doc.addPage(); y = head(); perPage = 0; }
        y = hadirBlock(doc, y, `Pelaksanaan Uji Kompetensi Sesi ${s}`, n, names); perPage++;
      }
      fontN(doc); doc.text('Mengetahui', 145, Math.min(y + 4, 262)); doc.text('Pengawas Pusat', 145, Math.min(y + 9, 267));
      signName(doc, 145, Math.min(y + 30, 276), pp.full_name || '', 52);
    }
  }
  function pageNotaHadirKonsumsi(doc, c, g) {
    const { r } = c, it = itm(r, g.items[0]);
    const yy = top(doc, 18); fontB(doc, 12); doc.text('DAFTAR HADIR KONSUMSI PELAKSANAAN UJI KOMPETENSI', PW / 2, yy, { align: 'center' });
    fontN(doc, 10); let y = yy + 12;
    [['Kegiatan', g.kegiatan || g.untuk], ['Tanggal', fmtDate(r.tgl_pelaksanaan)], ['Pukul', dots], ['Tempat', r.tuk_name]].forEach(([l, v]) => { doc.text(l, M, y); doc.text(': ' + v, M + 26, y); y += 6; });
    const rows = Math.max(1, Number(it.qty) || 1);
    doc.autoTable({
      startY: y + 2, theme: 'grid', styles: { fontSize: 9, minCellHeight: 8, valign: 'middle', cellPadding: 1.1, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD, head: [['No', 'Nama', 'Asal Institusi', 'Tanda tangan', 'Kabupaten/Kota']],
      body: Array.from({ length: rows }, (_, i) => [i + 1, '', '', '', '']), columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
    });
  }

  /* ---------- RINCIAN OPERASIONAL TUK (Lembar Serah Terima) - wajib di setiap berkas ---------- */
  function pageRincian(doc, c, numberLabel) {
    const { r, pj, pp } = c;
    let y = kop(doc);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('LEMBAR SERAH TERIMA', M, y + 4);
    doc.setFontSize(10);
    doc.text(String(numberLabel || '1'), PW - M, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y = infoBlock(doc, y + 12, [
      ['Nama PP', pp.full_name], ['Asal Institusi', r.pp_institusi], ['TUK', tukLabel(r)],
      ['Jumlah Sesi', r.jumlah_sesi], ['Jumlah Hari', r.jumlah_hari],
    ]);
    const body = [];
    const sec = (t) => body.push([{ content: t, colSpan: 5, styles: { halign: 'center', fillColor: [190, 245, 225], fontStyle: 'bold' } }]);
    const line = (i) => [i.label, i.nilai ? NUM(i.nilai) : '-', NUM(i.qty), (i.nilai * i.qty) ? NUM(i.nilai * i.qty) : '-', i.ket || ''];
    sec('MASUK KWITANSI PERJADIN');
    r.items.filter((i) => i.sec === 'perjadin').forEach((i) => body.push(line(i)));
    sec('KUITANSI SENDIRI');
    r.items.filter((i) => i.sec !== 'perjadin').forEach((i) => body.push(line(i)));
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.4, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD,
      head: [['Komponen Biaya', 'Nilai (Rp)', 'Banyak', 'Jumlah Netto (Rp)', 'Keterangan']],
      body,
      foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'left' } }, NUM(totalOf(r.items)), '']],
      footStyles: FOOT,
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center', cellWidth: 16 }, 3: { halign: 'right' } },
    });
    doc.setFontSize(8.5); doc.setTextColor(60);
    doc.text(`Catatan: seluruh nilai honor pada tabel di atas adalah netto, sudah dipotong ${taxLabel(r)}.`, M, at(doc) + 5);
    doc.setTextColor(0); doc.setFontSize(10);
    signBlock(doc, at(doc) + 10, pj.full_name, pp.full_name);
  }

  /* ---------- Footer identitas TUK di setiap halaman ---------- */
  function footers(doc, c, label) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(190); doc.setLineWidth(0.2); doc.line(M, 281.2, PW - M, 281.2); doc.setDrawColor(0);
      doc.setFontSize(7); doc.setTextColor(90);
      doc.text(`TUK: ${tukLabel(c.r)} | PP: ${c.pp.full_name}`, M, 284);
      doc.text(`Sesi ${c.r.jumlah_sesi} / Hari ${c.r.jumlah_hari}`, M, 288);
      doc.text(`${label} - hal ${i}/${n}`, PW - M, 288, { align: 'right' });
      doc.setTextColor(0);
    }
  }

  /* ---------- Builder berkas ---------- */
  /* ---------- Dokumen yang dibuat mandiri oleh PP (data dari isian PP: r.pp_mandiri) ---------- */
  const PM = (r) => r.pp_mandiri || {};
  const pmAmt = (r, key) => { const v = PM(r)[key]; return v === undefined || v === null || v === '' || !isFinite(Number(v)) ? null : Number(v); };
  const anggaranOf = (r, key) => { const i = r.items.find((x) => x.key === key); return i ? (Number(i.nilai) || 0) * (Number(i.qty) || 0) : 0; };
  const amtPP = (r, key) => { const v = pmAmt(r, key); return v === null ? anggaranOf(r, key) : v; };   // belum diisi PP -> pakai anggaran PJ
  const PP_FORM = ['tiket', 'hotel', 'ops_pp'];
  const dots = '.............................';
  const tukLabel = (r) => (r.nomor_tuk ? r.nomor_tuk + ' - ' : '') + (r.tuk_name || '');
  const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : dots);
  const lamaHari = (a, b) => (a && b ? Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1) : null);

  const PP_ROWS = [['uang_harian', 'Uang Harian'], ['hotel', 'Hotel/Penginapan'], ['travel_lain', 'Travel/Transport lain'], ['transport_darat', 'Transport Darat'], ['tiket', 'Tiket PP'], ['taksi_asal', 'Taksi Asal'], ['taksi_tujuan', 'Taksi Tujuan']];
  const ppAmt = (r, key) => { const v = pmAmt(r, key); return v === null ? (key === 'tiket' || key === 'hotel' ? anggaranOf(r, key) : 0) : v; };
  const perjadinTotal = (r) => PP_ROWS.reduce((s, [k]) => s + ppAmt(r, k), 0);

  // 5. Rincian biaya perjalanan dinas
  function pageRincianPerjadin(doc, c) {
    const { r, pj, pp } = c, m = PM(r), total = perjadinTotal(r), K = top(doc, 0);
    fontB(doc, 13); doc.text('RINCIAN BIAYA PERJALANAN DINAS', PW / 2, 20 + K, { align: 'center' });
    kvTop(doc, M, 32 + K, [['Lampiran SPD Nomor', m.spd_nomor || dots], ['Tanggal', m.spd_tanggal ? fmtDate(m.spd_tanggal) : dots]], 6);
    doc.autoTable({
      startY: 43 + K, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD, head: [['NO', 'PERINCIAN BIAYA', 'JUMLAH', 'KETERANGAN']],
      body: PP_ROWS.map(([k, l], i) => [i + 1, l, ppAmt(r, k) ? RP(ppAmt(r, k)) : 'Rp -', k === 'hotel' && m.hotel_nama ? `${m.hotel_nama}${m.hotel_malam ? ', ' + m.hotel_malam + ' malam' : ''}` : k === 'tiket' && m.moda ? m.moda : '']),
      foot: [[{ content: 'Jumlah', colSpan: 2, styles: { halign: 'right' } }, RP(total), '']], footStyles: FOOT,
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { halign: 'right', cellWidth: 38 } },
    });
    let y = at(doc) + 7; fontN(doc); doc.text('Terbilang : ' + (total ? cap(terbilang(total)) + ' Rupiah' : '-'), M, y); y += 9;
    doc.text('Telah dibayar sejumlah', M, y); doc.text(RP(total), M + 50, y); doc.text((m.tempat || '(Kota CBT)') + ', ' + fmtDate(m.tgl_pulang || r.tgl_pelaksanaan), 120, y); y += 6;
    doc.text('Telah menerima jumlah uang sebesar ' + RP(total), 120, y); y += 6;
    doc.text('Bendahara Pengeluaran', M, y); doc.text('Yang Menerima,', 120, y);
    signName(doc, M, y + 24, pj.full_name || '', 70); signName(doc, 120, y + 24, pp.full_name || '', 70); y += 34; fontN(doc, 9.5);
    doc.text('Ditetapkan sejumlah', M, y); doc.text(': ' + RP(total), M + 50, y); y += 5.5;
    doc.text('Yang telah dibayar semula', M, y); doc.text(': Rp -', M + 50, y); y += 5.5;
    doc.text('Sisa kurang/lebih', M, y); doc.text(': ' + RP(total), M + 50, y);
    doc.text('Pejabat Pembuat Komitmen', 120, y - 4); signName(doc, 120, y + 20, PPK(), 70);
  }
  // Daftar Pengeluaran Riil
  function pageRiil(doc, c) {
    const { r, pp } = c, m = PM(r), rows = [['Transport darat', ppAmt(r, 'transport_darat')], ['Taksi Asal', ppAmt(r, 'taksi_asal')], ['Taksi Tujuan', ppAmt(r, 'taksi_tujuan')]], total = rows.reduce((s, x) => s + x[1], 0);
    const K = top(doc, 0);
    fontB(doc, 13); doc.text('DAFTAR PENGELUARAN RIIL', PW / 2, 20 + K, { align: 'center' });
    fontN(doc); let y = 32 + K; doc.text('Yang bertanda tangan di bawah ini, atas nama Kuasa Pengguna Anggaran :', M, y); y += 8;
    [['Nama', PPK()], ['Jabatan', 'Pejabat Pembuat Komitmen']].forEach(([l, v]) => { doc.text(l, M, y); doc.text(': ' + v, M + 22, y); y += 5.5; });
    y += 3; doc.text('Berdasarkan Surat Perjalanan Dinas (SPD) :', M, y); y += 6;
    doc.text('Nomor', M, y); doc.text(': ' + (m.spd_nomor || dots), M + 22, y); y += 5.5; doc.text('Tanggal', M, y); doc.text(': ' + (m.spd_tanggal ? fmtDate(m.spd_tanggal) : dots), M + 22, y); y += 8;
    doc.text('dengan ini kami menyatakan dengan sesungguhnya bahwa :', M, y); y += 6;
    doc.text('1', M, y); doc.text('Biaya transportasi pegawai dan / atau biaya penginapan di bawah ini yang tidak dapat diperoleh', M + 6, y); y += 5; doc.text('bukti - bukti pengeluarannya meliputi :', M + 6, y);
    doc.autoTable({
      startY: y + 3, theme: 'grid', margin: { left: M + 6 }, styles: { fontSize: 9.5, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD, head: [['No', 'Uraian', 'Jumlah']],
      body: rows.map(([l, v], i) => [i + 1, l, v ? RP(v) : 'Rp -']), foot: [[{ content: 'Jumlah', colSpan: 2, styles: { halign: 'right' } }, total ? RP(total) : 'Rp -']], footStyles: FOOT,
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { halign: 'right', cellWidth: 40 } },
    });
    y = at(doc) + 6; fontN(doc); doc.text('Terbilang: ' + (total ? cap(terbilang(total)) + ' Rupiah' : '-'), M + 6, y); y += 8;
    doc.text('2', M, y);
    ['Jumlah uang tersebut pada angka 1 diatas benar-benar dikeluarkan untuk pelaksanaan perjalanan dinas dimaksud dan apabila di kemudian hari terdapat kelebihan atas pembayaran, kami bersedia untuk menyetorkan kelebihan tersebut ke kas negara.'].forEach((t) => splitLines(doc, t, PW - 2 * M - 6).forEach((ln) => { doc.text(ln, M + 6, y); y += 5; }));
    y += 3; splitLines(doc, 'Demikian pernyataan ini kami buat dengan sebenarnya, untuk dapat dipergunakan sebagaimana mestinya.', PW - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5; });
    y += 6; doc.text('Mengetahui / Menyetujui', M, y); doc.text((m.tempat || '(Kota CBT)') + ', ' + fmtDate(m.tgl_pulang || r.tgl_pelaksanaan), 120, y);
    doc.text('Pejabat Pembuat Komitmen', M, y + 6); doc.text('Pelaksana SPD,', 120, y + 6);
    signName(doc, M, y + 30, PPK(), 70); signName(doc, 120, y + 30, pp.full_name || '', 70);
  }

  const CUSTOM = {
    // Kwitansi Perjadin_PP: rincian + SPb + kwitansi + daftar pengeluaran riil
    kperjadin(r, pj, pp) {
      setYear(r); const c = ctx(r, pj, pp), doc = newDoc(), m = PM(r), total = perjadinTotal(r);
      const untuk = ['Biaya Perjalanan Dinas ke CBT dalam rangka kegiatan Uji Kompetensi', PROGRAM, periodeStr(r), 'Sesuai Surat penugasan Nomor ' + (m.surat_tugas || dots)];
      pageRincianPerjadin(doc, c);
      doc.addPage(); pageSPb(doc, c, { amount: total, kepada: pp.full_name, untuk, penerima: pp.full_name });
      doc.addPage(); pageKwitansi(doc, c, { amount: total, untuk, penerima: pp.full_name, withPPK: true, tempat: m.tempat });
      doc.addPage(); pageRiil(doc, c);
      footers(doc, c, 'Kwitansi Perjadin PP'); return doc;
    },
    // Kwitansi Biaya Operasional_PP: kwitansi + SPb
    kops(r, pj, pp) {
      setYear(r); const c = ctx(r, pj, pp), doc = newDoc(), m = PM(r), total = amtPP(r, 'ops_pp');
      pageKwitansi(doc, c, { amount: total, untuk: [m.ops_uraian || 'Biaya Operasional dalam rangka kegiatan Uji Kompetensi', PROGRAM, periodeStr(r), 'Di ' + r.tuk_name, 'Daftar terlampir.'], penerima: pp.full_name, withPPK: true, tempat: m.tempat });
      doc.addPage(); pageSPb(doc, c, { amount: total, kepada: pp.full_name, untuk: ['Biaya Operasional Pengawas Pusat dalam rangka kegiatan Uji Kompetensi', PROGRAM + ' ' + periodeStr(r), 'Di ' + r.tuk_name], penerima: pp.full_name });
      footers(doc, c, 'Kwitansi Biaya Operasional PP'); return doc;
    },
    // FORM LAPORAN PERJALANAN DINAS PP
    laporan(r, pj, pp) {
      setYear(r); const c = ctx(r, pj, pp), doc = newDoc(), m = PM(r), lama = lamaHari(m.tgl_berangkat, m.tgl_pulang);
      const K = top(doc, 0);
      fontB(doc, 13); doc.text('LAPORAN HASIL PERJALANAN DINAS', PW / 2, 22 + K, { align: 'center' });
      fontN(doc, 10.5); let y = 36 + K;
      const row = (l, v) => { doc.text(l, M, y); doc.text(':', M + 42, y); fontB(doc, 10.5); const ls = splitLines(doc, v || dots, PW - M - (M + 46)); ls.forEach((ln) => { doc.text(ln, M + 46, y); y += 5.6; }); fontN(doc, 10.5); y += 1.5; };
      const para = (l, v) => { doc.text(l, M, y); doc.text(':', M + 42, y); const ls = splitLines(doc, v || dots + dots + dots, PW - M - (M + 46)); ls.forEach((ln) => { if (y > 265) { doc.addPage(); y = top(doc, 22); } doc.text(ln, M + 46, y); y += 5.6; }); y += 4; };
      row('Nama', pp.full_name); row('Golongan', m.golongan); row('Asal Instansi', r.pp_institusi); row('Tempat Tujuan', r.tuk_name);
      para('Tujuan Perjalanan', m.maksud || `Melaksanakan tugas sebagai Pengawas Pusat pada Uji Kompetensi ${PROGRAM} ${periodeStr(r)} di ${r.tuk_name}.`);
      row('Lama Perjalanan Dinas', lama ? `${lama} hari (${fmtDate(m.tgl_berangkat)} s.d. ${fmtDate(m.tgl_pulang)})` : '');
      para('Hasil Kegiatan', m.hasil); para('Tindak Lanjut', m.kendala);
      y += 6; if (y > 240) { doc.addPage(); y = top(doc, 22); }
      doc.text((m.tempat || '(Nama Kota CBT)') + ', ' + fmtDate(m.tgl_pulang || r.tgl_pelaksanaan), 128, y); doc.text('Yang Melaporkan', 128, y + 6);
      signName(doc, 128, y + 32, pp.full_name || '', 70);
      footers(doc, c, 'Laporan Perjalanan Dinas'); return doc;
    },
  };

  // FORM KURLEB (anggaran PJ = "Yang diberikan"; "Yang dikeluarkan" = realisasi)
  function buildKurangLebih(r, pj, pp) {
    setYear(r);
    const c = ctx(r, pj, pp), doc = newDoc(), real = r.realisasi || {}, m = PM(r);
    const sumA = (...ks) => ks.reduce((s, k) => s + anggaranOf(r, k), 0);
    const given = (ks) => sumA(...ks);
    // [label, kunci anggaran PJ, sumber realisasi]
    const rows = [
      ['Transport (dalam kota)', ['trans_dalam_kota'], () => real.trans_dalam_kota], ['Transport (luar kota)', [], () => pmAmt(r, 'travel_lain')], ['Hotel', [], () => pmAmt(r, 'hotel')],
      ['Honor Briefing PP', ['honor_briefing_pp']], ['Honor Pelaksanaan PP', ['honor_pelaksanaan_pp']], ['Konsumsi di CBT', ['konsumsi_briefing', 'konsumsi_h1', 'konsumsi_h2'], () => real.konsumsi_h1],
      ['Biaya Operasional CBT', ['ops_cbt'], () => real.ops_cbt], ['Biaya Operasional PP', ['ops_pp'], () => pmAmt(r, 'ops_pp')],
      ['Honor PL', ['honor_pl']], ['Transport PL', ['trans_briefing_pl', 'trans_pelaksanaan_pl'], () => real.trans_briefing_pl],
      ['Honor Co CBT ', ['honor_cocbt']], ['Transport Co CBT', ['trans_cocbt'], () => real.trans_cocbt], ['Honor Admin', ['honor_admin']], ['Transport Lokal Admin ', ['trans_admin'], () => real.trans_admin],
      ['Honor IT Lokal', ['honor_it']], ['Transport Lokal IT Lokal ', ['trans_it'], () => real.trans_it],
      ['Taksi Asal', [], () => pmAmt(r, 'taksi_asal')], ['Taksi TUK', [], () => pmAmt(r, 'taksi_tujuan')], ['Pesawat', [], () => pmAmt(r, 'tiket')], ['Transport (dalam kota)', [], () => pmAmt(r, 'transport_darat')], ['Transport (luar kota)', []], ['', []], ['', []], ['', []],
    ];
    const K = top(doc, 0) + 1;
    fontB(doc, 11); doc.text('Nama (PP) : ' + (pp.full_name || ''), M, 20 + K); doc.text('TUK : ' + tukLabel(r), M, 26 + K); doc.text('No Hp : ' + (m.no_hp || ''), M, 32 + K); fontN(doc);
    let tg = 0, td = 0, tk = 0, tl = 0;
    const body = rows.map(([label, ks, fn], i) => {
      const g = given(ks), v = fn ? fn() : undefined, has = v !== undefined && v !== null && v !== '' && isFinite(Number(v)), out = has ? Number(v) : g;
      const K = out < g ? g - out : 0, L = out > g ? out - g : 0; tg += g; td += out; tk += K; tl += L;
      const show = (x) => (label ? (x ? NUM(x) : '') : '');
      return [i + 1, label, show(g), has || g ? show(out) : '', K ? NUM(K) : '', L ? NUM(L) : ''];
    });
    doc.autoTable({
      startY: 37 + K, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.2, minCellHeight: 6.2, lineColor: LINE, lineWidth: 0.2, textColor: 20 },
      headStyles: HEAD, head: [['No.', 'Uang', 'Yang diberikan', 'Yang dikeluarkan', 'Kurang', 'Lebih']],
      body, foot: [[{ content: 'Jumlah', colSpan: 2 }, NUM(tg), NUM(td), NUM(tk), NUM(tl)]], footStyles: FOOT,
      columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
    let y = at(doc) + 9; fontN(doc, 10);
    const net = tg - td;
    doc.text('Jumlah yang diterima/dikembalikan  ' + (net === 0 ? '-' : (net > 0 ? 'dikembalikan ' : 'diterima ') + RP(Math.abs(net))), M, y);
    if (y > 240) { doc.addPage(); y = top(doc, 22); }
    doc.text('Pengawas Pusat', 140, y + 10); signName(doc, 140, y + 34, pp.full_name || '', 60);
    footers(doc, c, 'Form Kurleb');
    return doc;
  }

  // ---------- SPTJM dalam bentuk Word (contoh; TUK memakai kop surat sendiri) ----------
  async function buildSptjmDocx(r, pj, pp, asType) {
    setYear(r);
    const ops = groupTotal(r, { items: ['ops_cbt'] }), per = periodeStr(r), x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const P = (t, o = {}) => `<w:p><w:pPr><w:jc w:val="${o.c ? 'center' : o.r ? 'right' : o.j ? 'both' : 'left'}"/><w:spacing w:after="${o.after == null ? 100 : o.after}"/>${o.br ? '<w:pageBreakBefore/>' : ''}${o.ind ? '<w:ind w:left="' + o.ind + '"/>' : ''}</w:pPr><w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}<w:sz w:val="${(o.size || 11) * 2}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r></w:p>`;
    const kota = '(kota CBT)', tgl = r.tgl_pelaksanaan ? fmtDate(r.tgl_pelaksanaan) : '… ' + YEAR;
    const paras = [
      P('[ KOP SURAT TUK / CBT — gunakan kop surat institusi ]', { c: true, b: true, size: 12, after: 240 }),
      P(`Nomor : ${kota}, ${tgl}`), P('Lampiran : 2 (dua) lembar'),
      P(`Perihal : Laporan dan Bukti Pertanggungjawaban atas biaya operasional Uji Kompetensi ${PROGRAM} ${per}`, { after: 200 }),
      P('Kepada Yth.', { after: 40 }), P('Ketua Panitia Ujian Kompetensi Nasional Mahasiswa D-3 RMIK / S.Tr MIK – Ad Hoc Uji Kompetensi Nasional Rekam Medis dan Manajemen Informasi Kesehatan', { after: 40 }), P('Di tempat', { after: 200 }),
      P('Dengan hormat,'),
      P(`Sehubungan dengan telah selesainya Pelaksanaan Uji Kompetensi Nasional ${PROGRAM} ${per}, bersama ini kami dari CBT ${r.tuk_name} ingin menyampaikan laporan pertanggungjawaban keuangan kegiatan ini sebesar ${RP(ops)} (${cap(terbilang(ops))} rupiah) sebagai berikut :`, { j: true }),
      P('1. Laporan Surat Pernyataan Tanggung Jawab Mutlak (SPTJM) (terlampir)', { ind: 360 }), P('2. Laporan Surat Pernyataan Tanggung Jawab Belanja (SPTB) (terlampir)', { ind: 360, after: 200 }),
      P('Atas perhatian dan kerjasamanya kami ucapkan terima kasih.', { after: 300 }),
      P('Koord CBT', { r: true, after: 60 }), P('Materai          Stempel CBT', { r: true, after: 60 }), P('ttd co cbt/pejabat CBT', { r: true, after: 500 }), P('…………………….', { r: true }),
      P('CONTOH', { br: true, c: true, b: true, size: 12 }),
      P('LAPORAN PENGGUNAAN DANA OPERASIONAL', { c: true, b: true, after: 40 }), P(`UJI KOMPETENSI ${PROGRAM.toUpperCase()}`, { c: true, b: true, after: 40 }), P(per, { c: true, b: true, after: 200 }),
      P('Uji Kompetensi Mahasiswa Bidang Kesehatan'), P(`Jumlah Biaya Operasional ${RP(ops)}`, { b: true, after: 160 }), P('Penggunaan :', { after: 60 }),
      ...['Pembayaran Cleaning Service 2 hari X 4 orang x Rp. 100.000 = Rp. 800.000', 'Pembayaran Satpam 2 hari X 2 orang x Rp. 150.000 = Rp. 600.000', 'Pemeliharaan Komputer = Rp. 2.000.000', 'Pembayaran Teknisi 2 hari X 2 Orang X Rp. 100.000 = Rp. 400.000', 'Pembayaran Honor Panitia Lokal = Rp. 500.000', 'Konsumsi Pelaksanaan = Rp. 300.000', 'Pembelian ATK = Rp. 320.000'].map((t) => P(t, { ind: 360, after: 40 })),
      P(`Total = ${RP(ops)}`, { b: true, after: 40 }), P('Sisa = Rp. 0', { after: 200 }), P('Demikian laporan kami.', { after: 240 }),
      P('Mengetahui,', { after: 40 }), P('Dekan, Wakil dekan, Kaprodi, Koor CBT/PJL', { after: 500 }), P('…………………………….'),
      P('SURAT PERNYATAAN', { br: true, c: true, b: true, size: 12, after: 40 }), P('TANGGUNG JAWAB MUTLAK', { c: true, b: true, size: 12, after: 240 }),
      P('Yang bertanda tangan di bawah ini :', { after: 80 }), P('Nama      : ……………………', { after: 40 }), P('Jabatan   : Penanggung jawab Lokasi TUK … /Koordinator CBT …….', { after: 40 }), P('Alamat    : ……………………', { after: 160 }),
      P('Dengan ini menyatakan dan bertanggung jawab secara penuh atas hal-hal sebagai berikut :', { after: 100 }),
      P(`1. Penggunaan anggaran biaya operasional Pelaksanaan Uji Kompetensi ${PROGRAM} ${per},`, { j: true, ind: 360 }),
      P('2. Perhitungan satuan biaya kegiatan tersebut telah dilakukan secara profesional, efisien, efektif, transparan dan dapat dipertanggungjawabkan mengacu pada pedoman Pengelola Keuangan dan ketentuan peraturan perundang-undangan;', { j: true, ind: 360 }),
      P('3. Apabila terjadi kelebihan pembayaran dari penggunaan anggaran kegiatan, sehingga mengakibatkan kerugian Negara, menjadi tanggung jawab penuh saya selaku Penanggung jawab Lokasi TUK/Koordinator CBT. Atas kerugian Negara tersebut saya sanggup menyetorkan ke Kas Ad Hoc Uji Kompetensi Nasional Rekam Medis dan Manajemen Informasi Kesehatan – Bank MANDIRI – 1260012612615497 an Ad Hoc Uji Kompetensi Nasional Rekam Medis dan Manajemen Informasi Kesehatan.', { j: true, ind: 360 }),
      P('4. Apabila dalam penggunaan anggaran kegiatan mengakibatkan kerugian Ad Hoc Uji Kompetensi Nasional Rekam Medis dan Manajemen Informasi Kesehatan dan Negara, maka menjadi tanggung jawab penuh saya selaku Penanggung jawab Lokasi TUK/Koordinator CBT.', { j: true, ind: 360, after: 160 }),
      P('Demikian Surat Pernyataan ini dibuat dengan sebenar-benarnya, dalam keadaan sadar dan tidak dalam tekanan.', { j: true, after: 240 }),
      P(`${kota}, ..... ${YEAR}`, { r: true, after: 40 }), P('Penanggung jawab Lokasi TUK/', { r: true, after: 40 }), P('Koordinator CBT', { r: true, after: 40 }), P('TTD co cbt, cap cbt dan Materai', { r: true, after: 500 }), P('….……………………', { r: true, after: 40 }), P('NIP/NIK/NIDN .........................', { r: true }),
    ];
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras.join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>');
    return zip.generateAsync({ type: asType === 'arraybuffer' ? 'arraybuffer' : 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // Satu berkas = satu jenis dokumen (honor, transport, dst), tidak digabung.
  function buildPart(comp, part, r, pj, pp) {
    if (part.custom) return CUSTOM[part.custom](r, pj, pp);
    setYear(r);
    const c = ctx(r, pj, pp);
    const doc = newDoc();
    let first = true;
    const np = () => { if (!first) doc.addPage(); first = false; };
    part.groups.forEach((g) => {
      if (g.skipIfZero && groupTotal(r, g) === 0) return;
      const who = g.who(r, c).filter(Boolean);
      np(); pageSPBY(doc, c, comp, g);
      np(); pageKuitansi(doc, c, comp, g, who.length === 1 ? who[0] : who.length ? who.join(', ') : '', groupTotal(r, g));
      if (g.daftar && kindOf(g) !== 'ops' && kindOf(g) !== 'konsumsi') { np(); pageDaftarPenerimaan(doc, c, comp, g); }
      if (g.nota) { np(); pageNotaHadirKonsumsi(doc, c, g); }
    });
    (part.hadir || []).forEach((h) => { np(); pageDaftarHadir(doc, c, h); });
    if (first) doc.text('(tidak ada data)', M, 40);
    footers(doc, c, part.label);
    return doc;
  }
  // Checklist kelengkapan seluruh berkas (A-F), satu file
  function buildChecklist(r, pj, pp) {
    setYear(r);
    const c = ctx(r, pj, pp), doc = newDoc();
    let y = title(doc, kop(doc), 'CHECKLIST KELENGKAPAN BERKAS', 'Checklist Keuangan UKOMNAS ' + YEAR);
    y = infoBlock(doc, y, [['Nama PP', pp.full_name], ['Asal Institusi', r.pp_institusi], ['TUK', tukLabel(r)]]);
    const order = [['A', 'pp', 'BERKAS PENGAWAS PUSAT'], ['B', 'cbt', 'BERKAS CBT CENTER'], ['C', 'cocbt', 'BERKAS CO CBT'], ['D', 'admin', 'BERKAS ADMIN'], ['E', 'it', 'BERKAS IT LOKAL'], ['F', 'pl', 'BERKAS PENGAWAS LOKAL']];
    const body = [];
    order.forEach(([L, key, label]) => {
      const comp = COMPONENTS.find((x) => x.key === key);
      body.push([{ content: `${L}. ${label}`, colSpan: 4, styles: { fillColor: [214, 236, 226], fontStyle: 'bold' } }]);
      comp.checklist.forEach((t, i) => body.push([i + 1, t, '', '']));
    });
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.3, minCellHeight: 6.5, valign: 'middle', lineColor: LINE, lineWidth: 0.15, textColor: 20 },
      headStyles: HEAD,
      head: [['No', 'Dokumen / Form', 'Ada', 'Tidak Ada']], body,
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 } },
    });
    signBlock(doc, at(doc) + 12, pj.full_name, pp.full_name, 'Yang memeriksa (PP),', 'Mengetahui (PJ Keuangan),');
    footers(doc, c, 'Checklist Berkas');
    return doc;
  }
  function buildSerahTerima(r, pj, pp) {
    setYear(r);
    const doc = newDoc();
    pageRincian(doc, ctx(r, pj, pp), '1');
    footers(doc, ctx(r, pj, pp), 'Lembar Serah Terima');
    return doc;
  }

  const safe = (s) => String(s || 'TUK').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  function fileList(r, pj, pp) {
    const base = safe(tukLabel(r));
    const pdf = (o, build) => Object.assign({ ext: 'pdf', build, make: async (t) => build().output(t) }, o);
    const list = [
      pdf({ id: 'serah', folder: '', name: `Lembar Serah Terima - ${base}.pdf`, label: 'Lembar Serah Terima (Rincian Operasional TUK)' }, () => buildSerahTerima(r, pj, pp)),
      pdf({ id: 'kl', folder: '', name: `Form Kurleb - ${base}.pdf`, label: 'Form Kurang / Lebih (Kurleb)' }, () => buildKurangLebih(r, pj, pp)),
      pdf({ id: 'checklist', folder: '', name: `Checklist Kelengkapan Berkas - ${base}.pdf`, label: 'Checklist Kelengkapan Berkas (A-F)' }, () => buildChecklist(r, pj, pp)),
    ];
    COMPONENTS.forEach((comp) => comp.parts.forEach((part) => {
      const o = { id: comp.key + '-' + part.key, folder: comp.folder, group: comp.label };
      if (part.docx) list.push({ ...o, ext: 'docx', name: `SPTJM Biaya Operasional CBT (contoh) - ${base}.docx`, label: part.label, make: (t) => buildSptjmDocx(r, pj, pp, t) });
      else list.push(pdf({ ...o, name: `${part.label} - ${base}.pdf`, label: part.label }, () => buildPart(comp, part, r, pj, pp)));
    }));
    return list;
  }

  // PDF panduan penggunaan (A4, berkop) untuk dicetak saat sosialisasi
  function panduanPdf(g) {
    setYear({});
    const doc = newDoc(); const strip = (t) => String(t).replace(/\*\*/g, '').replace(/→/g, '>').replace(/←/g, '<').replace(/—/g, '-');
    let y = kop(doc) + 2;
    fontB(doc, 14); doc.setTextColor(18, 53, 91); splitLines(doc, g.title.toUpperCase(), PW - 2 * M).forEach((ln) => { doc.text(ln, PW / 2, y, { align: 'center' }); y += 6.5; }); doc.setTextColor(20);
    fontN(doc, 10.2); y += 2; splitLines(doc, strip(g.intro), PW - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5.2; }); y += 4;
    const need = (h) => { if (y + h > 276) { doc.addPage(); y = kop(doc) + 4; } };
    g.sections.forEach((s) => {
      need(22); doc.setFillColor(226, 232, 240); doc.rect(M, y - 4.8, PW - 2 * M, 7.4, 'F'); doc.setFillColor(199, 154, 59); doc.rect(M, y - 4.8, 1.6, 7.4, 'F');
      fontB(doc, 11); doc.setTextColor(18, 53, 91); doc.text(strip(s.h), M + 4, y); doc.setTextColor(20); y += 7;
      s.steps.forEach((t, i) => {
        const lines = splitLines(doc, strip(t), PW - 2 * M - 11); need(lines.length * 5 + 3);
        fontB(doc, 10); doc.text(String(i + 1) + '.', M + 3, y); fontN(doc, 10);
        lines.forEach((ln) => { doc.text(ln, M + 10, y); y += 5; }); y += 1.4;
      });
      if (s.tip) {
        const lines = splitLines(doc, 'Catatan: ' + strip(s.tip), PW - 2 * M - 12); need(lines.length * 4.8 + 6);
        doc.setFillColor(250, 244, 228); doc.rect(M + 3, y - 3.6, PW - 2 * M - 3, lines.length * 4.8 + 3.4, 'F'); doc.setFillColor(199, 154, 59); doc.rect(M + 3, y - 3.6, 1.2, lines.length * 4.8 + 3.4, 'F');
        fontN(doc, 9.4); lines.forEach((ln) => { doc.text(ln, M + 8, y); y += 4.8; }); y += 2;
      }
      y += 4;
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setDrawColor(190); doc.setLineWidth(0.2); doc.line(M, 281.2, PW - M, 281.2); doc.setDrawColor(0); doc.setFontSize(7.5); doc.setTextColor(90); doc.text('Panduan ' + g.short + ' - Keuangan UKOMNAS PMIK', M, 286); doc.text(`hal ${i}/${n}`, PW - M, 286, { align: 'right' }); doc.setTextColor(20); }
    return doc;
  }

  window.UKOM = { panduanPdf, tukLabel, PP_FORM, actualCount, PP_OWN, headcount, applyHeadcount, RP, NUM, terbilang, defaultItems, totalOf, COMPONENTS, fileList, safe };
})();
