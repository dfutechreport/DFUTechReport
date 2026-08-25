"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase"; 
import { collection, getDocs, query, where, doc, getDoc, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

interface TechStats {
  id: string;
  isim: string;
  toplamPuan: number;
  isSayisi: number;
  durusluIsSayisi: number;
}

// SVG İkonlar (Bağımsız Yapı)
const IconBack = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconTrophy = () => <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;
const IconMedal = ({ color = "currentColor" }) => <svg viewBox="0 0 24 24" width="40" height="40" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6.1 2h11.8a2 2 0 0 1 1.7.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"></path><path d="M11 12 5.12 2.2"></path><path d="m13 12 5.88-9.8"></path><path d="M8 7h8"></path><circle cx="12" cy="17" r="5"></circle><path d="M12 18v-2"></path></svg>;
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
        
        // 1. TEKNİSYEN LİSTESİ: 'users' koleksiyonundan teknisyenleri çek
        const userSnap = await getDocs(query(collection(db, "users"), where("role", "==", "teknisyen")));
        const teknisyenler = userSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

        // 2. VERİ KAYNAĞI: page.txt ile aynı koleksiyon (maintenance_logs)
        const logSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        const logs = logSnap.docs.map(doc => doc.data());

        // 3. PUANLAMA MANTIĞI
        const stats: TechStats[] = teknisyenler.map(tech => {
          // Eşleştirme page.txt'deki gibi 'bildirenKisi' alanı üzerinden
          const techLogs = logs.filter(log => log.bildirenKisi === tech.name);
          
          let puan = 0;
          let durusluSayisi = 0;

          techLogs.forEach(log => {
            puan += 10; // Her kayıt 10 Puan
            // page.txt'deki 'isDuruslu' alanına göre bonus
            if (log.isDuruslu) {
              puan += 5; // Duruşlu iş bonusu
              durusluSayisi += 1;
            }
          });

          return {
            id: tech.id,
            isim: tech.name || "İsimsiz Personel",
            toplamPuan: puan,
            isSayisi: techLogs.length,
            durusluIsSayisi: durusluSayisi
          };
        });

        setLigVerisi(stats.sort((a, b) => b.toplamPuan - a.toplamPuan));
      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoading(false);
      }
    };

    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono tracking-tighter">ARŞİV VERİLERİ ANALİZ EDİLİYOR...</div>;

  const podyum = ligVerisi.slice(0, 3);
  const digerleri = ligVerisi.slice(3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans selection:bg-yellow-500/30">
      
      {/* Üst Bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-start mb-10">
        <button onClick={() => router.push(`/${userRole}`)} className="flex items-center gap-2 px-5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-xl active:scale-95">
          <IconBack /> <span className="text-xs font-black uppercase tracking-widest">Panel</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto mb-16 text-center">
        <div className="inline-block p-4 bg-yellow-500/10 rounded-3xl mb-4 text-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.1)] border border-yellow-500/20"><IconTrophy /></div>
        <h1 className="text-5xl font-black text-white tracking-tighter italic">DFU TEKNİK LİG</h1>
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mt-4"></div>
      </div>

      {/* Podyum (Top 3) */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 px-4">
        {/* 2. Sıra */}
        {podyum[1] && (
          <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center h-80 flex flex-col justify-center order-2 md:order-1 hover:border-slate-700 transition-all shadow-lg">
            <div className="text-slate-500 flex justify-center mb-4 opacity-80"><IconMedal color="#94a3b8" /></div>
            <h2 className="text-xl font-bold text-slate-200">{podyum[1].isim}</h2>
            <div className="text-5xl font-black text-white my-3 tracking-tighter">{podyum[1].toplamPuan}</div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{podyum[1].isSayisi} İş Kaydı</p>
          </div>
        )}

        {/* 1. Sıra (Şampiyon) */}
        {podyum[0] && (
          <div className="bg-slate-900 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(234,179,8,0.15)] border border-yellow-500/30 text-center h-[32rem] flex flex-col justify-center relative order-1 md:order-2 z-10 scale-105 ring-1 ring-yellow-500/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-10 py-1.5 rounded-full font-black text-[10px] shadow-xl tracking-widest">LİDER</div>
            <div className="text-yellow-500 flex justify-center mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-pulse"><IconTrophy /></div>
            <h2 className="text-4xl font-black text-white mb-2">{podyum[0].isim}</h2>
            <div className="text-8xl font-black text-yellow-500 my-4 tracking-tighter drop-shadow-md">{podyum[0].toplamPuan}</div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 flex justify-around mt-8 backdrop-blur-md">
              <div className="text-center"><p className="text-[9px] font-black text-slate-500 mb-1 tracking-widest uppercase">Kayıt</p><p className="text-3xl font-black text-white">{podyum[0].isSayisi}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-center"><p className="text-[9px] font-black text-red-500/80 mb-1 tracking-widest uppercase">Bonus</p><p className="text-3xl font-black text-red-500">{podyum[0].durusluIsSayisi}</p></div>
            </div>
          </div>
        )}

        {/* 3. Sıra */}
        {podyum[2] && (
          <div className="bg-slate-900/40 p-8 rounded-2xl border border-slate-800 text-center h-72 flex flex-col justify-center order-3 hover:border-slate-700 transition-all shadow-lg">
            <div className="text-orange-500 flex justify-center mb-4 opacity-80"><IconMedal color="#f97316" /></div>
            <h2 className="text-xl font-bold text-slate-200">{podyum[2].isim}</h2>
            <div className="text-4xl font-black text-white my-3 tracking-tighter">{podyum[2].toplamPuan}</div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{podyum[2].isSayisi} İş Kaydı</p>
          </div>
        )}
      </div>

      {/* Alt Liste */}
      <div className="max-w-5xl mx-auto bg-slate-900/30 rounded-[2rem] border border-slate-800/60 overflow-hidden shadow-2xl backdrop-blur-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900/80 text-slate-500 text-[9px] uppercase font-black tracking-[0.3em]">
            <tr>
              <th className="p-8">Sıra</th>
              <th className="p-8">Teknisyen</th>
              <th className="p-8 text-center">İş Adedi</th>
              <th className="p-8 text-center">Kritik Müdahale</th>
              <th className="p-8 text-right">Lig Puanı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {digerleri.map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/30 transition-all group">
                <td className="p-8 text-slate-600 font-black text-sm">#{index + 4}</td>
                <td className="p-8 font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 border border-slate-700/50 group-hover:border-blue-500/50 transition-all"><IconUser /></div>
                  {tech.isim}
                </td>
                <td className="p-8 text-center font-black text-slate-400">{tech.isSayisi}</td>
                <td className="p-8 text-center">
                   <span className="bg-blue-500/5 text-blue-400 px-4 py-1.5 rounded-xl text-[10px] font-black border border-blue-500/10 shadow-inner">
                    +{tech.durusluIsSayisi * 5} Puan
                   </span>
                </td>
                <td className="p-8 text-right font-black text-white text-3xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Veri Kaynağı Bilgisi */}
      <div className="max-w-5xl mx-auto mt-8 text-center opacity-30">
        <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.4em]">Kaynak: DFU Bakım Arşivi (maintenance_logs)</p>
      </div>
    </div>
  );
}