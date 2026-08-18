import os
content = r''' "use client";
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
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [selectedEked, setSelectedEked] = useState<any>(null);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);
  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const userData = userSnap.data();
          setUserRole(userData.role); setUserName(userData.name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(userData.role)) {
            setIsAdmin(true); fetchInitialData();
          } else { window.location.href = "/dashboard"; }
        }
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchInitialData = async () => {
    try {
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
      const ekedSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
      setAktifEked(ekedSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      const rcaSnap = await getDocs(collection(db, "root_cause_analysis"));
      setRcaLogs(rcaSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, eD:any = {}, eqGroups: any = {};
    rawLogs.forEach(l => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const y = d?.getFullYear().toString();
      const a = (d?.getMonth() + 1).toString();
      const s = Number(l.toplamSureDakika) || 0;
      if ((!filterYil || y === filterYil) && (!filterAy || a === filterAy)) {
        isC++; suC += s; hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) { duC += s; if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 }; eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s; }
      }
      if (!eqGroups[l.ekipmanAdi]) eqGroups[l.ekipmanAdi] = []; eqGroups[l.ekipmanAdi].push(l);
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
    const insights: any[] = []; const mtbfData: any[] = [];
    Object.keys(eqGroups).forEach(eqName => {
      const logs = eqGroups[eqName].sort((a:any, b:any) => (b.kayitTarihi?.toDate?.() || new Date(b.kayitTarihi)).getTime() - (a.kayitTarihi?.toDate?.() || new Date(a.kayitTarihi)).getTime());
      if (logs.length >= 2) {
        let totalInterval = 0;
        for (let i = 0; i < logs.length - 1; i++) { totalInterval += (logs[i].kayitTarihi?.toDate?.() || new Date(logs[i].kayitTarihi)).getTime() - (logs[i+1].kayitTarihi?.toDate?.() || new Date(logs[i+1].kayitTarihi)).getTime(); }
        const avgMtbf = (totalInterval / (logs.length - 1)) / (1000 * 60 * 60 * 24);
        mtbfData.push({ equipment: eqName, mtbf: avgMtbf.toFixed(1), count: logs.length });
        const last15Days = Date.now() - (15 * 1000 * 60 * 60 * 24);
        if (logs.filter((l:any) => (l.kayitTarihi?.toDate?.() || new Date(l.kayitTarihi)).getTime() > last15Days).length >= 2) { insights.push({ equipment: eqName, risk: "YÜKSEK", reason: "Sıklaşan Arıza" }); }
      }
    });
    setPredictiveInsights(insights.slice(0, 3)); setMtbfMetrics(mtbfData.sort((a,b) => b.count - a.count).slice(0, 5));
  }, [rawLogs, filterYil, filterAy, filterHat]);

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center overflow-hidden">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-indigo-600/20 blur-[150px] rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-32 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-80 h-1 bg-white/5 rounded-full overflow-hidden mb-6"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-400 to-transparent w-full animate-[scan_2s_infinite_linear]"></div></div>
      <p className="text-indigo-400 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">COMMAND CENTER LINKING...</p>
      <style jsx>{` @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_rgba(30,58,138,0.15)_0%,_transparent_80%)]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <div className="flex items-center gap-6"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1 shadow-2xl" /><div><h1 className="text-2xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300">Komuta Merkezi</h1><p className="text-[10px] text-indigo-500/60 font-black uppercase tracking-widest">{userName} | {userRole}</p></div></div>
          <div className="flex gap-4">
             <Link href="/dashboard" className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/30">Geri Dön</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/30">Güvenli Çıkış</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-16">
          {userRole === "isg" ? (
            <>
              <Link href="/admin/eked" className="bg-yellow-600/10 border border-yellow-600/30 hover:bg-yellow-600 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all text-yellow-500 hover:text-black">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-white/5 border border-white/10 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all hover:bg-white/10">🗄️ EKED Arşivi</Link>
              <Link href="/admin/kar-takip" className="bg-red-600/10 border border-red-600/30 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all hover:bg-red-600 hover:text-white text-red-500">⚡ KAR Arşivi</Link>
              <Link href="/admin/duyurular" className="bg-orange-600/10 border border-orange-600/30 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all hover:bg-orange-600 hover:text-white text-orange-500">📢 İSG Duyuru</Link>
            </>
          ) : (
            <>
              <Link href="/admin/is-emri-ac" className="bg-red-600/80 hover:bg-red-500 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all shadow-xl shadow-red-600/20">🚨 Yeni İş Emri</Link>
              <Link href="/admin/aktif-isler" className="bg-white/5 border border-white/10 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all hover:bg-white/10">Aktif İşler</Link>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all shadow-xl shadow-yellow-600/20">🔒 EKED Takip</Link>
              <Link href="/admin/yedek-parca" className="bg-indigo-600 text-white p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20">⚙️ Yedek Parça</Link>
              <Link href="/admin/personel" className="bg-purple-600/80 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest">👤 Personel Onay</Link>
              <Link href="/dashboard/pano-listesi" className="bg-cyan-600/80 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest">🔌 Pano Listesi</Link>
              <Link href="/dashboard/kontrol-formlari" className="bg-teal-600/80 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest">✅ Kontrol Formları</Link>
              <Link href="/admin/pm-takvim" className="bg-blue-600/80 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest">📅 PM Takvimi</Link>
              <Link href="/dashboard/sayac" className="bg-emerald-600/80 p-4 rounded-3xl font-black text-[10px] text-center uppercase tracking-widest">⚡ Sayaç Okuma</Link>
              <button onClick={()=>window.confirm("RESET?")} className="bg-red-950/40 border border-red-900/30 text-red-500 p-4 rounded-3xl font-black text-[10px] uppercase tracking-widest">Reset</button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group hover:border-yellow-500/30 transition-all">
              <h2 className="text-sm font-black text-yellow-500 mb-6 uppercase tracking-[0.3em]">🔒 AKTİF EKED {aktifEked.length > 0 && "!"}</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifEked.map((e, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-yellow-600/10 border-l-4 border-l-yellow-600">
                    <div><p className="text-[9px] font-black text-yellow-500 uppercase">{e.yer}</p><p className="text-xs font-bold text-gray-200">{e.personelName}</p></div>
                    <button onClick={() => { setSelectedEked(e); setShowEkedModal(true); }} className="bg-yellow-600 text-black text-[9px] font-black px-5 py-2 rounded-xl">İncele</button>
                  </div>
                ))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic">AKTİF KİLİT YOK.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3rem] shadow-2xl hover:border-red-500/30 transition-all">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.3em]">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-red-600/10">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">Detay</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic">AKTİF ALARM YOK.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3rem] shadow-2xl hover:border-indigo-500/40 transition-all">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.3em]">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-indigo-600/10">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">İncele</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic">BEKLEYEN İŞ YOK.</p>}
              </div>
           </div>
        </div>

        {/* AI CORE ANALYTICS (v24 - FORCE VISIBLE) */}
        {userRole !== "isg" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
             <div className="bg-indigo-500/[0.05] backdrop-blur-3xl border border-indigo-500/20 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full animate-pulse"></div>
                <h2 className="text-sm font-black text-indigo-400 mb-8 uppercase tracking-[0.4em]">🧠 AI KRİTİK ARIZA ÖNGÖRÜSÜ</h2>
                <div className="space-y-5">
                  {predictiveInsights.length > 0 ? (
                    predictiveInsights.map((ins, idx) => (
                      <div key={idx} className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2.5rem] flex justify-between items-center animate-pulse">
                        <div><p className="text-[11px] font-black text-red-400 uppercase">{ins.equipment}</p><p className="text-xs text-gray-400 font-bold">{ins.reason}</p></div>
                        <span className="bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase">Kritik Risk</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center"><p className="text-teal-500 font-black text-[11px] tracking-[0.3em] uppercase animate-pulse">✓ SİSTEM ANALİZİ TAMAMLANDI</p><p className="text-gray-600 text-[10px] mt-3 font-bold uppercase tracking-widest">Kritik risk taşıyan ekipman tespit edilmedi.</p></div>
                  )}
                </div>
             </div>
             <div className="bg-indigo-500/[0.05] backdrop-blur-3xl border border-indigo-500/20 p-10 rounded-[3.5rem] shadow-2xl">
                <h2 className="text-sm font-black text-teal-400 mb-8 uppercase tracking-[0.4em]">📊 MTBF Analizi (Arızasız Çalışma)</h2>
                <div className="space-y-4">
                  {mtbfMetrics.length > 0 ? (
                    mtbfMetrics.map((m, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-4">
                        <span className="text-[11px] font-bold text-gray-300 uppercase">{m.equipment}</span>
                        <div className="text-right"><span className="text-lg font-black text-white">{m.mtbf} GÜN</span><p className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">Stabil Çalışma</p></div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-gray-700"><p className="text-[11px] font-black uppercase tracking-[0.2em]">Veri Analizi Bekleniyor...</p><p className="text-[9px] mt-3 leading-relaxed opacity-50 font-bold italic text-indigo-400/40">(En az 2 kayıt olan makineler burada listelenir)</p></div>
                  )}
                </div>
             </div>
          </div>
        )}

        {/* RCA TASK LIST */}
        {userRole !== "isg" && (
          <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[3.5rem] mb-16 shadow-2xl">
            <h2 className="text-sm font-black text-white mb-8 uppercase tracking-[0.3em]">🧠 RCA Analizi Bekleyen Duruşlar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 flex flex-col justify-between h-full hover:border-indigo-500/30 transition-all">
                    <div><p className="text-[9px] font-bold text-gray-500 uppercase">{log.hatAdi}</p><p className="text-sm font-bold text-gray-200">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-[10px] mt-2 uppercase">{log.toplamSureDakika} dk Kayıp</p></div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3.5 mt-5 rounded-2xl text-[9px] font-black uppercase transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white'}`}>{hasRca ? "Güncelle" : "Analiz Yap"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        {userRole !== "isg" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16 text-center">
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-xl"><p className="text-[9px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-xl"><p className="text-[9px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-red-900/20 shadow-xl"><p className="text-[9px] text-red-500 font-black mb-1">Duruş</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-indigo-900/20 shadow-xl"><p className="text-[9px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
          </div>
        )}
      </div>

      {showEkedModal && selectedEked && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[1000] p-4">
          <div className="bg-slate-900 border border-yellow-500/30 w-full max-w-2xl rounded-[3.5rem] p-12 relative shadow-3xl">
            <button onClick={() => { setShowEkedModal(false); setSelectedEked(null); }} className="absolute top-8 right-8 text-gray-500 text-2xl hover:text-white transition">✕</button>
            <h2 className="text-2xl font-black text-yellow-400 uppercase mb-8">EKED Detay</h2>
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5"><p className="text-[9px] text-gray-500 uppercase mb-1">Konum</p><p className="text-lg font-bold text-white">{selectedEked.yer}</p></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5"><p className="text-[9px] text-gray-500 uppercase mb-1">Açıklama</p><p className="text-sm text-gray-300">{selectedEked.aciklama}</p></div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowEkedModal(false)} className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Kapat</button>
                <Link href="/admin/eked" className="flex-1 bg-yellow-600 text-black py-4 rounded-2xl font-black uppercase text-[10px] text-center flex items-center justify-center hover:bg-yellow-500 transition">Aktif Kilitler Listesini Aç</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''
path = "app/admin/page.tsx"
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    f.write(content.strip())
print(f"Updated: {path}")
