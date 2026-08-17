
import os
import re

# Logo yerleştirme fonksiyonu
def add_logo(c):
    if not c or '/dfulogo.png' in c: return c
    logo = '<img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" />'
    pats = [(r'(<h1.*?>.*?</h1>)', r'<div className="flex items-center gap-4">' + logo + r'\1</div>'), 
            (r'(<h2.*?>.*?</h2>)', r'<div className="flex items-center gap-4">' + logo + r'\1</div>')]
    for p, r in pats:
        if re.search(p, c): return re.sub(p, r, c, count=1)
    return c

files = {
    "app/admin/page.tsx": r'''"use client";
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
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [showIsgModal, setShowIsgModal] = useState(false);
  const [selectedEked, setSelectedEked] = useState<any>(null);

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
      const ekedSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
      setAktifEked(ekedSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

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

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`KOMUTA MERKEZİ BAŞLATILIYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase italic tracking-tighter">YETKİSİZ ERİŞİM!</div>;return (
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
        {/* BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          {userRole === "isg" ? (
            <>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-xl font-bold text-xs text-center">🗄️ EKED Arşivi</Link>
              <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
              <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">📢 İSG Duyuru</Link>
            </>
          ) : (
            <>
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
              <button onClick={()=>{if(window.confirm("RESET?")){/*reset*/}}} className="bg-red-950 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase border border-red-900/30 transition">Reset</button>
            </>
          )}
        </div>
        {/* 3-COLUMN NOTIFICATION GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           {/* EKED (LOTO) ALARMLARI */}
           <div className="bg-gray-900 border-2 border-yellow-600/40 p-7 rounded-[40px] shadow-2xl relative overflow-hidden group">
              {aktifEked.length > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-600/10 blur-3xl animate-pulse"></div>}
              <h2 className="text-lg font-black text-yellow-500 mb-6 flex items-center gap-3 uppercase tracking-[0.2em]">
                🔒 AKTİF EKED (LOTO) 
                {aktifEked.length > 0 && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span></span>}
              </h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifEked.map((e, idx) => (
                  <div key={idx} className="bg-yellow-950/10 border border-yellow-600/20 p-5 rounded-[25px] flex justify-between items-center transition group hover:bg-yellow-600/20 border-l-4 border-l-yellow-600">
                    <div>
                      <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">{e.yer}</p>
                      <p className="text-sm font-bold text-gray-100">{e.personelName}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{e.tarih}</p>
                    </div>
                    <button onClick={() => { setSelectedEked(e); setShowEkedModal(true); }} className="bg-yellow-600 text-black text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-lg transition uppercase tracking-widest hover:scale-105">İncele</button>
                  </div>
                ))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Aktif kilitli sistem yok.</p>}
              </div>
           </div>

           {/* ISG ALARMLARI */}
           <div className="bg-gray-900 border-2 border-red-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-3 uppercase tracking-[0.2em]">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-red-950/20 border border-red-900/30 p-5 rounded-[25px] flex justify-between items-center transition group hover:bg-red-900/30">
                    <div><p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{a.hatAdi}</p><p className="text-sm font-bold text-gray-100">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-6 py-2.5 rounded-2xl shadow-lg transition uppercase tracking-widest">Detay</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Aktif İSG alarmı yok.</p>}
              </div>
           </div>

           {/* SAHA BİLDİRİMLERİ */}
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
{userRole !== "isg" && (
  <>
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

        {/* ENERGY CHARTS */}
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
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase tracking-widest underline underline-offset-8">💧 Su (m³)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10}}/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* PERFORMANCE & ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] shadow-2xl">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest">🏆 Personel Performans Matrisi</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs uppercase font-bold"><thead className="text-gray-500 border-b border-gray-800"><tr><th className="py-4">Personel</th><th className="py-4">İş Sayısı</th><th className="py-4">Toplam Efor</th></tr></thead><tbody className="divide-y divide-gray-800">{personelPerformans.map((p,i)=><tr key={i} className="hover:bg-gray-800/30 transition"><td className="py-4 text-gray-200">{p.isim}</td><td className="py-4 text-green-400">{p.isSayisi}</td><td className="py-4 text-indigo-400">{p.eforDk} dk</td></tr>)}</tbody></table></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] shadow-2xl text-center">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest">🛑 En Çok Duruş Yapan Ekipmanlar</h2>
            <div className="space-y-4">{ekipmanPerformans.map((e,i)=>(<div key={i} className="flex justify-between items-center bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50"><span className="text-gray-300 font-bold">{e.ekipman}</span><div className="text-right"><span className="text-red-400 font-black block">{e.sure} dk</span><span className="text-[10px] text-gray-500">{e.count} Arıza</span></div></div>))}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2>
             <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
           </div>
           <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-teal-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">⚡ Hat Bazlı İş Yoğunluğu</h2>
             <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikIsHatti}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
           </div>
        </div>
  </>
)}
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

      {/* EKED DETAY MODAL */}
      {showEkedModal && selectedEked && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-500/30 w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative">
            <button onClick={() => { setShowEkedModal(false); setSelectedEked(null); }} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl">✕</button>
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-yellow-600 p-4 rounded-3xl text-black"><span className="text-3xl">🔒</span></div>
              <div><h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest">EKED Detay Bilgisi</h2><p className="text-gray-500 text-[10px] font-black uppercase">LOTO Güvenlik Kilidi</p></div>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 p-5 rounded-3xl border border-gray-700"><p className="text-[9px] text-gray-500 font-black uppercase">Konum</p><p className="text-lg font-bold text-white">{selectedEked.yer}</p></div>
                <div className="bg-gray-800/50 p-5 rounded-3xl border border-gray-700"><p className="text-[9px] text-gray-500 font-black uppercase">Tarih</p><p className="text-lg font-bold text-white">{selectedEked.tarih}</p></div>
              </div>
              <div className="bg-gray-800/50 p-5 rounded-3xl border border-gray-700"><p className="text-[9px] text-gray-500 font-black uppercase">Sorumlu Personel</p><p className="text-lg font-bold text-yellow-500">{selectedEked.personelName || "Belirtilmemiş"}</p></div>
              <div className="bg-gray-800/50 p-5 rounded-3xl border border-gray-700"><p className="text-[9px] text-gray-500 font-black uppercase">Açıklama</p><p className="text-gray-300 text-sm">{selectedEked.aciklama || "Açıklama yok."}</p></div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowEkedModal(false)} className="flex-1 bg-gray-800 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Kapat</button>
                <Link href="/admin/eked" className="flex-1 bg-yellow-600 text-black py-4 rounded-2xl font-black uppercase text-[10px] text-center flex items-center justify-center tracking-widest hover:bg-yellow-500 transition">Aktif Kilitler Listesini Aç</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}''',
    "app/dashboard/page.tsx": r'''"use client";
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
        if (part?.id) { 
          const yeniMiktar = (Number(part.mevcutMiktar) || 0) - Number(mat.quantity);
          await updateDoc(doc(db, "spare_parts", part.id), { mevcutMiktar: yeniMiktar }); 
          
          // KRİTİK STOK MAİL TETİKLEYİCİ
          if (yeniMiktar <= 2) {
            try {
              await fetch('/api/send-mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  parcaAdi: part.parcaAdi,
                  stokKodu: part.stokKodu || part.id,
                  kalanStok: yeniMiktar,
                  birim: part.birim || "Adet",
                  teknisyen: userName || "Teknisyen",
                  hat: formData.hatAdi || "Genel",
                  ekipman: formData.ekipmanAdi || "Genel"
                }),
              });
            } catch (mailErr) { console.error("Kritik stok maili gönderilemedi:", mailErr); }
          }
        }
      }
      if (formData.linkedOrderId) { await updateDoc(doc(db, "work_orders", formData.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() }); }
      alert("Rapor Kaydedildi."); window.location.reload();
    } catch (e: any) { alert("Hata: " + e.message); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`SİSTEM VERİLERİ SENKRONİZE EDİLYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase tracking-tighter">{userName}</p></div></div>
           <div className="flex flex-wrap gap-2">
             {(userRole === "admin" || userRole === "operator") && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition tracking-widest">Admin Panel</Link>)}
             
             <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest hover:bg-cyan-500">✅ Kontrol Formları</Link>
             <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest hover:bg-emerald-500">🛠️ Manuel PM</Link>
             <Link href="/admin/eked" className="bg-yellow-600 text-black text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest hover:bg-yellow-500">🔒 EKED Uygula</Link>
             <Link href="/dashboard/pano-listesi" className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest hover:bg-indigo-500">🔌 Pano Temizliği</Link>
             <Link href="/dashboard/sayac" className="bg-blue-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition tracking-widest hover:bg-blue-500">⚡ Sayaç Okuma</Link>
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
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }''',
    "app/admin/yedek-parca/page.tsx": r'''"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, writeBatch, setDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import * as XLSX from 'xlsx';

export default function YedekParcaYonetimi() {
  const [yedekParcalar, setYedekParcalar] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  
  const [progress, setProgress] = useState(0);
  const [lastUploadTime, setSonYuklemeZamani] = useState<any>(null);
  const [timeLeft, setKalanSure] = useState("");
  const [smartSearchQuery, setSmartSearchQuery] = useState("");
  const [smartSearchResults, setSmartSearchResults] = useState<any[]>([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [isFetchingUsage, setIsFetchingUsage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name); setUserRole(userSnap.data().role); }
        await initialSync();
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const initialSync = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "spare_parts"));
      const snap = await getDocs(q);
      setYedekParcalar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const sysSnap = await getDoc(doc(db, "system_logs", "excel_upload"));
      if (sysSnap.exists()) { setSonYuklemeZamani(sysSnap.data().lastUpload?.toDate()); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!lastUploadTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const lockTime = new Date(lastUploadTime).getTime() + (24 * 60 * 60 * 1000);
      const diff = lockTime - now;
      if (diff <= 0) { setKalanSure(""); clearInterval(interval); }
      else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setKalanSure(`${h}s ${m}d ${s}sn`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUploadTime]);

  const handleSmartLookup = () => {
    const s = smartSearchQuery.trim().toUpperCase();
    if (!s) return;
    const matches = yedekParcalar.filter(p => 
      String(p.id).toUpperCase().includes(s) || 
      (p.stokKodu && String(p.stokKodu).toUpperCase().includes(s)) ||
      (p.parcaAdi && String(p.parcaAdi).toUpperCase().includes(s))
    );
    setSmartSearchResults(matches);
  };

  const handleExcelUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const total = data.length; let processed = 0; const CHUNK = 400;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = data.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach((item: any) => {
          const code = item.stokKodu || item.stockCode || item.id;
          if(code) { batch.set(doc(db, "spare_parts", String(code)), item, { merge: true }); }
        });
        await batch.commit(); processed += chunk.length;
        setProgress(Math.floor((processed / total) * 100));
      }
      const now = new Date();
      await setDoc(doc(db, "system_logs", "excel_upload"), { lastUpload: now, uploadedBy: userName });
      setSonYuklemeZamani(now); setProgress(0);
      alert("Master Stok Güncellendi.");
      initialSync();
    };
    reader.readAsBinaryString(file);
  };

  const fetchUsageHistory = async () => {
    setIsFetchingUsage(true);
    try {
      const logsSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"), limit(400)));
      const usageList: any[] = [];
      logsSnap.forEach(d => {
        const data = d.data();
        const common = {
          tarih: data.baslangicTarihi || (data.kayitTarihi ? data.kayitTarihi.toDate().toLocaleDateString('tr-TR') : "-"),
          personel: data.bildirenKisi || "Sistem",
          makine: data.ekipmanAdi || "-"
        };
        if (data.kullanilanMalzemeler && Array.isArray(data.kullanilanMalzemeler)) {
          data.kullanilanMalzemeler.forEach((m: any) => {
            usageList.push({ ...common, stockCode: m.stockCode || m.stokKodu || "-", name: m.name || m.parcaAdi || "-", quantity: m.quantity || m.miktar || 0, unit: m.unit || m.birim || "Adet" });
          });
        }
        if (data.yedekParcaKodu && data.yedekParcaKodu !== "") {
          usageList.push({ ...common, stockCode: data.yedekParcaKodu, name: data.parcaAdi || "Orijinal Kayıt", quantity: data.yedekParcaMiktar || 1, unit: data.birim || "Adet" });
        }
      });
      setUsedMaterials(usageList);
      setIsDataFetched(true);
      if (usageList.length === 0) alert("Sarfiyat kaydı bulunamadı.");
    } catch (e) { console.error(e); alert("Hata oluştu."); }
    setIsFetchingUsage(false);
  };

  const exportUsageExcel = () => {
    let csv = "uFEFF" + "Tarih;Makine;Personel;Kod;Malzeme;Miktar;Birim\n";
    usedMaterials.forEach(m => { csv += `${m.tarih};${m.makine};${m.personel};${m.stockCode};${m.name};${m.quantity};${m.unit}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.body.appendChild(document.createElement("a"));
    link.href = URL.createObjectURL(blob); link.download = "DFU_Sarfiyat_Raporu.csv"; link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`DEPO VERİLERİ YÜKLENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  
  const handleExcelIndir = () => {
    try {
      const dataToExport = yedekParcalar
        .filter(p => !p.parcaAdi?.toLowerCase().includes("pasif"))
        .map(p => ({
          "Stok Kodu": p.stokKodu || p.id,
          "Parça Adı": p.parcaAdi || "-",
          "Mevcut Miktar": p.mevcutMiktar || 0,
          "Birim": p.birim || "Adet",
          "Durum": (Number(p.mevcutMiktar) <= 2) ? "KRİTİK" : "NORMAL"
        }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Güncel Stok");
      XLSX.writeFile(workbook, `DFU_Master_Stok_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert("Excel dökümü alınırken bir hata oluştu.");
    }
  };

return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* EXCEL INDIRME BUTONU - SAYFA BASI KESIN KONUM */}
        <div className="flex justify-end mb-6 no-print pt-4">
          <button 
            onClick={handleExcelIndir} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-[25px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center gap-3 border-2 border-emerald-400/20 active:scale-95"
          >
            <span className="text-2xl">📊</span> GÜNCEL MASTER STOK LİSTESİNİ İNDİR (EXCEL)
          </button>
        </div>

        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6 no-print">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><h1 className="text-xl font-black uppercase tracking-tighter">Yedek Parça & Depo Denetimi</h1></div>
           <Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition">Geri Dön</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 no-print">
           <div className="bg-gray-900 border-2 border-indigo-500/20 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-indigo-400 uppercase tracking-widest">📥 Master Stok Excel Güncelleme</h2>
                {timeLeft && <span className="bg-red-900/30 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black border border-red-900/40 animate-pulse">Kilit: {timeLeft}</span>}
              </div>
              {!timeLeft ? (
                <div className="space-y-4">
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-6 text-sm font-black text-gray-400 cursor-pointer" />
                  {progress > 0 && <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{width:`${progress}%`}}></div></div>}
                </div>
              ) : (
                <div className="py-10 text-center bg-black/20 rounded-3xl border border-dashed border-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs">Son Yüklemeden Sonra 24 Saat Beklenmelidir.</div>
              )}
           </div>
           <div className="bg-gray-900 border-2 border-teal-500/20 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
              <h2 className="text-lg font-black text-teal-400 mb-6 uppercase tracking-widest">🔍 Hızlı Stok Sorgulama</h2>
              <div className="flex gap-2 mb-8">
                <input type="text" placeholder="Kod veya Malzeme Adı..." value={smartSearchQuery} onChange={e=>setSmartSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSmartLookup()} className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl p-5 text-sm font-bold" />
                <button onClick={handleSmartLookup} className="bg-teal-600 hover:bg-teal-500 px-10 rounded-2xl font-black transition">GÖSTER</button>
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {smartSearchResults.map((p, i) => (
                  <div key={i} className="bg-black/40 border border-gray-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1"><p className="text-[10px] text-gray-500 uppercase font-black">Malzeme:</p><p className="text-sm font-black text-white uppercase">{p.parcaAdi || p.name || "İsimsiz"}</p><p className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">KOD: {p.stokKodu || p.id}</p></div>
                    <div className="bg-amber-600 text-white px-8 py-3 rounded-xl flex flex-col items-center shadow-lg min-w-[140px] border border-amber-400/30"><span className="text-[8px] font-black uppercase tracking-widest">Mevcut Stok</span><span className="text-2xl font-black">{p.mevcutMiktar ?? p.stock ?? 0}</span></div>
                  </div>
                ))}
              </div>
           </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-2xl">
           <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">⚙️ Malzeme Sarfiyat Geçmişi</h2>
              <div className="flex gap-2">
                 <button onClick={fetchUsageHistory} disabled={isFetchingUsage} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase transition shadow-lg">{isFetchingUsage ? "YÜKLENİYOR..." : "VERİLERİ GETİR"}</button>
                 <button onClick={exportUsageExcel} disabled={!isDataFetched || usedMaterials.length === 0} className="bg-green-700 hover:bg-green-600 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase transition shadow-lg disabled:opacity-20">EXCEL ÇIKTISI AL</button>
              </div>
           </div>
           <div className="overflow-x-auto max-h-[450px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="text-gray-600 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest">
                  <tr><th className="pb-5 px-2">Tarih</th><th className="pb-5">Makine</th><th className="pb-5">Malzeme</th><th className="pb-5 text-center">Miktar</th><th className="pb-5 text-right px-4">Personel</th></tr>
                </thead>
                <tbody className="text-xs font-bold uppercase">
                  {usedMaterials.map((m, i) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition">
                      <td className="py-4 px-2 text-gray-500">{m.tarih}</td>
                      <td className="py-4 text-teal-400">{m.makine}</td>
                      <td className="py-4 text-gray-200">{m.name}</td>
                      <td className="py-4 text-center text-white font-black tracking-widest">{m.quantity} {m.unit}</td>
                      <td className="py-4 text-right px-4 text-gray-500 font-normal italic">{m.personel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isDataFetched && <div className="py-20 text-center text-gray-700 font-black uppercase tracking-widest text-[10px]">Görüntülemek için "Verileri Getir" butonuna basın.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}''',
    "app/admin/aktif-isler/page.tsx": r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function AktifIslerListesi() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.kayitTarihi ? d.kayitTarihi.toDate().toLocaleString('tr-TR') : "Bilinmiyor",
          gercekZaman: d.kayitTarihi ? d.kayitTarihi.toDate().getTime() : 0
        };
      });
      setOrders(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
                if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          // ERİŞİM KISITLAMASI: Sadece admin, teknisyen ve operator girebilir.
          if (["admin", "teknisyen", "operator"].includes(role)) {
            setUserRole(role);
            setUserName(userSnap.data().name);
            fetchOrders();
          } else {
            window.location.href = "/dashboard"; 
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Onayladıktan sonra süresini girmek için Arıza Formu otomatik olarak açılacaktır.")) return;

    try {
      await updateDoc(doc(db, "work_orders", islem.id), {
        durum: "Kapalı",
        tamamlayanKisi: userName,
        tamamlanmaTarihi: new Date()
      });
      window.location.href = `/dashboard?hat=${encodeURIComponent(islem.hatAdi)}&ekipman=${encodeURIComponent(islem.ekipmanAdi)}&sorun=${encodeURIComponent(islem.sorunTipi)}&duruslu=${islem.isDuruslu ? 'true' : 'false'}&aciklama=${encodeURIComponent(islem.aciklama)}`;
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu iş emrini iptal edip SİLMEK istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "work_orders", id)); fetchOrders(); } catch (error) { alert("Hata"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`AKTİF İŞLER LİSTELENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-red-500 flex items-center gap-3">
              <span className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
              </span>
              Tüm Aktif İş Emirleri
            </h1>
            <p className="text-gray-400 mt-1">Üretimden veya yönetimden gelen, müdahale bekleyen tüm işlerin listesi.</p>
          </div>
          {/* YENİ: Yönlendirme Düzeltildi */}
                    <div className="flex flex-wrap gap-2 items-center">
            {/* TEKNİK NAVİGASYON BUTONLARI */}
            <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg">✅ Kontrol Formları</Link>
            <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg">🛠️ Manuel PM</Link>
            <Link href="/admin/eked" className="bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg">🔒 EKED Uygula</Link>
            <Link href="/dashboard/pano-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg">🔌 Pano Temizliği</Link>
            <Link href="/dashboard/sayac" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg">⚡ Sayaç Okuma</Link>
            
            <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition border border-gray-700 ml-2">
              ← Geri
            </Link>
          </div>
        </div>

        <div className="bg-gray-900 border-2 border-red-900/50 p-4 md:p-6 rounded-xl shadow-2xl overflow-x-auto">
          {orders.length === 0 ? <div className="text-center py-10 text-gray-500 font-medium">Şu an tesiste bekleyen hiçbir aktif iş emri yok. Harika!</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Açılış Tarihi</th>
                  <th className="pb-3 px-2">Bildiren Kişi</th>
                  <th className="pb-3 px-2">Hat / Ekipman</th>
                  <th className="pb-3 px-2">Sorun Tipi</th>
                  <th className="pb-3 px-2 text-red-400">Duruş Var Mı?</th>
                  <th className="pb-3 px-2 min-w-[200px]">Arıza Detayı</th>
                  {/* Üretim haricindekiler Aksiyon sütununu görür */}
                  {userRole !== "uretim" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                                {orders.map(o => (
                  <tr key={o.id} className={`border-b transition ${o.ekipmanAdi === "KAR devreye alma" ? "bg-red-900/40 border-red-500 animate-pulse" : "border-gray-800 hover:bg-gray-800/50"}`}>
                    <td className="py-4 px-2 text-gray-400 text-xs font-bold">{o.tarihFormatli}</td>
                    <td className="py-4 px-2 font-medium text-orange-300">{o.bildirenKisi}</td>
                    <td className="py-4 px-2"><div className="font-bold text-gray-200">{o.hatAdi}</div><div className="text-xs text-gray-500">{o.ekipmanAdi}</div></td>
                    <td className="py-4 px-2 text-gray-300">{o.sorunTipi}</td>
                    <td className="py-4 px-2">
                      {o.isDuruslu ? <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded font-bold border border-red-800/50">Kritik Duruş</span> : <span className="text-gray-500 text-xs">Hayır</span>}
                    </td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{o.aciklama}</td>
                    
                    {/* YENİ: İŞİ TAMAMLA VE SİL BUTONLARI ÜRETİM YETKİLİSİNE GİZLENDİ */}
                    {userRole !== "uretim" && (
                      <td className="py-4 px-2 text-right space-x-2">
                        <button 
                          onClick={() => handleIsiTamamla(o)} 
                          className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded shadow-lg transition"
                        >
                          ✅ İşi Tamamla
                        </button>
                        {userRole === "admin" && (
                           <button onClick={() => handleSil(o.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded border border-red-800/50">Sil</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}''',
    "app/page.tsx": r'''"use client";

import { useEffect, useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail 
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            if (userData.isApproved) {
              const role = userData.role;
              if (role === "admin" || role === "isg") router.push("/admin");
              else if (role === "depo") router.push("/depo"); 
              else router.push("/dashboard"); 
            } else {
              setError(`Hesabınız (${user.email}) sistemde kayıtlı ancak henüz onaylanmamış. Lütfen yöneticinizle görüşün.`);
              await auth.signOut();
              setLoading(false);
            }
          } else {
            try {
              await setDoc(userRef, {
                name: user.displayName || "İsimsiz Google Kullanıcısı",
                email: user.email,
                role: "",
                isApproved: false,
                createdAt: serverTimestamp()
              });
              setError(`Kayıt başvurunuz (${user.email}) alındı! Yöneticiniz onayladıktan sonra tekrar giriş yapabilirsiniz.`);
            } catch (firestoreErr) {
              console.error("Firestore Kayıt Hatası:", firestoreErr);
              setError("Sunucuya kayıt yapılamadı. Lütfen yöneticiyle iletişime geçin.");
            }
            await auth.signOut(); 
            setLoading(false);
          }
        } catch (err) {
          console.error("Kullanıcı verisi çekilemedi:", err);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isResetMode) {
        if (!email) {
          setError("Lütfen e-posta adresinizi girin.");
          setIsProcessing(false);
          return;
        }
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve Spam klasörünü) kontrol edin.");
        setIsResetMode(false); 
        
      } else if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) {
          setError("Lütfen Ad Soyad giriniz.");
          setIsProcessing(false);
          return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          name: name,
          email: email,
          role: "",
          isApproved: false,
          createdAt: serverTimestamp()
        });

        setSuccessMsg("Kayıt başarılı! Yöneticiniz hesabınızı onayladığında giriş yapabilirsiniz.");
        await auth.signOut(); 
        
        setIsLoginMode(true); 
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError("Bu e-posta adresi zaten kullanımda.");
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') setError("E-posta veya şifre hatalı.");
      else if (err.code === 'auth/weak-password') setError("Şifreniz en az 6 karakter olmalıdır.");
      else if (err.code === 'auth/invalid-email') setError("Geçersiz e-posta formatı.");
      else setError("Bir hata oluştu: " + err.message);
    }
    setIsProcessing(false);
  };

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') setError("Giriş penceresi kapatıldı.");
      else setError("Google ile giriş yapılırken bir hata oluştu.");
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`SİSTEM BAŞLATILIYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
        
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-teal-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-yellow-600/10 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <img src="/dfulogo.png" alt="DFU Logo" className="h-16 w-auto mb-5 rounded-xl drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]" />
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-200 text-center tracking-widest mb-1">
            DFU TECH REPORT
          </h1>
          <p className="text-gray-400 text-xs text-center font-medium tracking-wide mb-5">
            Teknik Bakım Raporlama ve Takip Sistemi
          </p>
          <div className="bg-gray-950/50 border border-gray-800 px-5 py-2 rounded-full inline-block backdrop-blur-sm shadow-inner">
            <p className="text-teal-400 text-xs font-bold tracking-wider italic text-center">
              "Veri Konuşur, Tesis Kazanır."
            </p>
          </div>
        </div>

        {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 p-3 rounded-xl mb-4 text-sm text-center leading-relaxed font-medium relative z-10">{error}</div>}
        {successMsg && <div className="bg-green-900/30 border border-green-800/50 text-green-300 p-3 rounded-xl mb-4 text-sm text-center leading-relaxed font-medium relative z-10">{successMsg}</div>}

        <div className="relative z-10">
          
          {!isResetMode && (
            <div className="flex bg-gray-800 p-1 rounded-xl mb-5">
              <button type="button" onClick={() => { setIsLoginMode(true); setError(""); setSuccessMsg(""); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${isLoginMode ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Giriş Yap</button>
              <button type="button" onClick={() => { setIsLoginMode(false); setError(""); setSuccessMsg(""); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${!isLoginMode ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>Kayıt Ol</button>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4 mb-6">
            
            {isResetMode && (
              <div className="text-center mb-4">
                <h3 className="text-white font-bold text-lg">Şifremi Unuttum</h3>
                <p className="text-gray-400 text-xs mt-1">Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderilecektir.</p>
              </div>
            )}

            {!isLoginMode && !isResetMode && (
              <div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLoginMode && !isResetMode} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="Ad Soyad" />
              </div>
            )}
            
            <div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="E-Posta Adresi" />
            </div>
            
            {!isResetMode && (
              <div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isResetMode} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors" placeholder="Şifre" />
                
                {isLoginMode && (
                  <div className="flex justify-end mt-2">
                    <button type="button" onClick={() => { setIsResetMode(true); setError(""); setSuccessMsg(""); }} className="text-xs text-teal-500 hover:text-teal-400 transition font-medium">
                      Şifremi Unuttum
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* YENİ GÜNCELLENEN: Şirket Logolu Kurumsal Giriş / Kayıt Butonu */}
            <button type="submit" disabled={isProcessing} className="w-full bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 mt-1 flex items-center justify-center gap-3">
              {!isResetMode && (
                <img src="/dfulogo.png" alt="DFU" className="h-6 w-auto bg-white rounded px-1" />
              )}
              {isProcessing ? "İşlem Yapılıyor..." : (isResetMode ? "Sıfırlama Bağlantısı Gönder" : (isLoginMode ? "Kurumsal Şirket Maili ile Giriş Yap" : "Kurumsal Şirket Maili ile Kayıt Ol"))}
            </button>

            {isResetMode && (
              <button type="button" onClick={() => { setIsResetMode(false); setError(""); setSuccessMsg(""); }} className="w-full bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 text-sm font-bold py-3 rounded-xl transition-all mt-2">
                İptal Et ve Geri Dön
              </button>
            )}
          </form>

          {!isResetMode && (
            <>
              <div className="flex items-center my-5">
                <div className="flex-1 border-t border-gray-700"></div>
                <span className="px-3 text-xs text-gray-500 font-bold">VEYA</span>
                <div className="flex-1 border-t border-gray-700"></div>
              </div>

              {/* YENİ GÜNCELLENEN: Sadeleştirilmiş Google Butonu */}
              <button onClick={handleGoogleLogin} disabled={isProcessing} className="w-full bg-white hover:bg-gray-100 text-gray-900 text-sm font-bold py-3.5 px-6 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google ile Giriş
              </button>
            </>
          )}
        </div>

      </div>
      
      <p className="text-gray-600 text-[10px] mt-6 text-center">
        &copy; {new Date().getFullYear()} DFU Donuk Fırıncılık Ürünleri A.Ş. Tüm Hakları Saklıdır.<br/>
        Sistem Sürümü: V3.0
      </p>
    </div>
  );
}'''
}

print("--- DFU TECH REPORT MASTER GÜNCELLEME V12 (LOGO & MOBİL UYUM) ---")
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip())
    print(f"[BAŞARILI] {path} güncellendi.")

print("\nLogo taraması ve enjeksiyonu tamamlandı.")
