import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// BURAYI KENDİ FIREBASE BİLGİLERİNİZLE GÜNCELLEYİN
const firebaseConfig = {
  apiKey: "AIzaSyDWqJA91hlpCb0vOsI0SopHLX_9Xfr2WM4",
  authDomain: "dfu-tech-report.firebaseapp.com",
  projectId: "dfu-tech-report",
  storageBucket: "dfu-tech-report.firebasestorage.app",
  messagingSenderId: "714961673687",
  appId: "1:714961673687:web:d21e6d6398677f421b7f92"
};

// Mantıksal Akış: Sistem birden fazla kez yüklenirse Firebase'in çökmesini engelleriz (Singleton Pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Yetkilendirme (Gmail Girişi) Modülünü Dışa Aktarıyoruz
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Veritabanı Modülünü Dışa Aktarıyoruz
export const db = getFirestore(app);