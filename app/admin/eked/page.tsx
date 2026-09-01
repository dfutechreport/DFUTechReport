"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

export default function EkedTakip() {
  const router = useRouter();
  
  // 1. ÖNCE TÜM STATELER TANIMLANMALI (Hata burada giderildi)
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  // 2. TÜM USEEFFECTLER
  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setUserRole(snap.data().role);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. BUILD GUARD (Tüm tanımlamalardan sonra gelmeli)
  if (!mounted || loading) return null;

  // 4. NAVİGASYON MANTIĞI
  const handleBack = () => {
    // Admin ise admin paneline, diğerleri (isg/teknisyen) dashboarda döner
    if (userRole === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 font-sans italic font-black uppercase">
      <div className="max-w-[1200px] mx-auto space-y-8">
        <h1 className="text-2xl text-yellow-500 tracking-widest border-b border-slate-800 pb-4">
          🔐 EKED LOTO TAKİP SİSTEMİ
        </h1>

        {/* EKED Kayıtları İçerik Alanı (Mevcut kodunuzu buraya ekleyebilirsiniz) */}
        <div className="bg-slate-900 border border-slate-800 p-20 rounded-[3rem] text-center text-slate-600">
          Aktif EKED Kayıtları Listeleniyor...
        </div>

        {/* DİNAMİK DASHBOARDA DÖN BUTONU */}
        <div className="pt-10">
          <button 
            onClick={handleBack}
            className="bg-slate-800 hover:bg-white hover:text-black px-10 py-4 rounded-2xl text-xs font-black tracking-widest transition-all shadow-2xl"
          >
            dashboarda dön
          </button>
        </div>
      </div>
    </div>
  );
}