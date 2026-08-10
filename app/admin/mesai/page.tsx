"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function MesaiRaporlari() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mesaiList, setMesaiList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);

  // Filtreler
  const [fYil, setFYil] = useState("");
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fPersonel, setFPersonel] = useState("");
  const [fTip, setFTip] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          setUserRole(role); setUserName(userSnap.data().name);
          if (["admin", "ik", "operator", "teknisyen"].includes(role)) {
            setIsAuthorized(true); fetchMesaiRecords();
          }
        }
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  // --- KRİTİK: TÜM ALANLARI TARAYAN VERİ EŞLEME (V61) ---
  const fetchMesaiRecords = async () => {
    try {
      const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const raw = d.data();
        const dateParts = raw.tarih ? raw.tarih.split("-") : [];
        
        // Veritabanındaki tüm ihtimalleri eşitleyen akıllı eşleme
        return {
          id: d.id,
          tarih: raw.tarih || "-",
          yil: dateParts[0] || "",
          ay: dateParts[1] || "",
          gun: dateParts[2] || "",
          personelIsmi: raw.personelIsmi || raw.name || raw.userName || raw.bildirenKisi || "Bilinmiyor",
          mesaiTipi: raw.mesaiTipi || raw.type || raw.mesaiTuru || "Fazla Mesai",
          baslangic: raw.baslangicSaati || raw.start || "-",
          bitis: raw.bitisSaati || raw.end || "-",
          sure: raw.sure || raw.duration || raw.efor || 0,
          aciklama: raw.aciklama || raw.comment || "-",
          evdenCagirma: raw.evdenCagirma === true || raw.onCall === true || raw.evdenCagirma === "Evet"
        };
      });
      setMesaiList(data);
      setFilteredList(data);
      setLoading(false);
    } catch (e) { console.error("Rapor çekme hatası:", e); setLoading(false); }
  };

  useEffect(() => {
    let res = [...mesaiList];
    if (fYil) res = res.filter(m => m.yil === fYil);
    if (fAy) res = res.filter(m => m.ay === fAy);
    if (fGun) res = res.filter(m => m.gun === fGun);
    if (fPersonel) res = res.filter(m => m.personelIsmi === fPersonel);
    if (fTip) res = res.filter(m => m.mesaiTipi === fTip);
    setFilteredList(res);
  }, [fYil, fAy, fGun, fPersonel, fTip, mesaiList]);

  const exportToExcel = () => {
    let csv = "uFEFF" + "Tarih;Personel;Baslangic;Bitis;Sure(Saat);Evden Cagirma;Mesai Türü;Aciklama\n";
    filteredList.forEach(m => {
      csv += `${m.tarih};${m.personelIsmi};${m.baslangic};${m.bitis};${m.sure};${m.evdenCagirma ? 'EVET' : 'HAYIR'};${m.mesaiTipi};${m.aciklama?.replace(/;/g, ",")}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `DFU_Mesai_Raporu_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUnique = (field: string) => Array.from(new Set(mesaiList.map(m => m[field]))).filter(Boolean).sort();

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-bold animate-pulse">RAPORLAR HAZIRLANIYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div>
             <h1 className="text-3xl font-black uppercase tracking-tighter text-amber-500">⏰ Mesai Kayıtları Arşivi</h1>
             <p className="text-[10px] text-gray-500 uppercase mt-1 font-bold tracking-[0.2em]">DFU Personel Puantaj ve Raporlama</p>
           </div>
           <div className="flex gap-3 no-print">
             {(userRole === "admin" || userRole === "ik") && (
               <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-black px-5 py-3 rounded-2xl shadow-xl transition uppercase tracking-widest">Excel Raporu Al</button>
             )}
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition uppercase tracking-widest">Dashboard'a Dön</Link>
           </div>
        </div>

        {/* FİLTRELER */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 bg-gray-900/50 p-6 rounded-[35px] border border-gray-800 shadow-2xl no-print">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-2">Analiz Yılı</label>
           <select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('yil').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-2">Analiz Ayı</label>
           <select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('ay').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-2">Personel Seç</label>
           <select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Tüm Ekip</option>{getUnique('personelIsmi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div><label className="text-[9px] text-amber-500 font-black uppercase mb-1 block ml-2">Mesai Türü</label>
           <select value={fTip} onChange={e=>setFTip(e.target.value)} className="w-full bg-gray-800 border border-amber-900/30 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('mesaiTipi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div className="flex items-end"><button onClick={()=>{setFYil("");setFAy("");setFPersonel("");setFTip("");setFGun("");}} className="w-full bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 p-3 rounded-xl text-[10px] font-black uppercase border border-gray-700 transition">Sıfırla</button></div>
        </div>

        {/* LİSTE */}
        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-3xl overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-6 px-2">Tarih</th><th className="pb-6">Personel</th><th className="pb-6">Saat Aralığı</th><th className="pb-6">Evden</th><th className="pb-6 text-center">Süre</th><th className="pb-6">Açıklama</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {filteredList.map((m, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group tracking-tighter">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{m.tarih}</td>
                     <td className="py-5 text-gray-100 font-black text-sm">{m.personelIsmi}</td>
                     <td className="py-5"><span className="bg-gray-800 text-gray-300 px-2 py-1 rounded-lg text-[10px] font-black">{m.baslangic} — {m.bitis}</span></td>
                     <td className="py-5 text-center">{m.evdenCagirma ? <span className="text-red-500 text-[10px] font-black border border-red-500/50 px-2 py-0.5 rounded">EVET</span> : "-"}</td>
                     <td className="py-5 text-center"><span className="bg-teal-900/20 text-teal-400 border border-teal-500/20 px-3 py-1 rounded-lg text-xs font-black tracking-widest">{m.sure} SAAT</span></td>
                     <td className="py-5 text-gray-500 text-[11px] italic font-medium max-w-[200px] truncate group-hover:whitespace-normal transition-all group-hover:text-gray-300">"{m.aciklama}"</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {filteredList.length === 0 && <div className="py-20 text-center text-gray-600 font-bold uppercase tracking-widest italic text-xs">Arşivde kayıtlı veri bulunamadı.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}
