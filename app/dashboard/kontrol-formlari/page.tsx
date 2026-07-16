"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function KontrolFormlariMenu() {
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          // IK ve Üretim Yetkilisi Giremez
          if (role === "ik" || role === "uretim") window.location.href = "/";
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
              ✅ Periyodik Kontrol Formları
            </h1>
            <p className="text-gray-400 mt-1">Sahadaki günlük ve haftalık donanım kontrollerini yapın veya arşivi inceleyin.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Panele Dön
          </Link>
        </div>

        {/* 1. KAZAN DAİRESİ */}
        <div className="bg-gray-900 border border-orange-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-orange-500 mb-4 border-b border-gray-800 pb-2">Kazan Dairesi Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/kazan" className="bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Günlük Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/kazan/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 2. HİDROFOR DAİRESİ */}
        <div className="bg-gray-900 border border-blue-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-500 mb-4 border-b border-gray-800 pb-2">Hidrofor Dairesi Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/hidrofor" className="bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Günlük Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/hidrofor/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 3. JENERATÖR */}
        <div className="bg-gray-900 border border-yellow-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-yellow-500 mb-4 border-b border-gray-800 pb-2">Jeneratör Grubu Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/jenerator" className="bg-yellow-600 hover:bg-yellow-500 text-black py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Haftalık Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/jenerator/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 4. YANGIN POMPALARI */}
        <div className="bg-gray-900 border border-red-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-red-500 mb-4 border-b border-gray-800 pb-2">Yangın Pompaları Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/yangin" className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Haftalık Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/yangin/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}