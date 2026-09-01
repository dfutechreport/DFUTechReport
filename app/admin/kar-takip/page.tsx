"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import DashboardReturn from "../../../components/DashboardReturn";

function KarArsivContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [karLogs, setKarLogs] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        // KAR Arşivi verilerini (kar_arsivi koleksiyonu) dinleme
        const q = query(collection(db, "kar_arsivi"), orderBy("tarih", "desc"));
        const unsubKar = onSnapshot(q, (snap) => {
          setKarLogs(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsubKar();
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!mounted || loading) return null;

  return (
    <div className="p-6 bg-[#050505] min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* ÜST PANEL VE DİNAMİK BUTON */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-red-500 uppercase italic">
              ⚡ KAR İŞLEM ARŞİVİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Kaçak Akım Rölesi Müdahale Kayıtları</p>
          </div>
          
          <DashboardReturn />
        </div>

        {/* KAR LOG LİSTESİ */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
          {karLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-600 font-black italic uppercase">
              Kayıtlı KAR müdahalesi bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[10px] tracking-widest uppercase italic">
                    <th className="py-4">Müdahale Tarihi</th>
                    <th className="py-4">Pano Adı / Yer</th>
                    <th className="py-4">Personel</th>
                    <th className="py-4 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {karLogs.map(log => (
                    <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="py-4 text-xs font-bold text-slate-400">{log.tarih}</td>
                      <td className="py-4 text-sm font-black text-white italic">{log.panoAdi}</td>
                      <td className="py-4 text-xs text-red-400 font-black italic">{log.personel}</td>
                      <td className="py-4 text-right">
                        <span className="px-4 py-1.5 bg-red-600/20 text-red-500 border border-red-600/30 rounded-full text-[9px] font-black italic">
                          MÜDAHALE EDİLDİ
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KarArsivPage() {
  return (
    <Suspense fallback={null}>
      <KarArsivContent />
    </Suspense>
  );
}