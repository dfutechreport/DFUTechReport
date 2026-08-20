
import os
files = {
    "lib/firebase.ts": r'''import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

// BURAYI KENDİ FIREBASE BİLGİLERİNİZLE GÜNCELLEYİN
const firebaseConfig = {
  apiKey: "AIzaSyDWqJA91hlpCb0vOsI0SopHLX_9Xfr2WM4",
  authDomain: "dfu-tech-report.firebaseapp.com",
  projectId: "dfu-tech-report",
  storageBucket: "dfu-tech-report.firebasestorage.app",
  messagingSenderId: "714961673687",
  appId: "1:714961673687:web:d21e6d6398677f421b7f92"
};

// Mantıksal Akış: Sistem birden fazla kez yüklenirse Firebase'in çökmesini engelleriz (Singleton Pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Yetkilendirme (Gmail Girişi) Modülünü Dışa Aktarıyoruz
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Veritabanı Modülünü Dışa Aktarıyoruz
export const db = getFirestore(app);
if (typeof window !== "undefined") { enableMultiTabIndexedDbPersistence(db).catch(() => {}); }''',
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
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
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
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
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
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-6 no-print pt-4"><button onClick={handleExcelIndir} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-[25px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center gap-3 border-2 border-emerald-400/20 active:scale-95"><span className="text-2xl">📊</span> GÜNCEL MASTER STOK LİSTESİNİ İNDİR (EXCEL)</button></div>
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
                      <td className="py-4 text-gray-200">{(!m.name || m.name.toUpperCase() === "ORIJINAL KAYIT") ? (yedekParcalar.find(p => (p.stokKodu && p.stokKodu === m.stockCode) || p.id === m.stockCode)?.parcaAdi || m.stockCode) : m.name}</td>
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
files["app/admin/aktif-isler/page.tsx"] = r'''"use client";

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
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchOrders();
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
          <Link href={userRole === "uretim" || userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Ana Ekrana Dön
          </Link>
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
}'''
files["app/admin/duyurular/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

export default function DuyuruYonetimi() {
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [duyurular, setDuyurular] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDuyurular = async () => {
    const q = query(collection(db, "announcements"), orderBy("tarih", "desc"));
    const snap = await getDocs(q);
    setDuyurular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchDuyurular(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baslik || !icerik) return alert("Lütfen başlık ve içerik girin.");
    setLoading(true);
    try {
      await addDoc(collection(db, "announcements"), {
        baslik,
        icerik,
        tarih: new Date(),
      });
      setBaslik(""); setIcerik("");
      fetchDuyurular();
      alert("Duyuru başarıyla yayınlandı. Personel giriş yaptığında ekranına düşecek.");
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    await deleteDoc(doc(db, "announcements", id));
    fetchDuyurular();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-3xl font-bold text-yellow-500">Duyuru Yönetimi</h1></div>
          <Link href="/admin" className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition">← Dashboard</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl mb-8">
          <h2 className="text-xl font-bold mb-4">Yeni Duyuru Yayınla</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Duyuru Başlığı (Örn: İş Güvenliği Uyarısı)" value={baslik} onChange={e => setBaslik(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            <textarea placeholder="Duyuru Detayı..." value={icerik} onChange={e => setIcerik(e.target.value)} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            <button type="submit" disabled={loading} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg w-full">{loading ? "Yayınlanıyor..." : "Tüm Tesise Duyur"}</button>
          </form>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-4">Aktif Duyurular</h2>
          {duyurular.length === 0 ? <p className="text-gray-500">Yayında duyuru yok.</p> : (
            <div className="space-y-4">
              {duyurular.map(d => (
                <div key={d.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-yellow-400 text-lg">{d.baslik}</h3>
                    <p className="text-gray-300 mt-2 text-sm">{d.icerik}</p>
                  </div>
                  <button onClick={() => handleSil(d.id)} className="bg-red-900/50 text-red-400 text-xs px-3 py-1 rounded hover:bg-red-600 hover:text-white transition">Sil</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}'''
files["app/admin/eked/arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function EkedArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchEked = async () => {
    try {
      const q = query(collection(db, "eked_logs"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        gercekZaman: document.data().kapatmaTarihi ? document.data().kapatmaTarihi.toDate().getTime() : 0,
        kapatmaStr: document.data().kapatmaTarihi ? document.data().kapatmaTarihi.toDate().toLocaleString('tr-TR') : "-"
      }));
      setLogs(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim") {
            window.location.href = "/admin/aktif-isler";
          } else {
            setUserRole(role);
            fetchEked();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "eked_logs", id)); fetchEked(); } catch (error) { alert("Hata."); }
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
    <>
      {/* PDF YAZDIRMA STİLLERİ */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-300 flex items-center gap-3 print:text-black">
                <span className="no-print">🗄️</span> EKED - LOTO Arşivi (İSG)
              </h1>
              <p className="text-gray-400 mt-1 print:text-black">Geçmişte yapılmış ve tamamlanarak kilidi açılmış güvenlik uygulamaları.</p>
            </div>
            <div className="flex gap-3 no-print">
              {/* YENİ: PDF ÇIKTISI AL BUTONU */}
              <button 
                onClick={() => window.print()} 
                className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm md:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF Çıktısı Al
              </button>
             <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          {/* Sadece PDF'te çıkacak başlık */}
          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">İSG - Tamamlanmış EKED (LOTO) Kayıt Raporu</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
            {logs.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Arşivde kayıt bulunmuyor.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Uygulama Tarihi</th>
                    <th className="pb-3 px-2">Kaldırılma (Tamamlanma) Zamanı</th>
                    <th className="pb-3 px-2">Uygulayan Personel</th>
                    <th className="pb-3 px-2">Uygulama Yeri</th>
                    <th className="pb-3 px-2 text-green-500 print:text-black">Durum</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2 text-gray-300 print:text-black">{log.tarih}</td>
                      <td className="py-4 px-2 text-gray-400 text-xs print:text-black font-bold">{log.kapatmaStr}</td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 text-gray-200 print:text-black">{log.yer}</td>
                      <td className="py-4 px-2">
                        <span className="bg-green-900/30 text-green-400 print:text-green-700 print:font-bold text-xs px-2 py-1 rounded border border-green-800/50 print:border-none">
                          Kilit Açıldı
                        </span>
                      </td>
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right space-x-2 no-print">
                          <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded">Sil</button>
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
    </>
  );
}'''
files["app/admin/eked/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function EkedTakip() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [yer, setYer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEked = async () => {
    try {
      const q = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        gercekZaman: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().getTime() : 0
      }));
      setLogs(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim") {
            window.location.href = "/admin/aktif-isler"; // Üretim giremez
          } else {
            setUserRole(role);
            setUserName(userSnap.data().name);
            fetchEked();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleEkedEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yer) return alert("Lütfen uygulama yapılan yeri giriniz.");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "eked_logs"), {
        tarih: tarih,
        personel: userName,
        yer: yer,
        durum: "Açık",
        kayitTarihi: new Date(),
        kapatmaTarihi: null
      });
      alert("EKED - LOTO uygulaması başarıyla başlatıldı! Tüm panellerde alarm olarak görünecek.");
      setYer(""); fetchEked();
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  const handleEkedKaldir = async (id: string) => {
    if (!window.confirm("DİKKAT: Enerji kilidinin kaldırıldığını ve alanın emniyetli olduğunu onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "eked_logs", id), {
        durum: "Kapalı",
        kapatmaTarihi: new Date()
      });
      fetchEked();
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu kaydı tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "eked_logs", id)); fetchEked(); } catch (error) { alert("Hata."); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-yellow-500 flex items-center gap-3">
              <span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-5 w-5 bg-yellow-500"></span></span>
              EKED - LOTO Takip Paneli
            </h1>
            <p className="text-gray-400 mt-1">Sahadaki kilitli (enerjisi kesilmiş) emniyetli alanların takibi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* YENİ EKED FORMU */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border-2 border-yellow-600/50 p-6 rounded-2xl shadow-[0_0_20px_rgba(202,138,4,0.15)]">
              <h2 className="text-xl font-bold mb-6 text-yellow-500 flex items-center gap-2">🔒 Yeni EKED Başlat</h2>
              <form onSubmit={handleEkedEkle} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tarih</label>
                  <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Uygulamayı Yapan Personel</label>
                  <input type="text" value={userName} disabled className="w-full bg-gray-900 border-gray-700 rounded-lg p-3 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Uygulama Yapılan Yer (Ekipman / Pano)</label>
                  <textarea value={yer} onChange={e => setYer(e.target.value)} placeholder="Örn: Paketleme Ana Panosu Şalteri" rows={3} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-bold py-3 rounded-lg shadow-lg disabled:opacity-50">
                  {isSubmitting ? "İşleniyor..." : "EKED Başlat (Kilitle)"}
                </button>
              </form>
            </div>
          </div>

          {/* AKTİF EKED LİSTESİ */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
              <h2 className="text-xl font-bold mb-4 text-white">Sahadaki Aktif Kilitler</h2>
              {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Şu an sahada aktif bir EKED uygulaması bulunmuyor.</div> : (
                <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="pb-3 px-2">Tarih</th>
                      <th className="pb-3 px-2">Uygulayan Personel</th>
                      <th className="pb-3 px-2">Uygulama Yeri</th>
                      <th className="pb-3 px-2 text-yellow-500">Durum</th>
                      <th className="pb-3 px-2 text-right">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                        <td className="py-4 px-2 text-gray-300 font-bold">{log.tarih}</td>
                        <td className="py-4 px-2 font-medium text-blue-300">{log.personel}</td>
                        <td className="py-4 px-2 text-gray-200 font-bold">{log.yer}</td>
                        <td className="py-4 px-2">
                          <span className="bg-yellow-900/40 text-yellow-500 text-xs px-2 py-1 rounded border border-yellow-700/50 animate-pulse">🔒 Kilitli</span>
                        </td>
                        <td className="py-4 px-2 text-right space-x-2">
                          <button onClick={() => handleEkedKaldir(log.id)} className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded shadow-lg">
                            ✅ İşlem Tamamlandı (Kilidi Aç)
                          </button>
                          {userRole === "admin" && <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded">Sil</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}'''
files["app/admin/ekipmanlar/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

type Ekipman = {
  id: string;
  hatAdi: string;
  ekipmanAdi: string;
  durum: string;
};

export default function EkipmanYonetimi() {
  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [durum, setDurum] = useState("Aktif");
  const [ekipmanlar, setEkipmanlar] = useState<Ekipman[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // YENİ: Düzenleme (Edit) State'leri
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);

  const ekipmanlariGetir = async () => {
    try {
      const q = query(collection(db, "assets"), orderBy("hatAdi"));
      const querySnapshot = await getDocs(q);
      const liste: Ekipman[] = [];
      querySnapshot.forEach((document) => {
        liste.push({ id: document.id, ...document.data() } as Ekipman);
      });
      setEkipmanlar(liste);
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  useEffect(() => {
    ekipmanlariGetir();
  }, []);

  // KAYDET VEYA GÜNCELLE FONKSİYONU
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi) {
      setMesaj("Lütfen hat ve ekipman adını eksiksiz girin!");
      return;
    }

    setLoading(true);
    setMesaj("");

    try {
      if (duzenlenenId) {
        // GÜNCELLEME İŞLEMİ
        const ekipmanRef = doc(db, "assets", duzenlenenId);
        await updateDoc(ekipmanRef, {
          hatAdi: hatAdi,
          ekipmanAdi: ekipmanAdi,
          durum: durum
        });
        setMesaj("Ekipman başarıyla güncellendi!");
      } else {
        // YENİ KAYIT İŞLEMİ
        await addDoc(collection(db, "assets"), {
          hatAdi: hatAdi,
          ekipmanAdi: ekipmanAdi,
          durum: durum,
          eklenmeTarihi: new Date()
        });
        setMesaj("Ekipman başarıyla eklendi!");
      }

      // Formu Sıfırla
      setHatAdi("");
      setEkipmanAdi("");
      setDurum("Aktif");
      setDuzenlenenId(null);
      ekipmanlariGetir(); 

    } catch (error) {
      console.error(error);
      setMesaj("İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // YENİ: SİLME FONKSİYONU
  const handleSil = async (id: string) => {
    if (!window.confirm("Bu ekipmanı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    
    try {
      await deleteDoc(doc(db, "assets", id));
      ekipmanlariGetir();
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi başarısız oldu.");
    }
  };

  // YENİ: DÜZENLEME MODUNA GEÇİŞ
  const handleDuzenle = (ekp: Ekipman) => {
    setHatAdi(ekp.hatAdi);
    setEkipmanAdi(ekp.ekipmanAdi);
    setDurum(ekp.durum || "Aktif");
    setDuzenlenenId(ekp.id);
    setMesaj("");
    window.scrollTo({ top: 0, behavior: "smooth" }); // Form yukarıda olduğu için kaydır
  };

  // Düzenlemeden Vazgeç
  const IptalEt = () => {
    setHatAdi("");
    setEkipmanAdi("");
    setDurum("Aktif");
    setDuzenlenenId(null);
    setMesaj("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-3xl font-bold">Hat ve Ekipman Yönetimi</h1></div>
            <p className="text-gray-400 mt-1"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | Varlık Tanımlama Merkezi</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition">
            ← Dashboard'a Dön
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sol Taraf: Ekipman Ekleme/Düzenleme Formu */}
          <div className="lg:col-span-1">
            <div className={`border p-6 rounded-2xl shadow-lg transition-colors ${duzenlenenId ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-900 border-gray-800'}`}>
              <h2 className={`text-xl font-bold mb-6 ${duzenlenenId ? 'text-blue-400' : 'text-orange-400'}`}>
                {duzenlenenId ? "Ekipmanı Düzenle" : "Yeni Ekipman Ekle"}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Üretim Hattı</label>
                  <input 
                    type="text" value={hatAdi} onChange={(e) => setHatAdi(e.target.value)} placeholder="Örn: Kruvasan Hattı" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Ekipman Adı</label>
                  <input 
                    type="text" value={ekipmanAdi} onChange={(e) => setEkipmanAdi(e.target.value)} placeholder="Örn: Spiral Mikser" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* YENİ: Durum Değiştirme (Aktif / Pasif / Hurda) */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Çalışma Durumu</label>
                  <select 
                    value={durum} onChange={(e) => setDurum(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Aktif">Aktif (Çalışıyor)</option>
                    <option value="Pasif">Pasif (Kullanım Dışı)</option>
                    <option value="Hurda">Hurda / Perte Çıktı</option>
                  </select>
                </div>

                {mesaj && (
                  <div className={`text-sm font-medium ${mesaj.includes("başarıyla") ? "text-green-400" : "text-red-400"}`}>
                    {mesaj}
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <button 
                    type="submit" disabled={loading}
                    className={`w-full font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 ${duzenlenenId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'}`}
                  >
                    {loading ? "İşleniyor..." : (duzenlenenId ? "Değişiklikleri Kaydet" : "Sisteme Ekle")}
                  </button>
                  
                  {duzenlenenId && (
                    <button type="button" onClick={IptalEt} className="w-full bg-gray-700 hover:bg-gray-600 font-bold py-3 px-4 rounded-lg transition">
                      İptal Et
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Sağ Taraf: Mevcut Ekipmanlar Listesi */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-6">Sistemdeki Ekipmanlar</h2>
              
              {ekipmanlar.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Henüz hiç ekipman tanımlanmamış.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-sm">
                        <th className="pb-3 px-4">Üretim Hattı</th>
                        <th className="pb-3 px-4">Ekipman Adı</th>
                        <th className="pb-3 px-4">Durum</th>
                        <th className="pb-3 px-4 text-right">Aksiyonlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ekipmanlar.map((ekp) => (
                        <tr key={ekp.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                          <td className="py-4 px-4 font-medium">{ekp.hatAdi}</td>
                          <td className="py-4 px-4 text-gray-300">{ekp.ekipmanAdi}</td>
                          <td className="py-4 px-4">
                            <span className={`text-xs px-3 py-1 rounded-full border ${
                              ekp.durum === 'Pasif' ? 'bg-orange-900/30 text-orange-400 border-orange-800/50' :
                              ekp.durum === 'Hurda' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                              'bg-green-900/30 text-green-400 border-green-800/50'
                            }`}>
                              {ekp.durum || 'Aktif'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right space-x-2">
                            <button onClick={() => handleDuzenle(ekp)} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white text-xs px-3 py-2 rounded transition border border-blue-800/50">
                              Düzenle
                            </button>
                            <button onClick={() => handleSil(ekp.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded transition border border-red-800/50">
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}'''
files["app/admin/is-emri-ac/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsEmriAc() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [seciliHat, setSeciliHat] = useState("");

  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [sorunTipi, setSorunTipi] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [isDuruslu, setIsDuruslu] = useState(false);

  const [sistemSaati, setSistemSaati] = useState<Date | null>(null);
  const [gosterilenSaatStr, setGosterilenSaatStr] = useState("");

  useEffect(() => {
    const suAn = new Date();
    setSistemSaati(suAn);
    setGosterilenSaatStr(suAn.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          
          if (role !== "admin" && role !== "uretim" && role !== "operator") window.location.href = "/";
          
          const snap = await getDocs(collection(db, "assets"));
          setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const benzersizHatlar = Array.from(new Set(assets.map(a => a.hatAdi)));
  const filtrelenmisEkipmanlar = assets.filter(a => a.hatAdi === seciliHat);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi || !sorunTipi || aciklama.length < 5) return alert("Lütfen tüm alanları doldurun.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "work_orders"), {
        hatAdi, ekipmanAdi, sorunTipi, aciklama, isDuruslu,
        bildirenKisi: userName,
        durum: "Açık", 
        kayitTarihi: sistemSaati, 
        tamamlayanKisi: "",
        tamamlanmaTarihi: null
      });
      alert("İş Emri başarıyla açıldı! Teknisyenlerin ekranına yansıdı.");
      window.location.href = userRole === "admin" ? "/admin" : "/admin/aktif-isler"; 
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-red-500/50 rounded-2xl shadow-2xl p-8">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-red-400 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Yeni Üretim Bildirimi (İş Emri)
          </h1>
          <Link href={userRole === "admin" ? "/admin" : "/admin/aktif-isler"} className="bg-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-700">İptal (Geri Dön)</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <label className="block text-sm font-bold text-gray-400 mb-2">Sistem Kayıt Saati (Kilitli)</label>
            <input type="text" value={gosterilenSaatStr} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-red-400 font-bold opacity-70 cursor-not-allowed text-center text-lg tracking-wider" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sorun Yaşanan Hat</label>
              <select value={hatAdi} onChange={(e) => { setHatAdi(e.target.value); setSeciliHat(e.target.value); setEkipmanAdi(""); }} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500">
                <option value="">-- Hat Seçiniz --</option>{benzersizHatlar.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Arızalı Ekipman</label>
              <select value={ekipmanAdi} onChange={(e) => setEkipmanAdi(e.target.value)} disabled={!seciliHat} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white disabled:opacity-50 focus:outline-none focus:border-red-500">
                <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>
                {filtrelenmisEkipmanlar.map(e => <option key={e.id} value={e.ekipmanAdi}>{e.ekipmanAdi}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sorun Tipi</label>
              <select value={sorunTipi} onChange={(e) => setSorunTipi(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500">
                <option value="">-- Seçiniz --</option><option value="Mekanik">Mekanik</option><option value="Elektrik">Elektrik</option><option value="Otomasyon">Otomasyon</option><option value="Diğer">Diğer</option>
              </select>
            </div>
            <div className="flex flex-col justify-center">
              <label className="block text-sm font-medium text-gray-400 mb-3">Hat Duruşu Var Mı?</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isDuruslu} onChange={(e) => setIsDuruslu(e.target.checked)} />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-300">{isDuruslu ? <span className="text-red-400 font-bold">Evet, Hat Durdu (Kritik)</span> : "Hayır, Hat Çalışıyor"}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Sorunun Detayı (Ne oldu?)</label>
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={4} placeholder="Lütfen teknisyenin anlayacağı şekilde arızayı tarif ediniz..." className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500" />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 text-white transition-all">
            {isSubmitting ? "Sisteme İletiliyor..." : "İş Emrini Gönder (Alarm Ver)"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/admin/is-listesi/page.tsx"] = r'''"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsListesi() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [logs, setRawLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  
  // Filters
  const [fYil, setFYil] = useState("");
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fVardiya, setFVardiya] = useState("");
  const [fHat, setFHat] = useState("");
  const [fEkipman, setFEkipman] = useState("");
  const [fDurus, setFDurus] = useState("");
  const [fPersonel, setFPersonel] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1. Kullanıcı Rolünü Tespit Et (Navigasyon için)
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserRole(uSnap.data().role || "teknisyen");
        }

        // 2. Kayıtları Çek (Son işten ilke otomatik sıralama)
        const snap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc")));
        const data = snap.docs.map(d => {
          const date = d.data().kayitTarihi?.toDate ? d.data().kayitTarihi.toDate() : new Date(d.data().kayitTarihi);
          return { id: d.id, ...d.data(), jsDate: date };
        });
        setRawLogs(data); setFilteredLogs(data);
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let res = [...logs];
    if (fYil) res = res.filter(l => l.jsDate?.getFullYear().toString() === fYil);
    if (fAy) res = res.filter(l => (l.jsDate?.getMonth() + 1).toString() === fAy);
    if (fGun) res = res.filter(l => l.jsDate?.getDate().toString() === fGun);
    if (fVardiya) res = res.filter(l => l.vardiya === fVardiya);
    if (fHat) res = res.filter(l => l.hatAdi === fHat);
    if (fEkipman) res = res.filter(l => l.ekipmanAdi === fEkipman);
    if (fDurus) res = res.filter(l => (fDurus === "evet" ? l.isDuruslu : !l.isDuruslu));
    if (fPersonel) res = res.filter(l => l.bildirenKisi === fPersonel);
    setFilteredLogs(res);
  }, [fYil, fAy, fGun, fVardiya, fHat, fEkipman, fDurus, fPersonel, logs]);

  const unique = (field: string) => Array.from(new Set(logs.map(l => l[field]))).filter(Boolean).sort();
  const uniqueDates = (type: 'Y'|'M'|'D') => {
    const sets = new Set<string>();
    logs.forEach(l => {
      if(!l.jsDate) return;
      if(type==='Y') sets.add(l.jsDate.getFullYear().toString());
      if(type==='M') sets.add((l.jsDate.getMonth()+1).toString());
      if(type==='D') sets.add(l.jsDate.getDate().toString());
    });
    return Array.from(sets).sort((a,b)=>Number(a)-Number(b));
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
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <h1 className="text-2xl font-black text-indigo-400 uppercase tracking-[0.2em]">📋 Yapılan İşler Arşivi</h1>
           
           {/* KRİTİK: ROL BAZLI GERİ DÖNÜŞ BUTONU */}
           <Link 
             href={userRole === "admin" ? "/admin" : "/dashboard"} 
             className="bg-gray-800 text-[10px] font-black px-6 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition uppercase tracking-widest shadow-lg"
           >
             {userRole === "admin" ? "Yönetici Paneline Dön" : "Dashboard'a Dön"}
           </Link>
        </div>

        {/* FİLTRELEME PANELİ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8 bg-gray-900 p-6 rounded-[35px] border border-gray-800 shadow-2xl">
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Yıl</label><select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('Y').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ay</label><select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('M').map(v=><option key={v} value={v}>{v}. Ay</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Gün</label><select value={fGun} onChange={e=>setFGun(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{uniqueDates('D').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Vardiya</label><select value={fVardiya} onChange={e=>setFVardiya(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('vardiya').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Hat</label><select value={fHat} onChange={e=>setFHat(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('hatAdi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Ekipman</label><select value={fEkipman} onChange={e=>setFEkipman(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('ekipmanAdi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Duruş</label><select value={fDurus} onChange={e=>setFDurus(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option><option value="evet">Duruşlu</option><option value="hayir">Normal</option></select></div>
           <div><label className="text-[9px] text-gray-500 font-black uppercase mb-1 block">Personel</label><select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-gray-800 rounded-xl p-2 text-xs text-white uppercase"><option value="">Hepsi</option>{unique('bildirenKisi').map(v=><option key={v} value={v}>{v}</option>)}</select></div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-2xl overflow-hidden relative">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-5 px-2">Tarih / Zaman</th><th className="pb-5">Vardiya</th><th className="pb-5">Makine Bilgisi</th><th className="pb-5">Etki</th><th className="pb-5">Sorumlu</th><th className="pb-5 text-right px-4">Süre</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {filteredLogs.map((l, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{l.baslangicTarihi} / {l.baslangicSaati}</td>
                     <td className="py-5 text-[10px] tracking-tighter">{l.vardiya}</td>
                     <td className="py-5"><p className="text-teal-400 font-black text-xs uppercase mb-1">{l.hatAdi}</p><p className="text-gray-100 text-sm font-black">{l.ekipmanAdi}</p></td>
                     <td className="py-5">{l.isDuruslu ? <span className="bg-red-900/30 text-red-500 border border-red-900/50 text-[10px] px-2 py-0.5 rounded-full font-black">Duruş</span> : <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Normal</span>}</td>
                     <td className="py-5 text-gray-300 text-xs font-black">{l.bildirenKisi}</td>
                     <td className="py-5 text-right px-4"><span className="bg-indigo-900/20 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-900/30 font-black">{l.toplamSureDakika} dk</span></td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {filteredLogs.length === 0 && <div className="py-20 text-center text-gray-600 font-bold uppercase italic text-xs">Filtrelere uygun iş kaydı bulunamadı.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}'''
files["app/admin/kar-takip/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function KarTakipArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "kar_takip"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        tarihFormatli: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().toLocaleString('tr-TR') : "-"
      }));
      setLogs(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim" || role === "ik") { window.location.href = "/"; } 
          else { setUserRole(role); fetchArsiv(); }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "kar_takip", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <h1 className="text-2xl font-bold text-red-500 print:text-black">🗄️ KAR (Kaçak Akım Rölesi) İhlal Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">PDF Çıktısı Al</button>
              <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Tesisinizde KAR ihlali bulunmuyor. Harika!</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tespit Tarihi</th><th className="pb-3 px-2">Pano Adı</th><th className="pb-3 px-2">Pano Yeri</th><th className="pb-3 px-2 text-red-400 print:text-black">Durum (İhlal)</th><th className="pb-3 px-2">Kontrol Eden</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 text-gray-300 print:text-black font-bold">{log.tarihFormatli}</td>
                      <td className="py-4 px-2 font-bold text-white print:text-black">{log.panoAdi}</td>
                      <td className="py-4 px-2 text-gray-400 print:text-black">{log.panoYeri}</td>
                      <td className="py-4 px-2 font-bold"><span className="bg-red-900/30 text-red-400 px-3 py-1 rounded-lg border border-red-800/50 print:border-none print:text-red-700 print:bg-transparent">{log.durum}</span></td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/admin/mesai/page.tsx"] = r'''"use client";
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
}'''
files["app/admin/pano-takip/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PanoTakipArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "pano_takip"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        tarihFormatli: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().toLocaleString('tr-TR') : "-"
      }));
      setLogs(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim" || role === "ik") { window.location.href = "/"; } 
          else { setUserRole(role); fetchArsiv(); }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "pano_takip", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <h1 className="text-2xl font-bold text-indigo-500 print:text-black">🗄️ Pano Temizlik ve Takip Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">PDF Çıktısı Al</button>
              <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Kontrol Tarihi</th><th className="pb-3 px-2">Pano Adı</th><th className="pb-3 px-2">Pano Yeri</th><th className="pb-3 px-2 text-indigo-400 print:text-black">İşlem</th><th className="pb-3 px-2">Kontrol Eden</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 text-gray-300 print:text-black font-bold">{log.tarihFormatli}</td>
                      <td className="py-4 px-2 font-bold text-white print:text-black">{log.panoAdi}</td>
                      <td className="py-4 px-2 text-gray-400 print:text-black">{log.panoYeri}</td>
                      <td className="py-4 px-2 text-green-400 print:text-black font-bold">{log.islem}</td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/admin/periyodik-bakim-arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PeriyodikBakimArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // YENİ: FİLTRELER
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "pm_logs"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.kayitTarihi ? d.kayitTarihi.toDate().toLocaleString('tr-TR') : "-",
          gercekZaman: d.kayitTarihi ? d.kayitTarihi.toDate().getTime() : 0,
          yil: d.kayitTarihi ? d.kayitTarihi.toDate().getFullYear().toString() : "",
          ay: d.kayitTarihi ? (d.kayitTarihi.toDate().getMonth() + 1).toString() : ""
        };
      });

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      data.forEach((d: any) => {
  if (d.yil) yillar.add(d.yil);
  if (d.hatAdi) hatlar.add(d.hatAdi);
});
      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());

      setLogs(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "ik" || role === "uretim") {
            window.location.href = "/";
          } else {
            setUserRole(role);
            fetchArsiv();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu bakım kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "pm_logs", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  const filteredLogs = logs.filter(log => {
    if (filterYil && log.yil !== filterYil) return false;
    if (filterAy && log.ay !== filterAy) return false;
    if (filterHat && log.hatAdi !== filterHat) return false;
    return true;
  });

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
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-teal-400 print:text-black">🗄️ Periyodik Bakım (PM) Arşivi</h1>
              <p className="text-gray-400 mt-1 print:text-black">Sahadan doldurulan tüm periyodik bakım (Checklist) formlarının dökümü.</p>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">PDF Çıktısı Al</button>
              <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          {/* YENİ: PM ARŞİVİ FİLTRE ÇUBUĞU */}
          <div className="bg-gray-900 border border-teal-800/50 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Yıl</label>
              <select value={filterYil} onChange={e => setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Ay</label>
              <select value={filterAy} onChange={e => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Üretim Hattı</label>
              <select value={filterHat} onChange={e => setFilterHat(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterHat("");}} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Periyodik Bakım (PM) Gerçekleşme Raporu</h2>
            <p className="text-gray-600">Filtre: Yıl {filterYil || "Tümü"} | Ay {filterAy || "Tümü"} | Hat {filterHat || "Tümü"}</p>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-teal-800/50 p-6 rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.15)] overflow-x-auto print:border-none print:shadow-none print:p-0">
            {filteredLogs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıtlı periyodik bakım formu bulunmuyor.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th>
                    <th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-teal-400 print:text-black">Bakım Yapılan Makine</th>
                    <th className="pb-3 px-2">Periyot</th>
                    <th className="pb-3 px-2 text-red-400 print:text-black">Hatalı Madde / Check</th>
                    <th className="pb-3 px-2 min-w-[200px]">Açıklama</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2 text-gray-400 text-xs print:text-black font-bold">{log.tarihFormatli} <br/><span className="text-gray-500">{log.vardiya}</span></td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 font-bold text-white print:text-black text-base">{log.makineKodu}</td>
                      <td className="py-4 px-2 text-gray-400 print:text-black text-xs">{log.bakimPeriyodu}</td>
                      <td className="py-4 px-2 font-bold">
                        {log.hataliMaddeSayisi > 0 ? (
                          <span className="bg-red-900/30 text-red-400 px-3 py-1 rounded-full border border-red-800/50 print:border-none print:text-red-700">
                            {log.hataliMaddeSayisi} Sorun Çıktı!
                          </span>
                        ) : (
                          <span className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full border border-green-800/50 print:border-none print:text-green-700">
                            Sorunsuz (0)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-gray-300 print:text-black text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{log.aciklama}</td>
                      
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right no-print">
                          <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded">Sil</button>
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
    </>
  );
}'''
files["app/admin/personel/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function PersonelYonetimi() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kullanicilar, setKullanicilar] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const currentUserRef = doc(db, "users", user.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        
        if (currentUserSnap.exists() && currentUserSnap.data().role === "admin") {
          setIsAdmin(true);
          fetchKullanicilar();
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchKullanicilar = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      data.sort((a: any, b: any) => {
        if (a.isApproved === b.isApproved) return 0;
        return a.isApproved ? 1 : -1;
      });
      
      setKullanicilar(data);
    } catch (error) {
      console.error("Kullanıcılar çekilirken hata:", error);
    }
    setLoading(false);
  };

  const handleLocalRoleChange = (userId: string, val: string) => {
    setKullanicilar(prev => prev.map(u => u.id === userId ? { ...u, role: val } : u));
  };

  const handleOnayla = async (userId: string, currentRole: string) => {
    if (!currentRole) return alert("Lütfen onaylamadan önce listeden bir rol seçiniz!");
    try {
      await updateDoc(doc(db, "users", userId), { isApproved: true, role: currentRole });
      alert("Personel başarıyla onaylandı.");
      fetchKullanicilar();
    } catch (error) {
      alert("Onaylama sırasında hata oluştu.");
    }
  };

  const handleRolDegistir = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      alert("Rol başarıyla güncellendi.");
      fetchKullanicilar();
    } catch (error) {
      alert("Rol güncellenirken hata oluştu.");
    }
  };

  const handleSil = async (userId: string) => {
    if (!window.confirm("DİKKAT: Bu personelin sisteme erişimini tamamen silmek istediğinize emin misiniz?")) return;
    try {
      // 1. Kullanıcıyı Firestore veritabanından sileriz
      await deleteDoc(doc(db, "users", userId));
      alert("Kullanıcı kaydı başarıyla silindi. (Not: Bu kişi kendi şifresiyle tekrar kayıt olabilir ancak yine onayınıza düşecektir).");
      fetchKullanicilar();
    } catch (error) {
      alert("Silme işlemi başarısız.");
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
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`YÜKLENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-purple-400 font-bold mb-1 text-sm tracking-wider uppercase">Yetki Yönetimi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Sistem Personel Kontrolü
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Giriş ekranından (Google veya Şifre ile) sisteme kayıt olan personelleri onaylayın ve rollerini atayın.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold shadow-lg transition flex items-center border border-gray-700">← Panele Dön</Link>
        </div>

        <div className="overflow-x-auto bg-gray-900 rounded-xl border border-gray-700 shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800">
              <tr className="text-gray-400 text-sm">
                <th className="py-4 px-4 font-bold border-b border-gray-700">İsim Soyisim</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">E-Posta Adresi</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">Sistem Durumu</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">Kullanıcı Rolü (Yetki)</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((user) => (
                <tr key={user.id} className={`border-b border-gray-800 transition ${user.isApproved ? 'hover:bg-gray-800/50' : 'bg-red-900/10 hover:bg-red-900/20'}`}>
                  <td className="py-4 px-4 font-bold text-white">{user.name}</td>
                  <td className="py-4 px-4 text-gray-400 text-sm">{user.email}</td>
                  <td className="py-4 px-4">
                    {user.isApproved ? (
                      <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-800/50">✅ Onaylı</span>
                    ) : (
                      <span className="bg-red-900/40 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-800/50 animate-pulse">⏳ Bekliyor</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <select 
                      value={user.role || ""} 
                      onChange={(e) => {
                        if (user.isApproved) handleRolDegistir(user.id, e.target.value);
                        else handleLocalRoleChange(user.id, e.target.value);
                      }}
                      className={`bg-gray-900 border rounded-lg p-2 text-sm focus:outline-none w-full min-w-[160px] ${!user.role && !user.isApproved ? 'border-red-500 text-red-400' : 'border-gray-600 text-gray-300 focus:border-purple-500'}`}
                    >
                      <option value="">-- Rol Seçin --</option>
                      <option value="admin">Yönetici (Admin)</option>
                      <option value="teknisyen">Bakım Teknisyeni</option>
                      <option value="operator">Teknik Operatör</option>
                      <option value="uretim">Üretim Bildiricisi</option>
                      <option value="isg">İSG (Güvenlik)</option>
                      <option value="depo">Depo ve Stok Sorumlusu</option>
                    </select>
                  </td>
                  <td className="py-4 px-4 text-right flex justify-end gap-2">
                    {!user.isApproved && (
                      <button onClick={() => handleOnayla(user.id, user.role)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg">Onayla</button>
                    )}
                    <button onClick={() => handleSil(user.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 px-4 py-2 rounded-lg text-xs font-bold transition">Sil</button>
                  </td>
                </tr>
              ))}
              {kullanicilar.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Sistemde onay bekleyen veya kayıtlı kullanıcı bulunmamaktadır.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}'''
files["app/admin/pm-setup/page.tsx"] = r'''"use client";

import { useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function PMSetup() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");

  const baslat = async () => {
    if (!window.confirm("DİKKAT: Sistemdeki tüm makinelerin bakım periyodu '3 AYLIK' olarak güncellenecektir. Onaylıyor musunuz?")) return;
    
    setLoading(true);
    try {
      setLog("Veritabanına bağlanılıyor...");
      
      const snap = await getDocs(collection(db, "pm_master_plan"));
      const makineler = snap.docs;
      
      setLog(`${makineler.length} adet makine bulundu. Güncelleme başlıyor...`);
      
      let sayac = 0;
      for (const makine of makineler) {
        sayac++;
        // Mevcut kaydın sadece 'siklik' alanını 3 AYLIK olarak eziyoruz
        await updateDoc(doc(db, "pm_master_plan", makine.id), {
          siklik: "3 AYLIK"
        });
        setLog(`Güncelleniyor: ${sayac} / ${makineler.length} (${makine.id}) -> 3 AYLIK yapıldı`);
      }

      setLog("HARİKA! Sistemdeki tüm makinelerin bakım sıklığı 3 AYLIK olarak güncellendi.");
    } catch (error: any) {
      setLog("Hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center text-white p-4">
      <div className="bg-gray-900 border border-teal-500 p-8 rounded-xl max-w-xl w-full shadow-[0_0_20px_rgba(20,184,166,0.2)]">
        <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-2xl font-bold text-teal-400 mb-4">Periyot Güncelleme Aracı</h1></div>
        <p className="text-gray-400 mb-6">Aşağıdaki butona bastığınızda, sistemdeki tüm makinelerin bakım sıklığı otomatik olarak 3 AYLIK olarak düzeltilecektir.</p>
        
        <button onClick={baslat} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 font-bold py-4 rounded-lg transition disabled:opacity-50 text-white shadow-lg">
          {loading ? "Veriler Güncelleniyor..." : "Tümünü 3 AYLIK Olarak Düzelt"}
        </button>

        <div className="mt-6 p-4 bg-black border border-gray-800 rounded font-mono text-sm text-green-400 min-h-[100px]">
          {log || "Bekleniyor..."}
        </div>

        <div className="mt-8 text-center">
          <a href="/admin" className="text-gray-500 hover:text-white transition">← İşlem bitince Admin Panele Dön</a>
        </div>
      </div>
    </div>
  );
}'''
files["app/admin/pm-takvim/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase"; 
import Link from "next/link";

export default function PeriyodikBakimTakvimi() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [takvimVerisi, setTakvimVerisi] = useState<any[]>([]);
  const [gosterilenVeri, setGosterilenVeri] = useState<any[]>([]);
  
  const [seciliAy, setSeciliAy] = useState("");
  const [seciliHat, setSeciliHat] = useState("");
  const [seciliDurum, setSeciliDurum] = useState("");

  const [hatListesi, setHatListesi] = useState<string[]>([]);

  // Excel'den yapay zeka ile çıkartılan, HAFTANIN BAŞLANGIÇ TARİHLERİNE GÖRE
  // Orijinal 165 satırlık KESİN 2026 BAKIM TARİHLERİ
  const excelMasterData = [
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "König Şekillendirme" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "König Şekillendirme" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Fermantasyon" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Fermantasyon" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Kesme" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Kesme" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Fırın" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Fırın" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Soğutma" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Soğutma" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Şoklama" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Şoklama" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Depanner" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Depanner" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-02-09", "hat": "SMALL PIECES", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-08-10", "hat": "SMALL PIECES", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Trivi  İşleme" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Trivi  İşleme" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Rademaker İşleme" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Rademaker İşleme" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Fermantasyon" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Fermantasyon" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Fırın" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Fırın" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Dekorlama" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Dekorlama" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Şoklama" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Şoklama" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-01-12", "hat": "PASTRY", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-09-07", "hat": "PASTRY", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-01-26", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-07-27", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-12-14", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Kestart" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Kestart" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Şekillendirme" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Şekillendirme" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Fermantasyon" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Fermantasyon" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Fırın" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Fırın" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Soğutma" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Soğutma" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Şoklama" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Şoklama" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-02", "hat": "SİMİT  HATTI", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-10-05", "hat": "SİMİT  HATTI", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Mikser" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Mikser" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Rheon" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Rheon" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Anko" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Anko" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Fırın" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Fırın" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "U Dönüş Modüler Bant" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "U Dönüş Modüler Bant" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Freezer" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Freezer" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Freezer Çıkış Palent Bant" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Freezer Çıkış Palent Bant" },
    { "tarih": "2026-04-27", "hat": "KURABİYE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-10-26", "hat": "KURABİYE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-16", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-07-13", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-11-23", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-01-01", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-05-11", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-12-21", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-01-01", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-05-11", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-12-21", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-01-01", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-05-11", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-12-21", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-01-01", "hat": "KEK", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-05-11", "hat": "KEK", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-12-21", "hat": "KEK", "ekipman": "Paketleme Makinaları" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAdmin(true); 
        loadExcelData();
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const loadExcelData = () => {
    setLoading(true);
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0); 

    const hatlar = new Set<string>();

    const islenmisVeri = excelMasterData.map(item => {
      hatlar.add(item.hat);
      
      const planTarihi = new Date(item.tarih);
      const ayStr = (planTarihi.getMonth() + 1).toString();
      
      // Eğer planlanan tarih bugünden önceyse, bu iş YAPILMIŞ (Tamamlanmış) sayılır.
      const isTamamlandi = planTarihi < bugun;

      return {
        ...item,
        tarihObj: planTarihi,
        tarihStr: planTarihi.toLocaleDateString('tr-TR'),
        ay: ayStr,
        durum: isTamamlandi ? "Tamamlandı" : "Bekliyor"
      };
    });

    islenmisVeri.sort((a, b) => a.tarihObj.getTime() - b.tarihObj.getTime());

    setHatListesi(Array.from(hatlar).sort());
    setTakvimVerisi(islenmisVeri);
    setGosterilenVeri(islenmisVeri);
    setLoading(false);
  };

  useEffect(() => {
    let filtrelenmis = takvimVerisi;
    if (seciliAy) {
      filtrelenmis = filtrelenmis.filter(v => v.ay === seciliAy);
    }
    if (seciliHat) {
      filtrelenmis = filtrelenmis.filter(v => v.hat === seciliHat);
    }
    if (seciliDurum) {
      filtrelenmis = filtrelenmis.filter(v => v.durum === seciliDurum);
    }
    setGosterilenVeri(filtrelenmis);
  }, [seciliAy, seciliHat, seciliDurum, takvimVerisi]);

  const exportToExcel = () => {
    if (gosterilenVeri.length === 0) return alert("Dışa aktarılacak veri bulunamadı.");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Planlanan Tarih;Durum;Üretim Hatti;Ekipman Adi\n";

    gosterilenVeri.forEach(row => {
      csvContent += `${row.tarihStr};${row.durum};${row.hat};${row.ekipman}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Yillik_Bakim_Plani_2026.csv`);
    document.body.appendChild(link);
    link.click();
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-gray-900 border border-teal-500/50 rounded-2xl shadow-2xl p-6 md:p-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6 gap-4">
          <div>
            <p className="text-teal-500 font-bold mb-1 text-sm tracking-wider uppercase">Excel Master Data Entegrasyonu</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              Yıllık Planlı Bakım Takvimi (2026)
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Gerçekleşen (Geçmiş) ve Bekleyen (Gelecek) bakım durumlarının otomatik renkli haritası.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={exportToExcel} className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Excel (CSV) İndir
            </button>
            <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition flex items-center">← Panele Dön</Link>
          </div>
        </div>

        {/* Filtreleme Alanı */}
        <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Ay Filtresi</label>
            <select value={seciliAy} onChange={(e) => setSeciliAy(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tüm Yıl</option>
              <option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option>
              <option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option>
              <option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option>
              <option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
            <select value={seciliHat} onChange={(e) => setSeciliHat(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tüm Hatlar</option>
              {hatListesi.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Durum</label>
            <select value={seciliDurum} onChange={(e) => setSeciliDurum(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tümü</option>
              <option value="Tamamlandı">✅ Yapılmış (Geçmiş)</option>
              <option value="Bekliyor">⏳ Bekleyen (Gelecek)</option>
            </select>
          </div>
          <button onClick={() => { setSeciliAy(""); setSeciliHat(""); setSeciliDurum(""); }} className="bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold hover:bg-gray-600 transition">Sıfırla</button>
        </div>

        {/* Takvim Tablosu */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-white">Listelenen Bakım Adedi: <span className="text-teal-400">{gosterilenVeri.length} İşlem</span></h3>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-800 shadow-md z-10">
                <tr className="text-gray-400">
                  <th className="py-4 px-4 border-b border-gray-700">Planlanan Tarih</th>
                  <th className="py-4 px-4 border-b border-gray-700">Sistem Durumu</th>
                  <th className="py-4 px-4 border-b border-gray-700">Üretim Hattı</th>
                  <th className="py-4 px-4 border-b border-gray-700">Ekipman</th>
                </tr>
              </thead>
              <tbody>
                {gosterilenVeri.length > 0 ? gosterilenVeri.map((row, index) => (
                  <tr key={index} className={`border-b border-gray-800 transition hover:bg-gray-800/80 ${row.durum === 'Tamamlandı' ? 'bg-green-900/10' : 'bg-orange-900/10'}`}>
                    <td className="py-4 px-4 font-bold text-white whitespace-nowrap">📅 {row.tarihStr}</td>
                    <td className="py-4 px-4">
                      {row.durum === "Tamamlandı" ? (
                        <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-800/50 flex items-center w-max gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Yapıldı
                        </span>
                      ) : (
                        <span className="bg-orange-900/40 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-800/50 flex items-center w-max gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Bekliyor
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-300 font-medium">{row.hat}</td>
                    <td className="py-4 px-4 font-bold text-teal-300">{row.ekipman}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">Seçili filtrelere uygun planlı bakım bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}'''
files["app/admin/tamamlanan-isler/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function TamamlananIsler() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [uretimPersonelleri, setUretimPersonelleri] = useState<string[]>([]);
  const [performansListesi, setPerformansListesi] = useState<any[]>([]);
  
  const [filterBildiren, setFilterBildiren] = useState("");
  const [filterAy, setFilterAy] = useState("");

  const fetchOrdersAndPerformans = async () => {
    try {
      const uQ = query(collection(db, "users"), where("role", "==", "uretim"));
      const uSnap = await getDocs(uQ);
      const uretimYetkilileriListesi = uSnap.docs.map(d => d.data().name);
      setUretimPersonelleri(uretimYetkilileriListesi.sort());

      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      
     const rawData: any[] = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().toLocaleString('tr-TR') : "Bilinmiyor",
          gercekZaman: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().getTime() : 0,
          kayitAyi: d.kayitTarihi ? (d.kayitTarihi.toDate().getMonth() + 1).toString() : ""
        };
      });

      const filtrelenmisData = rawData.filter(d => {
        if (filterBildiren && d.bildirenKisi !== filterBildiren) return false;
        if (filterAy && d.kayitAyi !== filterAy) return false;
        return true;
      });
      setOrders(filtrelenmisData.sort((a, b) => b.gercekZaman - a.gercekZaman));

      const bildirimSayilari: Record<string, number> = {};
      rawData.forEach(d => {
        if (filterAy && d.kayitAyi !== filterAy) return;
        const bildiren = d.bildirenKisi;
        if (uretimYetkilileriListesi.includes(bildiren)) {
          if (!bildirimSayilari[bildiren]) bildirimSayilari[bildiren] = 0;
          bildirimSayilari[bildiren] += 1;
        }
      });

      const siralama = Object.keys(bildirimSayilari).map(k => ({
        isim: k, adet: bildirimSayilari[k]
      })).sort((a, b) => b.adet - a.adet);

      setPerformansListesi(siralama);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchOrdersAndPerformans();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, [filterBildiren, filterAy]); 

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "work_orders", id)); fetchOrdersAndPerformans(); } catch (error) { alert("Hata"); }
  };

  const handleGeriAl = async (id: string) => {
    if (!window.confirm("Bu iş yanlışlıkla tamamlandıysa tekrar 'Aktif Bekleyen İşler' listesine göndermek ister misiniz?")) return;
    try { 
      await updateDoc(doc(db, "work_orders", id), { durum: "Açık", tamamlayanKisi: "", tamamlanmaTarihi: null });
      fetchOrdersAndPerformans(); 
    } catch (error) { alert("Hata"); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-green-400">Tamamlanmış İş Emirleri Arşivi</h1>
            <p className="text-gray-400 mt-1">Teknisyenler tarafından çözülen ve kapatılan iş taleplerinin arşivi.</p>
          </div>
         <Link href={userRole === "uretim" || userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← İzleme Paneline Dön</Link>
        </div>

        {/* FİLTRELEME ÇUBUĞU */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Kayıt Ayı</label>
            <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm">
              <option value="">Tüm Aylar</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-purple-400 mb-1 font-bold">Bildiren Kişi (Üretim Yetkilisi)</label>
            <select value={filterBildiren} onChange={(e) => setFilterBildiren(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm">
              <option value="">Tüm Personeller</option>{uretimPersonelleri.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterAy(""); setFilterBildiren(""); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
        </div>

        {/* LİSTE */}
        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl shadow-lg overflow-x-auto mb-10">
          {orders.length === 0 ? <div className="text-center py-10 text-gray-500">Bu filtrelere uygun tamamlanmış iş emri bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tamamlanma Tarihi</th><th className="pb-3 px-2 text-purple-400">Bildiren (Üretim)</th><th className="pb-3 px-2 text-green-400">Kapatan (Teknisyen)</th><th className="pb-3 px-2">Hat / Ekipman</th><th className="pb-3 px-2 min-w-[200px]">Arıza Tanımı</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-400 text-xs">{o.tarihFormatli}</td>
                    <td className="py-4 px-2 font-bold text-purple-400">{o.bildirenKisi}</td>
                    <td className="py-4 px-2 font-bold text-green-400">{o.tamamlayanKisi}</td>
                    <td className="py-4 px-2"><div className="font-bold text-gray-200">{o.hatAdi}</div><div className="text-xs text-gray-500">{o.ekipmanAdi} ({o.sorunTipi})</div></td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{o.aciklama}</td>
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right space-x-2">
                        <button onClick={() => handleGeriAl(o.id)} className="bg-orange-900/50 text-orange-400 text-xs px-3 py-2 rounded mb-1">Geri Al</button>
                        <button onClick={() => handleSil(o.id)} className="bg-red-900/50 text-red-400 text-xs px-3 py-2 rounded">Sil</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ÜRETİM YETKİLİSİ LİDERLİK TABLOSU */}
        <div className="bg-gray-900 border border-purple-700/50 p-4 md:p-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.1)] overflow-x-auto">
          <h2 className="text-xl font-bold mb-6 text-purple-400 flex items-center gap-2">Üretim Yetkilisi Bildirim Performansı (İlk 3 Lider)</h2>
          {performansListesi.length === 0 ? <div className="text-gray-500 py-4">Filtreye uygun bildirim yapan üretim yetkilisi bulunamadı.</div> : (
            <table className="w-full text-left text-sm md:text-base border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-4">Sıralama</th><th className="pb-3 px-4">Üretim Yetkilisi Adı</th><th className="pb-3 px-4 text-purple-400">Açtığı İş Emri / Bildirim Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {performansListesi.slice(0, 3).map((p, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</td>
                    <td className="py-4 px-4 font-bold text-gray-200">{p.isim}</td>
                    <td className="py-4 px-4"><span className="bg-purple-900/30 text-purple-400 font-bold px-4 py-1 rounded-full border border-purple-800/50">{p.adet} Adet Bildirim</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}'''
files["app/dashboard/kontrol-formlari/hidrofor/arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function HidroforArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_hidrofor"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role); fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_hidrofor", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div><h1 className="text-2xl font-bold text-blue-500 print:text-black">🗄️ Hidrofor Dairesi Kontrol Arşivi</h1></div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Hidrofor Dairesi Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2">Sertlik</th><th className="pb-3 px-2">Ham Su</th><th className="pb-3 px-2">Yangın P.</th><th className="pb-3 px-2">Yumuşak Su</th>
                    <th className="pb-3 px-2">Tuz Durumu</th><th className="pb-3 px-2 text-red-400 print:text-black">Kaçak Kontrolü</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 font-bold print:text-black">{log.tarih} <br/><span className="text-xs font-normal text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.sertlikSonucu}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.hamSuDeposuOk ? <span className="text-green-400 print:text-black font-bold">Normal</span> : <span className="text-red-400 print:text-black font-bold">Hatalı</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.yanginPompasiOk ? <span className="text-green-400 print:text-black font-bold">Normal</span> : <span className="text-red-400 print:text-black font-bold">Hatalı</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.yumusakSuDeposuOk ? <span className="text-green-400 print:text-black font-bold">Normal</span> : <span className="text-red-400 print:text-black font-bold">Hatalı</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.tuzSeviyesiOk ? <span className="text-green-400 print:text-black font-bold">Tam</span> : <span className="text-orange-400 print:text-black font-bold">Eklendi: {log.eklenenTuzKg}kg</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.kacakDurum === "YOK" ? <span className="text-green-400 print:text-black font-bold">YOK</span> : <span className="text-red-400 print:text-black font-bold">VAR: {log.kacakDetayi}</span>}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/dashboard/kontrol-formlari/hidrofor/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function HidroforFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Checkbox'lar
  const [chkHamSu, setChkHamSu] = useState(false);
  const [chkYangin, setChkYangin] = useState(false);
  const [chkYumusakSu, setChkYumusakSu] = useState(false);
  
  // Tuz Seviyesi Mantığı
  const [chkTuzTam, setChkTuzTam] = useState(true); // Tikliyse tuz tamdır, giriş alanı kaybolur
  const [eklenenTuzKg, setEklenenTuzKg] = useState("");

  const [sertlikSonucu, setSertlikSonucu] = useState("");
  
  // Kaçak Sızıntı Mantığı
  const [kacakDurum, setKacakDurum] = useState("YOK");
  const [kacakDetay, setKacakDetay] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) setUserName(userSnap.data().name);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya || !sertlikSonucu) return alert("Vardiya ve Sertlik Ölçüm sonucu zorunludur.");
    if (!chkTuzTam && !eklenenTuzKg) return alert("Tuz seviyesi onaysız! Lütfen eklenen tuz miktarını giriniz.");
    if (kacakDurum === "VAR" && !kacakDetay) return alert("Kaçak tespit edildi. Lütfen müdahale/detay bilgisini giriniz.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_hidrofor"), {
        tarih, vardiya, personel: userName,
        hamSuDeposuOk: chkHamSu,
        yanginPompasiOk: chkYangin,
        yumusakSuDeposuOk: chkYumusakSu,
        tuzSeviyesiOk: chkTuzTam,
        eklenenTuzKg: chkTuzTam ? "0" : eklenenTuzKg,
        sertlikSonucu: sertlikSonucu,
        kacakDurum: kacakDurum,
        kacakDetayi: kacakDurum === "VAR" ? kacakDetay : "Sorun Yok",
        kayitTarihi: new Date()
      });
      alert("Hidrofor Dairesi formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-blue-500/50 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-blue-500">Hidrofor Dairesi Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-4">
            <h3 className="text-blue-400 font-bold mb-4 border-b border-gray-700 pb-2">Durum Onayları (Kutuyu İşaretleyin)</h3>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkHamSu} onChange={e => setChkHamSu(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkHamSu ? 'text-green-400' : 'text-gray-300'}`}>Ham Su Deposu Seviye Normal</span>
            </label>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkYangin} onChange={e => setChkYangin(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkYangin ? 'text-green-400' : 'text-gray-300'}`}>Yangın Pompası Panosu Aktif</span>
            </label>

            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkYumusakSu} onChange={e => setChkYumusakSu(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkYumusakSu ? 'text-green-400' : 'text-gray-300'}`}>Yumuşak Su Deposu Seviye Normal</span>
            </label>

            {/* AKILLI TUZ SEVİYESİ */}
            <div className="mt-6 border-t border-gray-700 pt-4">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkTuzTam} onChange={e => setChkTuzTam(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkTuzTam ? 'text-green-400' : 'text-red-400'}`}>
                  {chkTuzTam ? "Tuz Seviyesi Tam" : "Tuz Seviyesi Düşük (Tuz Eklendi)"}
                </span>
              </label>
              
              {/* EĞER TİK KALDIRILIRSA BU KUTU AÇILIR */}
              {!chkTuzTam && (
                <div className="ml-10 mt-3 animate-fade-in border-l-4 border-red-500 pl-4">
                  <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Tuz Miktarı (Kg)</label>
                  <input type="number" value={eklenenTuzKg} onChange={e => setEklenenTuzKg(e.target.value)} placeholder="Örn: 50" className="w-full max-w-xs bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-blue-400 font-bold mb-1">Su Sertlik Ölçüm Sonucu (Fr)</label>
              <input type="text" value={sertlikSonucu} onChange={e => setSertlikSonucu(e.target.value)} placeholder="Örn: 0.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-blue-500" />
            </div>

            {/* AKILLI KAÇAK SIZINTI KONTROLÜ */}
            <div>
              <label className="block text-sm text-blue-400 font-bold mb-1">Kaçak / Sızıntı Kontrolü</label>
              <select value={kacakDurum} onChange={e => setKacakDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none ${kacakDurum === 'YOK' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
                <option value="YOK">YOK (Sistem Temiz)</option>
                <option value="VAR">VAR (Müdahale Gerekiyor)</option>
              </select>
            </div>
          </div>

          {kacakDurum === "VAR" && (
            <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-800/30 p-4 rounded-xl">
              <label className="block text-sm text-red-400 font-bold mb-1">Kaçak Bölgesi ve Yapılan İşlem</label>
              <textarea value={kacakDetay} onChange={e => setKacakDetay(e.target.value)} rows={3} placeholder="Nerede sızıntı var, ne yapıldı?..." className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Hidrofor Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/kontrol-formlari/jenerator/arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function JeneratorArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_jenerator"), orderBy("kayitTarihi", "desc"));
      setLogs((await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role); fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Kalıcı olarak silinecek, emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_jenerator", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <h1 className="text-2xl font-bold text-yellow-500 print:text-black">🗄️ Jeneratör Kontrol Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Jeneratör Grubu Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2">Jeneratör 1</th><th className="pb-3 px-2">Jeneratör 2</th><th className="pb-3 px-2">Jeneratör 3</th>
                    <th className="pb-3 px-2 text-yellow-500 print:text-black">Mazot Durumu</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 font-bold print:text-black">{log.tarih} <br/><span className="text-xs text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.jen1Ok ? <span className="text-green-400 print:text-black font-bold">Çalıştı</span> : <span className="text-red-400 print:text-black font-bold">Arıza</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.jen2Ok ? <span className="text-green-400 print:text-black font-bold">Çalıştı</span> : <span className="text-red-400 print:text-black font-bold">Arıza</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.jen3Ok ? <span className="text-green-400 print:text-black font-bold">Çalıştı</span> : <span className="text-red-400 print:text-black font-bold">Arıza</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.mazotDurum === "DOLU" ? <span className="text-green-400 print:text-black font-bold">Yeterli</span> : <span className="text-orange-400 print:text-black font-bold">Eklendi: {log.eklenenMazotLt}Lt</span>}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/dashboard/kontrol-formlari/jenerator/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function JeneratorFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Checkbox'lar
  const [chkJenerator1, setChkJenerator1] = useState(false);
  const [chkJenerator2, setChkJenerator2] = useState(false);
  const [chkJenerator3, setChkJenerator3] = useState(false);
  
  // Mazot Tankı Mantığı
  const [mazotDurumu, setMazotDurumu] = useState("DOLU");
  const [eklenenMazotLt, setEklenenMazotLt] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) setUserName(userSnap.data().name);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya) return alert("Vardiya seçimi zorunludur.");
    if (mazotDurumu === "BOŞ" && !eklenenMazotLt) return alert("Mazot seviyesi BOŞ seçildi. Lütfen eklenen miktarı giriniz.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_jenerator"), {
        tarih, vardiya, personel: userName,
        jen1Ok: chkJenerator1,
        jen2Ok: chkJenerator2,
        jen3Ok: chkJenerator3,
        mazotDurum: mazotDurumu,
        eklenenMazotLt: mazotDurumu === "BOŞ" ? eklenenMazotLt : "Ekleme Yapılmadı",
        kayitTarihi: new Date()
      });
      alert("Jeneratör Dairesi formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-yellow-500/50 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-yellow-500">Jeneratör Haftalık Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-yellow-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-yellow-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-4">
            <h3 className="text-yellow-400 font-bold mb-4 border-b border-gray-700 pb-2">Jeneratör Çalışma (Test) Onayları</h3>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator1} onChange={e => setChkJenerator1(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator1 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-1 Sorunsuz Çalıştı</span>
            </label>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator2} onChange={e => setChkJenerator2(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator2 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-2 Sorunsuz Çalıştı</span>
            </label>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator3} onChange={e => setChkJenerator3(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator3 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-3 Sorunsuz Çalıştı</span>
            </label>

            {/* AKILLI MAZOT TANKI SEVİYESİ */}
            <div className="mt-6 border-t border-gray-700 pt-6">
              <label className="block text-sm text-yellow-400 font-bold mb-3">Ortak Mazot Tankı Seviyesi</label>
              <select value={mazotDurumu} onChange={e => setMazotDurumu(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${mazotDurumu === 'DOLU' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
                <option value="DOLU">DOLU (Seviye Yeterli)</option>
                <option value="BOŞ">BOŞ (Seviye Düşük - Yakıt Eklendi)</option>
              </select>

              {mazotDurumu === "BOŞ" && (
                <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-900/50 p-4 rounded-xl">
                  <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Yakıt Miktarı (Litre)</label>
                  <input type="number" value={eklenenMazotLt} onChange={e => setEklenenMazotLt(e.target.value)} placeholder="Örn: 250" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Jeneratör Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/kontrol-formlari/kazan/arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function KazanArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_kazan"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({ id: document.id, ...document.data() }));
      setLogs(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_kazan", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-orange-500 print:text-black">🗄️ Kazan Dairesi Kontrol Arşivi</h1>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Kazan Dairesi Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-orange-400 print:text-black">Kondens (°C)</th><th className="pb-3 px-2 text-orange-400 print:text-black">Buhar Sic. (°C)</th>
                    <th className="pb-3 px-2 text-orange-400 print:text-black">Basınç (Bar)</th><th className="pb-3 px-2 text-orange-400 print:text-black">İletkenlik</th>
                    <th className="pb-3 px-2 text-blue-400 print:text-black">Kimyasal Durumu</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 text-gray-300 print:text-black font-bold">{log.tarih} <br/><span className="text-xs font-normal text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.kondensSicaklik}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.buharSicaklik}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.buharBasinc}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.iletkenlik}</td>
                      <td className="py-4 px-2 text-xs print:text-black">
                        {log.kimyasalDurum === "DOLU" ? <span className="text-green-400 print:text-black font-bold">DOLU</span> : <span className="text-red-400 print:text-black font-bold">EKLENDİ: {log.eklenenKimyasal}</span>}
                      </td>
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/dashboard/kontrol-formlari/kazan/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function KazanFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  const [kondensSicaklik, setKondensSicaklik] = useState("");
  const [buharSicaklik, setBuharSicaklik] = useState("");
  const [buharBasinc, setBuharBasinc] = useState("");
  const [iletkenlik, setIletkenlik] = useState("");
  
  // Şartlı Alan (Kimyasal Tank)
  const [kimyasalDurum, setKimyasalDurum] = useState("DOLU");
  const [kimyasalMiktar, setKimyasalMiktar] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserName(userSnap.data().name);
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya || !kondensSicaklik || !buharSicaklik || !buharBasinc || !iletkenlik) {
      return alert("Lütfen formdaki tüm sıcaklık ve basınç değerlerini doldurun.");
    }
    if (kimyasalDurum === "BOŞ" && !kimyasalMiktar) {
      return alert("Kimyasal tankı BOŞ seçildi. Lütfen eklenen miktarı giriniz!");
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_kazan"), {
        tarih,
        vardiya,
        personel: userName,
        kondensSicaklik: Number(kondensSicaklik),
        buharSicaklik: Number(buharSicaklik),
        buharBasinc: Number(buharBasinc),
        iletkenlik: Number(iletkenlik),
        kimyasalDurum,
        eklenenKimyasal: kimyasalDurum === "BOŞ" ? kimyasalMiktar : "Ekleme Yapılmadı",
        kayitTarihi: new Date()
      });
      alert("Kazan Dairesi formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-orange-500/50 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-orange-500">Kazan Dairesi Günlük Kontrol</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label>
              <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-orange-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label>
              <input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Kondens Tank Sıcaklığı (°C)</label>
              <input type="number" step="0.1" value={kondensSicaklik} onChange={e => setKondensSicaklik(e.target.value)} placeholder="Örn: 85.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazan Sıcaklığı (°C)</label>
              <input type="number" step="0.1" value={buharSicaklik} onChange={e => setBuharSicaklik(e.target.value)} placeholder="Örn: 140" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazanı Basıncı (Bar)</label>
              <input type="number" step="0.1" value={buharBasinc} onChange={e => setBuharBasinc(e.target.value)} placeholder="Örn: 6.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazanı İletkenlik Değeri (µS/cm)</label>
              <input type="number" step="0.1" value={iletkenlik} onChange={e => setIletkenlik(e.target.value)} placeholder="Örn: 3000" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <label className="block text-sm font-bold text-gray-300 mb-3">Kazan Kimyasal Tankları Durumu</label>
            <select value={kimyasalDurum} onChange={e => setKimyasalDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${kimyasalDurum === 'DOLU' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
              <option value="DOLU">DOLU (Ekleme Yapılmadı)</option>
              <option value="BOŞ">BOŞ (Seviye Düşük - Ekleme Yapıldı)</option>
            </select>

            {kimyasalDurum === "BOŞ" && (
              <div className="animate-fade-in border-l-4 border-red-500 pl-4">
                <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Kimyasal Miktarı (Lt / Kg)</label>
                <input type="text" value={kimyasalMiktar} onChange={e => setKimyasalMiktar(e.target.value)} placeholder="Ne kadar kimyasal eklendi?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500" />
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Kazan Dairesi Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/kontrol-formlari/yangin/arsiv/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function YanginArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_yangin"), orderBy("kayitTarihi", "desc"));
      setLogs((await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role); fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Kalıcı olarak silinecek, emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_yangin", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <h1 className="text-2xl font-bold text-red-500 print:text-black">🗄️ Yangın Pompaları Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Yangın Pompaları Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-red-400 print:text-black">Sızıntı / Kaçak</th>
                    <th className="pb-3 px-2">Dizel Pompa</th><th className="pb-3 px-2">Elektrikli Pompa</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 font-bold print:text-black">{log.tarih} <br/><span className="text-xs text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.kacakDurum === "YOK" ? <span className="text-green-400 print:text-black font-bold">YOK</span> : <span className="text-red-400 print:text-black font-bold">VAR: {log.kacakDetay}</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.dizelPompaOk ? <span className="text-green-400 print:text-black font-bold">Sağlam</span> : <span className="text-red-400 print:text-black font-bold">Arıza: {log.dizelHata}</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.elektrikliPompaOk ? <span className="text-green-400 print:text-black font-bold">Sağlam</span> : <span className="text-red-400 print:text-black font-bold">Arıza: {log.elektrikliHata}</span>}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}'''
files["app/dashboard/kontrol-formlari/yangin/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function YanginFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Kaçak Sızıntı
  const [kacakDurum, setKacakDurum] = useState("YOK");
  const [kacakDetay, setKacakDetay] = useState("");

  // Pompalar
  const [chkDizel, setChkDizel] = useState(true);
  const [dizelHata, setDizelHata] = useState("");
  
  const [chkElektrikli, setChkElektrikli] = useState(true);
  const [elektrikliHata, setElektrikliHata] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) setUserName(userSnap.data().name);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya) return alert("Vardiya seçimi zorunludur.");
    if (kacakDurum === "VAR" && !kacakDetay) return alert("Kaçak detayı girilmelidir.");
    if (!chkDizel && !dizelHata) return alert("Dizel Pompa arızası seçildi, lütfen detay girin.");
    if (!chkElektrikli && !elektrikliHata) return alert("Elektrikli Pompa arızası seçildi, lütfen detay girin.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_yangin"), {
        tarih, vardiya, personel: userName,
        kacakDurum, kacakDetay: kacakDurum === "VAR" ? kacakDetay : "Sızıntı Yok",
        dizelPompaOk: chkDizel, dizelHata: chkDizel ? "Sorun Yok" : dizelHata,
        elektrikliPompaOk: chkElektrikli, elektrikliHata: chkElektrikli ? "Sorun Yok" : elektrikliHata,
        kayitTarihi: new Date()
      });
      alert("Yangın Pompası formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-red-500/50 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-red-500">Yangın Pompaları Haftalık Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-red-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-red-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <label className="block text-sm text-red-400 font-bold mb-3">Kaçak / Sızıntı Kontrolü</label>
            <select value={kacakDurum} onChange={e => setKacakDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${kacakDurum === 'YOK' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
              <option value="YOK">YOK (Sistem Temiz)</option>
              <option value="VAR">VAR (Müdahale Gerekiyor)</option>
            </select>
            {kacakDurum === "VAR" && (
              <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-900/50 p-4 rounded-xl">
                <label className="block text-sm text-red-400 font-bold mb-1">Kaçak Bölgesi ve Yapılan İşlem</label>
                <textarea value={kacakDetay} onChange={e => setKacakDetay(e.target.value)} rows={2} placeholder="Nerede sızıntı var, ne yapıldı?..." className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-6">
            <h3 className="text-red-400 font-bold border-b border-gray-700 pb-2">Pompa Test Onayları (Kutuyu Kaldırırsanız Hata Alanı Açılır)</h3>
            
            <div className="space-y-3">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkDizel} onChange={e => setChkDizel(e.target.checked)} className="w-6 h-6 text-red-600 rounded focus:ring-red-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkDizel ? 'text-green-400' : 'text-red-400'}`}>{chkDizel ? "Dizel Pompa Sağlam" : "Dizel Pompa Arızalı"}</span>
              </label>
              {!chkDizel && <input type="text" value={dizelHata} onChange={e => setDizelHata(e.target.value)} placeholder="Dizel pompadaki arıza nedir?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 ml-2 text-white" />}
            </div>

            <div className="space-y-3 border-t border-gray-700 pt-4">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkElektrikli} onChange={e => setChkElektrikli(e.target.checked)} className="w-6 h-6 text-red-600 rounded focus:ring-red-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkElektrikli ? 'text-green-400' : 'text-red-400'}`}>{chkElektrikli ? "Elektrikli Pompa Sağlam" : "Elektrikli Pompa Arızalı"}</span>
              </label>
              {!chkElektrikli && <input type="text" value={elektrikliHata} onChange={e => setElektrikliHata(e.target.value)} placeholder="Elektrikli pompadaki arıza nedir?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 ml-2 text-white" />}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Yangın Pompası Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/kontrol-formlari/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function KontrolFormlariMenu() {
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          // IK ve Üretim Yetkilisi Giremez
          if (role === "ik" || role === "uretim") window.location.href = "/";
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
              ✅ Periyodik Kontrol Formları
            </h1>
            <p className="text-gray-400 mt-1">Sahadaki günlük ve haftalık donanım kontrollerini yapın veya arşivi inceleyin.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Panele Dön
          </Link>
        </div>

        {/* 1. KAZAN DAİRESİ */}
        <div className="bg-gray-900 border border-orange-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-orange-500 mb-4 border-b border-gray-800 pb-2">Kazan Dairesi Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/kazan" className="bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Günlük Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/kazan/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 2. HİDROFOR DAİRESİ */}
        <div className="bg-gray-900 border border-blue-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-blue-500 mb-4 border-b border-gray-800 pb-2">Hidrofor Dairesi Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/hidrofor" className="bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Günlük Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/hidrofor/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 3. JENERATÖR */}
        <div className="bg-gray-900 border border-yellow-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-yellow-500 mb-4 border-b border-gray-800 pb-2">Jeneratör Grubu Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/jenerator" className="bg-yellow-600 hover:bg-yellow-500 text-black py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Haftalık Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/jenerator/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

        {/* 4. YANGIN POMPALARI */}
        <div className="bg-gray-900 border border-red-700/50 p-6 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-2xl font-bold text-red-500 mb-4 border-b border-gray-800 pb-2">Yangın Pompaları Modülü</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/kontrol-formlari/yangin" className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold text-center shadow-lg transition">
              📝 Haftalık Kontrol Formunu Doldur
            </Link>
            <Link href="/dashboard/kontrol-formlari/yangin/arsiv" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 py-4 rounded-xl font-semibold text-center transition">
              🗄️ Kontrol Arşivine Git
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}'''
files["app/dashboard/mesai/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function MesaiGiris() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // Form State'leri
  const [tarih, setTarih] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [tur, setTur] = useState("");
  const [evdenCagirma, setEvdenCagirma] = useState("Yok");
  const [aciklama, setAciklama] = useState("");
  const [hesaplananDakika, setHesaplananDakika] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserName(userSnap.data().name);
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Süre Hesaplama Algoritması (Gece yarısını geçen mesaileri algılar)
  useEffect(() => {
    if (tarih && baslangic && bitis) {
      const basSaati = new Date(`${tarih}T${baslangic}`);
      const bitSaati = new Date(`${tarih}T${bitis}`);
      
      // Eğer bitiş saati başlangıçtan küçükse (Örn: 22:00'da girip 06:00'da çıktıysa) 1 gün ekle
      if (bitSaati < basSaati) {
        bitSaati.setDate(bitSaati.getDate() + 1);
      }

      let farkDakika = Math.floor((bitSaati.getTime() - basSaati.getTime()) / 60000);
      
      // Evden çağırma varsa +2 Saat (120 Dk) ekle
      if (evdenCagirma === "Var") farkDakika += 120;

      setHesaplananDakika(Math.max(0, farkDakika));
    } else {
      setHesaplananDakika(0);
    }
  }, [tarih, baslangic, bitis, evdenCagirma]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarih || !baslangic || !bitis || !tur || aciklama.length < 5) {
      setMesaj("Lütfen tüm alanları eksiksiz doldurun (Açıklama min 5 karakter).");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "overtime_logs"), {
        personel: userName,
        tarih: tarih, // YYYY-MM-DD
        baslangicSaati: baslangic,
        bitisSaati: bitis,
        mesaiTuru: tur,
        evdenCagirma: evdenCagirma,
        ekstraSureDk: evdenCagirma === "Var" ? 120 : 0,
        toplamMesaiDk: hesaplananDakika,
        aciklama: aciklama,
        kayitZamani: new Date()
      });
      
      setMesaj("BAŞARILI: Mesai kaydınız sisteme işlendi.");
      setTarih(""); setBaslangic(""); setBitis(""); setTur(""); setAciklama(""); setEvdenCagirma("Yok");
    } catch (error) {
      setMesaj("HATA: Kayıt başarısız.");
    } finally {
      setIsSubmitting(false);
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
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-blue-400">Fazla Mesai Formu</h1>
          <Link href="/dashboard" className="bg-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-700">← Arıza Paneline Dön</Link>
        </div>

        {mesaj && <div className={`p-4 mb-6 rounded-lg font-medium ${mesaj.includes("BAŞARILI") ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>{mesaj}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Mesai Tarihi</label>
              <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Başlangıç Saati</label>
              <input type="time" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bitiş Saati</label>
              <input type="time" value={bitis} onChange={(e) => setBitis(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Mesai Türü</label>
              <select value={tur} onChange={(e) => setTur(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3">
                <option value="">-- Seçiniz --</option>
                <option value="Normal Mesai">Normal Mesai</option>
                <option value="Haftalık İzin Mesaisi">Haftalık İzin Mesaisi</option>
                <option value="Resmi Tatil Mesaisi">Resmi Tatil Mesaisi</option>
                <option value="Vardiya Dönüşü Mesaisi">Vardiya Dönüşü Mesaisi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Evden Çağırma (+2 Saat)</label>
              <select value={evdenCagirma} onChange={(e) => setEvdenCagirma(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-orange-400 font-bold">
                <option value="Yok">Yok</option>
                <option value="Var">Var (TİS Gereği +2 Saat)</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-xl text-center">
            <p className="text-gray-400 text-sm">Hakediş (Otomatik Hesaplanan Toplam Süre)</p>
            <p className="text-3xl font-bold text-blue-400">
              {(hesaplananDakika / 60).toFixed(1)} <span className="text-lg text-gray-400">Saat</span> 
              <span className="text-sm font-normal text-gray-500 ml-2">({hesaplananDakika} dk)</span>
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Mesai Açıklaması (Yapılan İşler)</label>
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} placeholder="Hangi hatta ne iş yapıldı?..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"></textarea>
          </div>

          <button type="submit" disabled={isSubmitting || hesaplananDakika === 0} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl disabled:opacity-50">
            {isSubmitting ? "Kaydediliyor..." : "Mesai Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/pano-kayit/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function PanoKayit() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [panoAdi, setPanoAdi] = useState("");
  const [panoYeri, setPanoYeri] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          // İSG ve İK pano ekleyemez
          if (role === "isg" || role === "ik" || role === "uretim") {
            window.location.href = "/";
          } else {
            setUserRole(role);
            setUserName(userSnap.data().name);
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panoAdi || !panoYeri) return alert("Lütfen tüm alanları doldurun.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "electrical_panels"), {
        panoAdi,
        panoYeri,
        ekleyenPersonel: userName,
        kayitTarihi: new Date()
      });
      alert("Pano başarıyla sisteme kaydedildi!");
      setPanoAdi(""); setPanoYeri("");
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-indigo-500/50 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-indigo-400 flex items-center gap-2">🔌 Yeni Pano Kayıt Formu</h1>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Elektrik Panosunun Adı</label>
            <input 
              type="text" value={panoAdi} onChange={e => setPanoAdi(e.target.value)} 
              placeholder="Örn: MCC Ana Dağıtım Panosu" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Panonun Bulunduğu Yer (Hat / Bölge)</label>
            <input 
              type="text" value={panoYeri} onChange={e => setPanoYeri(e.target.value)} 
              placeholder="Örn: Kruvasan Hattı 2. Kat" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Panoyu Sisteme Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}'''
files["app/dashboard/pano-kontrol/page.tsx"] = r'''"use client";

import { useState, useEffect, Suspense } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PanoKontrolIcerik() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = useSearchParams();
  const panoId = searchParams.get("id");
  const panoAdi = searchParams.get("isim");
  const panoYeri = searchParams.get("yer");

  // Form State'leri
  const [chkTemizlik, setChkTemizlik] = useState(false);
  const [karDurumu, setKarDurumu] = useState("EVET"); // EVET / HAYIR

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserName(userSnap.data().name);
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panoId) return alert("Pano kimliği bulunamadı, lütfen listeden tekrar gelin.");

    setIsSubmitting(true);
    const kayitTarihi = new Date();

    try {
      // 1. EĞER TEMİZLİK YAPILDIYSA -> Pano Takip Arşivine Kaydet
      if (chkTemizlik) {
        await addDoc(collection(db, "pano_takip"), {
          panoAdi, panoYeri, personel: userName, islem: "Temizlik ve Kontrol Yapıldı", kayitTarihi
        });
      }

      // 2. EĞER KAR "HAYIR" İSE -> KAR Arşivine Kaydet VE İŞ EMRİ FIRLAT!
      if (karDurumu === "HAYIR") {
        // KAR Arşivi Logu
        await addDoc(collection(db, "kar_takip"), {
          panoAdi, panoYeri, personel: userName, durum: "KAR AKTİF DEĞİL (KAPALI)", kayitTarihi
        });

        // OTOMATİK İŞ EMRİ AÇ (Tüm Panellere Alarm Düşer)
        await addDoc(collection(db, "work_orders"), {
          hatAdi: panoYeri, // Hat bilgisi olarak panonun yerini alıyor
          ekipmanAdi: "KAR devreye alma", // Otomatik Ekipman
          sorunTipi: "Elektrik",
          aciklama: `ACİL İSG ALARMI: ${panoAdi} isimli panonun Kaçak Akım Rölesi devre dışı kalmıştır! Lütfen derhal müdahale edip KAR'ı devreye alın.`,
          isDuruslu: false,
          bildirenKisi: "SİSTEM OTOMASYONU",
          durum: "Açık", 
          kayitTarihi,
          tamamlayanKisi: "",
          tamamlanmaTarihi: null
        });
      }

      alert("Pano kontrol formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/pano-listesi";
    } catch (error) { 
      console.error(error); alert("Hata oluştu."); 
    } finally { 
      setIsSubmitting(false); 
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-indigo-500/50 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-indigo-400">Pano Temizlik ve Kontrol</h1>
          <Link href="/dashboard/pano-listesi" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-800/50 mb-8">
          <p className="text-indigo-200 text-sm font-medium">İşlem Yapılan Pano:</p>
          <p className="text-2xl font-bold text-white">{panoAdi}</p>
          <p className="text-sm text-gray-400">📍 {panoYeri}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* TEMİZLİK BÖLÜMÜ */}
          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <h3 className="text-gray-300 font-bold mb-4 border-b border-gray-700 pb-2">Rutin Pano Temizliği</h3>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded transition">
              <input type="checkbox" checked={chkTemizlik} onChange={e => setChkTemizlik(e.target.checked)} className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkTemizlik ? 'text-green-400' : 'text-gray-300'}`}>
                {chkTemizlik ? "✅ Pano İçi ve Dışı Temizlendi" : "Pano Temizliği Yapıldı"}
              </span>
            </label>
          </div>

          {/* KAR BÖLÜMÜ (HAYATİ BÖLÜM) */}
          <div className={`p-5 rounded-xl border-2 transition-colors ${karDurumu === 'HAYIR' ? 'bg-red-900/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-gray-800/50 border-gray-700'}`}>
            <label className={`block text-lg font-bold mb-3 ${karDurumu === 'HAYIR' ? 'text-red-400' : 'text-white'}`}>Kaçak Akım Rölesi (KAR) Aktif Mi?</label>
            <select 
              value={karDurumu} 
              onChange={e => setKarDurumu(e.target.value)} 
              className={`w-full p-4 rounded-lg font-bold border-2 focus:outline-none transition-colors ${karDurumu === 'EVET' ? 'bg-gray-800 text-green-400 border-gray-600' : 'bg-red-600 text-white border-red-400 animate-pulse'}`}
            >
              <option value="EVET">EVET (KAR Devrede ve Çalışıyor)</option>
              <option value="HAYIR">HAYIR (KAR Atmış veya Devre Dışı!)</option>
            </select>
            
            {karDurumu === "HAYIR" && (
              <p className="mt-3 text-sm text-red-300 font-bold">⚠️ DİKKAT: Kaydettiğiniz an tüm sisteme Acil İSG İş Emri fırlatılacaktır!</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Sisteme İşleniyor..." : "Pano Kontrolünü Kaydet"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div>Yükleniyor...</div>}><PanoKontrolIcerik /></Suspense>;
}'''
files["app/dashboard/pano-listesi/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PanoListesi() {
  const [panolar, setPanolar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  // YENİ: Pano Kayıt State'leri
  const [panoAdi, setPanoAdi] = useState("");
  const [panoYeri, setPanoYeri] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPanolar = async () => {
    try {
      const q = query(collection(db, "electrical_panels"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data()
      }));
      setPanolar(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "ik" || role === "uretim") {
            window.location.href = "/";
          } else {
            setUserRole(role);
            setUserName(userSnap.data().name);
            fetchPanolar();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  // YENİ: Pano Ekleme Fonksiyonu
  const handlePanoEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panoAdi || !panoYeri) return alert("Lütfen pano adı ve yerini girin.");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "electrical_panels"), {
        panoAdi, panoYeri, ekleyenPersonel: userName, kayitTarihi: new Date()
      });
      alert("Pano başarıyla eklendi!");
      setPanoAdi(""); setPanoYeri("");
      fetchPanolar(); // Tabloyu yenile
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu panoyu sistemden kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "electrical_panels", id)); fetchPanolar(); } catch (error) { alert("Hata."); }
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-indigo-400">🔌 Sistemdeki Elektrik Panoları</h1>
            <p className="text-gray-400 mt-1">Tesis genelindeki panoların kaydı, listesi ve kontrol erişimi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        {/* YENİ: PANO EKLEME FORMU (Üstte) */}
        <div className="bg-gray-900 border border-indigo-500/50 p-6 rounded-2xl shadow-[0_0_15px_rgba(99,102,241,0.15)] mb-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-auto flex-1">
            <label className="block text-sm text-indigo-300 font-bold mb-1">Yeni Pano Adı</label>
            <input type="text" value={panoAdi} onChange={e => setPanoAdi(e.target.value)} placeholder="Örn: MCC Ana Dağıtım" className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" />
          </div>
          <div className="w-full md:w-auto flex-1">
            <label className="block text-sm text-indigo-300 font-bold mb-1">Panonun Yeri (Hat/Bölge)</label>
            <input type="text" value={panoYeri} onChange={e => setPanoYeri(e.target.value)} placeholder="Örn: Kruvasan Hattı" className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" />
          </div>
          <button onClick={handlePanoEkle} disabled={isSubmitting} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-lg shadow-lg disabled:opacity-50 h-[48px]">
            {isSubmitting ? "Ekleniyor..." : "Sisteme Ekle"}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl shadow-lg overflow-x-auto">
          {panolar.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıtlı pano bulunmuyor. Lütfen yukarıdan ekleyin.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Pano Adı</th>
                  <th className="pb-3 px-2">Bulunduğu Yer</th>
                  <th className="pb-3 px-2 text-gray-500">Ekleyen</th>
                  <th className="pb-3 px-2 text-right">Aksiyon (Kontrol)</th>
                </tr>
              </thead>
              <tbody>
                {panolar.map(pano => (
                  <tr key={pano.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 font-bold text-white text-base">{pano.panoAdi}</td>
                    <td className="py-4 px-2 text-indigo-300 font-medium">{pano.panoYeri}</td>
                    <td className="py-4 px-2 text-gray-500 text-xs">{pano.ekleyenPersonel}</td>
                    <td className="py-4 px-2 text-right space-x-2 flex justify-end">
                      
                      <Link 
                        href={`/dashboard/pano-kontrol?id=${pano.id}&isim=${encodeURIComponent(pano.panoAdi)}&yer=${encodeURIComponent(pano.panoYeri)}`} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-lg transition"
                      >
                        ✅ Kontrol ve Temizlik Yap
                      </Link>

                      {userRole === "admin" && (
                        <button onClick={() => handleSil(pano.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded-lg transition border border-red-800/50">Sil</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}'''
files["app/dashboard/periyodik-bakim/page.tsx"] = r'''"use client";

import { useState, useEffect, Suspense } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PeriyodikBakimFormu() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [makineListesi, setMakineListesi] = useState<any[]>([]);
  const [seciliMakine, setSeciliMakine] = useState<any>(null);
  const [seciliMakineId, setSeciliMakineId] = useState("");
  const [yanitlar, setYanitlar] = useState<Record<number, string>>({});
  
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  const [aciklama, setAciklama] = useState("");

  const searchParams = useSearchParams();
  const pmWorkOrderId = searchParams.get("pmOrderId");
  const pmMakineKodu = searchParams.get("makine");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchMakineListesi();
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchMakineListesi = async () => {
    const snap = await getDocs(collection(db, "pm_master_plan"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const list = data.filter((d: any) => d.aktif).sort((a, b) => a.id.localeCompare(b.id));
    setMakineListesi(list);

    if (pmMakineKodu) {
      setSeciliMakineId(pmMakineKodu);
      const secilen = list.find(m => m.id === pmMakineKodu);
      if (secilen) setSeciliMakine(secilen);
    }
  };

  const handleMakineSecimi = (makineId: string) => {
    setSeciliMakineId(makineId);
    const secilen = makineListesi.find(m => m.id === makineId);
    setSeciliMakine(secilen);
    setYanitlar({}); 
  };

  const handleYanit = (index: number, durum: string) => {
    setYanitlar(prev => ({ ...prev, [index]: durum }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya) return alert("Vardiya seçimi zorunludur!");
    if (!seciliMakine) return alert("Lütfen bir makine seçiniz!");
    
    const eksikVarMi = seciliMakine.maddeler.some((_: any, index: number) => !yanitlar[index]);
    if (eksikVarMi) return alert("Lütfen tüm maddeleri işaretleyiniz.");

    setIsSubmitting(true);
    try {
      const hataliMaddeler = seciliMakine.maddeler.filter((madde: string, index: number) => yanitlar[index] === "Hatalı");

      await addDoc(collection(db, "pm_logs"), {
        makineKodu: seciliMakine.id, hatAdi: seciliMakine.hatAdi, ekipmanAdi: seciliMakine.ekipmanAdi,
        bakimPeriyodu: seciliMakine.siklik, tarih, vardiya, personel: userName, yanitlar: yanitlar, 
        hataliMaddeSayisi: hataliMaddeler.length,
        aciklama: aciklama || (hataliMaddeler.length > 0 ? "Kritik maddelerde sorun var." : "Tüm sistem sorunsuz."),
        kayitTarihi: new Date()
      });

      if (pmWorkOrderId) {
        await updateDoc(doc(db, "work_orders", pmWorkOrderId), {
          durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date()
        });
      }

      alert("Periyodik Bakım (PM) formu başarıyla mühürlendi!");
      window.location.href = "/dashboard"; 
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  // YENİ EKLENEN: Master Planı Excel'e Aktarma Fonksiyonu
  const exportMasterPlanToCSV = () => {
    if (makineListesi.length === 0) return alert("Dışa aktarılacak master plan bulunamadı.");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Makine Kodu;Hat Adi;Ekipman Adi;Bakim Periyodu;Kontrol Listesi (Checklist Maddeleri)\n";

    makineListesi.forEach(makine => {
      const makineKodu = makine.id || "-";
      const hat = makine.hatAdi || "-";
      const ekipman = makine.ekipmanAdi || "-";
      const periyot = makine.siklik || "-";
      // Checklist maddelerini Excel hücresi içinde okunaklı olması için " | " ile ayırarak yan yana yazdırıyoruz
      const maddeler = Array.isArray(makine.maddeler) ? makine.maddeler.join(" | ") : "-";

      csvContent += `${makineKodu};${hat};${ekipman};${periyot};${maddeler}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bakim_Master_Plani_${new Date().toLocaleDateString('tr-TR')}.csv`);
    document.body.appendChild(link);
    link.click();
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-gray-900 border border-teal-500/50 rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.15)] p-6 md:p-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4 gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-teal-400 flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            Dinamik Periyodik Bakım (PM) Formu
          </h1>
          
          {/* YENİ EKLENEN: Buton Grubu (Master Plan Çıktısı + Panele Dön) */}
          <div className="flex flex-wrap gap-3">
            {(userRole === "admin" || userRole === "operator" || userRole === "isg") && (
              <button onClick={exportMasterPlanToCSV} type="button" className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Master Plan Çıktısı Al
              </button>
            )}
            <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition flex items-center">← Panele Dön</Link>
          </div>
        </div>

        {pmWorkOrderId && (
          <div className="bg-teal-900/30 border border-teal-500/50 text-teal-400 p-4 rounded-xl mb-6 font-bold flex items-center gap-2">
            ✅ Alarmdan Yönlendirildi: Makine otomatik seçildi. Formu kaydettiğinizde Planlı Bakım İş Emri sistemden silinecektir.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Tarih</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border-gray-600 rounded-lg p-3 text-white focus:border-teal-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border-gray-600 rounded-lg p-3 text-white focus:border-teal-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-teal-400 font-bold mb-1">Bakım Yapılacak Makine</label>
              <select value={seciliMakineId} disabled={!!pmWorkOrderId} onChange={e => handleMakineSecimi(e.target.value)} className="w-full bg-gray-900 border-2 border-teal-800/50 rounded-lg p-4 text-white focus:border-teal-500 outline-none font-bold text-lg disabled:opacity-60">
                <option value="">-- Makine Seçiniz --</option>{makineListesi.map(m => <option key={m.id} value={m.id}>{m.id} (Periyot: {m.siklik})</option>)}
              </select>
            </div>
          </div>

          {seciliMakine && (
            <div className="bg-gray-800/50 p-6 rounded-xl border-2 border-teal-700/50 shadow-lg animate-fade-in">
              <div className="mb-6 border-b border-gray-700 pb-4">
                <h3 className="text-xl font-bold text-white mb-2">Makine Checklist: <span className="text-teal-400">{seciliMakine.ekipmanAdi}</span></h3>
              </div>
              <div className="space-y-4">
                {seciliMakine.maddeler.map((madde: string, index: number) => (
                  <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 border border-gray-700 p-4 rounded-lg gap-4">
                    <p className="flex-1 text-sm md:text-base text-gray-200"><span className="text-teal-500 font-bold mr-2">{index + 1}.</span> {madde}</p>
                    <div className="flex gap-2 min-w-[200px] justify-end">
                      <button type="button" onClick={() => handleYanit(index, "Sorunsuz")} className={`flex-1 px-4 py-2 text-xs font-bold rounded border ${yanitlar[index] === "Sorunsuz" ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>✅ Sorunsuz</button>
                      <button type="button" onClick={() => handleYanit(index, "Hatalı")} className={`flex-1 px-4 py-2 text-xs font-bold rounded border ${yanitlar[index] === "Hatalı" ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>❌ Hatalı</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seciliMakine && (
            <div className="animate-fade-in space-y-6">
              <div><textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3} placeholder="Hatalı maddeler için detaylı açıklama yazın..." className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-teal-500" /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
                {isSubmitting ? "Sisteme Mühürleniyor..." : "Periyodik Bakım Formunu Gönder"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}>
      <PeriyodikBakimFormu />
    </Suspense>
  );
}'''
files["app/dashboard/sayac/page.tsx"] = r'''"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function SayacOkuma() {
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [aktifSekme, setAktifSekme] = useState("Elektrik");
  const [sayaclar, setSayaclar] = useState<any[]>([]);
  const [gecmisOkumalar, setGecmisOkumalar] = useState<any[]>([]);
  const [girisDegerleri, setGirisDegerleri] = useState<Record<string, string>>({});
  const [seciliTarih, setSeciliTarih] = useState(new Date().toISOString().split('T')[0]);

  const [yeniSayacAdi, setYeniSayacAdi] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [duzenlenenLog, setDuzenlenenLog] = useState<any>(null);

  const fetchVeriler = async () => {
    try {
      const sayacSnap = await getDocs(collection(db, "meters"));
      setSayaclar(sayacSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const q = query(collection(db, "meter_logs"), orderBy("timestamp", "desc"));
      const logSnap = await getDocs(q);
      setGecmisOkumalar(logSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchVeriler();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSayacEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniSayacAdi) return;
    try {
      await addDoc(collection(db, "meters"), { name: yeniSayacAdi, tip: aktifSekme });
      setYeniSayacAdi(""); fetchVeriler();
    } catch (error) { alert("Hata!"); }
  };

  const handleTopluKayit = async () => {
    const doldurulanIdler = Object.keys(girisDegerleri).filter(id => girisDegerleri[id].trim() !== "");
    if (doldurulanIdler.length === 0) return alert("Sisteme işlenecek herhangi bir değer girmediniz!");
    if (!seciliTarih) return alert("Lütfen tarih seçiniz!");

    setIsSubmitting(true);
    try {
      for (const sayacId of doldurulanIdler) {
        const sayacAdi = sayaclar.find(s => s.id === sayacId)?.name || "Bilinmeyen Sayaç";
        await addDoc(collection(db, "meter_logs"), {
          tarih: seciliTarih, sayacAdi: sayacAdi, deger: Number(girisDegerleri[sayacId]), personel: userName, tip: aktifSekme, timestamp: new Date()
        });
      }
      alert("Tüm okumalar işlendi!"); setGirisDegerleri({}); fetchVeriler(); 
    } catch (error) { console.error(error); alert("Kaydedilemedi."); } finally { setIsSubmitting(false); }
  };

  const handleDuzenlemeKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "meter_logs", duzenlenenLog.id), { tarih: duzenlenenLog.tarih, sayacAdi: duzenlenenLog.sayacAdi, deger: Number(duzenlenenLog.deger) });
      alert("Kayıt güncellendi."); setEditModal(false); fetchVeriler();
    } catch (error) { alert("Güncellenemedi!"); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
    await deleteDoc(doc(db, "meter_logs", id)); fetchVeriler();
  };

  const filtrelenmisSayaclar = sayaclar.filter(s => s.tip === aktifSekme || (!s.tip && aktifSekme === "Elektrik"));
  const filtrelenmisOkumalar = gecmisOkumalar
    .filter(l => l.tip === aktifSekme || (!l.tip && aktifSekme === "Elektrik"))
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  const tema = aktifSekme === "Elektrik" ? "yellow" : aktifSekme === "Doğalgaz" ? "red" : "blue";
  const birim = aktifSekme === "Elektrik" ? "kWh" : aktifSekme === "Doğalgaz" ? "m³" : "Ton";

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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      
      {editModal && duzenlenenLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className={`bg-gray-900 border border-${tema}-500 rounded-2xl p-8 max-w-md w-full`}>
            <h2 className={`text-xl font-bold text-${tema}-400 mb-6`}>Okuma Düzenle</h2>
            <form onSubmit={handleDuzenlemeKaydet} className="space-y-4">
              <div><label className="block text-sm mb-1">Tarih</label><input type="date" value={duzenlenenLog.tarih} onChange={e => setDuzenlenenLog({...duzenlenenLog, tarih: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div><label className="block text-sm mb-1">Sayaç Adı</label><input type="text" value={duzenlenenLog.sayacAdi} onChange={e => setDuzenlenenLog({...duzenlenenLog, sayacAdi: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div><label className="block text-sm mb-1">Değer</label><input type="number" value={duzenlenenLog.deger} onChange={e => setDuzenlenenLog({...duzenlenenLog, deger: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div className="flex gap-4 pt-4"><button type="submit" className="flex-1 bg-blue-600 py-3 rounded-lg">Kaydet</button><button type="button" onClick={() => setEditModal(false)} className="flex-1 bg-gray-700 py-3 rounded-lg">İptal</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3">Enerji Sayaç Okuma</h1></div>
          
          {/* YENİ: Uretim yetkilisi de Panele dönebilir */}
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "uretim" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-gray-900 p-2 rounded-xl inline-flex">
          <button onClick={() => setAktifSekme("Elektrik")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Elektrik" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>⚡ Elektrik</button>
          <button onClick={() => setAktifSekme("Doğalgaz")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Doğalgaz" ? "bg-red-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>🔥 Doğalgaz</button>
          <button onClick={() => setAktifSekme("Su")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Su" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>💧 Su</button>
        </div>

        {userRole === "admin" && (
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex gap-4 items-end">
            <div className="flex-1"><label className={`block text-sm text-${tema}-400 mb-1 font-bold`}>Yeni {aktifSekme} Sayacı Tanımla</label><input type="text" value={yeniSayacAdi} onChange={e => setYeniSayacAdi(e.target.value)} placeholder={`Örn: Ana ${aktifSekme} Panosu`} className="w-full bg-gray-800 rounded-lg p-3" /></div>
            <button onClick={handleSayacEkle} className={`bg-${tema}-600 hover:bg-${tema}-500 px-6 py-3 rounded-lg font-bold`}>Ekle</button>
          </div>
        )}

        <div className={`bg-gray-900 border border-${tema}-600/30 p-6 rounded-xl shadow-lg mb-10`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-white">Toplu Değer Girişi ({aktifSekme})</h2>
            <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
              <span className="text-sm text-gray-400 font-bold pl-2">Okuma Tarihi:</span>
              <input type="date" value={seciliTarih} onChange={(e) => setSeciliTarih(e.target.value)} className={`bg-gray-900 border border-${tema}-500/50 rounded p-2 text-white text-sm outline-none`} />
            </div>
            {filtrelenmisSayaclar.length > 0 && <button onClick={handleTopluKayit} disabled={isSubmitting} className={`bg-${tema}-600 hover:bg-${tema}-500 font-bold px-6 py-2 rounded-lg disabled:opacity-50`}>{isSubmitting ? "İşleniyor..." : "Tüm Endeksleri İşle"}</button>}
          </div>
          
          {filtrelenmisSayaclar.length === 0 ? <div className="text-gray-500 py-4">Kayıtlı sayaç yok.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm mb-4">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 bg-gray-800/50">
                    <th className="p-3 w-1/3">Sayaç Adı</th><th className={`p-3 text-${tema}-400`}>Değer Girin ({birim})</th><th className="p-3 text-right">Kayıt Eden</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmisSayaclar.map(sayac => (
                    <tr key={sayac.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-3 font-bold text-gray-200">{sayac.name}</td>
                      <td className="p-3">
                        <input type="number" placeholder="Endeks..." value={girisDegerleri[sayac.id] || ""} onChange={(e) => setGirisDegerleri({...girisDegerleri, [sayac.id]: e.target.value})} className={`w-full max-w-[200px] bg-gray-800 border border-${tema}-500/50 rounded-lg p-2 focus:border-${tema}-400`} />
                      </td>
                      <td className="p-3 text-right text-gray-500">{userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={handleTopluKayit} disabled={isSubmitting} className={`w-full bg-${tema}-600 hover:bg-${tema}-500 font-bold py-4 rounded-xl disabled:opacity-50`}>{isSubmitting ? "Bekleyin..." : "TÜM ENDEKSLERİ İŞLE"}</button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-300">Geçmiş {aktifSekme} Okumaları</h2>
          {filtrelenmisOkumalar.length === 0 ? <div className="text-gray-500 py-4">Kayıt yok.</div> : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih</th><th className="pb-3 px-2">Sayaç Adı</th><th className={`pb-3 px-2 text-${tema}-400`}>Değer ({birim})</th><th className="pb-3 px-2">Personel</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {filtrelenmisOkumalar.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-2 text-gray-300 font-bold">{log.tarih}</td>
                    <td className="py-3 px-2 font-bold text-gray-200">{log.sayacAdi}</td>
                    <td className={`py-3 px-2 text-${tema}-400 font-bold text-lg`}>{log.deger}</td>
                    <td className="py-3 px-2 text-blue-300">{log.personel}</td>
                    {userRole === "admin" && (
                      <td className="py-3 px-2 text-right space-x-2">
                        <button onClick={() => { setDuzenlenenLog(log); setEditModal(true); }} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 text-xs px-3 py-1 rounded">Düzenle</button>
                        <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 text-xs px-3 py-1 rounded">Sil</button>
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
}'''
files["app/depo/kritik-stok/page.tsx"] = r'''"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import * as XLSX from "xlsx";

export default function KritikStokRaporu() {
  const [loading, setLoading] = useState(true);
  const [kritikParcalar, setKritikParcalar] = useState<any[]>([]);
  const [gosterilenKritikParcalar, setGosterilenKritikParcalar] = useState<any[]>([]);

  // YENİ EKLENEN: Filtre State'leri
  const [searchStokKodu, setSearchStokKodu] = useState("");
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterGun, setFilterGun] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");
  const [filterPersonel, setFilterPersonel] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "admin" || role === "depo") {
            fetchKritikStoklar();
          } else {
            window.location.href = "/dashboard";
          }
        }
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchKritikStoklar = async () => {
    setLoading(true);
    try {
      const partsSnap = await getDocs(collection(db, "spare_parts"));
      const kritikStoklarMap: Record<string, { ad: string, kalan: number, birim: string }> = {};
      
      partsSnap.forEach(d => {
        const p = d.data();
        if (p.mevcutMiktar <= 2) {
          kritikStoklarMap[d.id] = { ad: p.parcaAdi, kalan: p.mevcutMiktar, birim: p.birim };
        }
      });

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const birlesikRapor: any[] = [];

      logsSnap.forEach(d => {
        const data = d.data();
        if (data.yedekParcaKodu && kritikStoklarMap[data.yedekParcaKodu]) {
          const tObj = data.kayitTarihi ? data.kayitTarihi.toDate() : new Date();
          birlesikRapor.push({
            id: d.id,
            tarihObj: tObj,
            tarihStr: tObj.toLocaleString('tr-TR'),
            stokKodu: data.yedekParcaKodu,
            parcaAdi: kritikStoklarMap[data.yedekParcaKodu].ad,
            mevcutStok: kritikStoklarMap[data.yedekParcaKodu].kalan,
            birim: kritikStoklarMap[data.yedekParcaKodu].birim,
            hat: data.hatAdi || "-",
            ekipman: data.ekipmanAdi || "-",
            personel: Array.isArray(data.isiYapanlar) ? data.isiYapanlar.join(", ") : (data.bildirenKisi || "-")
          });
        }
      });

      birlesikRapor.sort((a, b) => b.tarihObj.getTime() - a.tarihObj.getTime());
      
      const essizRapor: any[] = [];
      const gorulenKodlar = new Set();
      
      for (const item of birlesikRapor) {
        if (!gorulenKodlar.has(item.stokKodu)) {
          gorulenKodlar.add(item.stokKodu);
          essizRapor.push(item);
        }
      }

      setKritikParcalar(essizRapor);
      setGosterilenKritikParcalar(essizRapor);
    } catch (error) {
      console.error("Kritik stoklar çekilirken hata:", error);
    }
    setLoading(false);
  };

  // YENİ EKLENEN: Filtreleme Algoritması
  useEffect(() => {
    let filtrelenmis = kritikParcalar;

    if (searchStokKodu) {
      filtrelenmis = filtrelenmis.filter(v => v.stokKodu.toLowerCase().includes(searchStokKodu.toLowerCase()) || v.parcaAdi.toLowerCase().includes(searchStokKodu.toLowerCase()));
    }
    if (filterYil) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && v.tarihObj.getFullYear().toString() === filterYil);
    }
    if (filterAy) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && (v.tarihObj.getMonth() + 1).toString() === filterAy);
    }
    if (filterGun) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && v.tarihObj.getDate().toString() === filterGun);
    }
    if (filterHat) {
      filtrelenmis = filtrelenmis.filter(v => v.hat === filterHat);
    }
    if (filterEkipman) {
      filtrelenmis = filtrelenmis.filter(v => v.ekipman === filterEkipman);
    }
    if (filterPersonel) {
      filtrelenmis = filtrelenmis.filter(v => v.personel.includes(filterPersonel));
    }

    setGosterilenKritikParcalar(filtrelenmis);
  }, [searchStokKodu, filterYil, filterAy, filterGun, filterHat, filterEkipman, filterPersonel, kritikParcalar]);

  const resetFilters = () => {
    setSearchStokKodu(""); setFilterYil(""); setFilterAy(""); setFilterGun(""); setFilterHat(""); setFilterEkipman(""); setFilterPersonel("");
  };

  const exportToXLSX = () => {
    if (gosterilenKritikParcalar.length === 0) return alert("Dışa aktarılacak kritik stok bulunamadı.");

    const excelData = gosterilenKritikParcalar.map(p => ({
      "Son Kullanım Tarihi": p.tarihStr,
      "Stok Kodu": p.stokKodu,
      "Malzeme Adı": p.parcaAdi,
      "Kalan Stok Miktarı": `${p.mevcutStok} ${p.birim}`,
      "Kullanılan Hat": p.hat,
      "Kullanılan Ekipman": p.ekipman,
      "Kullanan Personel": p.personel
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kritik_Stok_Raporu");
    XLSX.writeFile(workbook, `Kritik_Stok_Siparis_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
  };

  // Dinamik Dropdown Listeleri
  const uniqueYillar = Array.from(new Set(kritikParcalar.map(i => i.tarihObj?.getFullYear().toString()).filter(Boolean))).sort();
  const uniqueHatlar = Array.from(new Set(kritikParcalar.map(i => i.hat))).filter(h => h !== "-").sort();
  const uniqueEkipmanlar = Array.from(new Set(kritikParcalar.filter(i => !filterHat || i.hat === filterHat).map(i => i.ekipman))).filter(e => e !== "-").sort();
  const uniquePersonel = Array.from(new Set(kritikParcalar.map(i => i.personel))).filter(p => p !== "-").sort();

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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <div className="bg-gray-900 border border-red-500/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-red-400 font-bold mb-1 text-sm tracking-wider uppercase">Tedarik Zinciri ve Satın Alma</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Kritik Stok Bildirim Raporu
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Sistemde miktarı 2 veya daha altına düşmüş acil ihtiyaç listesi.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportToXLSX} className="bg-green-700 hover:bg-green-600 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              .XLSX İndir
            </button>
            <button onClick={() => window.history.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold transition shadow-lg border border-gray-700">← Geri Dön</button>
          </div>
        </div>

        {/* YENİ EKLENEN: Gelişmiş Filtreleme Bloğu */}
        {kritikParcalar.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 p-5 rounded-xl shadow-lg">
            <div className="mb-3">
              <input 
                type="text" 
                placeholder="🔍 Stok Kodu veya Malzeme Adı ile ara..." 
                value={searchStokKodu} 
                onChange={(e) => setSearchStokKodu(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-white focus:border-red-500"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500">
                <option value="">Tüm Yıllar</option>{uniqueYillar.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500">
                <option value="">Tüm Aylar</option>
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}. Ay</option>)}
              </select>
              <select value={filterGun} onChange={(e) => setFilterGun(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500">
                <option value="">Tüm Günler</option>
                {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filterHat} onChange={(e) => {setFilterHat(e.target.value); setFilterEkipman("");}} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500">
                <option value="">Tüm Hatlar</option>{uniqueHatlar.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm disabled:opacity-50 focus:border-red-500">
                <option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{uniqueEkipmanlar.map(ek => <option key={ek} value={ek}>{ek}</option>)}
              </select>
              <select value={filterPersonel} onChange={(e) => setFilterPersonel(e.target.value)} className="bg-gray-800 border border-gray-600 rounded-lg p-2 text-sm focus:border-red-500">
                <option value="">Tüm Personel</option>{uniquePersonel.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-sm text-red-400 font-bold">Bulunan Kritik Parça: {gosterilenKritikParcalar.length}</span>
              <button onClick={resetFilters} className="text-sm text-gray-400 hover:text-white underline">Filtreleri Temizle</button>
            </div>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-800 shadow-md z-10">
                <tr className="text-gray-400">
                  <th className="py-4 px-4 border-b border-gray-700">Son Kullanım Tarihi</th>
                  <th className="py-4 px-4 border-b border-gray-700">Stok Kodu / Malzeme Adı</th>
                  <th className="py-4 px-4 border-b border-gray-700">Mevcut Stok</th>
                  <th className="py-4 px-4 border-b border-gray-700">Kullanıldığı Yer</th>
                  <th className="py-4 px-4 border-b border-gray-700">Kullanan Personel</th>
                </tr>
              </thead>
              <tbody>
                {gosterilenKritikParcalar.length > 0 ? gosterilenKritikParcalar.map((row, index) => (
                  <tr key={index} className="border-b border-gray-800 transition hover:bg-red-900/30 bg-red-900/10">
                    <td className="py-4 px-4 font-medium text-gray-300 whitespace-nowrap">{row.tarihStr}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-red-300">{row.stokKodu}</div>
                      <div className="text-xs text-gray-400">{row.parcaAdi}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-black text-red-500 text-lg">{row.mevcutStok}</span> <span className="text-gray-500 text-xs">{row.birim}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-gray-200">{row.hat}</div>
                      <div className="text-xs text-teal-400">{row.ekipman}</div>
                    </td>
                    <td className="py-4 px-4 text-gray-300">{row.personel}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-500">Seçili filtrelere uygun kritik stok bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}'''

print("--- DFU TECH REPORT MASTER GÜNCELLEME V13 (IRONCLAD) ---")
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip())
    print(f"[BAŞARILI] {path} güncellendi.")
print("\nTAMAMLANDI: v9 Sarfiyat Fixi + v11 Animasyonlar + v12 Global Logo mühürlendi.")
