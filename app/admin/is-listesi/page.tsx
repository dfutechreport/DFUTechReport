"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsListesi() {
  const [loading, setLoading] = useState(true);
  const [logs, setRawLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  
  // Filters
  const [fDate, setFDate] = useState("");
  const [fShift, setFShift] = useState("");
  const [fLine, setFLine] = useState("");
  const [fEq, setFEq] = useState("");
  const [fDowntime, setFDowntime] = useState("");
  const [fPerson, setFPerson] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRawLogs(data); setFilteredLogs(data);
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let result = [...logs];
    if (fDate) result = result.filter(l => l.baslangicTarihi === fDate);
    if (fShift) result = result.filter(l => l.vardiya === fShift);
    if (fLine) result = result.filter(l => l.hatAdi === fLine);
    if (fEq) result = result.filter(l => l.ekipmanAdi.toLowerCase().includes(fEq.toLowerCase()));
    if (fDowntime) result = result.filter(l => (fDowntime === "yes" ? l.isDuruslu : !l.isDuruslu));
    if (fPerson) result = result.filter(l => l.bildirenKisi.toLowerCase().includes(fPerson.toLowerCase()));
    setFilteredLogs(result);
  }, [fDate, fShift, fLine, fEq, fDowntime, fPerson, logs]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <h1 className="text-2xl font-black text-indigo-400 uppercase tracking-tighter">📋 Yapılan İşler Arşivi</h1>
           <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black px-4 py-2 rounded-xl uppercase">Geri Dön</Link>
        </div>

        {/* FİLTRELEME PANELİ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-xl">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Tarih</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs border border-gray-700" /></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Vardiya</label><select value={fShift} onChange={e=>setFShift(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs"><option value="">Hepsi</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Üretim Hattı</label><input type="text" value={fLine} onChange={e=>setFLine(e.target.value)} placeholder="Hat adı..." className="w-full bg-gray-800 rounded-xl p-2 text-xs border border-gray-700" /></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ekipman</label><input type="text" value={fEq} onChange={e=>setFEq(e.target.value)} placeholder="Makine..." className="w-full bg-gray-800 rounded-xl p-2 text-xs border border-gray-700" /></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Duruş</label><select value={fDowntime} onChange={e=>setFDowntime(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs"><option value="">Hepsi</option><option value="yes">Duruşlu</option><option value="no">Normal</option></select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Personel</label><input type="text" value={fPerson} onChange={e=>setFPerson(e.target.value)} placeholder="İsim..." className="w-full bg-gray-800 rounded-xl p-2 text-xs border border-gray-700" /></div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-6 shadow-2xl overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-4">Tarih</th><th className="pb-4">Vardiya</th><th className="pb-4">Hat/Makine</th><th className="pb-4">Duruş</th><th className="pb-4">Teknisyen</th><th className="pb-4">Süre</th></tr>
               </thead>
               <tbody className="text-sm">
                 {filteredLogs.map((l, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-4 text-gray-400 font-bold">{l.baslangicTarihi}</td>
                     <td className="py-4 text-xs">{l.vardiya}</td>
                     <td className="py-4"><p className="text-teal-400 font-black text-xs uppercase">{l.hatAdi}</p><p className="text-gray-200 font-bold">{l.ekipmanAdi}</p></td>
                     <td className="py-4">{l.isDuruslu ? <span className="text-red-500 font-black text-[10px] border border-red-500 px-2 py-0.5 rounded">DURUŞLU</span> : <span className="text-gray-500 text-[10px]">NORMAL</span>}</td>
                     <td className="py-4 font-bold text-gray-300 uppercase">{l.bildirenKisi}</td>
                     <td className="py-4 text-indigo-400 font-black">{l.toplamSureDakika} dk</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
