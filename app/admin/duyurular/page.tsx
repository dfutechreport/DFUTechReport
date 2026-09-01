"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
// Firebase yolu, klasör derinliğine göre (3 seviye dışarı) düzeltildi.
import { auth, db } from "../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import DashboardReturn from "../../../components/DashboardReturn";

function DuyurularContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [duyurular, setDuyurular] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        // Duyuruları tarihe göre çekme
        const q = query(collection(db, "duyurular"), orderBy("tarih", "desc"));
        const unsubDuyurular = onSnapshot(q, (snap) => {
          setDuyurular(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsubDuyurular();
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!mounted || loading) return null;

  return (
    <div className="p-6 bg-[#050505] min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-orange-500 uppercase italic">
              📢 İSG DUYURU MERKEZİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Güvenlik Bildirimleri</p>
          </div>
          
          <DashboardReturn />
        </div>

        <div className="space-y-4">
          {duyurular.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-20 rounded-[3rem] text-center text-slate-600 font-black italic uppercase">
              Henüz bir duyuru bulunmuyor.
            </div>
          ) : (
            duyurular.map(duyuru => (
              <div key={duyuru.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] bg-orange-600/20 text-orange-400 px-4 py-1.5 rounded-full border border-orange-600/30 font-bold italic">
                    {duyuru.tarih}
                  </span>
                </div>
                <h3 className="text-xl text-white mb-2 tracking-tight">{duyuru.baslik}</h3>
                <p className="text-slate-400 text-sm normal-case font-normal leading-relaxed italic">{duyuru.icerik}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DuyurularPage() {
  return (
    <Suspense fallback={null}>
      <DuyurularContent />
    </Suspense>
  );
}