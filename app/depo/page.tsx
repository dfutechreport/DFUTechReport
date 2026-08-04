"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";

export default function DepoDashboard() {
  const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "depo" || role === "admin") {
            setUserName(userSnap.data().name);
            setLoading(false);
          } else {
            window.location.href = "/dashboard";
          }
        }
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Sistem yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 flex flex-col justify-center items-center">
      <div className="max-w-4xl w-full">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Depo Yönetim Paneli</h1>
              <p className="text-gray-400 mt-1 text-sm md:text-base">
                Hoş geldin, <span className="font-bold text-fuchsia-400">{userName}</span>
              </p>
            </div>
          </div>
          <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition">Çıkış Yap</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-gray-900 border border-fuchsia-500/30 p-8 rounded-2xl shadow-xl flex flex-col items-center text-center transition hover:border-fuchsia-500">
            <div className="bg-fuchsia-900/20 p-5 rounded-full mb-6">
              <svg className="w-12 h-12 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Yedek Parça Stok Yönetimi</h2>
            <p className="text-gray-400 text-sm mb-8">24 Saatte 1 kez Excel yükleyerek ana depo stoklarını senkronize edin ve kullanılan parçaların dökümünü alın.</p>
            <Link href="/admin/yedek-parca" className="w-full bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(192,38,211,0.4)] transition">
              Sisteme Giriş Yap
            </Link>
          </div>

          {/* YENİ GÜNCELLENEN KRİTİK STOK LİNKİ */}
          <div className="bg-gray-900 border border-red-500/30 p-8 rounded-2xl shadow-xl flex flex-col items-center text-center transition hover:border-red-500">
            <div className="bg-red-900/20 p-5 rounded-full mb-6">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Kritik Stok Bildirimleri</h2>
            <p className="text-gray-400 text-sm mb-8">Mevcut stoğu 2 ve altına düşerek satın almaya otomatik e-posta fırlatılmış olan malzemelerin detaylı raporu.</p>
            <Link href="/depo/kritik-stok" className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] transition">
              Listele
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}