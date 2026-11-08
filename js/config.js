// Konfigurasi web app Firebase (Console > Project settings > Your apps > Web).
// Nilai ini AMAN ditaruh di kode klien; keamanan data dijaga oleh firestore.rules.
window.APP_CONFIG = {
  firebase: {
    apiKey: 'ISI_API_KEY',
    authDomain: 'ISI_PROJECT_ID.firebaseapp.com',
    projectId: 'ISI_PROJECT_ID',
    appId: 'ISI_APP_ID',
  },
  // Email yang otomatis menjadi Admin (harus sama dengan di firestore.rules)
  ADMIN_EMAIL: 'wulanndari.dwiretno16@gmail.com',
};
