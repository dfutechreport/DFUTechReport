"use client";
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
  
  // DATA STATES
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  // MONITORING
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);

  // INSPECTION MODALS
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);

  // FILTERS
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [yilListesi, setYilListesi] = useState<string[]>([]);

  // ENERGY FILTERS
  const [elekSayacList, setElekSayacList] = useState<string[]>([]);
  const [gazSayacList, setGazSayacList] = useState<string[]>([]);
  const [suSayacList, setSuSayacList] = useState<string[]>([]);
  const [filterElekSayac, setFilterElekSayac] = useState("");
  const [filterGazSayac, setFilterGazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");

  // PERSONNEL MATRIX FILTERS
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  // OUTPUTS
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // RCA
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

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
          const role = userData.role;
          setUserRole(role); 
          setUserName(userData.name); // FIXED: userSnap used instead of snap
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
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
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık"), orderBy("kayitTarihi", "desc")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım"));

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawLogs(logs);

      const mSnap = await getDocs(query(collection(db, "meter_logs"), orderBy("tarih", "asc")));
      setRawMeterLogs(mSnap.docs.map(d => d.data()));

      const aSnap = await getDocs(collection(db, "assets"));
      const uniqueHats = new Set<string>();
      aSnap.docs.forEach(d => { if (d.data().hatAdi) uniqueHats.add(d.data().hatAdi); });
      setHatListesi(Array.from(uniqueHats).sort());

      const yillar = new Set<string>();
      logs.forEach(l => { if (l.kayitTarihi) yillar.add(l.kayitTarihi.toDate().getFullYear().toString()); });
      setYilListesi(Array.from(yillar).sort());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, pD:any = {}, eD:any = {}, pNames = new Set<string>();

    rawLogs.forEach(l => {
      const date = l.kayitTarihi?.toDate();
      const y = date?.getFullYear().toString();
      const a = (date?.getMonth() + 1).toString();
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
    alert("Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white rounded p-1" /><div><h1 className="text-xl font-black uppercase tracking-tighter">DFU Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{userName}</p></div></div>
          <div className="flex gap-3 no-print">
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700">Vardiya Raporu</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Çıkış</button>
          </div>
        </div>

        {/* 22+ BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl font-bold text-xs text-center">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center tracking-tighter">🔒 EKED Takip</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full animate-bounce">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-xl font-bold text-xs text-center border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center">📅 PM Takvimi</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center">⏰ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center">🗄️ Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Hat/Ekipman</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-xl font-black text-xs text-center">🛠️ Manuel PM</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center">📢 İSG Duyuru</Link>
        </div>

        {/* ALARM & NOTIFICATION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-gray-900 border-2 border-red-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-red-950/20 border border-red-900/30 p-5 rounded-[25px] flex justify-between items-center group transition">
                    <div><p className="text-[10px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-sm font-bold text-gray-100">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-5 py-2 rounded-xl">Detay</button>
                  </div>
                ))}
              </div>
           </div>
           <div className="bg-gray-900 border-2 border-indigo-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-indigo-950/20 border border-indigo-900/30 p-5 rounded-[25px] flex justify-between items-center transition">
                    <div><p className="text-[10px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-sm font-bold text-gray-100">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[10px] font-black px-5 py-2 rounded-xl">Detay</button>
                  </div>
                ))}
              </div>
           </div>
        </div>

        {/* RCA TASK LIST */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">🧠 RCA Analizi Bekleyenler</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
              const hasRca = rcaLogs.find(r => r.logId === log.id);
              return (
                <div key={idx} className="bg-gray-800/40 p-6 rounded-[30px] border border-gray-700/50 flex flex-col justify-between h-full hover:border-indigo-500/50 transition">
                  <div><p className="text-[10px] font-bold text-gray-500 uppercase">{log.hatAdi}</p><p className="font-bold text-gray-200">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 uppercase">{log.toplamSureDakika} dk Kayıp</p></div>
                  <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3 mt-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white'}`}>Analiz Yap</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* KPI SECTION */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase">
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-3xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-3xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-red-900/20 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1">Duruş</p><h3 className="text-3xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-indigo-900/20 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-3xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        {/* ENERGY CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase">⚡ Elektrik (kWh)</h2>
             <select value={filterElekSayac} onChange={e=>setFilterElekSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{elekSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-red-400 mb-4 uppercase">🔥 Doğalgaz (m³)</h2>
             <select value={filterGazSayac} onChange={e=>setFilterGazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{gazSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikGaz}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase">💧 Su (Ton)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* PERSONNEL PERFORMANCE MATRIX */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[45px] mb-12 shadow-2xl">
           <h2 className="text-xl font-black text-blue-400 mb-8 uppercase tracking-widest flex items-center gap-3">👤 PERSONEL PERFORMANS MATRİSİ</h2>
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 bg-gray-800/40 p-6 rounded-[25px] border border-gray-700/50 no-print">
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block">Yıl</label><select value={filterYil} onChange={e=>setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Tümü</option>{yilListesi.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block">Vardiya</label><select value={filterPerfVardiya} onChange={e=>setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block">Teknisyen</label><select value={filterPerfPersonel} onChange={e=>setFilterPerfPersonel(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Tüm Ekip</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block">Tip</label><select value={filterPerfDurus} onChange={e=>setFilterPerfDurus(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Hepsi</option><option value="durus">Duruşlu</option><option value="normal">Normal</option></select></div>
              <div><label className="text-[9px] text-blue-400 uppercase font-black mb-1 block">Sıra</label><select value={filterPerfSiralama} onChange={e=>setFilterPerfSiralama(e.target.value)} className="w-full bg-indigo-950 border border-indigo-500/30 rounded-xl p-2 text-xs text-white font-black"><option value="is">İş Sayısı</option><option value="efor">En Çok Efor</option></select></div>
           </div>
           <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest"><tr><th className="pb-4">İsim</th><th className="pb-4">Top. İş</th><th className="pb-4">Top. Efor</th><th className="pb-4 text-blue-400">MTTR (Ort)</th></tr></thead><tbody className="text-sm">{personelPerformans.slice(0,10).map((p,i)=>(<tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition"><td className="py-4 font-bold text-gray-200">{p.isim}</td><td className="py-4 text-green-400 font-black">{p.isSayisi}</td><td className="py-4 font-bold">{p.eforDk} dk</td><td className="py-4 text-indigo-400 font-black">{(p.eforDk/p.isSayisi || 0).toFixed(1)} dk</td></tr>))}</tbody></table></div>
        </div>

      </div>

      {/* INSPECTION MODAL */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-[50px] w-full max-w-2xl shadow-3xl relative">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Vaka Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1">Konum</p><p className="text-sm text-gray-200">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Bildiren</p><p className="text-sm text-gray-200">{selectedVaka.bildirenKisi || "Sistem"}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Zaman</p><p className="text-sm text-gray-200">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Etki</p><p className={selectedVaka.isDuruslu ? "text-red-500 text-sm" : "text-green-500 text-sm"}>{selectedVaka.isDuruslu ? "Duruşlu" : "Normal"}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10"><p className="text-[10px] text-indigo-400 uppercase font-black mb-3">Açıklama:</p><p className="text-gray-300 italic text-sm italic">"{selectedVaka.aciklama || "Not yok."}"</p></div>
             <button onClick={()=>setShowVakaModal(false)} className="w-full bg-gray-800 py-4 rounded-2xl font-black uppercase text-xs">Pencereyi Kapat</button>
          </div>
        </div>
      )}

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest text-center">Root Cause Analysis</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>( <button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/30':'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-400'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruşun nedenini ve aksiyon planını detaylandırın..." className="w-full bg-gray-800 border-gray-800 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-[20px] font-black text-gray-400 tracking-widest text-xs uppercase">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-600/30 tracking-widest text-xs uppercase">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
