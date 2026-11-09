/* Materi sosialisasi penggunaan aplikasi: terpisah untuk PJ Keuangan dan Pengawas Pusat.
   Tanda **teks** = cetak tebal. */
window.PANDUAN = {
  pj: {
    key: 'pj', short: 'PJ Keuangan', title: 'Panduan Penggunaan untuk PJ Keuangan',
    intro: 'PJ Keuangan menyusun biaya operasional tiap TUK, menerbitkannya kepada Pengawas Pusat (PP), lalu PP mengunduh seluruh dokumen keuangan. Panduan ini menjelaskan alurnya dari awal sampai dokumen siap cetak.',
    sections: [
      { h: '1. Mendapatkan akun PJ Keuangan', steps: [
        'Buka alamat aplikasi, klik **Daftar**, isi nama lengkap beserta gelar, institusi, email, dan kata sandi. Kolom Kode PJ dikosongkan.',
        'Beri tahu **Admin** bahwa Anda sudah mendaftar. Admin membuka menu **Pengguna** dan mengubah peran Anda menjadi **PJ Keuangan**.',
        'Keluar lalu masuk kembali. Menu **Laporan TUK**, **Impor Data**, dan **PP Saya** akan muncul.'],
        tip: 'Tulis nama dengan gelar yang benar. Nama itu tercetak sebagai Bendahara Pengeluaran pada Surat Perintah Bayar dan kuitansi.' },
      { h: '2. Menghubungkan PP dengan Anda', steps: [
        'Buka menu **PP Saya**. Di sana ada **Kode PJ** milik Anda (6 karakter).',
        'Cara 1: bagikan Kode PJ ke PP; saat **Daftar**, PP mengisi kode itu dan otomatis terhubung ke Anda.',
        'Cara 2: ketik **email PP** yang sudah mendaftar lalu klik **Tambahkan PP**.',
        'Cara 3: unggah daftar PP lewat menu **Impor Data → Data PP**. PP yang mendaftar dengan email yang sama otomatis terhubung ke Anda.'],
        tip: 'Satu PP hanya diampu satu PJ. Bila perlu dipindahkan, minta Admin mengubahnya di menu Pengguna.' },
      { h: '3. Membuat laporan TUK secara manual', steps: [
        'Buka **Laporan TUK → + Tambah TUK**, pilih **Pengawas Pusat (PP)**.',
        'Isi **Nomor TUK**, **Nama TUK**, **Tahun pelaksanaan**, **Periode**, **Tanggal pelaksanaan**, **Jumlah sesi**, **Jumlah hari**, dan **Jumlah peserta uji**.',
        'Isi **Jumlah petugas** Pengawas Lokal, Admin, IT Lokal, dan Co CBT. Banyak honor (× sesi) dan transport (× hari) terhitung otomatis.',
        'Periksa tabel **Rincian Operasional TUK**. Tarif standar sudah terisi; ubah **Nilai** atau **Banyak** bila TUK memiliki ketentuan berbeda. Tiket dan hotel bersifat at cost.',
        'Klik **Simpan draft** untuk menyimpan tanpa menampilkannya ke PP.'],
        tip: 'Tahun pelaksanaan diisi manual agar dokumen tetap benar di tahun berikutnya. Periode dan tanggal pelaksanaan tercetak pada kalimat "Periode … Tahun … Tanggal …".' },
      { h: '4. Mengisi banyak TUK sekaligus (Impor Data)', steps: [
        'Buka **Impor Data**, klik **Unduh template Data TUK**, lalu isi satu baris untuk tiap TUK di Excel.',
        'Klik pilih file dan unggah. Aplikasi menampilkan **pratinjau** dan menandai baris bermasalah (PP belum mendaftar, nama TUK kosong, duplikat).',
        'Klik **Impor yang dipilih sebagai draft**. Laporan masuk ke menu **Laporan TUK** berstatus Draft.',
        'Anda juga dapat mengunggah file **operasional_TUK-PP.xlsx** berformat Lembar Serah Terima (satu sheet per TUK) tanpa memakai template.'],
        tip: 'Hasil impor selalu draft. Periksa dulu sebelum diterbitkan.' },
      { h: '5. Menerbitkan ke PP', steps: [
        'Buka laporan yang akan diterbitkan lewat **Ubah / Unduh**, pastikan Nama TUK terisi dan total lebih dari 0.',
        'Klik **Simpan & terbitkan ke PP**. Sejak itu PP dapat melihat dan mengunduh dokumennya.',
        'Bila ada kesalahan, klik **Tarik dari PP** untuk menyembunyikan sementara, perbaiki, lalu terbitkan lagi.'],
        tip: 'PP tidak dapat mengubah anggaran buatan Anda; PP hanya mengisi nama petugas, golongan, dan dokumen mandiri.' },
      { h: '6. Mengunduh dokumen', steps: [
        'Di halaman laporan, bagian **Unduh dokumen** menampilkan semua berkas. Klik **Unduh PDF** per berkas, atau **Unduh semua (ZIP)**.',
        '**Lembar Serah Terima** diterbitkan satu kali sebagai file tersendiri. Berkas lain dikelompokkan per folder: Admin, Co CBT, IT Lokal, PL, PP, dan CBT.',
        'Honor dan transport dibuat dalam file terpisah; briefing dan pelaksanaan juga terpisah.',
        'Simpan perubahan terlebih dahulu agar dokumen memakai data terbaru.'],
        tip: 'Honor pada Lembar Serah Terima adalah netto (sudah dipotong PPh 5%). Dokumen honor menampilkan Bruto, PPh 21, dan Netto.' },
      { h: '7. Hal yang perlu diingat', steps: [
        'Nama petugas, rumah makan, dan golongan **diisi oleh PP**. Jumlah kolom nama mengikuti Jumlah petugas yang Anda isi.',
        'Mengubah jumlah sesi atau hari akan menghitung ulang banyak honor dan transport petugas.',
        'Nomor surat, tanggal, Mata Anggaran, dan MAK di SPb dan kuitansi dikosongkan untuk diisi tangan.',
        'Seluruh dokumen berukuran **A4**; cetak dengan skala **100%** (jangan "Fit to page").'] },
      { h: '8. Pertanyaan yang sering muncul', steps: [
        '**PP tidak melihat dokumen?** Pastikan laporan berstatus Terbit dan PP sudah terhubung ke Anda (menu PP Saya).',
        '**PP tidak ditemukan saat impor?** PP harus mendaftar dahulu dengan email yang sama; setelah itu unggah ulang (baris yang sudah ada dilewati).',
        '**Salah memasukkan data?** Buka laporan, ubah, lalu Simpan. Bila sudah terbit, simpan ulang dengan **Simpan & perbarui terbitan**.',
        '**Lupa kata sandi?** Gunakan tautan Lupa kata sandi di halaman masuk.'] },
    ],
  },
  pp: {
    key: 'pp', short: 'Pengawas Pusat', title: 'Panduan Penggunaan untuk Pengawas Pusat (PP)',
    intro: 'Pengawas Pusat (PP) mengunduh dokumen keuangan TUK yang sudah disiapkan PJ Keuangan, melengkapi nama petugas, serta membuat dokumen perjalanan dinas dan biaya operasional secara mandiri.',
    sections: [
      { h: '1. Mendaftar dan masuk', steps: [
        'Buka alamat aplikasi, klik **Daftar**, isi nama lengkap beserta gelar, institusi, email, dan kata sandi.',
        'Isi **Kode PJ** yang diberikan PJ Keuangan Anda. Bila emailnya sudah didaftarkan PJ, Anda otomatis terhubung walau kolom ini kosong.',
        'Masuk dengan email dan kata sandi tadi. Menu **Berkas Saya** akan tampil.'],
        tip: 'Nama yang Anda daftarkan otomatis tercetak di semua dokumen, jadi tulis lengkap dengan gelar.' },
      { h: '2. Melihat berkas TUK Anda', steps: [
        'Buka **Berkas Saya**. Laporan tampil setelah PJ **menerbitkannya**. Bila masih kosong, hubungi PJ Anda.',
        'Setiap TUK menampilkan nama TUK, tahun, sesi, hari, total biaya, dan daftar dokumen per folder.',
        'Klik **Unduh PDF** pada satu dokumen, atau **Unduh semua (ZIP)** untuk seluruh berkas.'] },
      { h: '3. Mengisi nama dan golongan petugas', steps: [
        'Di kartu TUK, bagian **Nama & golongan petugas TUK, rumah makan**: isi nama Co CBT, Admin, IT Lokal, dan Pengawas Lokal.',
        'Isi **Golongan** tiap petugas. **Kosongkan bila bukan ASN.**',
        'Isi **Nama rumah makan** untuk konsumsi.',
        'Klik **Simpan nama petugas**, lalu **unduh ulang** dokumen terkait agar nama tercetak.'],
        tip: 'Jumlah kolom nama ditentukan PJ dan tidak dapat ditambah. Hubungi PJ bila jumlah petugas di lapangan berbeda.' },
      { h: '4. Membuat dokumen mandiri PP', steps: [
        'Pada bagian **Dokumen mandiri PP**, isi golongan, No HP, dasar penugasan (nomor surat), nomor SPD, kota asal, kota CBT, moda transportasi, tanggal berangkat dan kembali.',
        'Isi nominal sesuai bukti: uang harian, hotel, travel, transport darat, tiket PP, taksi asal, taksi tujuan, dan **biaya operasional PP**.',
        'Isi tujuan perjalanan, hasil kegiatan, dan tindak lanjut untuk laporan.',
        'Klik **Simpan dokumen mandiri PP**, lalu unduh di folder **5. PP**: Laporan Perjalanan Dinas, Kwitansi Perjalanan Dinas, dan Kwitansi Biaya Operasional.'],
        tip: 'Nominal boleh kurang atau lebih dari anggaran; selisihnya muncul di Form Kurleb.' },
      { h: '5. Mengisi Form Kurleb (kurang/lebih)', steps: [
        'Buka bagian **Form Kurleb — realisasi pelaksanaan**. Tabel menampilkan anggaran PJ dan kolom realisasi.',
        'Isi **Realisasi** hanya pada komponen yang nominalnya berbeda; kosong berarti sama dengan anggaran. Selisih terlihat langsung.',
        'Klik **Simpan & unduh Form Kurleb**. Form ini berdiri sendiri dan tidak mengubah dokumen lain, jadi tidak perlu mengunduh ulang berkas lain.',
        'Honor bersifat tetap sehingga tidak dapat diubah.'] },
      { h: '6. Mencetak dan menandatangani', steps: [
        'Semua dokumen berukuran **A4**. Cetak dengan skala **100%** (pilih "Actual size", bukan "Fit to page").',
        'Isi tangan kolom yang sengaja dikosongkan: nomor surat, nomor bukti, tanggal, Mata Anggaran, MAK, dan Kode.',
        'Tanda tangani bagian penerima. Kuitansi dengan nilai di atas **Rp 5.000.000** memerlukan **meterai**.',
        'Isi **Checklist Kelengkapan Berkas**: beri tanda pada kolom Ada atau Tidak Ada untuk tiap dokumen.',
        'SPTJM biaya operasional CBT berupa file **Word contoh**; TUK menempelkan kop surat institusinya sendiri.'] },
      { h: '7. Pertanyaan yang sering muncul', steps: [
        '**Berkas Saya kosong?** PJ belum menerbitkan laporan, atau akun Anda belum terhubung ke PJ. Hubungi PJ.',
        '**Angka anggaran salah?** PP tidak dapat mengubah anggaran. Minta PJ memperbaikinya, lalu unduh ulang.',
        '**Nama belum tercetak?** Pastikan sudah menekan Simpan nama petugas, lalu unduh ulang dokumennya.',
        '**Lupa kata sandi?** Gunakan tautan Lupa kata sandi di halaman masuk.'] },
    ],
  },
  kampus: {
    key: 'kampus', short: 'Kampus (Pendaftar)', title: 'Panduan Pendaftaran UKOMNAS untuk Kampus',
    intro: 'Kampus mendaftarkan peserta Uji Kompetensi Nasional secara kolektif: satu pendaftaran dan satu invoice untuk banyak mahasiswa. Biaya dihitung otomatis dari jumlah peserta. Pembayaran dilakukan lewat aplikasi lain; di sini kampus mengunggah bukti transfer dan mengunduh invoice serta kuitansi.',
    sections: [
      { h: '1. Membuat akun kampus', steps: [
        'Buka alamat aplikasi, klik **Daftar**, lalu pilih **Daftar sebagai: Kampus - pendaftar UKOMNAS**.',
        'Isi nama penanggung jawab, **nama kampus**, email, dan kata sandi. Kolom Kode PJ tidak perlu diisi.',
        'Masuk dengan email dan kata sandi tadi. Menu **Pendaftaran Saya** akan tampil.'],
        tip: 'Gunakan email resmi yang aktif. Nama kampus tercetak pada invoice dan kuitansi.' },
      { h: '2. Mengajukan pendaftaran dan invoice', steps: [
        'Buka **Pendaftaran Saya**. Lengkapi nama kampus, alamat, kota, nama kontak, no HP, dan email.',
        'Isi **Jumlah peserta uji**. **Biaya per peserta** ditetapkan Admin; **total tagihan terhitung otomatis** beserta terbilangnya.',
        'Klik **Ajukan pendaftaran & terbitkan invoice**. Invoice bernomor berurutan langsung terbit dan terunduh dalam bentuk PDF A4.'],
        tip: 'Jumlah peserta dan data kontak masih bisa diubah (tombol Ubah) selama belum ada bukti pembayaran. Biaya per peserta tidak dapat diubah kampus.' },
      { h: '3. Membayar dan mengunggah bukti transfer', steps: [
        'Lakukan pembayaran sesuai rekening pada invoice melalui aplikasi pembayaran Anda. Cantumkan **nomor invoice** pada berita transfer.',
        'Di tabel **Pendaftaran saya**, klik **Unggah bukti**. Isi tanggal pembayaran dan jumlah dibayar, lalu pilih **foto bukti transfer** (foto atau tangkapan layar).',
        'Klik **Kirim bukti pembayaran**. Status menjadi **Menunggu verifikasi**.'],
        tip: 'Foto dikecilkan otomatis. Pastikan nominal, tanggal, dan nama rekening terbaca jelas.' },
      { h: '4. Verifikasi dan kuitansi', steps: [
        'Admin memeriksa bukti. Bila sesuai, status menjadi **Lunas** dan **kuitansi pendaftaran** bernomor terbit.',
        'Klik **Kuitansi** pada baris pendaftaran untuk mengunduh PDF A4 berkop. Invoice yang sudah lunas menampilkan tanda LUNAS.',
        'Bila bukti **ditolak**, alasan tampil pada baris pendaftaran. Klik **Unggah bukti** untuk mengirim ulang.'] },
      { h: '5. Pertanyaan yang sering muncul', steps: [
        '**Biaya belum muncul?** Admin belum menetapkan biaya per peserta, atau pendaftaran sedang ditutup.',
        '**Jumlah peserta berubah setelah invoice terbit?** Ubah selama belum mengunggah bukti, lalu unduh ulang invoice. Setelah itu hubungi Admin.',
        '**Nominal transfer berbeda dengan tagihan?** Isi jumlah yang sebenarnya dibayar; Admin akan memeriksanya.',
        '**Lupa kata sandi?** Gunakan tautan Lupa kata sandi di halaman masuk.'] },
    ],
  },
};
