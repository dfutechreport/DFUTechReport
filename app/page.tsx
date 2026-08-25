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
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          const isApproved = userSnap.data().isApproved;
          if (!isApproved) {
             setError("Hesabınız henüz onaylanmamış.");
             setLoading(false);
             return;
          }
          // ROL BAZLI YÖNLENDİRME
          if (role === "uretim") {
            router.push("/admin/tamamlanan-isler");
          } else if (role === "admin") {
            router.push("/admin");
          } else if (role === "depo") {
            router.push("/depo");
          } else {
            router.push("/dashboard");
          }
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Şifre sıfırlama linki e-postanıza gönderildi.");
      } else if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
          name, email, role: "user", isApproved: false, createdAt: serverTimestamp()
        });
        setSuccessMsg("Kayıt başarılı! Lütfen admin onayını bekleyiniz.");
        setIsLoginMode(true);
      }
    } catch (err: any) {
      setError("İşlem sırasında hata oluştu: " + err.message);
    }
    setIsProcessing(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic tracking-widest">DFU SİSTEMLERİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">DFU Teknik Portal</h1>
          <p className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-widest">Giriş ve Kimlik Doğrulama</p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLoginMode && !isResetMode && (
            <input type="text" placeholder="Ad Soyad" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={name} onChange={(e)=>setName(e.target.value)} required />
          )}
          <input type="email" placeholder="E-posta" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          {!isResetMode && (
            <input type="password" placeholder="Şifre" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          )}
          
          <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-black uppercase text-sm shadow-lg transition-all">
            {isProcessing ? "İşleniyor..." : isResetMode ? "Şifre Sıfırla" : isLoginMode ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </form>

        {error && <p className="text-red-500 text-center text-xs mt-4 font-bold">{error}</p>}
        {successMsg && <p className="text-green-500 text-center text-xs mt-4 font-bold">{successMsg}</p>}

        <div className="mt-8 flex flex-col gap-3 text-center">
          <button onClick={()=>{setIsResetMode(!isResetMode); setSuccessMsg(""); setError("");}} className="text-slate-500 text-xs hover:text-white uppercase font-bold underline">
            {isResetMode ? "Geri Dön" : "Şifremi Unuttum"}
          </button>
          {!isResetMode && (
            <button onClick={()=>setIsLoginMode(!isLoginMode)} className="text-slate-400 text-xs hover:text-white uppercase font-bold">
              {isLoginMode ? "Hesabınız yok mu? Kayıt Olun" : "Zaten hesabınız var mı? Giriş Yapın"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}