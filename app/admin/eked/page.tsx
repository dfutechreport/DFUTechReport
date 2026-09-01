"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
// Merkezi geri dönüş bileşeni import edildi
import DashboardReturn from "@/components/DashboardReturn";

function EkedContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        // Logları dinleme ve yükleme durumu kontrolü
        const q = query(collection(db, "eked_logs"), orderBy("tarih", "desc"));
        const unsubLogs = onSnapshot(q, (snap) => {
          setLogs(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsubLogs();
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!mounted || loading) return (
    <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest">
      SİSTEM YÜKLENİYOR...
    </div>
  );

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto space-y-8">
        
        {/* ÜST PANEL VE GERİ DÖNÜŞ BUTONU */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-yellow-500 uppercase italic">
              🔐 EKED LOTO TAKİP SİSTEMİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Enerji Kesme ve Kilitleme Yönetimi</p>
          </div>
          
          {/* DİNAMİK BUTON BURADA */}
          <DashboardReturn />
        </div>

        {/* EKED KAYITLARI TABLOSU (Orijinal tasarımınızla entegre) */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
          {logs.length === 0 ? (
            <div className="text-center py-20 text-slate-600 font-black tracking-widest italic uppercase">
              Aktif EKED Bildirimi Bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[10px] tracking-widest uppercase italic font-black">
                    <th className="py-4">Tarih</th>
                    <th className="py-4">Ekipman/Yer</th>
                    <th className="py-4">Personel</th>
                    <th className="py-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="py-4 text-xs font-bold text-slate-400 italic">{log.tarih}</td>
                      <td className="py-4 text-sm font-black text-white">{log.yer}</td>
                      <td className="py-4 text-xs text-indigo-400 font-black italic uppercase">{log.personel}</td>
                      <td className="py-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic ${log.durum === 'Açık' ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                          {log.durum}
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

export default function EkedPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center text-white italic font-black">YÜKLENİYOR...</div>}>
      <EkedContent />
    </Suspense>
  );
}