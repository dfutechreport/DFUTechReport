"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase"; 
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

interface TechStats {
  id: string;
  isim: string;
  toplamPuan: number;
  isSayisi: number;
  durusluIsSayisi: number;
}

// SVG İkonlar (Dark Mode Uyumlu)
const IconBack = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconTrophy = () => <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;
const IconMedal = ({ color = "currentColor" }) => <svg viewBox="0 0 24 24" width="40" height="40" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6.1 2h11.8a2 2 0 0 1 1.7.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"></path><path d="M11 12 5.12 2.2"></path><path d="m13 12 5.88-9.8"></path><path d="M8 7h8"></path><circle cx="12" cy="17" r="5"></circle><path d="M12 18v-2"></path></svg>;

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
      } else {
        router.push("/");
      }
    });

    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        
        // 1. Teknisyen Listesini Çek
        const userSnap = await getDocs(query(collection(db, "users"), where("role", "==", "teknisyen")));
        const teknisyenler = userSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

        // 2. İki Farklı Koleksiyondan Verileri Çek
        const [maintenanceSnap, workOrdersSnap] = await Promise.all([
          getDocs(collection(db, "maintenance_logs")),
          getDocs(collection(db, "work_orders"))
        ]);

        // 3. Tekilleştirme (Deduplication) Mantığı
        // Map kullanarak Document ID üzerinden çakışmaları engelliyoruz
        const uniqueJobsMap = new Map();

        maintenanceSnap.docs.forEach(doc => {
          uniqueJobsMap.set(doc.id, doc.data());
        });

        workOrdersSnap.docs.forEach(doc => {
          // Eğer aynı ID daha önce eklenmişse üzerine yazmaz (Veya tarih/saat kontrolü eklenebilir)
          if (!uniqueJobsMap.has(doc.id)) {
            uniqueJobsMap.set(doc.id, doc.data());
          }
        });

        const allUniqueJobs = Array.from(uniqueJobsMap.values());

        // 4. İstatistik Hesaplama
        const stats: TechStats[] = teknisyenler.map(tech => {
          const techJobs = allUniqueJobs.filter(job => 
            job.bildirenKisi === tech.name || job.teknisyen === tech.name
          );

          let score = 0;
          let durusluCount = 0;

          techJobs.forEach(job => {
            score += 10;
            // Duruşlu iş veya yüksek öncelikli iş kontrolü
            if (job.isDuruslu || job.oncelik === "Yüksek" || job.priority === "high") {
              score += 5;
              durusluCount += 1;
            }
          });

          return {
            id: tech.id,
            isim: tech.name || "Bilinmeyen",
            toplamPuan: score,
            isSayisi: techJobs.length,
            durusluIsSayisi: durusluCount
          };
        });

        setLigVerisi(stats.sort((a, b) => b.toplamPuan - a.toplamPuan));
      } catch (error) {
        console.error("Lig verisi hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono italic">Veri Tutarlılığı Kontrol Ediliyor...</div>;

  const podyum = ligVerisi.slice(0, 3);
  const digerleri = ligVerisi.slice(3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans selection:bg-yellow-500 selection:text-slate-950">
      
      {/* Navigasyon */}
      <div className="max-w-6xl mx-auto mb-8">
        <button 
          onClick={() => router.push(`/${userRole}`)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all shadow-xl"
        >
          <IconBack />
          <span className="text-sm font-black tracking-widest uppercase">Panel</span>
        </button>
      </div>

      {/* Hero Header */}
      <div className="max-w-6xl mx-auto mb-16 text-center">
        <div className="inline-block p-4 bg-yellow-500/10 rounded-3xl mb-6 text-yellow-500 shadow-2xl ring-1 ring-yellow-500/20">
          <IconTrophy />
        </div>
        <h1 className="text-5xl font-black text-white tracking-tighter mb-2">DFU TEKNİK LİG</h1>
        <p className="text-slate-500 font-bold tracking-[0.3em] uppercase text-xs">Gerçek Zamanlı Verimlilik Takibi</p>
      </div>

      {/* Podium & Table (Kısımlar aynı Dark Mode tasarımını koruyor) */}
      {/* ... (Podyum ve Tablo kodları yukarıdaki gibi devam eder) ... */}
      
      {/* Podyum Alanı */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 px-4">
        {podyum[1] && (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 text-center h-80 flex flex-col justify-center order-2 md:order-1 relative overflow-hidden group hover:border-slate-700 transition-all">
             <div className="text-slate-500 flex justify-center mb-4"><IconMedal color="#94a3b8" /></div>
             <h2 className="text-xl font-bold text-slate-200">{podyum[1].isim}</h2>
             <div className="text-4xl font-black text-white my-2">{podyum[1].toplamPuan}</div>
             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border-t border-slate-800 pt-4 mt-2">{podyum[1].isSayisi} İş Kaydı</div>
          </div>
        )}

        {podyum[0] && (
          <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl border border-yellow-500/30 text-center h-[30rem] flex flex-col justify-center relative order-1 md:order-2 z-10 scale-105 ring-1 ring-yellow-500/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-10 py-1.5 rounded-full font-black text-xs shadow-[0_0_20px_rgba(234,179,8,0.3)]">LİG LİDERİ</div>
            <div className="text-yellow-500 flex justify-center mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]"><IconTrophy /></div>
            <h2 className="text-4xl font-black text-white mb-2">{podyum[0].isim}</h2>
            <div className="text-7xl font-black text-yellow-500 my-4 tracking-tighter">{podyum[0].toplamPuan}</div>
            <div className="bg-slate-950/60 border border-slate-800/50 rounded-3xl p-6 flex justify-around mt-8 backdrop-blur-sm">
              <div className="text-center"><p className="text-[10px] font-bold text-slate-500 mb-1">İŞ ADEDİ</p><p className="text-3xl font-black text-white">{podyum[0].isSayisi}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-center"><p className="text-[10px] font-bold text-red-500/80 mb-1 uppercase">Kritik</p><p className="text-3xl font-black text-red-500">{podyum[0].durusluIsSayisi}</p></div>
            </div>
          </div>
        )}

        {podyum[2] && (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 text-center h-72 flex flex-col justify-center order-3 hover:border-slate-700 transition-all">
            <div className="text-orange-500 flex justify-center mb-4"><IconMedal color="#f97316" /></div>
            <h2 className="text-xl font-bold text-slate-200">{podyum[2].isim}</h2>
            <div className="text-4xl font-black text-white my-2">{podyum[2].toplamPuan}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest border-t border-slate-800 pt-4 mt-2">{podyum[2].isSayisi} İş Kaydı</div>
          </div>
        )}
      </div>

      {/* Sıralama Listesi */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-md">
        <table className="w-full text-left">
          <thead className="bg-slate-900/80 text-slate-500 text-[9px] uppercase font-black tracking-[0.3em]">
            <tr>
              <th className="p-7">Sıralama</th>
              <th className="p-7">Teknisyen</th>
              <th className="p-7 text-center">Toplam İş</th>
              <th className="p-7 text-center">Bonus Puan</th>
              <th className="p-7 text-right">Lig Puanı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {digerleri.map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/30 transition-all group">
                <td className="p-7 text-slate-600 font-black text-sm">#{index + 4}</td>
                <td className="p-7 font-bold text-slate-300 group-hover:text-white transition-colors">{tech.isim}</td>
                <td className="p-7 text-center font-bold text-slate-400">{tech.isSayisi}</td>
                <td className="p-7 text-center">
                   <span className="bg-blue-500/5 text-blue-400 px-4 py-1 rounded-full text-[10px] font-black border border-blue-500/10">
                    +{tech.durusluIsSayisi * 5}
                   </span>
                </td>
                <td className="p-7 text-right font-black text-white text-2xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}