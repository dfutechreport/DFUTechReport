"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsListesi() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [logs, setRawLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  
  // Filters
  const [fYil, setFYil] = useState("");
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fVardiya, setFVardiya] = useState("");
  const [fHat, setFHat] = useState("");
  const [fEkipman, setFEkipman] = useState("");
  const [fDurus, setFDurus] = useState("");
  const [fPersonel, setFPersonel] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1. Kullanıcı Rolünü Tespit Et (Navigasyon için)
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserRole(uSnap.data().role || "teknisyen");
        }

        // 2. Kayıtları Çek (Son işten ilke otomatik sıralama)
        const snap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        const data = snap.docs.map(d => {
          const date = d.data().kayitTarihi?.toDate ? d.data().kayitTarihi.toDate() : new Date(d.data().kayitTarihi);
          return { id: d.id, ...d.data(), jsDate: date };
        });
        setRawLogs(data); setFilteredLogs(data);
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let res = [...logs];
    if (fYil) res = res.filter(l => l.jsDate?.getFullYear().toString() === fYil);
    if (fAy) res = res.filter(l => (l.jsDate?.getMonth() + 1).toString() === fAy);
    if (fGun) res = res.filter(l => l.jsDate?.getDate().toString() === fGun);
    if (fVardiya) res = res.filter(l => l.vardiya === fVardiya);
    if (fHat) res = res.filter(l => l.hatAdi === fHat);
    if (fEkipman) res = res.filter(l => l.ekipmanAdi === fEkipman);
    if (fDurus) res = res.filter(l => (fDurus === "evet" ? l.isDuruslu : !l.isDuruslu));
    if (fPersonel) res = res.filter(l => l.bildirenKisi === fPersonel);
    setFilteredLogs(res);
  }, [fYil, fAy, fGun, fVardiya, fHat, fEkipman, fDurus, fPersonel, logs]);

  const unique = (field: string) => Array.from(new Set(logs.map(l => l[field]))).filter(Boolean).sort();
  const uniqueDates = (type: 'Y'|'M'|'D') => {
    const sets = new Set<string>();
    logs.forEach(l => {
      if(!l.jsDate) return;
      if(type==='Y') sets.add(l.jsDate.getFullYear().toString());
      if(type==='M') sets.add((l.jsDate.getMonth()+1).toString());
      if(type==='D') sets.add(l.jsDate.getDate().toString());
    });
    return Array.from(sets).sort((a,b)=>Number(a)-Number(b));
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <h1 className="text-2xl font-black text-indigo-400 uppercase tracking-[0.2em]">📋 Yapılan İşler Arşivi</h1>
           
           {/* KRİTİK: ROL BAZLI GERİ DÖNÜŞ BUTONU */}
           <Link 
             href={userRole === "admin" ? "/admin" : "/dashboard"} 
             className="bg-gray-800 text-[10px] font-black px-6 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition uppercase tracking-widest shadow-lg"
           >
             {userRole === "admin" ? "Yönetici Paneline Dön" : "Dashboard'a Dön"}
           </Link>
        </div>

        {/* FİLTRELEME PANELİ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8 bg-gray-900 p-6 rounded-[35px] border border-gray-800 shadow-2xl">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Yıl</label><select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('Y').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ay</label><select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('M').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Gün</label><select value={fGun} onChange={e=>setFGun(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('D').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Vardiya</label><select value={fVardiya} onChange={e=>setFVardiya(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('vardiya').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Hat</label><select value={fHat} onChange={e=>setFHat(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('hatAdi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ekipman</label><select value={fEkipman} onChange={e=>setFEkipman(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('ekipmanAdi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Duruş</label><select value={fDurus} onChange={e=>setFDurus(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option><option value="evet">Duruşlu</option><option value="hayir">Normal</option></select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Personel</label><select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('bildirenKisi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-2xl overflow-hidden relative">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-5 px-2">Tarih / Zaman</th><th className="pb-5">Vardiya</th><th className="pb-5">Makine Bilgisi</th><th className="pb-5">Etki</th><th className="pb-5">Sorumlu</th><th className="pb-5 text-right px-4">Süre</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {filteredLogs.map((l, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{l.baslangicTarihi} / {l.baslangicSaati}</td>
                     <td className="py-5 text-[10px] tracking-tighter">{l.vardiya}</td>
                     <td className="py-5"><p className="text-teal-400 font-black text-xs uppercase mb-1">{l.hatAdi}</p><p className="text-gray-100 text-sm font-black">{l.ekipmanAdi}</p></td>
                     <td className="py-5">{l.isDuruslu ? <span className="bg-red-900/30 text-red-500 border border-red-900/50 text-[10px] px-2 py-0.5 rounded-full font-black">Duruş</span> : <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Normal</span>}</td>
                     <td className="py-5 text-gray-300 text-xs font-black">{l.bildirenKisi}</td>
                     <td className="py-5 text-right px-4"><span className="bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-900/30 font-black">{l.toplamSureDakika} dk</span></td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {filteredLogs.length === 0 && <div className="py-20 text-center text-gray-600 font-bold uppercase italic text-xs">Filtrelere uygun iş kaydı bulunamadı.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}
