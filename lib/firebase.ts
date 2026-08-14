import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDWqJA91hlpCb0vOsI0SopHLX_9Xfr2WM4",
  authDomain: "dfu-tech-report.firebaseapp.com",
  projectId: "dfu-tech-report",
  storageBucket: "dfu-tech-report.firebasestorage.app",
  messagingSenderId: "714961673687",
  appId: "1:714961673687:web:d21e6d6398677f421b7f92"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    console.warn("Firebase Persistence Error:", err.code);
  });
}