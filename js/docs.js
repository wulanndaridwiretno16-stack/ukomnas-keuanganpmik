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
  const names = (r, key) => {
    const p = Object.assign({}, r.personnel || {}, r.petugas || {});
    if (key === 'rumah_makan') return [p.rumah_makan || ''];
    const v = p[key], arr = Array.isArray(v) ? v : v ? [v] : [];
    return Array.from({ length: headcount(r, key) }, (_, i) => arr[i] || '');
  };

  const COMPONENTS = [
    {
      key: 'admin', no: 1, folder: '1. ADMIN', label: 'Berkas Admin', role: 'Teknisi (Admin)',
      groups: [
        { title: 'Honorarium Teknisi (Admin)', items: ['honor_admin'], who: (r) => names(r, 'admin'), role: 'Admin', daftar: true, perPerson: true },
        { title: 'Transport Lokal Admin', items: ['trans_admin'], who: (r) => names(r, 'admin'), role: 'Admin', daftar: true, perPerson: true },
      ],
      hadir: [{ title: 'Daftar Hadir Pelaksanaan Admin', who: (r) => names(r, 'admin') }],
      checklist: ['SPBY Honorarium Teknisi (Admin)', 'Kuitansi Honorarium Teknisi (Admin)', 'Daftar Penerimaan Honorarium Teknisi (Admin)', 'Daftar Hadir Pelaksanaan Admin', 'Surat Tugas Admin', 'SPBY Transport Lokal Admin', 'Kuitansi Transport Lokal Admin', 'Daftar Penerimaan Transport Lokal Admin'],
    },
    {
      key: 'cocbt', no: 2, folder: '2. Co CBT', label: 'Berkas Co CBT', role: 'Co CBT',
      groups: [
        { title: 'Honorarium Co CBT', items: ['honor_cocbt'], who: (r) => names(r, 'co_cbt'), role: 'Co CBT', daftar: true, perPerson: true },
        { title: 'Transport Lokal Co CBT', items: ['trans_cocbt'], who: (r) => names(r, 'co_cbt'), role: 'Co CBT', daftar: true, perPerson: true },
      ],
      hadir: [{ title: 'Daftar Hadir Co CBT', who: (r) => names(r, 'co_cbt') }],
      checklist: ['SPBY Honorarium Co CBT', 'Kuitansi Honorarium Co CBT', 'Daftar Penerimaan Honorarium Co CBT', 'Daftar Hadir Co CBT', 'Surat Tugas Co CBT', 'SPBY Transport Lokal Co CBT', 'Kuitansi Transport Lokal Co CBT', 'Daftar Penerimaan Transport Lokal Co CBT'],
    },
    {
      key: 'it', no: 3, folder: '3. IT Lokal', label: 'Berkas IT Lokal', role: 'IT Lokal',
      groups: [
        { title: 'Honorarium IT Lokal', items: ['honor_it'], who: (r) => names(r, 'it_lokal'), role: 'IT Lokal', daftar: true, perPerson: true },
        { title: 'Transport Lokal IT Lokal', items: ['trans_it'], who: (r) => names(r, 'it_lokal'), role: 'IT Lokal', daftar: true, perPerson: true },
      ],
      hadir: [{ title: 'Daftar Hadir IT Lokal', who: (r) => names(r, 'it_lokal') }],
      checklist: ['SPBY Honorarium IT Lokal', 'Kuitansi Honorarium IT Lokal', 'Daftar Penerimaan Honorarium IT Lokal', 'Daftar Hadir IT Lokal', 'Surat Tugas IT Lokal', 'SPBY Transport Lokal IT Lokal', 'Kuitansi Transport Lokal IT Lokal', 'Daftar Penerimaan Transport Lokal IT Lokal'],
    },
    {
      key: 'pl', no: 4, folder: '4. PL', label: 'Berkas Pengawas Lokal', role: 'Pengawas Lokal',
      groups: [
        { title: 'Honorarium Pengawas Lokal', items: ['honor_pl'], who: (r) => names(r, 'pl'), role: 'Pengawas Lokal', daftar: true, perPerson: true },
        { title: 'Transport Lokal Pengawas Lokal', items: ['trans_briefing_pl', 'trans_pelaksanaan_pl'], who: (r) => names(r, 'pl'), role: 'Pengawas Lokal', daftar: true, perPerson: true },
      ],
      hadir: [
        { title: 'Daftar Hadir Pengawas Lokal - Briefing', who: (r) => names(r, 'pl') },
        { title: 'Daftar Hadir Pengawas Lokal - Pelaksanaan', who: (r) => names(r, 'pl') },
      ],
      checklist: ['SPBY Honorarium Pengawas Lokal', 'Kuitansi Honorarium Pengawas Lokal', 'Daftar Penerimaan Honorarium Pengawas Lokal', 'Daftar Hadir Pengawas Lokal Briefing', 'Daftar Hadir Pengawas Lokal Pelaksanaan', 'Surat Tugas Pengawas Lokal', 'SPBY Transport Lokal Pengawas Lokal', 'Kuitansi Transport Lokal Pengawas Lokal', 'Daftar Penerimaan Transport Pengawas Lokal'],
    },
    {
      key: 'pp', no: 5, folder: '5. PP', label: 'Berkas Pengawas Pusat', role: 'Pengawas Pusat',
      groups: [
        { title: 'Honorarium Bimtek Komponen Uji (Briefing)', items: ['honor_briefing_pp'], who: (r, c) => [c.pp.full_name], role: 'Pengawas Pusat', daftar: false },
        { title: 'Honorarium Bimtek Peserta Uji (Pelaksanaan)', items: ['honor_pelaksanaan_pp'], who: (r, c) => [c.pp.full_name], role: 'Pengawas Pusat', daftar: true },
        { title: 'Transport Lokal Pengawas Pusat (Dalam Kota)', items: ['trans_dalam_kota', 'trans_briefing_pp'], who: (r, c) => [c.pp.full_name], role: 'Pengawas Pusat', daftar: true },
        { title: 'Biaya Operasional Pengawas Pusat', items: ['ops_pp'], who: (r, c) => [c.pp.full_name], role: 'Pengawas Pusat', daftar: false },
      ],
      perjadin: true,
      hadir: [
        { title: 'Daftar Hadir H-1 Pengawas Pusat (Briefing)', who: (r, c) => [c.pp.full_name] },
        { title: 'Daftar Hadir Pelaksanaan Pengawas Pusat', who: (r, c) => [c.pp.full_name] },
      ],
      checklist: ['SPBY Perjalanan Dinas Pengawas Pusat', 'Kuitansi Perjalanan Dinas (luar kota & dalam kota)', 'Rincian Perjalanan Dinas', 'Daftar Pengeluaran Riil', 'SPPD Pelaksanaan (stempel CBT)', 'Invoice Hotel dan/atau Tiket Travel', 'Boarding Pass PP (luar kota)', 'Laporan Perjalanan Dinas', 'SPBY & Kuitansi Honorarium Briefing', 'Daftar Hadir H-1', 'SPBY & Kuitansi Honorarium Pelaksanaan', 'Daftar Penerimaan Pelaksanaan', 'Daftar Hadir Pelaksanaan', 'Surat Tugas PP (dari institusi)', 'SPBY, Kuitansi & Daftar Penerimaan Transport Lokal', 'SPBY, Kuitansi & Nota Biaya Operasional PP'],
    },
    {
      key: 'cbt', no: 6, folder: '6. CBT', label: 'Berkas CBT Center', role: 'CBT Center',
      groups: [
        { title: 'Biaya Operasional CBT Center (Rp 40.000 per peserta)', items: ['ops_cbt'], who: (r) => names(r, 'co_cbt'), role: 'Co CBT / CBT Center', daftar: false, sptjm: true },
        { title: 'Biaya Konsumsi Hari Briefing', items: ['konsumsi_briefing'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', daftar: false, nota: true },
        { title: 'Biaya Konsumsi Hari 1 Pelaksanaan', items: ['konsumsi_h1'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', daftar: false, nota: true },
        { title: 'Biaya Konsumsi Hari 2 Pelaksanaan', items: ['konsumsi_h2'], who: (r) => names(r, 'rumah_makan'), role: 'Rumah Makan', daftar: false, nota: true, skipIfZero: true },
      ],
      hadir: [],
      checklist: ['SPBY Biaya Operasional CBT Center', 'Kuitansi Biaya Operasional CBT', 'SPTJM (surat laporan, rincian, pernyataan)', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Briefing', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Hari 1', 'SPBY/Kuitansi/Nota/Daftar Hadir Konsumsi Hari 2'],
    },
  ];

  /* ---------- Gambar ---------- */
  const PW = 210, M = 15;
  let YEAR = new Date().getFullYear();   // diisi dari r.tahun saat berkas dibuat
  const setYear = (r) => { YEAR = String((r && r.tahun) || new Date().getFullYear()); };
  const ctx = (r, pj, pp) => ({ r, pj, pp });
  // Komponen milik PP yang dibuat mandiri oleh PP: nominal bisa kurang/lebih dari hitungan PJ.
  const PP_OWN = ['tiket', 'hotel', 'trans_dalam_kota', 'trans_briefing_pp', 'ops_pp'];
  const itm = (r, key) => {
    const it = r.items.find((i) => i.key === key) || { nilai: 0, qty: 0, label: key };
    const v = r.realisasi && r.realisasi[key];
    if (PP_OWN.includes(key) && v !== undefined && v !== null && v !== '' && isFinite(Number(v))) return Object.assign({}, it, { nilai: Number(v), qty: 1 });
    return it;
  };

  function newDoc() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
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
    doc.setFont('helvetica', 'bold');
    const L = doc.splitTextToSize(left || '(................................)', W);
    const R = doc.splitTextToSize(right || '(................................)', W);
    doc.text(L, xl, y + 26); doc.text(R, xr, y + 26);
    doc.setFont('helvetica', 'normal');
    return y + 26 + 5 * Math.max(L.length, R.length) + 4;
  }
  const at = (doc) => doc.lastAutoTable.finalY;

  // Honor pada Lembar Serah Terima adalah NETTO (sudah dipotong PPh 5%). Bruto = netto / (1 - tarif).
  const taxRate = (r) => (r.pph == null ? 5 : Number(r.pph)) / 100;
  const isHonorItem = (i) => String(i.key).startsWith('honor_');
  const brutoOf = (r, net) => Math.round(net / (1 - taxRate(r)));
  const isHonorGroup = (g) => g.items.every((k) => k.startsWith('honor_'));
  const taxLabel = (r) => 'PPh ' + (taxRate(r) * 100).toString().replace('.', ',') + '%';
  const taxNote = (r) => `Honorarium telah dipotong pajak ${taxLabel(r)}; jumlah yang dibayarkan adalah netto.`;
  const taxSum = (r, g) => { const net = groupTotal(r, g), br = brutoOf(r, net); return { net, br, pph: br - net }; };

  function groupItems(r, g) { return g.items.map((k) => itm(r, k)); }
  const groupTotal = (r, g) => totalOf(groupItems(r, g));
  const uraian = (r, g) =>
    groupItems(r, g).map((i) => `${i.label} (${NUM(i.qty)} x ${RP(i.nilai)})`).join('; ');

  function pageSPBY(doc, c, comp, g) {
    const { r, pj, pp } = c;
    let y = title(doc, kop(doc), 'SURAT PERMINTAAN BAYAR (SPBY)', 'Nomor: ........ / SPBY / UKOMNAS-PMIK / ' + YEAR);
    y = infoBlock(doc, y, [
      ['Kegiatan', 'Uji Kompetensi Nasional Rekam Medis dan Informasi Kesehatan ' + YEAR],
      ['Tempat Uji Kompetensi', r.tuk_name],
      ['Pengawas Pusat', pp.full_name],
      ['Keperluan', g.title],
      ['Jumlah Dibayarkan', RP(groupTotal(r, g)) + ' (' + cap(terbilang(groupTotal(r, g))) + ' rupiah)'],
    ]);
    if (isHonorGroup(g)) {
      const s = taxSum(r, g);
      doc.autoTable({
        startY: y + 2, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
        head: [['Uraian', 'Banyak', 'Bruto', taxLabel(r), 'Netto']],
        body: groupItems(r, g).map((i) => { const net = i.nilai * i.qty, br = brutoOf(r, net); return [i.label + (i.ket ? ` (${i.ket})` : ''), NUM(i.qty), RP(br), RP(br - net), RP(net)]; })
          .concat([[{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } }, { content: RP(s.br), styles: { fontStyle: 'bold' } }, { content: RP(s.pph), styles: { fontStyle: 'bold' } }, { content: RP(s.net), styles: { fontStyle: 'bold' } }]]),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      });
      doc.setFontSize(9); doc.text(taxNote(r), M, at(doc) + 6);
    } else {
      doc.autoTable({
        startY: y + 2, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
        head: [['Uraian', 'Nilai', 'Banyak', 'Jumlah']],
        body: groupItems(r, g).map((i) => [i.label + (i.ket ? ` (${i.ket})` : ''), RP(i.nilai), NUM(i.qty), RP(i.nilai * i.qty)])
          .concat([[{ content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: RP(groupTotal(r, g)), styles: { fontStyle: 'bold' } }]]),
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
      });
    }
    doc.setFontSize(10);
    doc.text('Mohon dibayarkan sesuai rincian di atas. Bukti pendukung terlampir.', M, at(doc) + (isHonorGroup(g) ? 12 : 8));
    signBlock(doc, at(doc) + (isHonorGroup(g) ? 20 : 16), '', pj.full_name, 'Yang meminta (PJ Keuangan),', 'Menyetujui,');
  }

  function pageKuitansi(doc, c, comp, g, who, amount, forText) {
    const { r, pj } = c;
    let y = title(doc, kop(doc), 'KUITANSI', 'Nomor: ........ / KWT / UKOMNAS-PMIK / ' + YEAR);
    y = infoBlock(doc, y, [
      ['Sudah terima dari', 'Tim Ad Hoc UKOMNAS PMIK ' + YEAR + ' (PJ Keuangan: ' + (pj.full_name || '-') + ')'],
      ['Uang sejumlah', RP(amount)],
      ['Terbilang', cap(terbilang(amount)) + ' rupiah'],
      ['Untuk pembayaran', forText || g.title + ' - TUK ' + r.tuk_name],
      ['Rincian', uraian(r, g)],
    ].concat(isHonorGroup(g) ? [['Pajak', (() => { const s = taxSum(r, g); return `Bruto ${RP(s.br)} - ${taxLabel(r)} ${RP(s.pph)} = netto ${RP(s.net)}`; })()]] : []));
    doc.setFontSize(10);
    doc.text('Tempat/Tanggal: ............................., ............................. ' + YEAR, M, y + 4);
    signBlock(doc, y + 14, pj.full_name, who || '(................................)', 'Yang menerima,');
    doc.setFontSize(8); doc.text('Meterai diperlukan apabila nilai di atas Rp 5.000.000', M, 275);
  }

  function pageDaftarPenerimaan(doc, c, comp, g) {
    const { r, pj } = c;
    let y = title(doc, kop(doc), 'DAFTAR PENERIMAAN', g.title);
    y = infoBlock(doc, y, [['TUK', r.tuk_name], ['Pengawas Pusat', c.pp.full_name]]);
    const who = g.who(r, c);
    const per = g.perPerson ? groupTotal(r, g) / who.length : groupTotal(r, g);
    if (isHonorGroup(g)) {
      const s = taxSum(r, g), n = Math.max(1, who.length), br = s.br / n, pj_ = s.pph / n;
      const rowsT = (who.length ? who : ['']).map((nm, i) => [i + 1, nm || '', g.role, RP(br), RP(pj_), RP(per), '']);
      doc.autoTable({
        startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 12, valign: 'middle' }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
        head: [['No', 'Nama', 'Jabatan', 'Bruto', taxLabel(r), 'Netto diterima', 'Tanda Tangan']],
        body: rowsT,
        foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'right' } }, RP(s.br), RP(s.pph), RP(s.net), '']],
        footStyles: { fillColor: [235, 235, 235], textColor: 0 },
        columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { cellWidth: 30 } },
      });
      doc.setFontSize(8.5); doc.text(taxNote(r), M, at(doc) + 6);
      signBlock(doc, at(doc) + 14, pj.full_name, '', 'Mengetahui,');
      return;
    }
    const rows = who.map((n, i) => [i + 1, n || '', g.role, RP(per), '']);
    if (!rows.length) rows.push([1, '', g.role, RP(per), '']);
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 12, valign: 'middle' }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['No', 'Nama', 'Jabatan', 'Jumlah', 'Tanda Tangan']],
      body: rows,
      foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'right' } }, RP(groupTotal(r, g)), '']],
      footStyles: { fillColor: [235, 235, 235], textColor: 0 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 3: { halign: 'right', cellWidth: 32 }, 4: { cellWidth: 40 } },
    });
    signBlock(doc, at(doc) + 10, pj.full_name, '', 'Mengetahui,');
  }

  function pageDaftarHadir(doc, c, h, rows) {
    const { r } = c;
    let y = title(doc, kop(doc), h.title.toUpperCase());
    y = infoBlock(doc, y, [['TUK', r.tuk_name], ['Hari/Tanggal', '.............................................']]);
    const who = h.who(r, c);
    const body = who.map((n, i) => [i + 1, n || '', '', '']);
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 12, valign: 'middle' }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['No', 'Nama', 'Tanda Tangan', 'Keterangan']], body,
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 50 }, 3: { cellWidth: 40 } },
    });
  }

  function pageSPTJM(doc, c, comp, g) {
    const { r, pj } = c;
    const peserta = Number(itm(r, 'ops_cbt').qty) || 0;
    let y = title(doc, kop(doc), 'SURAT LAPORAN PENGGUNAAN BIAYA OPERASIONAL CBT', 'SPTJM - Halaman 1');
    doc.setFontSize(10);
    const t = `Yang bertanda tangan di bawah ini, Co CBT pada TUK ${r.tuk_name}, melaporkan penggunaan biaya operasional CBT UKOMNAS PMIK ${YEAR} sebesar ${RP(groupTotal(r, g))} untuk ${NUM(peserta)} peserta (Rp ${NUM(itm(r, 'ops_cbt').nilai)} per peserta).`;
    doc.text(doc.splitTextToSize(t, PW - M * 2), M, y);
    signBlock(doc, y + 30, '', (r.personnel || {}).co_cbt || '', 'Co CBT / CBT Center,');
    doc.addPage();
    y = title(doc, kop(doc), 'RINCIAN PENGGUNAAN BIAYA OPERASIONAL CBT', 'SPTJM - Halaman 2');
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 9 }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['No', 'Uraian Penggunaan', 'Jumlah (Rp)']],
      body: [[1, 'Sewa/penyiapan perangkat dan jaringan', ''], [2, 'Kebutuhan listrik & internet', ''], [3, 'Kebersihan & perlengkapan ruang uji', ''], [4, 'Lain-lain', ''], [{ content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } }, { content: RP(groupTotal(r, g)), styles: { fontStyle: 'bold' } }]],
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 40 } },
    });
    doc.addPage();
    y = title(doc, kop(doc), 'SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK (SPTJM)', 'Halaman 3');
    const t3 = `Saya menyatakan bahwa biaya operasional CBT sebesar ${RP(groupTotal(r, g))} pada TUK ${r.tuk_name} telah digunakan sesuai peruntukannya dan bertanggung jawab penuh atas kebenaran penggunaan tersebut. Apabila terdapat kelebihan/ketidaksesuaian, saya bersedia menyetorkannya kembali.`;
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(t3, PW - M * 2), M, y);
    signBlock(doc, y + 30, '', (r.personnel || {}).co_cbt || '', 'Yang menyatakan (materai, stempel & TTD),');
  }

  function pageNotaHadirKonsumsi(doc, c, g) {
    const { r } = c;
    let y = title(doc, kop(doc), 'DAFTAR HADIR KONSUMSI', g.title);
    y = infoBlock(doc, y, [['TUK', r.tuk_name], ['Jumlah porsi', NUM(itm(r, g.items[0]).qty)]]);
    const n = Math.max(1, Number(itm(r, g.items[0]).qty) || 1);
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 9 }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['No', 'Nama', 'Tanda Tangan']],
      body: Array.from({ length: n }, (_, i) => [i + 1, '', '']),
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 50 } },
    });
  }

  function pagePerjadin(doc, c) {
    const { r, pp } = c;
    let y = title(doc, kop(doc), 'RINCIAN PERJALANAN DINAS (LUAR KOTA)');
    y = infoBlock(doc, y, [['Nama PP', pp.full_name], ['Asal Institusi', r.pp_institusi], ['Tujuan (TUK)', r.tuk_name]]);
    const rows = ['tiket', 'hotel'].map((k) => itm(r, k));
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 9 }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['Komponen', 'Nilai', 'Banyak', 'Jumlah (at cost)']],
      body: rows.map((i) => [i.label, RP(i.nilai), NUM(i.qty), RP(i.nilai * i.qty)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' } },
    });
    doc.setFontSize(9);
    doc.text('Lampirkan invoice hotel/tiket dan boarding pass PP sebagai bukti (at cost).', M, at(doc) + 8);
    signBlock(doc, at(doc) + 16, c.pj.full_name, pp.full_name);
  }

  function pageChecklist(doc, c, comp) {
    let y = title(doc, kop(doc), 'CHECKLIST KELENGKAPAN BERKAS', comp.label);
    y = infoBlock(doc, y, [['TUK', c.r.tuk_name], ['Pengawas Pusat', c.pp.full_name]]);
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 9, minCellHeight: 8, valign: 'middle' }, headStyles: { fillColor: [240, 220, 250], textColor: 0 },
      head: [['No', 'Dokumen', 'Ada', 'Kurang']],
      body: comp.checklist.map((t, i) => [i + 1, t, '', '']),
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 } },
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
      ['Nama PP', pp.full_name], ['Asal Institusi', r.pp_institusi], ['TUK', r.tuk_name],
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
      startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.4, lineColor: 0, lineWidth: 0.15, textColor: 0 },
      headStyles: { fillColor: [245, 205, 250], textColor: 0, halign: 'center' },
      head: [['Komponen Biaya', 'Nilai (Rp)', 'Banyak', 'Jumlah Netto (Rp)', 'Keterangan']],
      body,
      foot: [[{ content: 'TOTAL', colSpan: 3, styles: { halign: 'left' } }, NUM(totalOf(r.items)), '']],
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center', cellWidth: 16 }, 3: { halign: 'right' } },
    });
    doc.setFontSize(8.5); doc.setTextColor(60);
    doc.text(`Catatan: seluruh nilai honor pada tabel di atas adalah netto, sudah dipotong ${taxLabel(r)}.`, M, at(doc) + 5);
    doc.setTextColor(0); doc.setFontSize(10);
    signBlock(doc, at(doc) + 10, pj.full_name, pp.full_name);
  }

  /* ---------- Lembar Kurang / Lebih = realisasi pelaksanaan vs anggaran (hitungan PJ) ---------- */
  function buildKurangLebih(r, pj, pp) {
    setYear(r);
    const c = ctx(r, pj, pp), doc = newDoc(), real = r.realisasi || {};
    let y = title(doc, kop(doc), 'LEMBAR KURANG / LEBIH', 'Realisasi pelaksanaan terhadap anggaran (hitungan PJ Keuangan)');
    y = infoBlock(doc, y, [['Nama PP', pp.full_name], ['Asal Institusi', r.pp_institusi], ['TUK', r.tuk_name], ['Jumlah Sesi / Hari', `${r.jumlah_sesi} / ${r.jumlah_hari}`]]);
    let tA = 0, tR = 0, tK = 0, tL = 0;
    const body = r.items.map((i) => {
      const a = (Number(i.nilai) || 0) * (Number(i.qty) || 0);
      const v = real[i.key], has = !isHonorItem(i) && v !== undefined && v !== null && v !== '' && isFinite(Number(v));
      const rl = has ? Number(v) : a, K = rl < a ? a - rl : 0, L = rl > a ? rl - a : 0;
      tA += a; tR += rl; tK += K; tL += L;
      return [i.label, NUM(a), NUM(rl), K ? NUM(K) : '-', L ? NUM(L) : '-', PP_OWN.includes(i.key) ? 'dibuat mandiri PP' : ''];
    });
    doc.autoTable({
      startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.3, lineColor: 0, lineWidth: 0.15, textColor: 0 },
      headStyles: { fillColor: [245, 205, 250], textColor: 0, halign: 'center' },
      head: [['Komponen Biaya', 'Anggaran PJ (Rp)', 'Realisasi (Rp)', 'Kurang (Rp)', 'Lebih (Rp)', 'Keterangan']],
      body,
      foot: [['TOTAL', NUM(tA), NUM(tR), NUM(tK), NUM(tL), '']],
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    doc.setFontSize(8.5); doc.setTextColor(60);
    doc.text(doc.splitTextToSize('Kurang = realisasi di bawah anggaran. Lebih = realisasi melebihi anggaran. Honor bersifat tetap (netto, PPh 5%). Transport dan biaya operasional PP diisi mandiri oleh PP sesuai bukti pengeluaran.', PW - 2 * M), M, at(doc) + 5);
    doc.setTextColor(0); doc.setFontSize(10);
    signBlock(doc, at(doc) + 14, pj.full_name, pp.full_name, 'Yang membuat (PP),', 'Mengetahui (PJ Keuangan),');
    footers(doc, c, 'Lembar Kurang Lebih');
    return doc;
  }

  /* ---------- Footer identitas TUK di setiap halaman ---------- */
  function footers(doc, c, label) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(90);
      doc.text(`TUK: ${c.r.tuk_name} | PP: ${c.pp.full_name}`, M, 284);
      doc.text(`Sesi ${c.r.jumlah_sesi} / Hari ${c.r.jumlah_hari}`, M, 288);
      doc.text(`${label} - hal ${i}/${n}`, PW - M, 288, { align: 'right' });
      doc.setTextColor(0);
    }
  }

  /* ---------- Builder berkas ---------- */
  function buildComponent(comp, r, pj, pp) {
    setYear(r);
    const c = ctx(r, pj, pp);
    const doc = newDoc();
    let first = true;
    const np = () => { if (!first) doc.addPage(); first = false; };
    np(); pageChecklist(doc, c, comp);
    comp.groups.forEach((g) => {
      if (g.skipIfZero && groupTotal(r, g) === 0) return;
      const who = g.who(r, c).filter(Boolean);
      np(); pageSPBY(doc, c, comp, g);
      np(); pageKuitansi(doc, c, comp, g, who.length === 1 ? who[0] : who.length ? who.join(', ') : '', groupTotal(r, g));
      if (g.daftar) { np(); pageDaftarPenerimaan(doc, c, comp, g); }
      if (g.sptjm) { np(); pageSPTJM(doc, c, comp, g); }
      if (g.nota) { np(); pageNotaHadirKonsumsi(doc, c, g); }
    });
    if (comp.perjadin) { np(); pagePerjadin(doc, c); }
    (comp.hadir || []).forEach((h) => { np(); pageDaftarHadir(doc, c, h); });
    footers(doc, c, comp.label);
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
    const base = safe(r.tuk_name);
    const list = [{ id: 'serah', folder: '', name: `Lembar Serah Terima - ${base}.pdf`, label: 'Lembar Serah Terima (Rincian Operasional TUK)', build: () => buildSerahTerima(r, pj, pp) }];
    list.push({ id: 'kl', folder: '', name: `Lembar Kurang Lebih - ${base}.pdf`, label: 'Lembar Kurang / Lebih (realisasi pelaksanaan)', build: () => buildKurangLebih(r, pj, pp) });
    COMPONENTS.forEach((comp) => list.push({
      id: comp.key, folder: comp.folder, name: `${comp.label} - ${base}.pdf`, label: comp.label,
      build: () => buildComponent(comp, r, pj, pp),
    }));
    return list;
  }

  window.UKOM = { PP_OWN, headcount, applyHeadcount, RP, NUM, terbilang, defaultItems, totalOf, COMPONENTS, fileList, safe };
})();
