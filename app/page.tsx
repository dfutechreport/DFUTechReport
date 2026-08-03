"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; // Firebase dosya yolunuzu gerekirse kontrol edin
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const router = useRouter();

  // Sistem açıldığında kullanıcının daha önceden giriş yapıp yapmadığını ve ROLÜNÜ kontrol eder
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
              
              // ==========================================
              // ROL BAZLI OTOMATİK YÖNLENDİRME (ROUTING)
              // ==========================================
              if (role === "admin" || role === "isg") {
                router.push("/admin");
              } else if (role === "depo") {
                // YENİ EKLENEN: Depo kullanıcısı kendi paneline gider
                router.push("/depo"); 
              } else {
                // uretim, operator, teknisyen rollerinin hepsi Dashboard'a gider
                router.push("/dashboard"); 
              }
            } else {
              setError("Hesabınız henüz onaylanmamış. Lütfen yöneticinizle görüşün.");
              auth.signOut();
              setLoading(false);
            }
          } else {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError("");
    try {
      // Firebase ile giriş işlemi
      await signInWithEmailAndPassword(auth, email, password);
      // Giriş başarılı olursa üstteki useEffect otomatik tetiklenir ve yönlendirmeyi yapar.
    } catch (err: any) {
      setError("Giriş başarısız. E-posta veya şifre hatalı.");
      setIsLoggingIn(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-500 font-bold tracking-widest">SİSTEM BAŞLATILIYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-8">
        
        {/* LOGO VE BAŞLIK ALANI */}
        <div className="flex flex-col items-center mb-8">
          <img src="/dfulogo.png" alt="DFU Logo" className="h-16 w-auto mb-6 bg-white p-2 rounded-xl" />
          <h1 className="text-2xl font-bold text-white text-center">CMMS Yönetim Sistemi</h1>
          <p className="text-gray-500 text-sm mt-2 text-center">Endüstri 4.0 Bakım & Arıza Takip Platformu</p>
        </div>

        {/* HATA MESAJI GÖSTERİMİ */}
        {error && (
          <div className="bg-red-900/30 border border-red-800/50 text-red-400 p-4 rounded-xl mb-6 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* GİRİŞ FORMU */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">E-Posta Adresi</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="ornek@sirket.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">Şifre</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoggingIn} 
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(13,148,136,0.3)] transition-all disabled:opacity-50"
          >
            {isLoggingIn ? "Giriş Yapılıyor..." : "Sisteme Giriş Yap"}
          </button>
        </form>

      </div>
      
      <p className="text-gray-600 text-xs mt-8 text-center">
        &copy; {new Date().getFullYear()} DFU Donuk Fırıncılık Ürünleri A.Ş. Tüm Hakları Saklıdır.<br/>
        Sistem Sürümü: V3.0
      </p>
    </div>
  );
}