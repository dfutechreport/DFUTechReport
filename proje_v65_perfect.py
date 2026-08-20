import os
content = r'''"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [bakimLigi, setBakimLigi] = useState<any[]>([]);
  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);
  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  
  // DATA STATES
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  // MONITORING
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  // MODALS
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  // FILTERS (Global & Graphical)
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [yilListesi, setYilListesi] = useState<string[]>([]);

  // PERSONNEL MATRIX FILTERS (FIXED: Missing state added)
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  // ENERGY FILTERS
  const [filterElekSayac, setFilterElekSayac] = useState("");
  const [filterGazSayac, setFilterGazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");
  const [elekSayacList, setElekSayacList] = useState<string[]>([]);
  const [gazSayacList, setGazSayacList] = useState<string[]>([]);
  const [suSayacList, setSuSayacList] = useState<string[]>([]);

  // OUTPUTS
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const userData = userSnap.data();
          setUserRole(userData.role); setUserName(userData.name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(userData.role)) {
            setIsAdmin(true); fetchInitialData(); fetchRcaData();
          } else { window.location.href = "/dashboard"; }
        }
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    
  if (loading) return ( <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center overflow-hidden"> <div className="relative mb-12"> <div className="absolute inset-0 bg-indigo-600/20 blur-[150px] rounded-full animate-pulse"></div> <img src="/dfulogo.png" className="h-32 w-auto relative z-10 animate-bounce" /> </div> <div className="w-80 h-1 bg-white/5 rounded-full overflow-hidden mb-6"><div className="absolute inset-0 bg-indigo-400 w-full animate-pulse"></div></div> <p className="text-indigo-400 font-black tracking-[0.5em] text-[10px] uppercase">COMMUNICATION ESTABLISHED</p> </div> ); 
  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <div className="flex items-center gap-6"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1 shadow-2xl" /><div><h1 className="text-2xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300">Komuta Merkezi</h1></div></div>
          {(() => { const t = Number(kpiTotals.sure)||0, d = Number(kpiTotals.durus)||0, r = t > 0 ? (d/t)*100 : 0; return ( <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print"> <span className="text-[10px] font-black uppercase text-gray-500">DURUŞ ORANI:</span> <span className={`text-sm font-black ${r < 30 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>%{r.toFixed(1)}</span> </div> ) })()}
          <div className="flex gap-4"><Link href="/dashboard" className="bg-white/5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10">Geri Dön</Link><button onClick={()=>auth.signOut()} className="bg-red-600/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase text-red-400 border border-red-500/30">Çıkış</button></div>
        </div>
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg hover:bg-red-500 transition">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl font-bold text-xs text-center">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-xl font-bold text-xs text-center">🗄️ EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full animate-bounce">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-xl font-semibold text-xs text-center border border-gray-600">🗄️ Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center uppercase">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-xl font-bold text-xs text-center border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center uppercase tracking-tighter">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-xl font-bold text-xs text-center">🗄️ PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-xl font-black text-xs text-center shadow-lg">🛠️ Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter tracking-widest">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">⏰ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">🗄️ Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">⚙️ Hat/Makineler</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">📢 İSG Duyuru</Link>
          <button onClick={()=>{if(window.confirm("RESET?")){/*reset logic*/}}} className="bg-red-950 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase border border-red-900/30 transition">Reset</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-red-600/10 border border-white/5"><div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">Detay</button></div>))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase">Aktif Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[3.5rem] shadow-2xl">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (<div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-indigo-600/10 border border-white/5"><div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">İncele</button></div>))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase">Bekleyen İş Yok.</p>}
              </div>
           </div>
        </div>

        {userRole !== "isg" && (
          <div className="space-y-12 mb-16 no-print">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-amber-500/[0.03] backdrop-blur-3xl border border-amber-500/20 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                   <div className="flex justify-between items-start mb-8"><h2 className="text-sm font-black text-amber-500 uppercase">🏆 BAKIM YILDIZLARI LİGİ</h2><button onClick={()=>setShowScoreInfo(true)} className="bg-amber-500/10 text-amber-500 text-[8px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase transition-all">Puanlama Metodu</button></div>
                   <div className="space-y-6">{bakimLigi.map((p,i)=>(<div key={i} className={`flex justify-between items-center p-5 rounded-[2rem] border ${i===0?'border-amber-500/40 bg-amber-500/10 shadow-lg':'border-white/5 bg-white/5'}`}><div className="flex items-center gap-4"><span className="text-2xl">{i===0?'🥇':i===1?'🥈':'🥉'}</span><div><p className="text-xs font-black text-white uppercase">{p.isim}</p><p className="text-[8px] text-gray-500 font-bold uppercase">{p.is} Müdahale</p></div></div><div className="text-right"><p className="text-sm font-black text-amber-400">{p.pts}</p><p className="text-[8px] text-amber-600 font-black uppercase">XP PUAN</p></div></div>))}</div>
                </div>
                <div className="bg-emerald-500/[0.03] backdrop-blur-3xl border border-emerald-500/20 p-10 rounded-[3.5rem] shadow-2xl">
                   <div className="flex justify-between items-start mb-8"><h2 className="text-sm font-black text-emerald-400 uppercase">💰 EN MALİYETLİLER</h2><button onClick={()=>setShowFinanceInfo(true)} className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase transition-all">Analiz Detayı</button></div>
                   <div className="space-y-4">{maliyetAnalizi.map((e,i)=>(<div key={i} className="flex justify-between items-center border-b border-white/5 pb-4"><div><p className="text-[10px] font-bold text-gray-300 uppercase">{e.isim}</p><p className="text-[8px] text-gray-600 font-black uppercase">{e.pS} Sarfiyat</p></div><span className="text-emerald-500 font-black text-sm">{e.tS} DK</span></div>))}</div>
                </div>
             </div>
             <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 blur-[120px] rounded-full animate-pulse"></div>
                <h2 className="text-sm font-black text-indigo-400 mb-8 uppercase tracking-[0.5em] flex items-center gap-4">🧠 AI KRİTİK ARIZA ÖNGÖRÜSÜ <span className="h-2 w-2 bg-red-500 rounded-full animate-ping"></span></h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{predictiveInsights.length > 0 ? predictiveInsights.map((ins, i) => (<div key={i} className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2.5rem] flex flex-col justify-center items-center text-center animate-pulse"><p className="text-[12px] font-black text-red-400 uppercase mb-2">{ins.equipment}</p><span className="bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase shadow-lg shadow-red-600/20">Kritik Risk</span></div>)) : <div className="col-span-3 py-10 text-center text-teal-500 font-black text-[11px] uppercase animate-pulse">✓ SİSTEM ANALİZİ: TÜM EKİPMANLAR STABİL</div>}</div>
             </div>
             <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-10 rounded-[3.5rem] shadow-2xl">
                <h2 className="text-sm font-black text-teal-400 mb-8 uppercase tracking-[0.5em]">📊 MTBF ANALİZİ (ARIZASIZ ÇALIŞMA KARARLILIĞI)</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{mtbfMetrics.map((m, i) => (<div key={i} className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] text-center hover:border-teal-500/30 transition-all"><p className="text-[10px] font-bold text-gray-400 uppercase mb-2 truncate">{m.equipment}</p><span className="text-2xl font-black text-white">{m.mtbf}</span><p className="text-[8px] text-teal-500/60 font-black uppercase mt-1">GÜN STABİL</p></div>))}</div>
             </div>
          </div>
        )}
<div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
              const hasRca = rcaLogs.find(r => r.logId === log.id);
              return (
                <div key={idx} className="bg-gray-800/40 p-6 rounded-[30px] border border-gray-700/50 flex flex-col justify-between h-full hover:border-indigo-500/50 transition duration-300">
                  <div><p className="text-[10px] font-bold text-gray-500 uppercase">{log.hatAdi}</p><p className="font-bold text-gray-200">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 uppercase tracking-tighter">{log.toplamSureDakika} dk Kayıp</p></div>
                  <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3 mt-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>{hasRca ? "Güncelle" : "Analiz Yap"}</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase tracking-tighter">
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1">Duruş Süresi</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        {/* ENERGY CHARTS (FILTERED) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase tracking-widest underline underline-offset-8">⚡ Elektrik (kWh)</h2>
             <select value={filterElekSayac} onChange={e=>setFilterElekSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{elekSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-red-400 mb-4 uppercase tracking-widest underline underline-offset-8">🔥 Doğalgaz (m³)</h2>
             <select value={filterGazSayac} onChange={e=>setFilterGazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{gazSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikGaz}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase tracking-widest underline underline-offset-8">💧 Su (Ton)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* PERSONNEL PERFORMANCE MATRIX (FULL FILTER) */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[45px] mb-12 shadow-2xl relative overflow-hidden">
           <h2 className="text-xl font-black text-blue-400 mb-8 uppercase tracking-widest flex items-center gap-3 tracking-[0.2em]">👤 PERSONEL PERFORMANS MATRİSİ</h2>
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 bg-gray-800/40 p-6 rounded-[25px] border border-gray-700/50 no-print">
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Filtre Yıl</label><select value={filterYil} onChange={e=>setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white uppercase"><option value="">Tümü</option>{yilListesi.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Vardiya</label><select value={filterPerfVardiya} onChange={e=>setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white uppercase"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Teknisyen</label><select value={filterPerfPersonel} onChange={e=>setFilterPerfPersonel(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white uppercase"><option value="">Tüm Ekip</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Arıza Tipi</label><select value={filterPerfDurus} onChange={e=>setFilterPerfDurus(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option><option value="durus">Duruşlu</option><option value="normal">Normal</option></select></div>
              <div><label className="text-[9px] text-blue-400 uppercase font-black mb-1 block ml-1">Sıralama</label><select value={filterPerfSiralama} onChange={e=>setFilterPerfSiralama(e.target.value)} className="w-full bg-indigo-950 border border-indigo-500/30 rounded-xl p-2 text-xs text-white font-black uppercase"><option value="is">İş Sayısı</option><option value="efor">En Çok Efor</option></select></div>
           </div>
           <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest"><tr><th className="pb-4">İsim</th><th className="pb-4">Top. İş</th><th className="pb-4">Top. Efor</th><th className="pb-4 text-blue-400">MTTR (Ort)</th></tr></thead><tbody className="text-sm font-bold uppercase">{personelPerformans.slice(0,10).map((p,i)=>(<tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition"><td className="py-4 text-gray-200">{i<3?"⭐ ":" "}{p.isim}</td><td className="py-4 text-green-400">{p.isSayisi} Adet</td><td className="py-4">{p.eforDk} dk</td><td className="py-4 text-indigo-400">{(p.eforDk/p.isSayisi || 0).toFixed(1)} dk</td></tr>))}</tbody></table></div>
        </div>

        {/* BOTTOM CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">📈 RCA Pareto Analizi</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name: c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl"><h2 className="text-sm font-black text-teal-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">⚡ Hat Bazlı İş Yoğunluğu</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikIsHatti}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></div>
        </div>

      </div>

      {/* INSPECTION MODAL */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-sans">
          <div className="bg-gray-900 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Bildirim Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-tighter">Konum</p><p className="text-sm text-gray-200 tracking-tighter">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-tighter">Bildiren</p><p className="text-sm text-gray-200 tracking-tighter uppercase">{selectedVaka.bildirenKisi || "Sistem"}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-tighter">Zaman</p><p className="text-sm text-gray-200 tracking-tighter">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-tighter">Etki</p><p className={selectedVaka.isDuruslu ? "text-red-500 text-sm" : "text-green-500 text-sm"}>{selectedVaka.isDuruslu ? "Duruşlu" : "Normal"}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner"><p className="text-[10px] text-indigo-400 uppercase font-black mb-3 underline underline-offset-8 decoration-indigo-700 font-bold uppercase">Açıklama Notu:</p><p className="text-gray-300 italic text-sm font-medium">"{selectedVaka.aciklama || "Not girilmemiş."}"</p></div>
             <button onClick={()=>setShowVakaModal(false)} className="w-full bg-gray-800 hover:bg-gray-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition border border-gray-700 shadow-2xl">Pencereyi Kapat</button>
          </div>
        </div>
      )}

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter text-center tracking-[0.2em]">Root Cause Analysis</h2>
            <p className="text-[10px] text-center text-gray-500 mb-8 uppercase font-bold tracking-widest">{selectedLogForRca?.ekipmanAdi}</p>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>( <button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/30':'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-400'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruşun nedenini ve aksiyon planını detaylandırın..." className="w-full bg-gray-800 border-gray-800 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40 shadow-inner" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-[20px] font-black text-gray-400 tracking-widest text-xs uppercase">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-600/30 tracking-widest text-xs uppercase transition">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}

      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4 font-sans">
          <div className="bg-slate-900 border border-amber-500/30 p-12 rounded-[3.5rem] max-w-2xl w-full relative shadow-3xl">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition text-2xl">✕</button>
            <h2 className="text-2xl font-black text-amber-500 mb-8 uppercase text-center">XP Puanlama Metodolojisi</h2>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5"><ul className="space-y-4"><li className="flex justify-between border-b border-white/5 pb-2"><span>🟢 Normal Arıza Müdahalesi:</span> <span className="text-amber-400 font-black">+20 XP</span></li><li className="flex justify-between border-b border-white/5 pb-2"><span>🔴 Duruşlu (Downtime) Müdahale:</span> <span className="text-red-400 font-black">+50 XP</span></li><li className="flex justify-between border-t border-white/5 pt-2"><span>⚡ Müdahale Hızı Bonusu (İlk 15 dk):</span> <span className="text-indigo-400 font-black">+15 XP</span></li></ul></div>
              <div className="bg-amber-500/10 p-8 rounded-[2rem] border border-amber-500/20 text-left"><p className="text-amber-500 font-black mb-2 uppercase text-[11px]">Örnek Hesaplama:</p><p>Duruşlu bir arızaya 10 dakika içinde müdahale edilirse: <strong>50 + 15 = 65 XP</strong> kazanılır.</p></div>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-10 w-full bg-amber-600 py-5 rounded-[2rem] font-black uppercase text-xs">Anladım, Kapat</button>
          </div>
        </div>
      )}
      {showFinanceInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4 font-sans">
          <div className="bg-slate-900 border border-emerald-500/30 p-12 rounded-[3.5rem] max-w-2xl w-full relative shadow-3xl text-left">
            <button onClick={() => setShowFinanceInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition text-2xl">✕</button>
            <h2 className="text-2xl font-black text-emerald-400 mb-8 uppercase text-center">Maliyet Analiz Detayı</h2>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed text-left">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5"><p className="mb-4">Sıralama kriterleri:</p><ul className="space-y-4"><li>🛠️ <strong>Parça Yoğunluğu:</strong> Kullanılan malzeme adedi (%60 ağırlık).</li><li>⏰ <strong>Bakım Süresi:</strong> Müdahale süresi (%40 ağırlık).</li></ul></div>
              <div className="bg-emerald-500/10 p-8 rounded-[2rem] border border-emerald-500/20"><p className="text-[10px] text-emerald-400 font-black uppercase mb-2">Örnek Analiz:</p><p>Makine A (10 Parça + 50 dk) &gt; Makine B (1 Parça + 200 dk). Parça maliyeti sıralamayı önceliklendirir.</p></div>
            </div>
            <button onClick={() => setShowFinanceInfo(false)} className="mt-10 w-full bg-emerald-600 py-5 rounded-[2rem] font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
}'''
path = "app/admin/page.tsx"
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as f: f.write(content.strip())
print(f"[BAŞARILI] app/admin/page.tsx v65 (IRONCLAD REBUILD) ile yenilendi.")
