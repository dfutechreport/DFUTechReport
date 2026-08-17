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

  const [fYil, setFYil] = useState("");
  const [fAy, setFAy] = useState("");
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

  // --- KRİTİK: DFU GERÇEK VERİTABANI ŞEMASI EŞLEMESİ ---
  const fetchMesaiRecords = async () => {
    try {
      const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => {
        const raw = d.data();
        const dateParts = raw.tarih ? raw.tarih.split("-") : [];
        
        // Veritabanındaki 'personel', 'mesaiTuru' ve 'toplamMesaiDk' alanları kullanıldı
        return {
          id: d.id,
          tarih: raw.tarih || "-",
          yil: dateParts[0] || "",
          ay: dateParts[1] || "",
          personelIsmi: raw.personel || raw.personelIsmi || "Bilinmiyor",
          mesaiTuru: raw.mesaiTuru || raw.mesaiTipi || "Genel",
          baslangic: raw.baslangicSaati || raw.baslangic || "-",
          bitis: raw.bitisSaati || raw.bitis || "-",
          sureSaat: raw.toplamMesaiDk ? (Number(raw.toplamMesaiDk) / 60).toFixed(1) : (raw.sure || 0),
          aciklama: raw.aciklama || "-",
          evdenCagirma: raw.evdenCagirma === "Var" || raw.evdenCagirma === true
        };
      });
      setMesaiList(data);
      setFilteredList(data);
      setLoading(false);
    } catch (e) { console.error("Veri eşleme hatası:", e); setLoading(false); }
  };

  useEffect(() => {
    let res = [...mesaiList];
    if (fYil) res = res.filter(m => m.yil === fYil);
    if (fAy) res = res.filter(m => m.ay === fAy);
    if (fPersonel) res = res.filter(m => m.personelIsmi === fPersonel);
    if (fTip) res = res.filter(m => m.mesaiTuru === fTip);
    setFilteredList(res);
  }, [fYil, fAy, fPersonel, fTip, mesaiList]);

  const exportToExcel = () => {
    let csv = "uFEFF" + "Tarih;Personel;Mesai Turu;Baslangic;Bitis;Sure(Saat);Evden Cagirma;Aciklama\n";
    filteredList.forEach(m => {
      csv += `${m.tarih};${m.personelIsmi};${m.mesaiTuru};${m.baslangic};${m.bitis};${m.sureSaat};${m.evdenCagirma ? 'EVET' : 'HAYIR'};${m.aciklama?.replace(/;/g, ",")}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `DFU_Mesai_Raporu_Final.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getUnique = (field: string) => Array.from(new Set(mesaiList.map(m => m[field]))).filter(Boolean).sort();

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`YÜKLENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
           <div><h1 className="text-3xl font-black uppercase text-amber-500 tracking-tighter">⏰ Mesai Kayıtları Arşivi</h1><p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">DFU Endüstriyel Puantaj Sistemi</p></div>
           <div className="flex gap-3">
             {(userRole === "admin" || userRole === "ik") && (<button onClick={exportToExcel} className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-black px-5 py-3 rounded-2xl shadow-xl transition uppercase tracking-widest">Excel Raporu Al</button>)}
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition uppercase">Geri Dön</Link>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10 bg-gray-900/50 p-6 rounded-[35px] border border-gray-800 shadow-2xl no-print">
           <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-2">Yıl</label><select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('yil').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-2">Ay</label><select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('ay').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-2">Personel</label><select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white uppercase"><option value="">Tüm Ekip</option>{getUnique('personelIsmi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-amber-500 uppercase font-black mb-1 block ml-2">Mesai Türü</label><select value={fTip} onChange={e=>setFTip(e.target.value)} className="w-full bg-gray-800 border border-amber-900/30 rounded-xl p-3 text-xs text-white uppercase"><option value="">Hepsi</option>{getUnique('mesaiTuru').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div className="flex items-end"><button onClick={()=>{setFYil("");setFAy("");setFPersonel("");setFTip("");}} className="w-full bg-gray-800 hover:bg-red-900/40 text-gray-500 p-3 rounded-xl text-[10px] font-black uppercase transition">Sıfırla</button></div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-3xl overflow-hidden relative">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-6 px-2">Tarih</th><th className="pb-6">Personel</th><th className="pb-6">Tür</th><th className="pb-6">Evden</th><th className="pb-6">Aralık</th><th className="pb-6 text-center">Süre</th><th className="pb-6">Açıklama</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {filteredList.map((m, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{m.tarih}</td>
                     <td className="py-5 text-gray-100 text-sm font-black tracking-tighter">{m.personelIsmi}</td>
                     <td className="py-5"><span className="bg-amber-900/30 text-amber-500 border border-amber-900/40 px-3 py-1 rounded-lg text-[9px] font-black">{m.mesaiTuru}</span></td>
                     <td className="py-5">{m.evdenCagirma ? <span className="text-red-500 text-[10px] font-black border border-red-500/50 px-2 py-0.5 rounded-full">VAR</span> : <span className="text-gray-600 font-normal">YOK</span>}</td>
                     <td className="py-5"><span className="text-[10px] text-gray-400 font-black">{m.baslangic}—{m.bitis}</span></td>
                     <td className="py-5 text-center"><span className="bg-teal-900/20 text-teal-400 border border-teal-500/30 px-3 py-1 rounded-lg text-xs font-black">{m.sureSaat} SAAT</span></td>
                     <td className="py-5 text-gray-500 text-[11px] font-medium max-w-[150px] truncate group-hover:whitespace-normal transition-all group-hover:text-gray-300">"{m.aciklama}"</td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {filteredList.length === 0 && <div className="py-20 text-center text-gray-600 font-bold uppercase tracking-widest italic text-xs">Arşivde kayıt bulunamadı.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}