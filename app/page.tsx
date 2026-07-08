"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [userStatus, setUserStatus] = useState("guest"); 
  const [message, setMessage] = useState("");
  
  // YENİ: Başarılı Giriş Animasyonu State'i
  const [showSplash, setShowSplash] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: user.email,
              name: user.displayName,
              role: "pending",
              isApproved: false,
              createdAt: new Date()
            });
            setUserStatus("pending");
            setMessage("Kayıt alındı. Onay bekleniyor.");
          } else {
            const userData = userSnap.data();
            if (!userData.isApproved) {
              setUserStatus("pending");
              setMessage("Hesabınız henüz onaylanmadı.");
            } else {
              // KULLANICI ONAYLIYSA DOĞRUDAN ANİMASYONA GEÇ (Varsa)
              setUserStatus(userData.role);
            }
          }
        } catch (error) {
          console.error("Veri çekme hatası:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  // YENİ: Butona tıklandığında hemen gitmek yerine animasyonu tetikle
  const handleEnterSystem = (url: string) => {
    setTargetUrl(url);
    setShowSplash(true); // Animasyonu Başlat
    
    // 2.2 Saniye sonra gerçek sayfaya yönlendir
    setTimeout(() => {
      window.location.href = url;
    }, 2200);
  };

  // EĞER ANİMASYON TETİKLENDİYSE SADECE BU EKRANI GÖSTER
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center overflow-hidden">
        
        {/* Dönen Dış Halka */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-b-transparent animate-[spin_2s_linear_infinite_reverse]"></div>
          
                    {/* İçteki Kendi Şirket Logonuz (Nabız Efektli) */}
          <div className="animate-pulse flex items-center justify-center bg-white rounded-full w-28 h-28 z-10 shadow-[0_0_40px_rgba(59,130,246,0.6)] overflow-hidden p-2">
            <img 
  src="/dfulogo.png" 
  alt="DFU Logo" 
              className="w-full h-full object-contain" 
            />
          </div>
        </div>

        {/* Yükleniyor Yazısı */}
        <div className="mt-8 text-center animate-[bounce_2s_infinite]">
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">DFU Sistemleri</h2>
          <p className="text-blue-400 font-medium mt-2 tracking-[0.2em] text-sm">GÜVENLİ BAĞLANTI KURULUYOR...</p>
        </div>
      </div>
    );
  }

  // NORMAL GİRİŞ EKRANI
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 text-center">
        
        <div className="mx-auto flex justify-center mb-6">
          {/* LOGONUZ BURADA ÇIKAR */}
        <img 
  src="/dfulogo.png" 
  alt="DFU Logo" 
  className="h-20 w-auto object-contain bg-white rounded-xl p-2 shadow-lg shadow-white/10" 
/>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Bakım Yönetimi</h1>
        <p className="text-gray-400 mb-8 text-sm font-medium tracking-wide text-blue-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</p>

        {userStatus === "admin" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-900/30 text-green-400 border border-green-800/50">
              Giriş Başarılı (Yetki: Admin)
            </div>
            {/* Tıklanınca Animasyonu Başlatan Buton */}
            <button 
              onClick={() => handleEnterSystem("/admin")} 
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-green-500/30"
            >
              Yönetim Paneline Git ➔
            </button>
          </div>
        ) : userStatus === "user" || userStatus === "teknisyen" || userStatus === "operator" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/50">
              Giriş Başarılı (Yetki: Teknisyen)
            </div>
            {/* Tıklanınca Animasyonu Başlatan Buton */}
            <button 
              onClick={() => handleEnterSystem("/dashboard")} 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-blue-500/30"
            >
              Ana Ekrana Git ➔
            </button>
          </div>
        ) : userStatus === "pending" ? (
          <div className="p-4 rounded-lg bg-orange-900/30 text-orange-400 border border-orange-800/50">
            {message}
          </div>
        ) : (
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? "Bağlanıyor..." : "Google ile Giriş Yap"}
          </button>
        )}
      </div>
    </div>
  );
}