# Keuangan UKOMNAS PMIK — Dokumen Keuangan TUK

Aplikasi web untuk Tim Ad Hoc PMIK. **PJ Keuangan** memasukkan nama TUK dan biaya komponen uji; setelah *diterbitkan*, **Pengawas Pusat (PP)** langsung mengunduh semua berkas keuangan (PDF) per komponen uji.

- **Hosting**: Netlify (situs statis, tanpa build) — kode di GitHub
- **Database + login**: Firebase (Authentication + Firestore, paket gratis *Spark*)
- **PDF**: dibuat di browser (jsPDF), tidak perlu server/Storage

## Impor data (menu **Impor Data** untuk PJ/Admin)
- **Data operasional TUK**: unggah Excel/CSV (nomor TUK, nama TUK, PP, sesi/hari/peserta, jumlah petugas, konsumsi, tiket/hotel/ops PP) atau file `operasional_TUK-PP.xlsx` berformat Lembar Serah Terima (satu sheet per TUK). Hasil berupa **draft**; baris yang sudah ada dilewati.
- **Data PP**: unggah daftar PP (nama, email, institusi, no HP, golongan). PP yang mendaftar dengan email yang sama otomatis terhubung ke PJ pengunggah (tanpa Kode PJ).
- Template siap pakai: folder [`templates/`](templates) (`Template Data TUK.xlsx`, `Template Data PP.xlsx`) atau tombol unduh di menu Impor Data. **Nomor TUK** juga dapat diisi di formulir laporan.

## Mode demo (uji coba tanpa menyimpan data)
Buka `https://<situs>/?demo=1`. Semua data hanya di memori browser, tidak masuk Firebase, dan hilang saat halaman dimuat ulang. Tersedia tombol masuk cepat sebagai Admin, PJ Keuangan, dan Pengawas Pusat (kata sandi demo: `demo123`).

## Peran
| Peran | Bisa apa |
|---|---|
| **Admin** | Menetapkan PJ Keuangan, menghubungkan PP ↔ PJ, melihat semua laporan |
| **PJ Keuangan** (boleh banyak orang) | Akun sendiri, mengampu beberapa PP, input TUK & biaya, terbitkan/tarik, unduh |
| **Pengawas Pusat (PP)** | Melihat & mengunduh laporan miliknya yang sudah diterbitkan; menambahkan nama Co CBT, Admin, IT Lokal, PL & rumah makan; mengisi realisasi pelaksanaan (Lembar Kurang/Lebih) dan membuat mandiri transport & biaya operasional PP. Anggaran buatan PJ tidak dapat diubah PP (dijaga `firestore.rules`) |

## Aturan dokumen
- **Lembar Serah Terima** (rincian operasional TUK) diterbitkan **satu kali** sebagai file tersendiri; tidak disisipkan di berkas komponen uji.
- **Honor sudah netto** (dipotong PPh 5%, tarif bisa diubah lewat field `pph`). SPBY, kuitansi, dan daftar penerimaan honor menampilkan Bruto, PPh 5%, dan Netto.
- **Honor dan transport dibuat dalam file terpisah** (mis. `Honor Admin.pdf` dan `Transport Admin.pdf`). Tiap file berisi 1 SPBY, 1 kuitansi, dan 1 daftar penerimaan dengan rincian tarif × jumlah orang (honor dipisah bruto/PPh/netto, transport tanpa pajak). Briefing dan pelaksanaan juga dipisah (kegiatan berbeda): PP = Honor Briefing, Honor Pelaksanaan, Transport Briefing, Transport Pelaksanaan; PL = Honor, Transport Briefing, Transport Pelaksanaan. Dokumen **dibuat mandiri oleh PP** (dari isian PP): Laporan Perjalanan Dinas, Kuitansi Perjalanan Dinas, Kuitansi Biaya Operasional PP. CBT: Biaya Operasional dan Konsumsi. Checklist A-F menjadi satu file tersendiri.
- **Admin, IT Lokal, PL, Co CBT boleh lebih dari 1 orang**: PJ mengisi jumlah petugas; "Banyak" honor (× sesi) dan transport (× hari) dihitung otomatis. PP hanya mengisi nama (dan **golongan per petugas**, dikosongkan bila bukan ASN) sebanyak jumlah buatan PJ (1 ya 1, 2 ya 2; tidak bisa ditambah, dikunci di `firestore.rules`).
- **Tahun pelaksanaan** diisi manual per laporan (kop & nomor dokumen), sehingga dokumen dapat dipakai di tahun-tahun berikutnya.
- **Lembar Kurang/Lebih** = realisasi pelaksanaan vs anggaran hitungan PJ (Kurang = realisasi di bawah anggaran, Lebih = di atas). PP mengisi realisasi; honor bersifat tetap. Lembar ini **berdiri sendiri**: realisasi (termasuk transport & biaya operasional PP yang diisi mandiri oleh PP) hanya muncul di lembar ini dan tidak mengubah dokumen komponen uji.

