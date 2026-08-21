"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  // NEXUS STABLE STATES
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);

  
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

  
  
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

  
  const fetchNexusData = async () => {
    try {
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      
      const pSnap = await getDocs(query(collection(db, "personel"), orderBy("xp", "desc"), limit(5)));
      const pArr = [];
      for (const d of pSnap.docs) {
        pArr.push({ id: d.id, ...d.data() });
      }
      setPersonelList(pArr);
      
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const counts: any = {};
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

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
            setIsAdmin(true); fetchNexusData(); fetchInitialData(); fetchRcaData();
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
  
  
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

  
  const fetchNexusData = async () => {
    try {
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      
      const pSnap = await getDocs(query(collection(db, "personel"), orderBy("xp", "desc"), limit(5)));
      const pArr = [];
      for (const d of pSnap.docs) {
        pArr.push({ id: d.id, ...d.data() });
      }
      setPersonelList(pArr);
      
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const counts: any = {};
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

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

  
  
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

  
  const fetchNexusData = async () => {
    try {
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      
      const pSnap = await getDocs(query(collection(db, "personel"), orderBy("xp", "desc"), limit(5)));
      const pArr = [];
      for (const d of pSnap.docs) {
        pArr.push({ id: d.id, ...d.data() });
      }
      setPersonelList(pArr);
      
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const counts: any = {};
      for (const docObj of bSnap.docs) {
        const data = docObj.data();
        if (data.sarfiyat && Array.isArray(data.sarfiyat)) {
          for (const s of data.sarfiyat) {
            const k = s.parcaAdi || s.stokKodu || "Bilinmeyen";
            counts[k] = (counts[k] || 0) + 1;
          }
        }
      }
      
      const formatted = [];
      for (const key in counts) {
        formatted.push({ part: String(key), failure: Number(counts[key]) });
      }
      
      formatted.sort((a, b) => { return b.failure - a.failure; });
      setCorrData(formatted.slice(0, 5));
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

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
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '30px 30px' }}></div>
      <div className="relative mb-20 scale-110">
        <div className="absolute inset-0 bg-indigo-600/20 blur-[150px] rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-40 w-auto relative z-10 animate-[pulse_3s_infinite_ease-in-out] drop-shadow-[0_0_50px_rgba(79,70,229,0.4)]" alt="DFU" />
      </div>
      <div className="relative w-80 h-1 bg-white/5 rounded-full overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-400 to-transparent w-full animate-[ai_scan_2s_infinite_linear]"></div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-indigo-400/60 font-black tracking-[1em] text-[10px] uppercase animate-pulse mb-4">SYNCHRONIZING NEURAL LINKS...</p>
        <div className="grid grid-cols-5 gap-2 opacity-20">
          {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-0.5 bg-indigo-500 animate-ping" style={{ animationDelay: `${i*0.3}s` }}></div>)}
        </div>
      </div>
      <style jsx>{` @keyframes ai_scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } `}</style>
    </div>
  );
  if (!isAdmin) return <div className="min-h-screen bg-[#020617] text-red-500 flex justify-center items-center font-bold text-xl uppercase italic tracking-tighter">YETKİSİZ ERİŞİM!</div>;return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase">Vardiya Raporu</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg transition">Çıkış</button>
          </div>
        </div>
        {/* BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          {userRole === "isg" ? (
            <>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl font-bold text-xs text-center">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl font-bold text-xs text-center">🗄️ EKED Arşivi</Link>
              <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
              <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">📢 İSG Duyuru</Link>
            </>
          ) : (
            <>
              <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl font-bold text-xs text-center shadow-lg hover:bg-red-500 transition">🚨 Yeni İş Emri</Link>
              <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl font-bold text-xs text-center">Aktif Bildirimler</Link>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl font-bold text-xs text-center">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl font-bold text-xs text-center">🗄️ EKED Arşivi</Link>
              <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full animate-bounce">{kpiOnayBekleyen}</span>}</Link>
              <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
              <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl font-semibold text-xs text-center border border-gray-600">🗄️ Pano Arşivi</Link>
              <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl font-bold text-xs text-center uppercase">✅ Kontrol Formları</Link>
              <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">⚙️ Yedek Parça</Link>
              <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl font-bold text-xs text-center border border-indigo-500/30">📋 Yapılan İşler</Link>
              <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl font-bold text-xs text-center">⚡ KAR Arşivi</Link>
              <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl font-bold text-xs text-center uppercase tracking-tighter">📅 PM Takvimi</Link>
              <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl font-bold text-xs text-center">🗄️ PM Arşivi</Link>
              <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl font-black text-xs text-center shadow-lg">🛠️ Manuel PM</Link>
              <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter tracking-widest">⚡ Sayaç Okuma</Link>
              <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">⏰ Mesai Raporları</Link>
              <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">🗄️ Tamamlanan İşler</Link>
              <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">⚙️ Hat/Makineler</Link>
              <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase tracking-tighter">📢 İSG Duyuru</Link>
              <button onClick={()=>{if(window.confirm("RESET?")){/*reset*/}}} className="bg-red-950 text-red-500 p-3 rounded-2xl text-[10px] font-black uppercase border border-red-900/30 transition">Reset</button>
            </>
          )}
        </div>
        {/* 3-COLUMN NOTIFICATION GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           {/* EKED (LOTO) ALARMLARI */}
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border-2 border-yellow-600/40 p-7 rounded-[3rem] shadow-2xl relative overflow-hidden group">
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
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border-2 border-red-900/40 p-7 rounded-[3rem] shadow-2xl">
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
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border-2 border-indigo-900/40 p-7 rounded-[3rem] shadow-2xl">
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
        <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-8 rounded-[3rem] mb-12 shadow-2xl">
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
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] p-6 rounded-[30px] border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1">Duruş Süresi</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        {/* ENERGY CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase tracking-widest underline underline-offset-8">⚡ Elektrik (kWh)</h2>
             <select value={filterElekSayac} onChange={e=>setFilterElekSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{elekSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-red-400 mb-4 uppercase tracking-widest underline underline-offset-8">🔥 Doğalgaz (m³)</h2>
             <select value={filterGazSayac} onChange={e=>setFilterGazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{gazSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-6 rounded-[30px] shadow-xl">
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase tracking-widest underline underline-offset-8">💧 Su (m³)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-2 text-[10px] mb-4 text-white uppercase"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
        </div>

        {/* PERFORMANCE & ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-8 rounded-[3rem] shadow-2xl">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest">🏆 Personel Performans Matrisi</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-xs uppercase font-bold"><thead className="text-gray-500 border-b border-gray-800"><tr><th className="py-4">Personel</th><th className="py-4">İş Sayısı</th><th className="py-4">Toplam Efor</th></tr></thead><tbody className="divide-y divide-gray-800">{personelPerformans.map((p,i)=><tr key={i} className="hover:bg-gray-800/30 transition"><td className="py-4 text-gray-200">{p.isim}</td><td className="py-4 text-green-400">{p.isSayisi}</td><td className="py-4 text-indigo-400">{p.eforDk} dk</td></tr>)}</tbody></table></div>
          </div>
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-8 rounded-[3rem] shadow-2xl text-center">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest">🛑 En Çok Duruş Yapan Ekipmanlar</h2>
            <div className="space-y-4">{ekipmanPerformans.map((e,i)=>(<div key={i} className="flex justify-between items-center bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50"><span className="text-gray-300 font-bold">{e.ekipman}</span><div className="text-right"><span className="text-red-400 font-black block">{e.sure} dk</span><span className="text-[10px] text-gray-500">{e.count} Arıza</span></div></div>))}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2>
           </div>
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-teal-400 mb-6 uppercase tracking-widest text-center tracking-[0.2em]">⚡ Hat Bazlı İş Yoğunluğu</h2>
           </div>
        </div>
  </>
)}
      </div>

      {/* INSPECTION MODAL */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-sans">
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
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
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
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
          <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-[0_0_50px_rgba(30,58,138,0.1)] border border-yellow-500/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative">
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
    
      {/* --- NEXUS ALGORİTMA MODALLARI --- */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans">
          <div className="bg-[#020617] border-2 border-indigo-500/50 p-8 rounded-3xl max-w-lg w-full shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <h4 className="text-indigo-400 font-bold mb-6 text-xl italic border-b border-indigo-500/20 pb-2 uppercase text-center tracking-tighter italic">XP & Seviye Sistemi Matrisi</h4>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed font-mono italic">
              <p><span className="text-indigo-500">{" >> "}</span> <strong>Arıza Müdahale:</strong> +150 XP.</p>
              <p><span className="text-indigo-500">{" >> "}</span> <strong>İSG & EKED:</strong> +200 XP Bonus.</p>
            </div>
            <button onClick={() => setShowLeagueInfo(false)} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all uppercase italic tracking-widest shadow-lg shadow-indigo-500/30">Anlaşıldı</button>
          </div>
        </div>
      )}
      {showCorrInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans">
          <div className="bg-[#020617] border-2 border-emerald-500/50 p-8 rounded-3xl max-w-lg w-full shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <h4 className="text-emerald-400 font-bold mb-6 text-xl italic border-b border-emerald-500/20 pb-2 uppercase text-center tracking-tighter italic">Korelasyon Hesaplama Metodu</h4>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed font-mono italic">
              <p><span className="text-emerald-500">{" >> "}</span> <strong>Veri Kaynağı:</strong> Firestore 'bakimlar' koleksiyonu.</p>
              <p><span className="text-emerald-500">{" >> "}</span> <strong>İşlem:</strong> Parça frekans korelasyonu.</p>
            </div>
            <button onClick={() => setShowCorrInfo(false)} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition-all uppercase italic tracking-widest shadow-lg shadow-emerald-500/30">Anlaşıldı</button>
          </div>
        </div>
      )}

    </div>
  );
}