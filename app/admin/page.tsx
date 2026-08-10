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

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");

  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [globalMTBF, setGlobalMTBF] = useState("0");
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // RCA States
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  // Bad Actors State'leri
  const [filterEqYil, setFilterEqYil] = useState("");
  const [filterEqAy, setFilterEqAy] = useState("");
  const [filterEqHat, setFilterEqHat] = useState("");
  const [filterEqLimit, setFilterEqLimit] = useState("5"); 
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || ""); 
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
            setIsAdmin(true); 
            fetchIlkVeriler(); 
            fetchRcaData();
          } else {
            window.location.href = "/dashboard";
          }
        }
      } else {
        window.location.href = "/";
      }
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

      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData: any[] = wSnap.docs.map(d => ({ id: d.id, ...d.data(), gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 }));
      
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma").sort((a,b)=>b.gercekZaman - a.gercekZaman));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım").sort((a,b)=>b.gercekZaman - a.gercekZaman));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım").sort((a,b)=>b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const eSnap = await getDocs(eQ);
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRawLogs(logs);

      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      const meterSnap = await getDocs(qMeter);
      setRawMeterLogs(meterSnap.docs.map(d => d.data()));

      // HAT VE EKİPMAN LİSTELERİNİ 'ASSETS' KOLEKSİYONUNDAN ÇEK (KRİTİK DÜZELTME)
      const aSnap = await getDocs(collection(db, "assets"));
      const uniqueHats = new Set<string>();
      const assetsData = aSnap.docs.map(d => d.data());
      assetsData.forEach((item: any) => { if (item.hatAdi) uniqueHats.add(item.hatAdi); });
      setHatListesi(Array.from(uniqueHats).sort());

      const yillar = new Set<string>();
      logs.forEach(data => {
        let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
        if (tarihObj) yillar.add(tarihObj.getFullYear().toString());
      });
      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      
    } catch (error) { console.error(error); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Kategori Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { 
      logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() 
    }, { merge: true });
    alert("Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.reload();
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleFactoryReset = async () => {
    if (userEmail !== "dfutechreport@gmail.com" && userEmail !== "ilker.yilmaz@donukfirincilik.com.tr") return alert("Yetkisiz!");
    if (window.confirm("SİSTEM SIFIRLANSIN MI?") && window.prompt("SİL yazın") === "SİL") {
      setLoading(true);
      const cols = ["work_orders", "maintenance_logs", "meter_logs", "eked_logs", "root_cause_analysis"];
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      window.location.reload();
    }
  };

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const sayacGruplari: Record<string, any[]> = {};
    const elekSet = new Set<string>(); const dogSet = new Set<string>(); const suSet = new Set<string>();
    rawMeterLogs.forEach(log => {
      const tip = log.tip || "Elektrik";
      if (tip === "Elektrik" && log.sayacAdi) elekSet.add(log.sayacAdi);
      if (tip === "Doğalgaz" && log.sayacAdi) dogSet.add(log.sayacAdi);
      if (tip === "Su" && log.sayacAdi) suSet.add(log.sayacAdi);
      if (tip === "Elektrik" && filterElektrikSayac && log.sayacAdi !== filterElektrikSayac) return;
      if (tip === "Doğalgaz" && filterDogalgazSayac && log.sayacAdi !== filterDogalgazSayac) return;
      if (tip === "Su" && filterSuSayac && log.sayacAdi !== filterSuSayac) return;
      if (!sayacGruplari[log.sayacAdi]) sayacGruplari[log.sayacAdi] = [];
      sayacGruplari[log.sayacAdi].push(log);
    });
    setElektrikSayacListesi(Array.from(elekSet).sort()); setDogalgazSayacListesi(Array.from(dogSet).sort()); setSuSayacListesi(Array.from(suSet).sort());

    const initAylar = (): Record<string, number> => ({ "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0, "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0 });
    const tElek = initAylar(); const tDog = initAylar(); const tSu = initAylar();

    Object.keys(sayacGruplari).forEach(s => {
      const okumalar = sayacGruplari[s]; const tip = okumalar[0].tip || "Elektrik"; 
      for (let i = 1; i < okumalar.length; i++) {
        const diff = Math.max(0, Number(okumalar[i].deger) - Number(okumalar[i - 1].deger)); 
        const ay = `${okumalar[i].tarih.split("-")[1]}. Ay`;
        if (tip === "Elektrik") tElek[ay] += diff;
        else if (tip === "Doğalgaz") tDog[ay] += diff;
        else if (tip === "Su") tSu[ay] += diff;
      }
    });
    const fmt = (obj: any) => Object.keys(obj).map(ay => ({ ay, tuketim: obj[ay] })).filter(a => a.tuketim > 0);
    setGrafikElektrik(fmt(tElek)); setGrafikDogalgaz(fmt(tDog)); setGrafikSu(fmt(tSu));
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let topDurusDk = 0, topIs = 0, topMudahale = 0, dAdedi = 0;
    const tumIslerData: any = {}, durusluIslerData: any = {}, pAnaliz: any = {}, eqData: any = {};
    const tumP = new Set<string>(), activeEq = new Set<string>();

    rawLogs.forEach((data) => {
      let tObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tObj ? tObj.getFullYear().toString() : "";
      const ay = tObj ? (tObj.getMonth() + 1).toString() : ""; 
      const sure = Number(data.toplamSureDakika) || 0;

      if (data.isDuruslu && data.ekipmanAdi) {
        if ((!filterEqYil || yil === filterEqYil) && (!filterEqAy || ay === filterEqAy) && (!filterEqHat || data.hatAdi === filterEqHat)) {
          if (!eqData[data.ekipmanAdi]) eqData[data.ekipmanAdi] = { hat: data.hatAdi || "-", count: 0, sure: 0 };
          eqData[data.ekipmanAdi].count++; eqData[data.ekipmanAdi].sure += sure;
        }
      }

      if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterHat || data.hatAdi === filterHat) && (!filterEkipman || data.ekipmanAdi === filterEkipman)) {
        if (data.ekipmanAdi) activeEq.add(data.ekipmanAdi);
        const gKey = filterHat ? (data.ekipmanAdi || "B") : (data.hatAdi || "B");
        topIs++; topMudahale += sure;
        if (!tumIslerData[gKey]) tumIslerData[gKey] = { adet: 0, dakika: 0 };
        tumIslerData[gKey].adet++; tumIslerData[gKey].dakika += sure;
        if (data.isDuruslu) {
          topDurusDk += sure; dAdedi++;
          if (!durusluIslerData[gKey]) durusluIslerData[gKey] = { adet: 0, dakika: 0 };
          durusluIslerData[gKey].adet++; durusluIslerData[gKey].dakika += sure;
        }
      }

      const ekip = Array.isArray(data.isiYapanlar) ? data.isiYapanlar : [data.bildirenKisi || "Bilinmiyor"];
      ekip.forEach((p: string) => {
        tumP.add(p);
        if ((!filterPerfYil || yil === filterPerfYil) && (!filterPerfAy || ay === filterPerfAy) && (!filterPerfVardiya || data.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
           if (!pAnaliz[p]) pAnaliz[p] = { isSayisi: 0, eforDk: 0 };
           pAnaliz[p].isSayisi++; pAnaliz[p].eforDk += sure;
        }
      });
    });

    setGlobalMTBF(topIs > 0 ? (topMudahale / topIs).toFixed(1) : "0");
    setEkipmanListesi(Array.from(activeEq).sort()); setPersonelHavuzu(Array.from(tumP).sort());
    setKpiAylikDurus(topDurusDk); setKpiToplamIs(topIs); setKpiToplamSure(topMudahale); setKpiDurusluIsSayisi(dAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k=>({ isim: k, ...tumIslerData[k] })));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k=>({ isim: k, ...durusluIslerData[k] })));
    setPersonelPerformans(Object.keys(pAnaliz).map(k=>({ isim: k, ...pAnaliz[k] })).sort((a,b)=>b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eqData).map(k=>({ ekipman: k, ...eqData[k] })).sort((a,b)=>b.count - a.count).slice(0, Number(filterEqLimit)));
  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterEqYil, filterEqAy, filterEqHat, filterEqLimit]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase italic">Yetkisiz Erişim!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" className="h-12 bg-white rounded p-1" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">DFU Yönetici Paneli</h1>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-[0.2em]">Hoşgeldin, {userName} | {userRole}</p>
            </div>
          </div>
          <div className="flex gap-3 no-print">
            <button onClick={handleFactoryReset} className="bg-red-950 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black border border-red-900/50 uppercase">Sıfırla</button>
            <button onClick={()=>window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">PDF Rapor</button>
            <Link href="/dashboard" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Vardiya Raporu</Link>
            <button onClick={()=>auth.signOut()} className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-600/20">Çıkış</button>
          </div>
        </div>

        {/* BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10 no-print">
          {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg">🚨 Yeni İş Emri</Link>)}
          {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl font-bold text-xs text-center">Aktif İşler</Link>)}
          {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center">🗄️ Tamamlanan İşler</Link>)}
          {(userRole === "admin" || userRole === "isg") && (
            <><Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link><Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center">📢 İSG Duyuru</Link></>
          )}
          {userRole === "admin" && (<Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{kpiOnayBekleyen}</span>}</Link>)}
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Yedek Parça</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-xl font-black text-xs text-center shadow-lg">🛠️ Manuel PM Başlat</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">📋 Yapılan İşler</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center">⏰ Mesai Raporları</Link>
        </div>

        {/* ALARMS */}
        {aktifPmAlarmlari.length > 0 && (
          <div className="bg-teal-900/20 border border-teal-500/30 p-5 rounded-[30px] mb-8 animate-pulse"><p className="text-xs font-black text-teal-400 mb-2 tracking-widest">📅 PLANLI BAKIM ZAMANI GELENLER:</p>{aktifPmAlarmlari.map(i=>(<div key={i.id} className="text-sm font-bold">• {i.hatAdi} - {i.ekipmanAdi}</div>))}</div>
        )}

        {/* RCA TABLE */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-[40px] mb-12 shadow-2xl">
            <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-2 uppercase tracking-tighter">🧠 Kök Neden Analizi Bekleyen Duruşlar</h2>
            <div className="space-y-4">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-5 rounded-[25px] flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50 transition">
                    <div className="flex-1"><p className="text-[10px] text-gray-500 uppercase font-bold">{log.hatAdi} | {log.id}</p><p className="font-bold text-gray-100">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk Kayıp</span></p></div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'}`}>{hasRca ? "Güncelle" : "Analiz Et"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-4xl font-black text-green-400">{kpiToplamIs}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruş Sayısı</p><h3 className="text-4xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-indigo-900/30"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Kayıp Süre</p><h3 className="text-4xl font-black text-indigo-400">{kpiAylikDurus} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-purple-900/30"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">MTTR (Ort)</p><h3 className="text-4xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs || 0).toFixed(0)} dk</h3></div>
        </div>

        {/* ENERGY CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px]"><h2 className="text-xs font-bold text-yellow-400 mb-6 uppercase tracking-widest">⚡ Elektrik (kWh)</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElektrik}><XAxis dataKey="ay" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px]"><h2 className="text-xs font-bold text-red-400 mb-6 uppercase tracking-widest">🔥 Doğalgaz (m³)</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDogalgaz}><XAxis dataKey="ay" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[30px]"><h2 className="text-xs font-bold text-blue-400 mb-6 uppercase tracking-widest">💧 Su (Ton)</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
        </div>

        {/* BAD ACTORS & MAIN CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-2xl"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest">📉 RCA Dağılımı (5M)</h2>{rcaLogs.length > 0 ? (<div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name: c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>) : <div className="h-64 flex items-center justify-center text-xs text-gray-600 italic">Veri Bekleniyor...</div>}</div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] lg:col-span-2 shadow-2xl"><h2 className="text-sm font-black text-teal-400 mb-6 uppercase tracking-widest">⚡ Hat Bazlı İş Yoğunluğu</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></div>
        </div>

        {/* BAD ACTORS TABLE */}
        <div className="bg-gray-900 border border-red-900/30 p-8 rounded-[40px] shadow-2xl mb-12">
          <h2 className="text-xl font-black text-red-500 mb-6 uppercase tracking-tighter">⚠️ En Sık Arıza Yapanlar (Bad Actors)</h2>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-xs uppercase font-black tracking-widest"><tr ><th className="pb-4">Ekipman</th><th className="pb-4">Arıza Sayısı</th><th className="pb-4">Toplam Duruş</th></tr></thead><tbody className="text-sm">{ekipmanPerformans.map((eq,i)=>(<tr key={i} className="border-b border-gray-800/50"><td className="py-4 font-bold text-gray-200">{eq.ekipman}</td><td className="py-4 text-red-400 font-black">{eq.count} Kez</td><td className="py-4 font-black">{eq.sure} dk</td></tr>))}</tbody></table></div>
        </div>

      </div>

      {/* MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter tracking-widest">Arıza Kök Neden Analizi</h2>
            <p className="text-xs text-gray-500 mb-8 uppercase font-bold">{selectedLogForRca?.ekipmanAdi} Analizi Yapılıyor</p>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>( <button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl':'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-500'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruşun gerçek nedeni ve kalıcı aksiyon planını buraya detaylandırın..." className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-[20px] font-black text-gray-400 tracking-widest text-xs uppercase">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-600/30 tracking-widest text-xs uppercase">Analizi Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
