"use client";

import { useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "admin") router.push("/admin");
          else router.push("/dashboard");
        } else { setLoading(false); }
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { name: user.displayName, email: user.email, role: "user", isApproved: false, createdAt: serverTimestamp() });
        setSuccessMsg("Kayıt başarılı! Lütfen admin onayını bekleyiniz.");
      }
    } catch (err: any) { setError("Google girişi başarısız."); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Şifre sıfırlama linki gönderildi.");
      } else if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), { name, email, role: "user", isApproved: false, createdAt: serverTimestamp() });
        setSuccessMsg("Kayıt başarılı! Admin onayını bekleyiniz.");
        setIsLoginMode(true);
      }
    } catch (err: any) { setError(err.message); }
    setIsProcessing(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-black text-white text-center mb-8 italic uppercase tracking-tighter">DFU Teknik Portal</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLoginMode && !isResetMode && (
            <input type="text" placeholder="Ad Soyad" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={name} onChange={(e)=>setName(e.target.value)} required />
          )}
          <input type="email" placeholder="E-posta" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          {!isResetMode && (
            <input type="password" placeholder="Şifre" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          )}
          <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-black uppercase text-sm shadow-lg">{isProcessing ? "İşleniyor..." : isResetMode ? "Sıfırla" : isLoginMode ? "Giriş Yap" : "Kayıt Ol"}</button>
        </form>
        {isLoginMode && !isResetMode && (
          <button onClick={handleGoogleLogin} className="w-full mt-4 bg-white hover:bg-gray-100 py-4 rounded-2xl text-black font-bold uppercase text-xs flex items-center justify-center gap-2">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="18" alt="G" /> Google ile Giriş
          </button>
        )}
        {error && <p className="text-red-500 text-center text-xs mt-4 font-bold">{error}</p>}
        {successMsg && <p className="text-green-500 text-center text-xs mt-4 font-bold">{successMsg}</p>}
        <div className="mt-8 flex flex-col gap-3 text-center">
          <button onClick={()=>{setIsResetMode(!isResetMode); setSuccessMsg(""); setError("");}} className="text-slate-500 text-xs font-bold uppercase underline">{isResetMode ? "Geri Dön" : "Şifremi Unuttum"}</button>
          {!isResetMode && <button onClick={()=>setIsLoginMode(!isLoginMode)} className="text-slate-400 text-xs font-bold uppercase">{isLoginMode ? "Hesap Oluştur" : "Giriş Yap"}</button>}
        </div>
      </div>
    </div>
  );
}