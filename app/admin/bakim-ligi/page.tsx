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
        
        // 1. PERSONEL LİSTESİ: page.txt'deki gibi 'uretim' rolündekileri baz alıyoruz
        const uSnap = await getDocs(query(collection(db, "users"), where("role", "==", "uretim")));
        const personeller = uSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

        // 2. İŞ VERİLERİ: page.txt'deki gibi 'work_orders' koleksiyonundan 'Kapalı' olanları çekiyoruz
        const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
        const snap = await getDocs(q);
        const kapaliIsler = snap.docs.map(d => d.data());

        // 3. PUANLAMA VE EŞLEŞTİRME
        const stats: TechStats[] = personeller.map(p => {
          // Eşleştirme 'bildirenKisi' alanı üzerinden yapılıyor (page.txt mantığı)
          const pIsleri = kapaliIsler.filter(is => is.bildirenKisi === p.name);
          
          let puan = 0;
          let durusluCount = 0;

          pIsleri.forEach(is => {
            puan += 10; // Her tamamlanan iş 10 Puan
            // Eğer iş duruşluysa (isDuruslu veya oncelik kriteri)
            if (is.isDuruslu || is.oncelik === "Yüksek") {
              puan += 5;
              durusluCount += 1;
            }
          });

          return {
            id: p.id,
            isim: p.name || "İsimsiz Personel",
            toplamPuan: puan,
            isSayisi: pIsleri.length,
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono">Veriler Eşitleniyor...</div>;

  const podyum = ligVerisi.slice(0, 3);
  const digerleri = ligVerisi.slice(3);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans">
      <div className="max-w-6xl mx-auto flex items-center justify-start mb-8">
        <button onClick={() => router.push(`/${userRole}`)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-lg">
          <IconBack /> <span className="text-sm font-bold">Geri Dön</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto mb-12 text-center">
        <div className="inline-block p-4 bg-yellow-500/10 rounded-2xl mb-4 text-yellow-500 shadow-xl border border-yellow-500/20"><IconTrophy /></div>
        <h1 className="text-4xl font-black text-white tracking-tight">DFU TEKNİK LİG</h1>
        <p className="text-slate-500 text-xs mt-2 font-bold tracking-[0.2em] uppercase">Tamamlanan İş Verilerine Göre Sıralama</p>
      </div>

      {/* Podyum */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-16 px-4">
        {podyum[1] && (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 text-center h-72 flex flex-col justify-center order-2 md:order-1 transition-all hover:border-slate-700">
            <div className="text-slate-500 flex justify-center mb-4"><IconMedal color="#94a3b8" /></div>
            <h2 className="text-xl font-bold text-slate-200">{podyum[1].isim}</h2>
            <div className="text-4xl font-black text-white my-2">{podyum[1].toplamPuan}</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{podyum[1].isSayisi} Tamamlanan İş</p>
          </div>
        )}

        {podyum[0] && (
          <div className="bg-slate-900 p-10 rounded-3xl shadow-2xl border border-yellow-500/30 text-center h-[28rem] flex flex-col justify-center relative order-1 md:order-2 z-10 scale-105 ring-1 ring-yellow-500/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 px-8 py-1 rounded-full font-black text-sm shadow-lg tracking-tighter">LİG LİDERİ</div>
            <div className="text-yellow-500 flex justify-center mb-6 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]"><IconTrophy /></div>
            <h2 className="text-3xl font-black text-white">{podyum[0].isim}</h2>
            <div className="text-6xl font-black text-yellow-500 my-4 tracking-tighter">{podyum[0].toplamPuan}</div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 flex justify-around mt-6">
              <div className="text-center"><p className="text-[10px] font-bold text-slate-500 mb-1">İŞ ADEDİ</p><p className="text-2xl font-black text-white">{podyum[0].isSayisi}</p></div>
              <div className="w-px bg-slate-800"></div>
              <div className="text-center"><p className="text-[10px] font-bold text-red-500/70 mb-1 tracking-widest uppercase text-xs">KRİTİK</p><p className="text-2xl font-black text-red-500">{podyum[0].durusluIsSayisi}</p></div>
            </div>
          </div>
        )}

        {podyum[2] && (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 text-center h-64 flex flex-col justify-center order-3 transition-all hover:border-slate-700">
            <div className="text-orange-500 flex justify-center mb-4"><IconMedal color="#f97316" /></div>
            <h2 className="text-xl font-bold text-slate-200">{podyum[2].isim}</h2>
            <div className="text-4xl font-black text-white my-2">{podyum[2].toplamPuan}</div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{podyum[2].isSayisi} İş</p>
          </div>
        )}
      </div>

      {/* Tablo */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase tracking-[0.2em]">
            <tr>
              <th className="p-6 font-black">#</th>
              <th className="p-6 font-black">Personel</th>
              <th className="p-6 font-black text-center">İş Adedi</th>
              <th className="p-6 font-black text-center">Bonus Puan</th>
              <th className="p-6 font-black text-right">Skor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {digerleri.map((tech, index) => (
              <tr key={tech.id} className="hover:bg-slate-800/50 transition-all group">
                <td className="p-6 text-slate-600 font-bold text-sm">#{index + 4}</td>
                <td className="p-6 font-bold text-slate-300 flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 border border-slate-700"><IconUser /></div>
                  <span className="group-hover:text-white transition-colors">{tech.isim}</span>
                </td>
                <td className="p-6 text-center font-bold text-slate-400">{tech.isSayisi}</td>
                <td className="p-6 text-center"><span className="text-blue-500 font-bold text-xs">+{tech.durusluIsSayisi * 5}</span></td>
                <td className="p-6 text-right font-black text-blue-400 text-xl tracking-tighter">{tech.toplamPuan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}