"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import DashboardReturn from "@/components/DashboardReturn";

function EkedArsivContent() {
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
        // Tüm logları (arşiv dahil) dinleme
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
    <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest text-center">
      SİSTEM VERİLERİ SENKRONİZE EDİLİYOR...
    </div>
  );

  return (
    <div className="p-6 bg-[#050505] min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1440px] mx-auto space-y-8">
        
        {/* ÜST PANEL VE GERİ DÖNÜŞ BUTONU */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-indigo-400 uppercase italic">
              📂 EKED İŞLEM ARŞİVİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Tamamlanan ve Geçmiş Kilit İşlemleri</p>
          </div>
          
          {/* DİNAMİK BUTON BURADA */}
          <DashboardReturn />
        </div>

        {/* ARŞİV TABLOSU */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
          {logs.length === 0 ? (
            <div className="text-center py-20 text-slate-600 font-black tracking-widest italic uppercase">
              Arşivlenmiş Kayıt Bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[10px] tracking-widest uppercase italic font-black">
                    <th className="py-4">Kayıt Tarihi</th>
                    <th className="py-4">Kapatma Tarihi</th>
                    <th className="py-4">Ekipman/Bölge</th>
                    <th className="py-4">Personel</th>
                    <th className="py-4 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                      <td className="py-4 text-xs font-bold text-slate-400 italic">{log.tarih}</td>
                      <td className="py-4 text-xs font-bold text-green-600 italic">{log.kapatmaTarihi || "-"}</td>
                      <td className="py-4 text-sm font-black text-white">{log.yer}</td>
                      <td className="py-4 text-xs text-indigo-400 font-black italic uppercase">{log.personel}</td>
                      <td className="py-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic ${log.durum === 'Açık' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
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

export default function EkedArsivPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <EkedArsivContent />
    </Suspense>
  );
}