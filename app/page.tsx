"use client";

import { useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true); // Giriş mi Kayıt mı?
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const router = useRouter();

  // Sistem açıldığında yetki kontrolü
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            if (userData.isApproved) {
              const role = userData.role;
              if (role === "admin" || role === "isg") {
                router.push("/admin");
              } else if (role === "depo") {
                router.push("/depo"); 
              } else {
                router.push("/dashboard"); 
              }
            } else {
              setError(`Hesabınız (${user.email}) sistemde kayıtlı ancak henüz onaylanmamış. Lütfen yöneticinizle görüşün.`);
              auth.signOut();
              setLoading(false);
            }
          } else {
            // Google ile ilk defa girenler için arka planda kayıt oluştur
            await setDoc(doc(db, "users", user.uid), {
              name: user.displayName || "İsimsiz Kullanıcı",
              email: user.email,
              role: "",
              isApproved: false,
              createdAt: new Date()
            });
            setError(`Kayıt başvurunuz (${user.email}) alındı! Yöneticiniz onayladıktan sonra tekrar giriş yapabilirsiniz.`);
            auth.signOut();
            setLoading(false);
          }
        } catch (err) {
          console.error("Kullanıcı verisi çekilemedi:", err);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // E-Posta / Şifre ile Giriş veya Kayıt İşlemi
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isLoginMode) {
        // GİRİŞ YAP
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // KAYIT OL
        if (!name) {
          setError("Lütfen Ad Soyad giriniz.");
          setIsProcessing(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Yeni kullanıcıyı Firestore'a "Onaysız" kaydet
        await setDoc(doc(db, "users", user.uid), {
          name: name,
          email: email,
          role: "",
          isApproved: false,
          createdAt: new Date()
        });

        setSuccessMsg("Kayıt başarılı! Yöneticiniz hesabınızı onayladığında giriş yapabilirsiniz.");
        auth.signOut(); 
        setIsLoginMode(true); 
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError("Bu e-posta adresi zaten kullanımda.");
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') setError("E-posta veya şifre hatalı.");
      else if (err.code === 'auth/weak-password') setError("Şifreniz en az 6 karakter olmalıdır.");
      else setError("Bir hata oluştu: " + err.message);
    }
    setIsProcessing(false);
  };

  // Google ile Giriş İşlemi
  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') setError("Giriş penceresi kapatıldı.");
      else setError("Google ile giriş yapılırken bir hata oluştu.");
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-500 font-bold tracking-widest">SİSTEM BAŞLATILIYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
        
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-teal-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-yellow-600/10 rounded-full blur-3xl"></div>

        {/* LOGO, BAŞLIK VE SLOGAN */}
        <div className="flex flex-col items-center mb-8 relative z-10">
          <img src="/dfulogo.png" alt="DFU Logo" className="h-16 w-auto mb-5 rounded-xl drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]" />
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 text-center tracking-widest mb-1">
            DFU TECH REPORT
          </h1>
          <p className="text-gray-400 text-xs text-center font-medium tracking-wide mb-5">
            Teknik Bakım Raporlama ve Takip Sistemi
          </p>
          
          <div className="bg-gray-950/50 border border-gray-800 px-5 py-2 rounded-full inline-block backdrop-blur-sm shadow-inner">
            <p className="text-teal-400 text-xs font-bold tracking-wider italic text-center">
              "Veri Konuşur, Tesis Kazanır."
            </p>
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 p-3 rounded-xl mb-4 text-sm text-center leading-relaxed font-medium relative z-10">{error}</div>}
        {successMsg && <div className="bg-green-900/30 border border-green-800/50 text-green-300 p-3 rounded-xl mb-4 text-sm text-center leading-relaxed font-medium relative z-10">{successMsg}</div>}

        {/* E-POSTA İLE GİRİŞ / KAYIT FORMU */}
        <div className="relative z-10">
          
          {/* Giriş / Kayıt Geçiş Butonları */}
          <div className="flex bg-gray-800 p-1 rounded-xl mb-5">
            <button type="button" onClick={() => { setIsLoginMode(true); setError(""); setSuccessMsg(""); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isLoginMode ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Giriş Yap</button>
            <button type="button" onClick={() => { setIsLoginMode(false); setError(""); setSuccessMsg(""); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isLoginMode ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Kayıt Ol</button>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4 mb-6">
            {!isLoginMode && (
              <div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLoginMode} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="Ad Soyad" />
              </div>
            )}
            <div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="E-Posta Adresi" />
            </div>
            <div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="Şifre" />
            </div>
            <button type="submit" disabled={isProcessing} className="w-full bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-1">
              {isProcessing ? "İşlem Yapılıyor..." : (isLoginMode ? "Giriş Yap" : "Kayıt Ol")}
            </button>
          </form>

          {/* AYIRICI ÇİZGİ */}
          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-gray-700"></div>
            <span className="px-3 text-xs text-gray-500 font-bold">VEYA</span>
            <div className="flex-1 border-t border-gray-700"></div>
          </div>

          {/* GOOGLE İLE GİRİŞ BUTONU */}
          <button onClick={handleGoogleLogin} disabled={isProcessing} className="w-full bg-white hover:bg-gray-100 text-gray-900 text-sm font-bold py-3.5 px-6 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google ile Giriş Yap
          </button>
        </div>

      </div>
      
      <p className="text-gray-600 text-[10px] mt-6 text-center">
        &copy; {new Date().getFullYear()} DFU Donuk Fırıncılık Ürünleri A.Ş. Tüm Hakları Saklıdır.<br/>
        Sistem Sürümü: V3.0
      </p>
    </div>
  );
}