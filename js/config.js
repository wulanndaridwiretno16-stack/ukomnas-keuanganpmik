// Konfigurasi web app Firebase (Console > Project settings > Your apps > Web).
// Nilai ini AMAN ditaruh di kode klien; keamanan data dijaga oleh firestore.rules.
window.APP_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBvQX6mjhrIBBj_Ow8YwnkBCX_nMZ0apHs',
    authDomain: 'dok-keuangan-ukomnas-pmik.firebaseapp.com',
    projectId: 'dok-keuangan-ukomnas-pmik',
    appId: '1:991315847396:web:c088a44e87a8799cc824f1',
  },
  // Email yang otomatis menjadi Admin (harus sama dengan di firestore.rules)
  ADMIN_EMAIL: 'wulanndari.dwiretno16@gmail.com',
};
