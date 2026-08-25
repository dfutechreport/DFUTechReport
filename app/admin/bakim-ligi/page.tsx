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

// İkonlar
const IconBack = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconInfo = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>;
const IconClose = () => <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>;
const IconTrophy = () => <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;

export default function BakimLigiPage() {
  const [ligVerisi, setLigVerisi] = useState<TechStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("dashboard");
  const [showInfo, setShowInfo] = useState(false);
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
        const logSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        
        const uniqueLogsMap = new Map();
        logSnap.docs.forEach(doc => {
          uniqueLogsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
        const allLogs = Array.from(uniqueLogsMap.values());

        const statsMap = new Map<string, TechStats>();

        allLogs.forEach(log => {
          const personelIsmi = log.bildirenKisi || log.teknisyen;
          if (!personelIsmi) return; // İsimsiz kayıtları atla
          
          if (!statsMap.has(personelIsmi)) {
            statsMap.set(personelIsmi, {
              id: personelIsmi,
              isim: personelIsmi,
              toplamPuan: 0,
              isSayisi: 0,
              durusluIsSayisi: 0
            });
          }

          const current = statsMap.get(personelIsmi)!;
          current.isSayisi += 1;
          current.toplamPuan += 10;
          if (log.isDuruslu === true || log.isDuruslu === "evet") {
            current.durusluIsSayisi += 1;
            current.toplamPuan += 5;
          }
        });

        setLigVerisi(Array.from(statsMap.values()).sort((a, b) => b.toplamPuan - a.toplamPuan));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans relative">
      
      {/* Üst Navigasyon & Bilgi Butonu */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <button onClick={() => router.push(`/${userRole}`)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg active:scale-95">
          <IconBack /> <span className="text-xs font-black uppercase tracking-widest">Panel</span>
        </button>

        <button 
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/20 transition-all"
        >
          <IconInfo /> <span className="text-xs font-black uppercase">Puanlama Nasıl Yapılır?</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto mb-16 text-center">
        <div className="inline-block p-4 bg-yellow-500/10 rounded-2xl mb-4 text-yellow-500 shadow-xl border border-yellow-500/20"><IconTrophy /></div>
        <h1 className="text-5xl font-black text-white tracking-tighter italic">DFU TEKNİK LİG</h1>
        <p className="text-slate-500 text-[10px] mt-2 font-black tracking-[0.3em] uppercase">Aktif Bakım Yapan Tüm Personel</p>
      </div>

      {/* Podyum */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-20 px-4">
        {ligVerisi.slice(0, 3).map((tech, idx) => (
          <div key={tech.id} className={`${idx === 0 ? 'order-1 md:order-2 z-10 scale-105 bg-slate-900 border-yellow-500/30 h-[30rem]' : idx === 1 ? 'order-2 md:order-1 bg-slate-900/50 h-80' : 'order-3 bg-slate-900/50 h-72'} p-8 rounded-[2rem] border border-slate-800 text-center flex flex-col justify-center relative shadow-2xl`}>
            {idx === 0 && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-8 py-1 rounded-full font-black text-[9px] tracking-widest uppercase">Lider</div>}
            <div className={`flex justify-center mb-4 ${idx === 0 ? 'text-yellow-500 animate-pulse' : idx === 1 ? 'text-slate-400' : 'text-orange-500'}`}><IconTrophy /></div>
            <h2 className="font-black text-white text-2xl truncate">{tech.isim}</h2>
            <div className={`font-black my-2 ${idx === 0 ? 'text-7xl text-yellow-500 tracking-tighter' : 'text-5xl text-white'}`}>{tech.toplamPuan}</div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex justify-around mt-6">
              <div className="text-center"><p className="text-[9px] font-bold text-slate-500 mb-1">İŞ</p><p className="text-2xl font-black text-white">{tech.isSayisi}</p></div>
              <div className="text-center"><p className="text-[9px] font-bold text-red-500/80 mb-1">BONUS</p><p className="text-2xl font-black text-red-500">+{tech.durusluIsSayisi * 5}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden shadow-xl mb-20">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-500 text-[9px] uppercase font-black tracking-[0.2em] border-b border-slate-800">
            <tr>
              <th className="p-6">Sıra</th>
              <th className="p-6">Personel</th>
              <th className="p-6 text-center">İş Sayısı</th>
              <th className="p-6 text-center">Duruşlu İş</th>
              <th className="p-6 text-right">Puan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {ligVerisi.slice(3).map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/50 transition-all group">
                <td className="p-6 text-slate-600 font-bold text-sm">#{index + 4}</td>
                <td className="p-6 font-bold text-slate-300 group-hover:text-white transition-colors uppercase text-sm italic">{tech.isim}</td>
                <td className="p-6 text-center font-bold text-slate-400">{tech.isSayisi}</td>
                <td className="p-6 text-center"><span className="text-red-500/70 font-black text-xs">{tech.durusluIsSayisi}</span></td>
                <td className="p-6 text-right font-black text-blue-400 text-2xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PUANLAMA BİLGİ MODALI (Overlay) */}
      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl relative p-8 animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
            >
              <IconClose />
            </button>

            <h3 className="text-2xl font-black text-white mb-6 pr-8">Puanlama Sistemi</h3>
            
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 font-bold">+10</div>
                <div>
                  <h4 className="font-bold text-slate-200">Her Tamamlanan İş</h4>
                  <p className="text-sm text-slate-500">Arşivde (maintenance_logs) adınıza kayıtlı olan her bir benzersiz iş için temel puan.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-red-500/20 p-2 rounded-lg text-red-400 font-bold">+5</div>
                <div>
                  <h4 className="font-bold text-slate-200">Kritik Duruş Bonusu</h4>
                  <p className="text-sm text-slate-500">Üretimi etkileyen "Duruşlu İş" olarak işaretlenmiş müdahaleler için ek puan.</p>
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  * Sistem verileri gerçek zamanlı olarak arşivden çeker. Aynı iş kaydı sadece bir kez sayılır. İşi yapan kişinin adı listede otomatik olarak belirir.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowInfo(false)}
              className="w-full mt-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all uppercase tracking-widest text-xs"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </div>
  );
}