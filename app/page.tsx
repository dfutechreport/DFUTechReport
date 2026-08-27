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

// SVG İKONLAR
const IconInfo = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>;
const IconX = () => <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>;
const IconShield = () => <svg viewBox="0 0 24 24" width="48" height="48" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;

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
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          const isApproved = userSnap.data().isApproved;
          if (!isApproved) {
             setError("Hesabınız admin onayı beklemektedir.");
             setLoading(false);
             return;
          }
          // ROL BAZLI YÖNLENDİRME (KORUNDU)
          if (role === "uretim") router.push("/admin/tamamlanan-isler");
          else if (role === "admin") router.push("/admin");
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
    } catch (err: any) { setError("Giriş işlemi iptal edildi."); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Şifre sıfırlama talimatı e-postanıza gönderildi.");
      } else if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
          name, email, role: "user", isApproved: false, createdAt: serverTimestamp()
        });
        setSuccessMsg("Kaydınız oluşturuldu. Admin onayından sonra giriş yapabilirsiniz.");
        setIsLoginMode(true);
      }
    } catch (err: any) {
      setError("Hata: " + err.message);
    }
    setIsProcessing(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-bold tracking-widest animate-pulse uppercase text-xs">Sistemler Başlatılıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Arka Plan Dekoratif Işıklar */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-md z-10">
        {/* LOGO ALANI */}
        <div className="flex flex-col items-center mb-10 group">
          <img 
            src="/dfulogo.png" 
            alt="DFU LOGO" 
            className="h-28 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-transform duration-500 group-hover:scale-105" 
          />
          <div className="h-1 w-16 bg-blue-600 mt-4 rounded-full"></div>
        </div>

        {/* GİRİŞ KARTI */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">
          
          {/* Bilgi Butonu */}
          <button 
            onClick={() => setShowInfoModal(true)}
            className="absolute top-6 right-6 text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter"
          >
            <IconInfo /> Nasıl Kayıt Olunur?
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
              {isResetMode ? "ŞİFRE KURTARMA" : isLoginMode ? "GİRİŞ PANELİ" : "PERSONEL KAYIT"}
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Teknik Bakım ve Raporlama Sistemi</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && !isResetMode && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Ad Soyad</label>
                <input type="text" placeholder="Örn: Ahmet Yılmaz" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all text-sm font-medium" value={name} onChange={(e)=>setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Kurumsal E-posta</label>
              <input type="email" placeholder="mail@kurumadi.com" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all text-sm font-medium" value={email} onChange={(e)=>setEmail(e.target.value)} required />
            </div>
            {!isResetMode && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Sistem Şifresi</label>
                <input type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 transition-all text-sm font-medium" value={password} onChange={(e)=>setPassword(e.target.value)} required />
              </div>
            )}
            
            <button type="submit" disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-white font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all active:scale-95 mt-4">
              {isProcessing ? "İŞLENİYOR..." : isResetMode ? "TALİMAT GÖNDER" : isLoginMode ? "SİSTEME GİRİŞ" : "KAYDI TAMAMLA"}
            </button>
          </form>

          {/* SOSYAL GİRİŞ */}
          {isLoginMode && !isResetMode && (
            <>
              <div className="relative my-8 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                <span className="relative bg-slate-900 px-4 text-[9px] text-slate-600 font-bold uppercase tracking-widest">veya</span>
              </div>
              <button onClick={handleGoogleLogin} className="w-full bg-white hover:bg-slate-100 py-4 rounded-2xl text-slate-950 font-black uppercase text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-white/5">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/0/google.svg" width="16" alt="G" /> Google ile Hızlı Giriş
              </button>
            </>
          )}

          {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-center text-xs font-bold animate-shake">{error}</div>}
          {successMsg && <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-center text-xs font-bold">{successMsg}</div>}

          {/* ALT NAVİGASYON */}
          <div className="mt-10 flex flex-col gap-4 text-center">
            <button onClick={()=>{setIsResetMode(!isResetMode); setSuccessMsg(""); setError("");}} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors underline underline-offset-4">
              {isResetMode ? "Giriş Ekranına Dön" : "Şifremi Unuttum"}
            </button>
            {!isResetMode && (
              <button onClick={()=>setIsLoginMode(!isLoginMode)} className="text-slate-300 text-[11px] font-black uppercase tracking-widest hover:text-blue-400 transition-colors">
                {isLoginMode ? "Yeni Hesap Oluştur" : "Zaten hesabınız var mı? Giriş Yap"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KAYIT BİLGİ MODALI */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[3rem] shadow-2xl p-10 relative">
            <button onClick={() => setShowInfoModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"><IconX /></button>
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-500/10 p-5 rounded-3xl mb-6"><IconShield /></div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4">Giriş Prosedürü</h3>
              <div className="space-y-6 text-slate-400 text-sm font-medium">
                <div className="flex gap-4 items-start text-left">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black flex-shrink-0 text-xs shadow-lg shadow-blue-900/20">01</div>
                  <p><span className="text-white font-bold">Kayıt İşlemi:</span> Kurumsal e-postanız ile kayıt yaparak kendinize özel bir şifre belirleyin.</p>
                </div>
                <div className="flex gap-4 items-start text-left">
                  <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black flex-shrink-0 text-xs">02</div>
                  <p><span className="text-white font-bold">Admin Onayı:</span> Güvenlik gereği hesabınız, admin tarafından kontrol edilip onaylanacaktır.</p>
                </div>
                <div className="flex gap-4 items-start text-left">
                  <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black flex-shrink-0 text-xs">03</div>
                  <p><span className="text-white font-bold">Tam Erişim:</span> Onaylandıktan sonra belirlediğiniz şifre ile sisteme her zaman giriş yapabilirsiniz.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="w-full mt-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-900/20"
              >
                Anladım, Teşekkürler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}