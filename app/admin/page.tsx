
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
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  // Monitoring States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  // Main Filters
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  // Energy Filters
  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");

  // Detailed Personnel Matrix Filters
  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  // KPI & Graph Data
  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // Bad Actors
  const [filterEqLimit, setFilterEqLimit] = useState("5"); 
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  // RCA Modal
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
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role); setUserName(userSnap.data().name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
            setIsAdmin(true); fetchIlkVeriler(); fetchRcaData();
          } else { window.location.href = "/dashboard"; }
        }
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchRcaData = async () => {
    try {
      const snap = await getDocs(collection(db, "root_cause_analysis"));
      setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (e) { console.error(e); }
  };

  const fetchIlkVeriler = async () => {
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım").slice(0, 5));

      const eSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

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
    let tDurus=0, tIs=0, tSure=0, dAdet=0;
    const hData:any = {}, dData:any = {}, pAnaliz:any = {}, eqData:any = {};
    const tumP = new Set<string>();

    rawLogs.forEach(l => {
      const date = l.kayitTarihi?.toDate();
      const yil = date?.getFullYear().toString();
      const ay = (date?.getMonth() + 1).toString();
      const sure = Number(l.toplamSureDakika) || 0;

      // Bad Actors Logic
      if (l.isDuruslu) {
        if (!eqData[l.ekipmanAdi]) eqData[l.ekipmanAdi] = { count: 0, sure: 0 };
        eqData[l.ekipmanAdi].count++; eqData[l.ekipmanAdi].sure += sure;
      }

      // Chart & KPI Filtering
      if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterHat || l.hatAdi === filterHat)) {
        tIs++; tSure += sure;
        hData[l.hatAdi] = (hData[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) { tDurus += sure; dAdet++; dData[l.hatAdi] = (dData[l.hatAdi] || 0) + sure; }
      }

      // Detailed Personnel Matrix Filtering
      const isEkibi = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      isEkibi.forEach((p: string) => {
        tumP.add(p);
        if ((!filterPerfYil || yil === filterPerfYil) && (!filterPerfAy || ay === filterPerfAy) && (!filterPerfVardiya || l.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
           if (!pAnaliz[p]) pAnaliz[p] = { isSayisi: 0, eforDk: 0 };
           pAnaliz[p].isSayisi++; pAnaliz[p].eforDk += sure;
        }
      });
    });

    setKpiToplamIs(tIs); setKpiToplamSure(tSure); setKpiAylikDurus(tDurus); setKpiDurusluIsSayisi(dAdet);
    setGrafikTumIslerVerisi(Object.keys(hData).map(k=>({ isim: k, adet: hData[k] })));
    setGrafikDurusVerisi(Object.keys(dData).map(k=>({ isim: k, dakika: dData[k] })));
    setPersonelHavuzu(Array.from(tumP).sort());
    setPersonelPerformans(Object.keys(pAnaliz).map(k=>({ isim: k, ...pAnaliz[k] })).sort((a,b)=> filterPerfSiralama === "efor" ? b.eforDk - a.eforDk : b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eqData).map(k=>({ ekipman: k, ...eqData[k] })).sort((a,b)=>b.count-a.count).slice(0, Number(filterEqLimit)));
  }, [rawLogs, filterYil, filterAy, filterHat, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterPerfSiralama, filterEqLimit]);

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const elekS = new Set<string>(), dogS = new Set<string>(), suS = new Set<string>();
    const tElek:any = {}, tDog:any = {}, tSu:any = {};
    rawMeterLogs.forEach(l => {
      const tip = l.tip || "Elektrik";
      if(tip==="Elektrik") elekS.add(l.sayacAdi); if(tip==="Doğalgaz") dogS.add(l.sayacAdi); if(tip==="Su") suS.add(l.sayacAdi);
      const ay = `${l.tarih.split("-")[1]}. Ay`;
      if(tip==="Elektrik" && (!filterElektrikSayac || l.sayacAdi===filterElektrikSayac)) tElek[ay] = (tElek[ay]||0) + Number(l.deger || 0);
      if(tip==="Doğalgaz" && (!filterDogalgazSayac || l.sayacAdi===filterDogalgazSayac)) tDog[ay] = (tDog[ay]||0) + Number(l.deger || 0);
      if(tip==="Su" && (!filterSuSayac || l.sayacAdi===filterSuSayac)) tSu[ay] = (tSu[ay]||0) + Number(l.deger || 0);
    });
    setElektrikSayacListesi(Array.from(elekS).sort()); setDogalgazSayacListesi(Array.from(dogS).sort()); setSuSayacListesi(Array.from(suS).sort());
    setGrafikElektrik(Object.keys(tElek).map(ay=>({ ay, tuketim: tElek[ay] })));
    setGrafikDogalgaz(Object.keys(tDog).map(ay=>({ ay, tuketim: tDog[ay] })));
    setGrafikSu(Object.keys(tSu).map(ay=>({ ay, tuketim: tSu[ay] })));
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase">Giriş Yetkisi Bulunamadı</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><h1 className="text-2xl font-black uppercase tracking-tighter">DFU BI PANEL</h1></div>
          <div className="flex gap-3 no-print">
            <button onClick={()=>{if(window.confirm("RESET?")) { /* factory reset logic */ }}} className="bg-red-950 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-red-900/40">Sistemi Sıfırla</button>
            <Link href="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Vardiya Raporu</Link>
            <button onClick={()=>auth.signOut()} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Çıkış</button>
          </div>
        </div>

        {/* 22+ BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10 no-print">
          {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center">🚨 Yeni İş Emri</Link>)}
          <Link href="/admin/aktif-isler" className="bg-red-900/60 border border-red-500/50 p-3 rounded-xl font-bold text-xs text-center">Aktif İş Emirleri</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center tracking-tighter">🗄️ Tamamlanan İşler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center">📢 İSG Duyuru</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Hat / Ekipman</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-kayit" className="bg-indigo-700 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Kayıt</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-xl font-semibold text-xs text-center border border-gray-600 text-[10px]">🗄️ Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center">✅ Kontrol Formları</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-xl font-bold text-xs text-center">🗄️ PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-xl font-black text-xs text-center shadow-lg">🛠️ Manuel PM Başlat</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">📋 Yapılan İşler</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center">⏰ Mesai Raporları</Link>
        </div>

        {/* ALARMS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           {aktifIsgAlarmlari.length > 0 && <div className="bg-red-950/30 border-2 border-red-600 p-5 rounded-3xl animate-pulse"><p className="text-xs font-black text-red-500 mb-2 uppercase tracking-widest">⚠️ KRİTİK İSG (KAR):</p>{aktifIsgAlarmlari.map(a=>(<div key={a.id} className="text-sm font-bold">• {a.hatAdi} - {a.ekipmanAdi}</div>))}</div>}
           {aktifPmAlarmlari.length > 0 && <div className="bg-teal-900/20 border border-teal-500/30 p-5 rounded-3xl"><p className="text-xs font-black text-teal-400 mb-2 uppercase tracking-widest">📅 PM GÜNÜ GELENLER:</p>{aktifPmAlarmlari.map(a=>(<div key={a.id} className="text-sm font-bold">• {a.hatAdi} - {a.ekipmanAdi}</div>))}</div>}
        </div>

        {/* RCA TABLE */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-[40px] mb-12 shadow-2xl">
            <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-2 uppercase">🧠 Kök Neden Analizi Bekleyenler</h2>
            <div className="space-y-4">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-5 rounded-[25px] flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50 transition">
                    <div className="flex-1"><p className="text-[10px] text-gray-500 uppercase font-bold">{log.hatAdi} | {log.id}</p><p className="font-bold text-gray-100">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p></div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'}`}>{hasRca ? "Güncelle" : "Analiz Et"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-lg"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-4xl font-black text-green-400">{kpiToplamIs}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800 shadow-lg"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruş Sayısı</p><h3 className="text-4xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-lg"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Kayıp Süre</p><h3 className="text-4xl font-black text-indigo-400">{kpiAylikDurus} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-purple-900/30 shadow-lg"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">Tesis MTTR</p><h3 className="text-4xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs || 0).toFixed(0)} dk</h3></div>
        </div>

        {/* ENERGY SECTION WITH FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase">⚡ Elektrik (kWh)</h2>
             <select value={filterElektrikSayac} onChange={e=>setFilterElektrikSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{elektrikSayacListesi.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElektrik}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-red-400 mb-4 uppercase">🔥 Doğalgaz (m³)</h2>
             <select value={filterDogalgazSayac} onChange={e=>setFilterDogalgazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{dogalgazSayacListesi.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDogalgaz}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase">💧 Su (Ton)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-[10px] mb-4 text-white"><option value="">Tüm Sayaçlar</option>{suSayacListesi.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* DETAILED PERSONNEL PERFORMANCE MATRIX */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-blue-400 mb-6 uppercase tracking-widest flex items-center gap-2">👤 Personel Performans Matrisi</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 no-print bg-gray-800/30 p-5 rounded-2xl border border-gray-700/50">
             <div><label className="text-[9px] text-gray-500 uppercase font-bold ml-1">Yıl</label><select value={filterPerfYil} onChange={e=>setFilterPerfYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] text-white"><option value="">Tümü</option>{yilListesi.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
             <div><label className="text-[9px] text-gray-500 uppercase font-bold ml-1">Ay</label><select value={filterPerfAy} onChange={e=>setFilterPerfAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] text-white"><option value="">Tümü</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m}. Ay</option>)}</select></div>
             <div><label className="text-[9px] text-gray-500 uppercase font-bold ml-1">Vardiya</label><select value={filterPerfVardiya} onChange={e=>setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] text-white"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
             <div><label className="text-[9px] text-gray-500 uppercase font-bold ml-1">Tip</label><select value={filterPerfDurus} onChange={e=>setFilterPerfDurus(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] text-white"><option value="">Hepsi</option><option value="durus">Duruşlu</option><option value="normal">Normal</option></select></div>
             <div><label className="text-[9px] text-blue-400 uppercase font-black ml-1">Sıralama</label><select value={filterPerfSiralama} onChange={e=>setFilterPerfSiralama(e.target.value)} className="w-full bg-indigo-900/50 border border-indigo-500/30 rounded-xl p-2 text-[10px] text-white font-black"><option value="is">İş Sayısı</option><option value="efor">Toplam Efor</option></select></div>
          </div>

          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-xs uppercase font-black tracking-widest"><tr><th className="pb-4">Teknisyen</th><th className="pb-4">İş Sayısı</th><th className="pb-4">Efor (dk)</th><th className="pb-4">MTTR (Ort)</th></tr></thead><tbody className="text-sm font-medium">{personelPerformans.slice(0,10).map((p,i)=>(<tr key={i} className="border-b border-gray-800/50 hover:bg-white/5 transition"><td className="py-4 text-gray-200">{i<3? "🥇 ":" "}{p.isim}</td><td className="py-4 text-green-400 font-black">{p.isSayisi} Adet</td><td className="py-4">{p.eforDk} dk</td><td className="py-4 text-indigo-400 font-bold">{(p.eforDk/p.isSayisi).toFixed(1)} dk</td></tr>))}</tbody></table></div>
        </div>

        {/* BAD ACTORS TABLE */}
        <div className="bg-gray-900 border border-red-900/30 p-8 rounded-[40px] shadow-2xl mb-12">
          <h2 className="text-xl font-black text-red-500 mb-6 uppercase tracking-tighter">⚠️ En Sık Arıza Yapanlar (Bad Actors)</h2>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-xs uppercase font-black tracking-widest"><tr><th className="pb-4">Ekipman</th><th className="pb-4">Arıza Sayısı</th><th className="pb-4">Toplam Duruş</th></tr></thead><tbody className="text-sm font-medium">{ekipmanPerformans.map((eq,i)=>(<tr key={i} className="border-b border-gray-800/50"><td className="py-4 text-gray-200 font-bold">{eq.ekipman}</td><td className="py-4 text-red-400 font-black">{eq.count} Kez</td><td className="py-4 font-black">{eq.sure} dk</td></tr>))}</tbody></table></div>
        </div>

        {/* BOTTOM CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest">📉 Kök Neden Analizi (Pareto)</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name: c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl"><h2 className="text-sm font-black text-teal-400 mb-6 uppercase tracking-widest">⚡ Hat Bazlı İş Yoğunluğu</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><YAxis tick={{fontSize:10, fill:'#6B7280'}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></div>
        </div>

      </div>

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter tracking-widest">Arıza Kök Neden Analizi</h2>
            <p className="text-xs text-gray-500 mb-8 uppercase font-bold tracking-widest">{selectedLogForRca?.ekipmanAdi} | {selectedLogForRca?.toplamSureDakika} dk Duruş</p>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>( <button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl':'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-500'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruşun nedenini ve kalıcı aksiyon planını detaylandırın..." className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-[20px] font-black text-gray-400 text-xs uppercase tracking-widest">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-600/30 text-xs uppercase tracking-widest">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
