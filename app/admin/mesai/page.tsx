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

  // Filtre State'leri
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
          // Yetki Kontrolü: Admin, İK, Teknisyen, Operatör hepsi görebilir ama buton yetkisi farklı
          if (["admin", "ik", "operator", "teknisyen"].includes(role)) {
            setIsAuthorized(true);
            fetchMesaiRecords();
          }
        }
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchMesaiRecords = async () => {
    try {
      const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const dData = d.data();
        const dateParts = dData.tarih ? dData.tarih.split("-") : []; // YYYY-MM-DD varsayımı
        return { 
          id: d.id, 
          ...dData,
          yil: dateParts[0] || "",
          ay: dateParts[1] || "",
          gun: dateParts[2] || ""
        };
      });
      setMesaiList(data);
      setFilteredList(data);
      setLoading(false);
    } catch (e) { console.error(e); setLoading(false); }
  };

  // --- FİLTRELEME MOTORU ---
  useEffect(() => {
    let res = [...mesaiList];
    if (fYil) res = res.filter(m => m.yil === fYil);
    if (fAy) res = res.filter(m => m.ay === fAy);
    if (fGun) res = res.filter(m => m.gun === fGun);
    if (fPersonel) res = res.filter(m => m.personelIsmi === fPersonel);
    if (fTip) res = res.filter(m => m.mesaiTipi === fTip);
    setFilteredList(res);
  }, [fYil, fAy, fGun, fPersonel, fTip, mesaiList]);

  // --- EXCEL (CSV) ÇIKTI ALMA (SADECE ADMIN VE IK) ---
  const exportToExcel = () => {
    let csv = "uFEFF" + "Tarih;Personel;Mesai Tipi;Sure(Saat);Aciklama\n";
    filteredList.forEach(m => {
      csv += `${m.tarih};${m.personelIsmi};${m.mesaiTipi};${m.sure};${m.aciklama?.replace(/;/g, ",")}\n`;
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

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-bold animate-pulse uppercase">Arşiv Yükleniyor...</div>;
  if (!isAuthorized) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <div>
             <h1 className="text-2xl font-black uppercase tracking-tighter text-amber-500 flex items-center gap-3">⏰ Mesai Kayıtları Arşivi</h1>
             <p className="text-[10px] text-gray-500 uppercase mt-1 font-bold">Kullanıcı: {userName} ({userRole})</p>
           </div>
           <div className="flex gap-3">
             {/* EXCEL BUTONU - SADECE ADMIN VE IK GÖRÜR */}
             {(userRole === "admin" || userRole === "ik") && (
               <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-black px-5 py-2.5 rounded-xl shadow-lg transition uppercase tracking-widest">Excel Raporu Al</button>
             )}
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black px-5 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-700 transition uppercase tracking-widest">Geri Dön</Link>
           </div>
        </div>

        {/* FİLTRELEME PANELİ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-2xl no-print">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-1">Yıl</label>
           <select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2.5 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('yil').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-1">Ay</label>
           <select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2.5 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('ay').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-1">Gün</label>
           <select value={fGun} onChange={e=>setFGun(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2.5 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('gun').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block ml-1">Personel</label>
           <select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2.5 text-xs text-white uppercase"><option value="">Tüm Ekip</option>{getUnique('personelIsmi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           
           <div><label className="text-[9px] text-amber-500 font-black uppercase mb-1 block ml-1">Mesai Türü</label>
           <select value={fTip} onChange={e=>setFTip(e.target.value)} className="w-full bg-gray-800 border border-amber-900/30 rounded-xl p-2.5 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('mesaiTipi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
        </div>

        {/* LİSTE TABLOSU */}
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 shadow-2xl overflow-hidden relative">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-[0.15em]">
                 <tr><th className="pb-5 px-2">Tarih</th><th className="pb-5">Personel</th><th className="pb-5">Mesai Türü</th><th className="pb-5">Süre</th><th className="pb-5">Açıklama</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {filteredList.map((m, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{m.tarih}</td>
                     <td className="py-5 text-gray-100">{m.personelIsmi}</td>
                     <td className="py-5"><span className="bg-amber-900/20 text-amber-500 border border-amber-900/30 px-3 py-1 rounded-lg text-[10px] font-black">{m.mesaiTipi}</span></td>
                     <td className="py-5 text-teal-400 font-black tracking-widest">{m.sure} SAAT</td>
                     <td className="py-5 text-gray-500 text-xs italic font-medium">"{m.aciklama || "Açıklama yok."}"</td>
                   </tr>
                 ))}
                 {filteredList.length === 0 && (
                   <tr><td colSpan={5} className="py-12 text-center text-gray-600 italic">Aranan kriterlere uygun mesai kaydı bulunamadı.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