## Format dokumen = template Drive "MASTER TEMPLATE"
Seluruh dokumen mengikuti bentuk template: **Surat Perintah Bayar (SPb)** dengan PPK & Bendahara Pengeluaran, **Kwitansi Bukti/Pembayaran** (honor: Bruto, PPh 21, Netto), **Daftar Penerimaan** (Gol, Vol, Satuan, Honorium, PPh Pasal 21, Diterima), **Daftar Hadir** (briefing H-1 dan per sesi pelaksanaan), **Form Kurleb**, **Rincian Biaya Perjalanan Dinas + Daftar Pengeluaran Riil**, dan **Laporan Hasil Perjalanan Dinas**. Nama PPK diatur di `js/config.js` (`PPK_NAME`); Bendahara = nama PJ Keuangan pada laporan. **SPTJM Biaya Operasional CBT** berupa file **Word contoh** (tanpa kop UKOMNAS; TUK menempelkan kop suratnya sendiri).

## Berkas yang dihasilkan (mengikuti folder Drive *MASTER TEMPLATE*)
`Lembar Serah Terima` (rincian operasional TUK) + 6 berkas komponen: **1. Admin · 2. Co CBT · 3. IT Lokal · 4. PL · 5. PP · 6. CBT Center**. Isi: checklist, SPBY, kuitansi, daftar penerimaan, daftar hadir, SPTJM (CBT), rincian perjalanan dinas (PP).
Identitas TUK dan PP dicetak di footer setiap halaman. Tersedia unduhan per berkas atau semua sekaligus (ZIP, susunan folder sama dengan Drive).

Tarif bawaan (dari Lembar Serah Terima Stikes Wira Medika Bali) dapat diubah per TUK di formulir: transport Rp170.000, honor briefing PP Rp332.500, honor pelaksanaan PP Rp451.250, konsumsi Rp71.000, operasional CBT Rp40.000/peserta, honor PL Rp275.500, Co CBT Rp380.000, Admin Rp185.250, IT Lokal Rp332.500; tiket/hotel/operasional PP *at cost*. Total contoh = **Rp6.874.500** (sama dengan dokumen asli).

## Pasang (sekali saja)

### 1. Firebase
1. <https://console.firebase.google.com> → **Add project** (Spark/gratis).
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (production mode, region `asia-southeast2` Jakarta).
4. **Firestore → Rules** → tempel isi `firestore.rules` → **Publish**. (atau `npx firebase-tools deploy --only firestore:rules`)
5. **Project settings → Your apps → Web (`</>`)** → salin `apiKey`, `projectId`, `appId` ke `js/config.js`.
6. Setelah Netlify jadi: **Authentication → Settings → Authorized domains → Add domain** → `namasitus.netlify.app`.

### 2. GitHub
```bash
cd ukomnas-keuangan
git remote add origin https://github.com/<akun>/ukomnas-keuangan.git
git push -u origin main
```

### 3. Netlify
**Add new site → Import from Git → pilih repo**. Build command kosong, publish directory `.` (sudah diatur di `netlify.toml`). Setiap `git push` otomatis deploy.

### 4. Admin pertama
1. Buka situs → **Daftar** memakai email admin (`wulanndari.dwiretno16@gmail.com`, bisa diubah di `js/config.js` **dan** `firestore.rules`).
2. Klik tautan di email verifikasi → di aplikasi klik **Saya sudah verifikasi** → akun menjadi **Admin**.
   *(Alternatif: ubah field `role` jadi `admin` manual di Firestore → koleksi `users`.)*

### 5. Alur harian
1. PJ & PP **Daftar** (PP boleh mengisi *Kode PJ* agar otomatis terhubung).
2. Admin: menu **Pengguna** → ubah peran akun PJ menjadi **PJ Keuangan**.
3. PJ: menu **PP Saya** → tambahkan PP via email (atau bagikan Kode PJ) → **Laporan TUK → Tambah TUK** → isi nama TUK & biaya → **Simpan & terbitkan**.
4. PP masuk → **Berkas Saya** → unduh per berkas atau ZIP.

## Keamanan
`apiKey` Firebase di `config.js` memang publik; data dilindungi `firestore.rules` (PP hanya membaca laporan *terbit* miliknya; PJ hanya laporan & PP miliknya; peran tidak bisa diubah sendiri). Aturan diuji di emulator: `tests/rules.test.js` (73 skenario).

```bash
npm i -D firebase-tools @firebase/rules-unit-testing
npx firebase emulators:exec --only firestore --project demo-ukom "node tests/rules.test.js"
```

## Pengembangan
Tidak ada langkah build untuk situs. `vendor/firebase.js` dibundel dari `src/fb-entry.js` (`npm i && npm run build`) bila SDK ingin diperbarui.
