import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

// FIREBASE KONFİGÜRASYONU
const firebaseConfig = {
  apiKey: "AIzaSyDWqJA91hlpCb0vOsI0SopHLX_9Xfr2WM4",
  authDomain: "dfu-tech-report.firebaseapp.com",
  projectId: "dfu-tech-report",
  storageBucket: "dfu-tech-report.firebasestorage.app",
  messagingSenderId: "714961673687",
  appId: "1:714961673687:web:d21e6d6398677f421b7f92"
};

// Singleton Pattern: Firebase App Initialization
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// ==========================================================
// ÇEVRİMDIŞI (OFFLINE) DESTEĞİ AKTİF ETME
// ==========================================================
// Bu blok, internetin çekmediği noktalarda (kazan dairesi vb.) 
// verilerin IndexedDB üzerinde depolanmasını ve internet geldiği an 
// sunucuya otomatik senkronize edilmesini sağlar.
if (typeof window !== "undefined") {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Birden fazla sekme açıkken persistence sadece birinde çalışabilir.
      console.warn("Firebase Persistence: Çoklu sekme açık, önbellek kısıtlı.");
    } else if (err.code === 'unimplemented') {
      // Tarayıcı IndexedDB desteklemiyor (çok eski tarayıcılar).
      console.warn("Firebase Persistence: Tarayıcı çevrimdışı desteği sunmuyor.");
    }
  });
}
