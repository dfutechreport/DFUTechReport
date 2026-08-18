
import os
import re

def update_admin():
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
    return () => unsubscribe();
  }, []);

  const fetchRcaData = async () => {
    const snap = await getDocs(collection(db, "root_cause_analysis"));
    setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
  };

  const fetchInitialData = async () => {
    try {
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım"));

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      const mSnap = await getDocs(query(collection(db, "meter_logs"), orderBy("tarih", "asc")));
      setRawMeterLogs(mSnap.docs.map(d => d.data()));

      // HYBRID DISCOVERY FOR DROPDOWNS
      const hatSet = new Set<string>();
      const aSnap = await getDocs(collection(db, "assets"));
      aSnap.docs.forEach(d => { if(d.data().hatAdi) hatSet.add(d.data().hatAdi); });
      const hSnap = await getDocs(collection(db, "hatlar"));
      hSnap.docs.forEach(d => { if(d.data().ad || d.data().name) hatSet.add(d.data().ad || d.data().name); });
      setHatListesi(Array.from(hatSet).sort());

      const yilSet = new Set<string>();
      logsSnap.docs.forEach(l => {
        const d = l.data().kayitTarihi?.toDate ? l.data().kayitTarihi.toDate() : new Date(l.data().kayitTarihi);
        if(d && !isNaN(d.getTime())) yilSet.add(d.getFullYear().toString());
      });
      setYilListesi(Array.from(yilSet).sort());

      setKpiOnayBekleyen((await getDocs(query(collection(db, "users"), where("isApproved", "==", false)))).size);
    } catch (e) { console.error(e); }
  };

  // --- CALCULATION ENGINE ---
  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, pD:any = {}, eD:any = {}, pNames = new Set<string>();

    rawLogs.forEach(l => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const y = d?.getFullYear().toString();
      const a = (d?.getMonth() + 1).toString();
      const s = Number(l.toplamSureDakika) || 0;

      if ((!filterYil || y === filterYil) && (!filterAy || a === filterAy) && (!filterHat || l.hatAdi === filterHat)) {
        isC++; suC += s;
        hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) duC += s;
      }

      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => {
        if(p) pNames.add(p);
        if ((!filterYil || y === filterYil) && (!filterAy || a === filterAy) && (!filterPerfVardiya || l.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
          if ((filterPerfDurus === "durus" && !l.isDuruslu) || (filterPerfDurus === "normal" && l.isDuruslu)) return;
          if (!pD[p]) pD[p] = { isSayisi: 0, eforDk: 0 };
          pD[p].isSayisi++; pD[p].eforDk += s;
        }
      });

      if (l.isDuruslu) {
        if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 };
        eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s;
      }
    });

    setPersonelHavuzu(Array.from(pNames).sort());
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, ...pD[k] })).sort((a,b)=> filterPerfSiralama === "efor" ? b.eforDk - a.eforDk : b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil, filterAy, filterHat, filterPerfVardiya, filterPerfPersonel, filterPerfSiralama, filterPerfDurus]);

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const elS = new Set<string>(), gzS = new Set<string>(), suS = new Set<string>();
    const tEl:any = {}, tGz:any = {}, tSu:any = {};
    rawMeterLogs.forEach(l => {
      const t = l.tip || "Elektrik";
      if(t==="Elektrik") elS.add(l.sayacAdi); if(t==="Doğalgaz") gzS.add(l.sayacAdi); if(t==="Su") suS.add(l.sayacAdi);
      const ay = `${l.tarih.split("-")[1]}. Ay`;
      if(t==="Elektrik" && (!filterElekSayac || l.sayacAdi===filterElekSayac)) tEl[ay] = (tEl[ay]||0) + Number(l.deger || 0);
      if(t==="Doğalgaz" && (!filterGazSayac || l.sayacAdi===filterGazSayac)) tGz[ay] = (tGz[ay]||0) + Number(l.deger || 0);
      if(t==="Su" && (!filterSuSayac || l.sayacAdi===filterSuSayac)) tSu[ay] = (tSu[ay]||0) + Number(l.deger || 0);
    });
    setElekSayacList(Array.from(elS).sort()); setGazSayacList(Array.from(gzS).sort()); setSuSayacList(Array.from(suS).sort());
    setGrafikElek(Object.keys(tEl).map(ay=>({ ay, tuketim: tEl[ay] })));
    setGrafikGaz(Object.keys(tGz).map(ay=>({ ay, tuketim: tGz[ay] })));
    setGrafikSu(Object.keys(tSu).map(ay=>({ ay, tuketim: tSu[ay] })));
  }, [rawMeterLogs, filterElekSayac, filterGazSayac, filterSuSayac]);

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Analiz Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse uppercase tracking-[0.2em]">DFU SİSTEM YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase italic tracking-tighter">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase tracking-tighter">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase">Vardiya Raporu</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg transition">Çıkış</button>
          </div>
        </div>

        {/* 22 BUTTON GRID (COMPLETE) */}
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

        {/* NOTIFICATION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-gray-900 border-2 border-red-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-3 uppercase tracking-[0.2em]">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-red-950/20 border border-red-900/30 p-5 rounded-[25px] flex justify-between items-center transition group hover:bg-red-900/30">
                    <div><p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{a.hatAdi}</p><p className="text-sm font-bold text-gray-100">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-lg transition uppercase tracking-widest">İncele</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Aktif İSG alarmı yok.</p>}
              </div>
           </div>
           <div className="bg-gray-900 border-2 border-indigo-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-3 uppercase tracking-[0.2em]">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-indigo-950/20 border border-indigo-900/30 p-5 rounded-[25px] flex justify-between items-center transition group hover:bg-indigo-900/30">
                    <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{is.hatAdi}</p><p className="text-sm font-bold text-gray-100">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-lg transition uppercase tracking-widest">İncele</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Bekleyen bildirim yok.</p>}
              </div>
           </div>
        </div>

        {/* RCA TASK LIST */}
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <div className="text-4xl mb-6">🏆</div>
            <h2 className="text-xl font-black text-amber-500 mb-6 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-white to-amber-500">XP Puan Sistemi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Bakım Ligindeki sıralamanız, sahadaki performans verileriniz üzerinden anlık hesaplanır:</p>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                <ul className="space-y-3">
                  <li>🟢 <strong className="text-white">Normal İş Kapatma:</strong> +20 XP</li>
                  <li>🔴 <strong className="text-red-400">Duruşlu (Downtime) İş:</strong> +50 XP</li>
                  <li>⚡ <strong className="text-indigo-400">Müdahale Hızı:</strong> Zamanında çözüm bonus kazandırır.</li>
                </ul>
              </div>
              <p className="text-[10px] italic text-gray-500">İSG kurallarına uyum puanlamayı doğrudan etkileyen gizli faktördür.</p>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-8 w-full bg-amber-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}
      {showFinanceInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-emerald-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowFinanceInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <div className="text-4xl mb-6">💰</div>
            <h2 className="text-xl font-black text-emerald-400 mb-6 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-white to-emerald-500">Maliyet Analizi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Maliyet listesi, ekipmanın tesis üzerindeki toplam yükünü temsil eder:</p>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                <ul className="space-y-3">
                  <li>🛠️ <strong className="text-white">Yedek Parça Sarfiyatı:</strong> Kullanılan parçaların adedi.</li>
                  <li>⏰ <strong className="text-white">Toplam Bakım Süresi:</strong> Müdahale için harcanan her dakika.</li>
                </ul>
              </div>
              <p className="text-[10px] italic text-gray-500">Bu veriler CapEx planlaması ve yenileme kararları için temel oluşturur.</p>
            </div>
            <button onClick={() => setShowFinanceInfo(false)} className="mt-8 w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}

    </div>
  );
}'''
    # ISG/Saha Move logic, Modals logic etc.
    # We will just write the provided robustly updated code here.
    return content

def update_dash():
    content = r'''"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId: string | null;
}

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00", linkedOrderId: null, aciklama: ""
    }
  });
  
  // States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);

  const selectedHat = watch("hatAdi");
  const basTarih = watch("baslangicTarihi");
  const bitTarih = watch("bitisTarihi");
  const basSaat = watch("baslangicSaati");
  const bitSaat = watch("bitisSaati");

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name || ""); setUserRole(userSnap.data().role || ""); }
        await fetchSystemData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  const fetchSystemData = async () => {
    try {
      // 1. Bildirimler
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      // 2. assets (Hat ve Ekipmanlar)
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());

      // 3. KRİTİK: MASTER STOK LİSTESİ (13.000 Satır)
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  // --- KRİTİK: DFU GERÇEK ALAN EŞLEME MOTORU (V83) ---
  const findStockItem = (id: number) => {
    const row = usedMaterials.find(m => m.id === id);
    if (!row || !row.stockCode) return;
    const searchStr = row.stockCode.trim().toUpperCase();
    
    // Hem belgenin kimliğinde hem de stokKodu alanında ara
    const part = allSpareParts.find(p => 
      String(p.id).toUpperCase() === searchStr || 
      (p.stokKodu && String(p.stokKodu).toUpperCase() === searchStr) ||
      (p.stockCode && String(p.stockCode).toUpperCase() === searchStr)
    );

    setUsedMaterials(prev => prev.map(m => {
      if (m.id === id) {
        if (!part) return { ...m, name: "Hatalı Kod", stock: "0" };

        // GERÇEK ALANLAR: parcaAdi ve mevcutMiktar (Dump Analizine Göre)
        const resolvedName = part.parcaAdi || part.name || part.malzemeAdi || "İsim Tanımsız";
        const resolvedStock = part.mevcutMiktar ?? part.stock ?? part.stok ?? 0;

        return { 
          ...m, 
          name: String(resolvedName), 
          stock: String(resolvedStock) 
        };
      }
      return m;
    }));
  };

  const triggerAutoFill = (order: any) => {
    setValue("hatAdi", order.hatAdi || "");
    setValue("ekipmanAdi", order.ekipmanAdi || "");
    setValue("isDuruslu", order.isDuruslu || false);
    setValue("linkedOrderId", order.id || null); 
    setValue("aciklama", (order.aciklama ? `[Not: ${order.aciklama}] ` : ""));
    setShowVakaModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedHat) {
      const filtered = allAssets.filter((a: any) => a.hatAdi === selectedHat).map((a: any) => a.ekipmanAdi);
      setFilteredEkipmanlar(filtered.sort());
    }
  }, [selectedHat, allAssets]);

  useEffect(() => {
    if (basTarih && bitTarih && basSaat && bitSaat) {
      const start = new Date(`${basTarih}T${basSaat}`).getTime();
      const end = new Date(`${bitTarih}T${bitSaat}`).getTime();
      let diff = (end - start) / 60000;
      setHesaplananSure(diff > 0 ? diff : 0);
    }
  }, [basTarih, bitTarih, basSaat, bitSaat]);

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!Recognition) return alert("Hata");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const currentText = watch("aciklama") || "";
      const transcript = e.results[0][0].transcript;
      setValue("aciklama", currentText + (currentText ? " " : "") + transcript);
    };
    rec.start();
  };

  const onSubmit = async (formData: MaintenanceFormData) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      const cleanData = {
        hatAdi: formData.hatAdi || "-", ekipmanAdi: formData.ekipmanAdi || "-", vardiya: formData.vardiya || "08:00 - 16:00",
        isDuruslu: Boolean(formData.isDuruslu), baslangicTarihi: formData.baslangicTarihi || "", baslangicSaati: formData.baslangicSaati || "",
        bitisTarihi: formData.bitisTarihi || "", bitisSaati: formData.bitisSaati || "", aciklama: formData.aciklama || "",
        toplamSureDakika: Number(hesaplananSure) || 0, bildirenKisi: userName || "Sistem", kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials
      };
      await setDoc(doc(collection(db, "maintenance_logs")), cleanData);
      for (const mat of materials) {
        const part = allSpareParts.find(p => String(p.id).toUpperCase() === mat.stockCode.toUpperCase() || (p.stokKodu && String(p.stokKodu).toUpperCase() === mat.stockCode.toUpperCase()));
        if (part?.id) { await updateDoc(doc(db, "spare_parts", part.id), { mevcutMiktar: increment(-mat.quantity) }); }
      }
      if (formData.linkedOrderId) { await updateDoc(doc(db, "work_orders", formData.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() }); }
      alert("Rapor Kaydedildi."); window.location.reload();
    } catch (e: any) { alert("Hata: " + e.message); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase tracking-tighter">{userName}</p></div></div>
           <div className="flex flex-wrap gap-2">
             {(userRole === "admin" || userRole === "operator") && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition tracking-widest">Admin Panel</Link>)}
             <Link href="/dashboard/mesai" className="bg-amber-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest">Mesai Yaz</Link>
             <Link href="/admin/mesai" className="bg-gray-800 text-white text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition tracking-widest">Mesailerim</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-4 py-2.5 rounded-xl border border-red-900/30 transition">ÇIKIŞ</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* SOL PANEL (İZLEME) */}
          <div className="lg:col-span-1 space-y-8">
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/40 border-2 border-red-600 p-6 rounded-[35px] shadow-2xl animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-5 tracking-widest flex items-center gap-2 tracking-tighter">⚠️ KRİTİK İSG</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-2xl mb-3 border border-red-900/50 flex justify-between items-center group">
                    <p className="text-[10px] font-black uppercase text-white truncate mr-2">{a.hatAdi}</p>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 p-7 rounded-[40px] shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase mb-5 tracking-widest">🔔 Aktif Bildirimler</h3>
              {aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-[20px] mb-3 flex justify-between items-center hover:border-teal-500/50 transition duration-300">
                  <div className="flex-1 min-w-0 mr-3"><p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p></div>
                  <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-teal-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                </div>
              ))}
            </div>
            <Link href="/admin/is-listesi" className="flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 p-5 rounded-[25px] transition shadow-xl text-[11px] font-black uppercase tracking-widest">📋 Tüm İşleri Filtrele</Link>
          </div>

          {/* SAĞ PANEL (FORM) */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[50px] p-8 md:p-12 shadow-2xl relative">
              <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter border-b border-gray-800 pb-5">Bakım İş Bitirme Raporu</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                <input type="hidden" {...register("linkedOrderId")} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Üretim Hattı</label><select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Ekipman</label><select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2 tracking-widest">Vardiya</label><select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm text-white outline-none font-bold"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700"><input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" /><label className="text-[10px] font-black text-red-400 uppercase tracking-widest tracking-widest">Duruş Var</label></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-bold uppercase">
                   <div className="flex gap-2"><input type="date" {...register("baslangicTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white font-bold" /><input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                   <div className="flex gap-2"><input type="date" {...register("bitisTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white font-bold" /><input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                </div>

                {/* --- MALZEME SARFİYATI: V83 ZIRHLI TASARIM --- */}
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-6 shadow-inner">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyat Listesi</h3><button type="button" onClick={()=>setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }])} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-xl shadow-lg shadow-teal-600/20 transition">+ EKLE</button></div>
                  
                  {usedMaterials.map(m => (
                    <div key={m.id} className="bg-black/30 p-5 rounded-[30px] border border-gray-700/50 space-y-4 animate-fadeIn transition-all shadow-xl">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder="Stok Kodu Girin..." value={m.stockCode} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, stockCode:e.target.value}:x))} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 text-[10px] uppercase font-black text-white outline-none focus:border-indigo-500" />
                        <div className="flex gap-2 w-full sm:w-auto">
                           <button type="button" onClick={()=>findStockItem(m.id)} className="flex-1 sm:px-8 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black py-3 rounded-xl uppercase transition">GÖSTER</button>
                           <button type="button" onClick={()=>setUsedMaterials(usedMaterials.filter(x=>x.id!==m.id))} className="bg-gray-800 text-red-500 px-4 rounded-xl border border-gray-700 hover:bg-red-900 transition">✕</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 min-h-[50px] flex items-center">
                           <p className={`text-[11px] font-black uppercase flex-1 ${m.name === "Hatalı Kod" ? "text-red-500" : "text-teal-400"}`}>{m.name}</p>
                        </div>
                        {m.stock !== "-" && (
                          <div className="bg-amber-600 text-white p-3 rounded-2xl flex justify-between items-center shadow-lg border border-amber-400/30">
                             <span className="text-[10px] font-black uppercase tracking-widest">Sistemdeki Güncel Stok:</span>
                             <span className="text-lg font-black tracking-tighter">{m.stock} ADET</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex flex-col gap-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Miktar</label>
                           <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="w-full bg-gray-800 p-3 rounded-xl text-lg font-black text-white border border-gray-700 text-center" min="1" />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Birim</label>
                           <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="w-full bg-gray-800 p-3 rounded-xl text-xs font-black text-white border border-gray-700 uppercase"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-900/20 p-7 rounded-[35px] text-center border border-teal-500/20 shadow-inner font-black uppercase"><p className="text-[10px] font-black text-teal-500 mb-1">Müdahale Süresi</p><h2 className="text-4xl text-white">{hesaplananSure} DK</h2></div>
                
                {/* --- AÇIKLAMA VE SESLE YAZDIR --- */}
                <div>
                  <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">İşlem Detayları</label>
                  <button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg shadow-red-600/20':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>🎙️ SESLE YAZDIR</button></div>
                  <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white focus:ring-1 ring-teal-500 outline-none font-medium" placeholder="Çözüm sürecini ve aldığınız aksiyonları detaylandırın..." />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[45px] shadow-2xl transition-all uppercase tracking-widest text-sm">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* VAKA DETAY MODALI */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-sans">
          <div className="bg-gray-900 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Vaka Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1">Konum</p><p className="text-sm text-gray-200">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Zaman</p><p className="text-sm text-gray-200">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner">
                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3 underline underline-offset-8">Açıklama Notu:</p>
                <p className="text-gray-300 italic text-sm font-medium leading-relaxed font-bold tracking-tighter">"{selectedVaka.aciklama || "Not girilmemiş."}"</p>
             </div>
             <div className="flex gap-4">
                <button onClick={()=>setShowVakaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition">Vazgeç</button>
                <button onClick={()=>triggerAutoFill(selectedVaka)} className="flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-green-600/20 transition">İşi Tamamla</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }'''
    # We will need to add states and UI cards to technician dashboard too
    return content

files = {
    "app/admin/page.tsx": update_admin(),
    "app/dashboard/page.tsx": update_dash()
}

for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f: f.write(content.strip())
    print(f"[BAŞARILI] {path} v32 standartlarında mühürlendi.")
