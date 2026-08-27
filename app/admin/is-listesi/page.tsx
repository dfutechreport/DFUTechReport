"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsListesi() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [logs, setRawLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  
  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Filters
  const [fYil, setFYil] = useState("");
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fVardiya, setFVardiya] = useState("");
  const [fHat, setFHat] = useState("");
  const [fEkipman, setFEkipman] = useState("");
  const [fDurus, setFDurus] = useState("");
  const [fPersonel, setFPersonel] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
    const data = snap.docs.map(d => {
      const date = d.data().kayitTarihi?.toDate ? d.data().kayitTarihi.toDate() : new Date(d.data().kayitTarihi);
      return { id: d.id, ...d.data(), jsDate: date };
    });
    setRawLogs(data); setFilteredLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) setUserRole(uSnap.data().role || "teknisyen");
        fetchLogs();
      } else { window.location.href = "/"; }
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "maintenance_logs", id));
      alert("Kayıt başarıyla silindi.");
      fetchLogs();
    } catch (e) { alert("Silme hatası!"); }
  };

  const handleUpdate = async () => {
    if (!selectedLog) return;
    try {
      const { id, jsDate, ...updateData } = selectedLog;
      await updateDoc(doc(db, "maintenance_logs", id), updateData);
      alert("Kayıt güncellendi.");
      setShowEditModal(false);
      fetchLogs();
    } catch (e) { alert("Güncelleme hatası!"); }
  };

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

  if (loading) return <div className="p-20 text-white text-center">İş Listesi Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <h1 className="text-2xl font-black text-indigo-400 uppercase tracking-widest italic">📋 Yapılan İşler Arşivi</h1>
           <Link href={userRole === "admin" ? "/admin" : "/dashboard"} className="bg-gray-800 text-[10px] font-black px-6 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition uppercase tracking-widest">Geri Dön</Link>
        </div>

        {/* FİLTRELEME PANELİ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8 bg-gray-900 p-6 rounded-[35px] border border-gray-800 shadow-2xl">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Yıl</label><select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('Y').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ay</label><select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('M').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Hat</label><select value={fHat} onChange={e=>setFHat(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{Array.from(new Set(logs.map(l=>l.hatAdi))).map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Vardiya</label><select value={fVardiya} onChange={e=>setFVardiya(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 00:00">16:00 - 00:00</option><option value="00:00 - 08:00">00:00 - 08:00</option></select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Duruş</label><select value={fDurus} onChange={e=>setFDurus(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option><option value="evet">Duruşlu</option><option value="hayir">Normal</option></select></div>
           <button onClick={()=>{setFYil("");setFAy("");setFHat("");setFVardiya("");setFDurus("");setFEkipman("");setFPersonel("");}} className="bg-red-950 text-red-500 font-black text-[10px] rounded-xl px-4 py-2 mt-4 border border-red-900/30">Filtreleri Temizle</button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-2xl overflow-hidden relative">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest italic">
                 <tr><th className="pb-5 px-2">Zaman</th><th className="pb-5">Makine</th><th className="pb-5">Sorumlu</th><th className="pb-5 text-right px-4">Süre</th>{userRole === "admin" && <th className="pb-5 text-center">İşlemler</th>}</tr>
               </thead>
               <tbody className="text-sm font-bold italic">
                 {filteredLogs.map((l, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{l.baslangicTarihi} <br/> {l.baslangicSaati}</td>
                     <td className="py-5"><p className="text-teal-400 font-black text-xs uppercase mb-1">{l.hatAdi}</p><p className="text-gray-100 text-sm font-black uppercase">{l.ekipmanAdi}</p></td>
                     <td className="py-5 text-gray-300 text-xs font-black uppercase">{l.bildirenKisi} {l.isDuruslu && <span className="ml-2 bg-red-900/40 text-red-500 px-2 py-0.5 rounded text-[8px]">DURUŞLU</span>}</td>
                     <td className="py-5 text-right px-4"><span className="bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-900/30 font-black">{l.toplamSureDakika} dk</span></td>
                     {userRole === "admin" && (
                       <td className="py-5 text-center">
                         <div className="flex gap-2 justify-center">
                            <button onClick={() => { setSelectedLog(l); setShowEditModal(true); }} className="bg-blue-600/10 text-blue-400 border border-blue-600/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition">Düzenle</button>
                            <button onClick={() => handleDelete(l.id)} className="bg-red-600/10 text-red-500 border border-red-600/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition">Sil</button>
                         </div>
                       </td>
                     )}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* DÜZENLEME MODALI */}
      {showEditModal && selectedLog && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-[3rem] shadow-2xl p-10 relative">
            <h2 className="text-xl font-black text-indigo-400 uppercase mb-8 italic tracking-widest">Kayıt Düzenle</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] text-gray-500 uppercase font-black px-2">Ekipman Adı</label><input type="text" value={selectedLog.ekipmanAdi} onChange={e=>setSelectedLog({...selectedLog, ekipmanAdi: e.target.value})} className="w-full bg-slate-950 border border-gray-800 p-3 rounded-2xl text-sm" /></div>
              <div><label className="text-[10px] text-gray-500 uppercase font-black px-2">İşlem Açıklaması</label><textarea value={selectedLog.aciklama} onChange={e=>setSelectedLog({...selectedLog, aciklama: e.target.value})} className="w-full bg-slate-950 border border-gray-800 p-3 rounded-2xl text-sm h-32" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] text-gray-500 uppercase font-black px-2">Süre (Dakika)</label><input type="number" value={selectedLog.toplamSureDakika} onChange={e=>setSelectedLog({...selectedLog, toplamSureDakika: Number(e.target.value)})} className="w-full bg-slate-950 border border-gray-800 p-3 rounded-2xl text-sm" /></div>
                <div><label className="text-[10px] text-gray-500 uppercase font-black px-2">Vardiya</label><select value={selectedLog.vardiya} onChange={e=>setSelectedLog({...selectedLog, vardiya: e.target.value})} className="w-full bg-slate-950 border border-gray-800 p-3 rounded-2xl text-sm"><option>08:00 - 16:00</option><option>16:00 - 00:00</option><option>00:00 - 08:00</option></select></div>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-black text-gray-400 uppercase text-xs">Vazgeç</button>
              <button onClick={handleUpdate} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black text-white uppercase text-xs shadow-lg">Değişiklikleri Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}