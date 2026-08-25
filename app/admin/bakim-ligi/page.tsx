"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase"; 
import { collection, getDocs, query, doc, getDoc, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

interface TechStats {
  id: string;
  isim: string;
  toplamPuan: number;
  isSayisi: number;
  durusluIsSayisi: number;
}

const IconBack = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconTrophy = () => <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;
const IconUser = () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;

export default function BakimLigiPage() {
  const [ligVerisi, setLigVerisi] = useState<TechStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("dashboard");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) setUserRole(uSnap.data().role === "admin" ? "admin" : "dashboard");
        fetchLeagueData();
      } else router.push("/");
    });

    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        
        // 1. TÜM LOGLARI ÇEK (Bakım Arşivi - maintenance_logs)
        const logSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        
        // TEKİLLEŞTİRME: Aynı ID'li işi iki kez saymamak için Map kullanıyoruz
        const uniqueLogsMap = new Map();
        logSnap.docs.forEach(doc => {
          uniqueLogsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const allLogs = Array.from(uniqueLogsMap.values());

        // 2. İSİM BAZLI GRUPLAMA (İşi yapan herkesi dahil et)
        const statsMap = new Map<string, TechStats>();

        allLogs.forEach(log => {
          // İşi yapan kişi 'bildirenKisi' veya 'teknisyen' alanında olabilir
          const personelIsmi = log.bildirenKisi || log.teknisyen || "Bilinmeyen";
          
          if (!statsMap.has(personelIsmi)) {
            statsMap.set(personelIsmi, {
              id: personelIsmi, // İsim üzerinden grupluyoruz
              isim: personelIsmi,
              toplamPuan: 0,
              isSayisi: 0,
              durusluIsSayisi: 0
            });
          }

          const current = statsMap.get(personelIsmi)!;
          current.isSayisi += 1;
          current.toplamPuan += 10; // Her iş 10 puan

          if (log.isDuruslu === true || log.isDuruslu === "evet") {
            current.durusluIsSayisi += 1;
            current.toplamPuan += 5; // Duruşlu iş bonusu
          }
        });

        // 3. SONUÇLARI SIRALA VE STATE'E AT
        const finalStats = Array.from(statsMap.values()).sort((a, b) => b.toplamPuan - a.toplamPuan);
        setLigVerisi(finalStats);

      } catch (error) {
        console.error("Lig hesaplama hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono">Veriler Eşitleniyor...</div>;

  const podyum = ligVerisi.slice(0, 3);
  const digerleri = ligVerisi.slice(3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      {/* Navigasyon & Header Kısmı (Aynı Tasarım) */}
      <div className="max-w-6xl mx-auto flex items-center justify-start mb-8">
        <button onClick={() => router.push(`/${userRole}`)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span className="text-sm font-bold tracking-tight">Geri Dön</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto mb-16 text-center">
        <div className="inline-block p-4 bg-yellow-500/10 rounded-2xl mb-4 text-yellow-500 shadow-xl border border-yellow-500/20"><IconTrophy /></div>
        <h1 className="text-5xl font-black text-white tracking-tighter italic">DFU TEKNİK LİG</h1>
        <p className="text-slate-500 text-xs mt-2 font-bold tracking-[0.2em] uppercase">Arşiv Kayıtlarına Göre Gerçek Performans</p>
      </div>

      {/* Podyum */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 px-4">
        {podyum.map((tech, idx) => {
          const isWinner = idx === 0;
          const orderClass = idx === 0 ? "order-1 md:order-2 z-10 scale-105 shadow-2xl border-yellow-500/30" : idx === 1 ? "order-2 md:order-1 h-80" : "order-3 h-72";
          const bgColor = isWinner ? "bg-slate-900" : "bg-slate-900/50";
          const medalColor = idx === 0 ? "#eab308" : idx === 1 ? "#94a3b8" : "#f97316";

          return (
            <div key={tech.id} className={`${bgColor} ${orderClass} p-8 rounded-3xl border border-slate-800 text-center flex flex-col justify-center relative transition-all`}>
              {isWinner && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-8 py-1 rounded-full font-black text-[10px] tracking-widest uppercase shadow-lg">Lider</div>}
              <div className={`flex justify-center mb-4 ${isWinner ? 'animate-pulse' : ''}`} style={{ color: medalColor }}>
                <IconTrophy />
              </div>
              <h2 className={`font-black text-white ${isWinner ? 'text-3xl' : 'text-xl'}`}>{tech.isim}</h2>
              <div className={`font-black text-white my-2 ${isWinner ? 'text-6xl text-yellow-500' : 'text-4xl'}`}>{tech.toplamPuan}</div>
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex justify-around mt-4">
                <div className="text-center"><p className="text-[9px] font-bold text-slate-500 uppercase">İş</p><p className="text-xl font-bold">{tech.isSayisi}</p></div>
                <div className="w-px bg-slate-800"></div>
                <div className="text-center"><p className="text-[9px] font-bold text-red-500/70 uppercase">Kritik</p><p className="text-xl font-bold text-red-500">{tech.durusluIsSayisi}</p></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liste */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
              <th className="p-6">Sıra</th>
              <th className="p-6">Personel</th>
              <th className="p-6 text-center">İş Adedi</th>
              <th className="p-6 text-center">Bonus</th>
              <th className="p-6 text-right">Skor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {digerleri.map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/50 transition-all group">
                <td className="p-6 text-slate-600 font-bold text-sm">#{index + 4}</td>
                <td className="p-6 font-bold text-slate-300 group-hover:text-white flex items-center gap-3 italic">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 border border-slate-700"><IconUser /></div>
                  {tech.isim}
                </td>
                <td className="p-6 text-center font-bold text-slate-400">{tech.isSayisi}</td>
                <td className="p-6 text-center"><span className="text-blue-500 font-black text-xs">+{tech.durusluIsSayisi * 5}</span></td>
                <td className="p-6 text-right font-black text-blue-400 text-2xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}