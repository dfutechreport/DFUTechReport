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
  tekrarSayisi: number;
}

const IconBack = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconTrophy = ({ size = 48 }) => <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;

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
        const logSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "asc")));
        const logs = logSnap.docs.map(d => ({ 
          id: d.id, ...d.data(), 
          jsDate: d.data().kayitTarihi?.toDate() || new Date(d.data().kayitTarihi) 
        }));

        const statsMap = new Map<string, TechStats>();
        const lastFixTimePerEquip = new Map<string, Date>();

        logs.forEach(log => {
          const equipName = log.ekipmanAdi || "Genel";
          const currentTime = log.jsDate;
          let isRecurring = false;
          if (lastFixTimePerEquip.has(equipName)) {
            const lastTime = lastFixTimePerEquip.get(equipName)!;
            const diffHours = (currentTime.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
            if (diffHours < 48) isRecurring = true;
          }
          lastFixTimePerEquip.set(equipName, currentTime);

          const rawNames = log.teknisyen || log.bildirenKisi || "";
          const names = rawNames.split(/[%,.\-+]/).map((n:string) => n.trim()).filter((n:string) => n.length > 1);

          names.forEach((name: string) => {
            if (!statsMap.has(name)) {
              statsMap.set(name, { id: name, isim: name, toplamPuan: 0, isSayisi: 0, durusluIsSayisi: 0, tekrarSayisi: 0 });
            }
            const s = statsMap.get(name)!;
            s.isSayisi += 1; s.toplamPuan += 10;
            if (log.isDuruslu === true || log.isDuruslu === "evet") { s.durusluIsSayisi += 1; s.toplamPuan += 5; }
            if (isRecurring) { s.tekrarSayisi += 1; s.toplamPuan -= 10; }
          });
        });
        setLigVerisi(Array.from(statsMap.values()).sort((a, b) => b.toplamPuan - a.toplamPuan));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    return () => unsubscribe();
  }, [router]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono italic uppercase tracking-widest">Veriler İşleniyor...</div>;

  const podyum = ligVerisi.slice(0, 3);
  const digerleri = ligVerisi.slice(3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-12">
        <button onClick={() => router.push(`/${userRole}`)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all shadow-xl font-black uppercase text-[10px]">
          <IconBack /> Geri Dön
        </button>
      </div>

      {/* PODYUM ALANI - YÜKSEKLİK VE FONT DÜZELTMESİ YAPILDI */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-24 px-4">
        
        {/* 2. SIRA */}
        {podyum[1] && (
          <div className="bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-800 text-center flex flex-col justify-between min-h-[22rem] order-2 md:order-1 relative group hover:border-slate-600 transition-all shadow-xl">
             <div className="text-slate-400 flex justify-center pt-2"><IconTrophy size={48} /></div>
             <div className="my-4">
               <h2 className="text-xl font-bold text-slate-200 uppercase leading-tight line-clamp-2 px-2">{podyum[1].isim}</h2>
               <div className="text-5xl font-black text-white mt-2 tracking-tighter">{podyum[1].toplamPuan}</div>
             </div>
             <div className="bg-slate-950/40 rounded-2xl p-4 flex justify-around text-[10px] font-bold uppercase text-slate-500">
                <div><p>İŞ</p><p className="text-white text-lg">{podyum[1].isSayisi}</p></div>
                <div className="w-px bg-slate-800"></div>
                <div><p>TEKRAR</p><p className="text-red-500 text-lg">{podyum[1].tekrarSayisi}</p></div>
             </div>
          </div>
        )}

        {/* 1. SIRA (LİDER) */}
        {podyum[0] && (
          <div className="bg-slate-900 p-10 rounded-[3rem] shadow-[0_0_50px_rgba(234,179,8,0.1)] border border-yellow-500/30 text-center flex flex-col justify-between min-h-[30rem] relative order-1 md:order-2 z-10 scale-105 ring-1 ring-yellow-500/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-8 py-1.5 rounded-full font-black text-[10px] tracking-widest uppercase shadow-xl">ŞAMPİYON</div>
            <div className="text-yellow-500 flex justify-center pt-4 animate-pulse"><IconTrophy size={80} /></div>
            <div className="my-6">
              <h2 className="text-3xl font-black text-white uppercase leading-tight line-clamp-2">{podyum[0].isim}</h2>
              <div className="text-7xl font-black text-yellow-500 mt-2 tracking-tighter drop-shadow-md">{podyum[0].toplamPuan}</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-[2rem] p-6 flex justify-around shadow-inner">
              <div className="text-center"><p className="text-[10px] font-bold text-slate-500 uppercase">Toplam İş</p><p className="text-3xl font-black text-white">{podyum[0].isSayisi}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-center"><p className="text-[10px] font-bold text-red-500 uppercase">Tekrar</p><p className="text-3xl font-black text-red-500">{podyum[0].tekrarSayisi}</p></div>
            </div>
          </div>
        )}

        {/* 3. SIRA */}
        {podyum[2] && (
          <div className="bg-slate-900/60 p-8 rounded-[2.5rem] border border-slate-800 text-center flex flex-col justify-between min-h-[20rem] order-3 relative hover:border-slate-600 transition-all shadow-xl">
            <div className="text-orange-500 flex justify-center pt-2"><IconTrophy size={40} /></div>
            <div className="my-4">
              <h2 className="text-lg font-bold text-slate-300 uppercase leading-tight line-clamp-2 px-2">{podyum[2].isim}</h2>
              <div className="text-4xl font-black text-white mt-2 tracking-tighter">{podyum[2].toplamPuan}</div>
            </div>
            <div className="bg-slate-950/40 rounded-2xl p-4 flex justify-around text-[10px] font-bold uppercase text-slate-500">
               <p>{podyum[2].isSayisi} İş Kaydı</p>
               <p className="text-red-500/60">{podyum[2].tekrarSayisi} Tekrar</p>
            </div>
          </div>
        )}
      </div>

      {/* LİSTE GÖRÜNÜMÜ */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
            <tr>
              <th className="p-8">Sıralama</th>
              <th className="p-8">Teknisyen / Operatör</th>
              <th className="p-8 text-center">İş Adedi</th>
              <th className="p-8 text-center">Ceza (Tekrar)</th>
              <th className="p-8 text-right">Skor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {digerleri.map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/30 transition-all">
                <td className="p-8 text-slate-600 font-black text-sm">#{index + 4}</td>
                <td className="p-8 font-black text-slate-300 uppercase italic text-sm tracking-tighter">{tech.isim}</td>
                <td className="p-8 text-center font-black text-slate-400">{tech.isSayisi}</td>
                <td className="p-8 text-center"><span className="text-red-500/40 font-black text-xs">-{tech.tekrarSayisi * 10}</span></td>
                <td className="p-8 text-right font-black text-blue-400 text-2xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}