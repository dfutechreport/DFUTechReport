"use client";
import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";

const IconInfo = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>;
const IconX = () => <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M18 6 6 18M6 6l12 12"></path></svg>;

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
          const role = userSnap.data().role ? userSnap.data().role.toLowerCase().trim() : "";
          if (role === "ik") router.push("/admin/mesai");
          else if (role === "uretim") router.push("/admin/tamamlanan-isler");
          else if (role === "admin") router.push("/admin");
          else if (role === "depo") router.push("/admin/yedek-parca");
          else if (role === "isg") router.push("/isg");
          else router.push("/dashboard");
        } else { setLoading(false); }
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { name: user.displayName, email: user.email, role: "user", isApproved: false, createdAt: serverTimestamp() });
      }
    } catch (err) { setError("İşlem iptal edildi."); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (isResetMode) { await sendPasswordResetEmail(auth, email); setSuccessMsg("Sıfırlama linki gönderildi."); }
      else if (isLoginMode) { await signInWithEmailAndPassword(auth, email, password); }
      else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), { name, email, role: "user", isApproved: false, createdAt: serverTimestamp() });
        setSuccessMsg("Kayıt başarılı! Admin onayı bekleyin.");
        setIsLoginMode(true);
      }
    } catch (err: any) { setError(err.message); }
    setIsProcessing(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic tracking-widest">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans italic font-bold">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-10 group">
          <img src="/dfulogo.png" alt="DFU" className="h-28 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105" />
          <div className="h-1 w-16 bg-blue-600 mt-4 rounded-full"></div>
        </div>
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative text-white">
          <button onClick={() => setShowInfoModal(true)} className="absolute top-8 right-8 text-slate-500 hover:text-blue-400 flex items-center gap-1 text-[10px] font-black uppercase"><IconInfo /> Kayıt Rehberi</button>
          <div className="mb-8 uppercase tracking-tighter">
            <h2 className="text-2xl font-black">{isResetMode ? "Kurtarma" : isLoginMode ? "Giriş Paneli" : "Yeni Kayıt"}</h2>
            <p className="text-slate-500 text-[10px] tracking-widest">Teknik Yönetim Portalı</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && !isResetMode && <input type="text" placeholder="Ad Soyad" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={name} onChange={(e)=>setName(e.target.value)} required />}
            <input type="email" placeholder="E-posta" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            {!isResetMode && <input type="password" placeholder="Şifre" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={password} onChange={(e)=>setPassword(e.target.value)} required />}
            <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-black uppercase text-xs tracking-widest transition-all">{isProcessing ? "İŞLENİYOR..." : isResetMode ? "ŞİFREYİ SIFIRLA" : isLoginMode ? "SİSTEME GİRİŞ" : "KAYDI TAMAMLA"}</button>
          </form>
          {isLoginMode && !isResetMode && (
            <>
              <div className="relative my-8 text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div><span className="relative bg-slate-900 px-4 text-[9px] text-slate-600 font-bold uppercase tracking-widest">veya</span></div>
              <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 py-4 rounded-2xl text-slate-950 font-black uppercase text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="16" /> Google ile Hızlı Giriş</button>
            </>
          )}
          {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-center text-xs font-bold">{error}</div>}
          {successMsg && <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-center text-xs font-bold">{successMsg}</div>}
          <div className="mt-10 flex flex-col gap-4 text-center">
            <button onClick={()=>{setIsResetMode(!isResetMode); setSuccessMsg(""); setError("");}} className="text-slate-500 text-[10px] font-black uppercase underline underline-offset-4">{isResetMode ? "Geri Dön" : "Şifremi Unuttum"}</button>
            {!isResetMode && <button onClick={()=>setIsLoginMode(!isLoginMode)} className="text-slate-300 text-[11px] font-black uppercase">{isLoginMode ? "Yeni Hesap Oluştur" : "Zaten hesabınız var mı?"}</button>}
          </div>
        </div>
      </div>
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[3rem] shadow-2xl p-10 relative text-white text-center">
            <button onClick={() => setShowInfoModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><IconX /></button>
            <h3 className="text-2xl font-black italic uppercase mb-6">Giriş Prosedürü</h3>
            <div className="space-y-6 text-slate-400 text-sm text-left font-black">
              <p><span className="text-blue-500">01. Kayıt:</span> Kurumsal mailiniz ile şifrenizi belirleyin.</p>
              <p><span className="text-blue-500">02. Onay:</span> Hesabınız admin tarafından onaylanacaktır.</p>
              <p><span className="text-blue-500">03. Erişim:</span> Onay sonrası sistemdeki yetki alanınıza giriş yapabilirsiniz.</p>
            </div>
            <button onClick={() => setShowInfoModal(false)} className="w-full mt-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-[10px] tracking-widest shadow-xl transition-all">Anladım</button>
          </div>
        </div>
      )}
    </div>
  );
}
