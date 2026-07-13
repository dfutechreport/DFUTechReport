"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase"; 

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [userStatus, setUserStatus] = useState("guest"); 
  const [message, setMessage] = useState("");
  
  const [showSplash, setShowSplash] = useState(false);

  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [gercekIsim, setGercekIsim] = useState("");

  const [tempRoleInfo, setTempRoleInfo] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (!userData.isApproved) {
              setUserStatus("pending");
              setMessage("Hesabınız henüz onaylanmadı. Lütfen Admin ile iletişime geçin.");
            } else {
              setUserStatus(userData.role);
            }
          } else {
            const email = user.email?.toLowerCase().trim();
            const manuelRef = doc(db, "users", email || "bilinmeyen");
            const manuelSnap = await getDoc(manuelRef);

            if (manuelSnap.exists()) {
              const manuelData = manuelSnap.data();
              setTempRoleInfo(manuelData); 
              setTempUser(user);
              setGercekIsim(manuelData.name || user.displayName || ""); 
              setShowNamePrompt(true);
            } else {
              setTempUser(user);
              setGercekIsim(user.displayName || ""); 
              setShowNamePrompt(true);
            }
          }
        } catch (error) { console.error("Veri çekme hatası:", error); }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try { await signInWithPopup(auth, googleProvider); } catch (error) { setLoading(false); }
  };

  const handleIsimKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gercekIsim.trim().length < 3) return alert("Lütfen geçerli bir İsim-Soyisim giriniz.");

    setLoading(true);
    try {
      await updateProfile(tempUser, { displayName: gercekIsim });
      const userRef = doc(db, "users", tempUser.uid);

      if (tempRoleInfo) {
        await setDoc(userRef, {
          email: tempUser.email, name: gercekIsim, role: tempRoleInfo.role, isApproved: true, createdAt: new Date(), manuelOnaylandi: true
        });
        const email = tempUser.email?.toLowerCase().trim();
        await deleteDoc(doc(db, "users", email));
        setShowNamePrompt(false);
        setUserStatus(tempRoleInfo.role); 
      } else {
        await setDoc(userRef, {
          email: tempUser.email, name: gercekIsim, role: "pending", isApproved: false, createdAt: new Date()
        });
        setShowNamePrompt(false); setUserStatus("pending");
        setMessage(`Kayıt alındı, ${gercekIsim}. Yönetici onayı bekleniyor.`);
      }
    } catch (error) { alert("İsim kaydedilirken bir hata oluştu."); } finally { setLoading(false); }
  };

  const handleEnterSystem = (url: string) => {
    setShowSplash(true); 
    setTimeout(() => { window.location.href = url; }, 2200);
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-gray-950 z-50 flex flex-col items-center justify-center overflow-hidden">
        <div className="relative w-40 h-40 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-b-transparent animate-[spin_2s_linear_infinite_reverse]"></div>
          <div className="animate-pulse flex items-center justify-center bg-white rounded-full w-28 h-28 z-10 shadow-[0_0_40px_rgba(59,130,246,0.6)] overflow-hidden p-2">
            <img src="/dfulogo.png" alt="DFU Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="mt-8 text-center animate-[bounce_2s_infinite]">
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">DFU Sistemleri</h2>
          <p className="text-blue-400 font-medium mt-2 tracking-[0.2em] text-sm">GÜVENLİ BAĞLANTI KURULUYOR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden">
        
        <div className="mx-auto flex justify-center mb-6">
          <img src="/dfulogo.png" alt="DFU Logo" className="h-20 w-auto object-contain bg-white rounded-xl p-2 shadow-lg shadow-white/10" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Bakım Yönetimi</h1>
        <p className="text-gray-400 mb-8 text-sm font-medium tracking-wide text-blue-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</p>

        {showNamePrompt ? (
          <form onSubmit={handleIsimKaydet} className="space-y-4 animate-fade-in bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h2 className="text-xl font-bold text-yellow-400">Son Bir Adım!</h2>
            <p className="text-gray-300 text-sm">
              {tempRoleInfo ? "Hesabınız yönetici tarafından peşinen onaylandı! Sadece resmi adınızı teyit edin." : "Kurumsal kayıtlar için lütfen adınızı ve soyadınızı giriniz."}
            </p>
            <input type="text" value={gercekIsim} onChange={(e) => setGercekIsim(e.target.value)} placeholder="Örn: Ahmet Yılmaz" className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 text-center text-lg font-bold" required />
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition disabled:opacity-50">
              {loading ? "Sisteme Giriliyor..." : (tempRoleInfo ? "Doğrula ve İçeri Gir" : "Kaydımı Tamamla")}
            </button>
          </form>
        ) : userStatus === "admin" || userStatus === "operator" || userStatus === "uretim" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-900/30 text-green-400 border border-green-800/50">
              Giriş Başarılı (Yetki: {userStatus === "uretim" ? "ÜRETİM YETKİLİSİ" : userStatus.toUpperCase()})
            </div>
            <button onClick={() => handleEnterSystem("/admin")} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-green-500/30">
              {userStatus === "admin" ? "Yönetim Paneline Git ➔" : "İzleme Paneline Git ➔"}
            </button>
          </div>
        ) : userStatus === "teknisyen" || userStatus === "user" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/50">Giriş Başarılı (Yetki: TEKNİSYEN)</div>
            <button onClick={() => handleEnterSystem("/dashboard")} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg shadow-blue-500/30">
              Arıza Formuna Git ➔
            </button>
          </div>
        ) : userStatus === "pending" ? (
          <div className="p-4 rounded-lg bg-orange-900/30 text-orange-400 border border-orange-800/50">{message}</div>
        ) : (
          <button onClick={handleGoogleLogin} disabled={loading} className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-3 disabled:opacity-50">
            {loading ? "Bağlanıyor..." : "Google ile Giriş Yap"}
          </button>
        )}
      </div>
    </div>
  );
}