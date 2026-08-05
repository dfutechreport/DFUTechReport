"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

// RCA Kategorileri (5M Metodolojisi)
const RCA_CATEGORIES = [
  { id: "human", label: "İnsan (Eğitim/Hata)", color: "#3B82F6" },
  { id: "machine", label: "Makine (Tasarım/Yıpranma)", color: "#EF4444" },
  { id: "material", label: "Malzeme (Yedek Parça Kalitesi)", color: "#10B981" },
  { id: "method", label: "Metot (Bakım Prosedürü)", color: "#F59E0B" },
  { id: "environment", label: "Ortam (Isı/Toz/Nem)", color: "#8B5CF6" }
];

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  // Filtre State'leri
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");
  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);

  // Sayaç State'leri
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");
  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  // Performans State'leri
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 
  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 

  // KPI State'leri
  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [globalMTBF, setGlobalMTBF] = useState("0");
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // Bad Actors State'leri
  const [filterEqYil, setFilterEqYil] = useState("");
  const [filterEqAy, setFilterEqAy] = useState("");
  const [filterEqHat, setFilterEqHat] = useState("");
  const [filterEqLimit, setFilterEqLimit] = useState("5"); 
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  // ROOT CAUSE (RCA) STATE'LERİ
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [grafikRcaDağılım, setGrafikRcaDağılım] = useState<any[]>([]);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", comment: "" });

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
          if (role === "admin" || role === "operator" || role === "uretim" || role === "isg") {
            setIsAdmin(true); 
            fetchIlkVeriler(); 
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

  const fetchIlkVeriler = async () => {
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData: any[] = wSnap.docs.map(d => ({ id: d.id, ...d.data(), gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 }));
      
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma").sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım").sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım").sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRawLogs(logs);

      const rcaSnap = await getDocs(collection(db, "root_cause_analysis"));
      setRcaLogs(rcaSnap.docs.map(d => d.data()));

      const meterSnap = await getDocs(query(collection(db, "meter_logs"), orderBy("tarih", "asc")));
      setRawMeterLogs(meterSnap.docs.map(d => d.data()));

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      logs.forEach((data: any) => {
        if (data.hatAdi) hatlar.add(data.hatAdi);
        let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
        if (tarihObj) yillar.add(tarihObj.getFullYear().toString());
      });
      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());
    } catch (error) { console.error(error); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Lütfen bir kök neden kategorisi seçin.");
    try {
      const rcaData = {
        logId: selectedLogForRca.id,
        ekipmanAdi: selectedLogForRca.ekipmanAdi,
        hatAdi: selectedLogForRca.hatAdi,
        category: rcaForm.category,
        comment: rcaForm.comment,
        analyzedBy: userName,
        date: new Date()
      };
      await setDoc(doc(db, "root_cause_analysis", selectedLogForRca.id), rcaData);
      alert("Kök neden analizi kaydedildi.");
      setShowRcaModal(false);
      setRcaForm({ category: "", comment: "" });
      fetchIlkVeriler();
    } catch (error) { alert("Kaydedilemedi."); }
  };

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Form otomatik açılacaktır.")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.href = `/dashboard?hat=${encodeURIComponent(islem.hatAdi)}&ekipman=${encodeURIComponent(islem.ekipmanAdi)}&sorun=${encodeURIComponent(islem.sorunTipi)}&duruslu=${islem.isDuruslu ? 'true' : 'false'}&aciklama=${encodeURIComponent(islem.aciklama)}`;
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleFactoryReset = async () => {
    if (userEmail !== "dfutechreport@gmail.com" && userEmail !== "ilker.yilmaz@donukfirincilik.com.tr") return alert("Yetkisiz!");
    if (window.confirm("TÜM VERİLER SİLİNECEK?") && window.prompt("SİL yazın") === "SİL") {
      setLoading(true);
      const collections = ["work_orders", "maintenance_logs", "meter_logs", "eked_logs", "root_cause_analysis"];
      for (const col of collections) {
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
    const initAylar = (): Record<string, number> => ({ "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0, "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0 });
    const tElek = initAylar(); const tDog = initAylar(); const tSu = initAylar();
    const elekS = new Set<string>(); const dogS = new Set<string>(); const suS = new Set<string>();

    const sayacGruplari: Record<string, any[]> = {};
    rawMeterLogs.forEach(log => {
      const tip = log.tip || "Elektrik";
      if (tip === "Elektrik") elekS.add(log.sayacAdi);
      if (tip === "Doğalgaz") dogS.add(log.sayacAdi);
      if (tip === "Su") suS.add(log.sayacAdi);
      if (tip === "Elektrik" && filterElektrikSayac && log.sayacAdi !== filterElektrikSayac) return;
      if (tip === "Doğalgaz" && filterDogalgazSayac && log.sayacAdi !== filterDogalgazSayac) return;
      if (tip === "Su" && filterSuSayac && log.sayacAdi !== filterSuSayac) return;
      if (!sayacGruplari[log.sayacAdi]) sayacGruplari[log.sayacAdi] = [];
      sayacGruplari[log.sayacAdi].push(log);
    });

    Object.keys(sayacGruplari).forEach(s => {
      const okumalar = sayacGruplari[s];
      const tip = okumalar[0].tip || "Elektrik";
      for (let i = 1; i < okumalar.length; i++) {
        const diff = Math.max(0, Number(okumalar[i].deger) - Number(okumalar[i-1].deger));
        const ay = `${okumalar[i].tarih.split("-")[1]}. Ay`;
        if (tip === "Elektrik") tElek[ay] += diff;
        else if (tip === "Doğalgaz") tDog[ay] += diff;
        else if (tip === "Su") tSu[ay] += diff;
      }
    });

    setElektrikSayacListesi(Array.from(elekS).sort()); setDogalgazSayacListesi(Array.from(dogS).sort()); setSuSayacListesi(Array.from(suS).sort());
    const fmt = (obj: any) => Object.keys(obj).map(ay => ({ ay, tuketim: obj[ay] })).filter(a => a.tuketim > 0);
    setGrafikElektrik(fmt(tElek)); setGrafikDogalgaz(fmt(tDog)); setGrafikSu(fmt(tSu));
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let tDurus = 0, tIs = 0, tEfor = 0, dIsAdedi = 0;
    const tumIslerData: any = {}, durusluIslerData: any = {}, personelAnaliz: any = {}, eqData: any = {};
    const aktifEq = new Set<string>(), tumP = new Set<string>();

    rawLogs.forEach((data: any) => {
      let tObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tObj ? tObj.getFullYear().toString() : "";
      const ay = tObj ? (tObj.getMonth() + 1).toString() : "";
      const sure = Number(data.toplamSureDakika) || 0;

      // Bad Actor Logic
      if (data.isDuruslu && data.ekipmanAdi) {
        if ((!filterEqYil || yil === filterEqYil) && (!filterEqAy || ay === filterEqAy) && (!filterEqHat || data.hatAdi === filterEqHat)) {
          if (!eqData[data.ekipmanAdi]) eqData[data.ekipmanAdi] = { hat: data.hatAdi || "-", count: 0, sure: 0 };
          eqData[data.ekipmanAdi].count++; eqData[data.ekipmanAdi].sure += sure;
        }
      }

      // KPI & Graph Logic
      if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterHat || data.hatAdi === filterHat) && (!filterEkipman || data.ekipmanAdi === filterEkipman)) {
        tIs++; tEfor += sure;
        if (data.ekipmanAdi) aktifEq.add(data.ekipmanAdi);
        const gKey = filterHat ? (data.ekipmanAdi || "B") : (data.hatAdi || "B");
        if (!tumIslerData[gKey]) tumIslerData[gKey] = { adet: 0, dakika: 0 };
        tumIslerData[gKey].adet++; tumIslerData[gKey].dakika += sure;
        if (data.isDuruslu) {
          tDurus += sure; dIsAdedi++;
          if (!durusluIslerData[gKey]) durusluIslerData[gKey] = { adet: 0, dakika: 0 };
          durusluIslerData[gKey].adet++; durusluIslerData[gKey].dakika += sure;
        }
      }

      // Personel Matrix
      const ekip = Array.isArray(data.isiYapanlar) ? data.isiYapanlar : [data.bildirenKisi || "Bilinmiyor"];
      ekip.forEach((p: string) => {
        tumP.add(p);
        if ((!filterPerfYil || yil === filterPerfYil) && (!filterPerfAy || ay === filterPerfAy) && (!filterPerfVardiya || data.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
          if (!personelAnaliz[p]) personelAnaliz[p] = { isSayisi: 0, eforDk: 0 };
          personelAnaliz[p].isSayisi++; personelAnaliz[p].eforDk += sure;
        }
      });
    });

    // RCA Chart Logic
    const rcaDağılım: any = {};
    rcaLogs.forEach(r => {
      rcaDağılım[r.category] = (rcaDağılım[r.category] || 0) + 1;
    });
    setGrafikRcaDağılım(RCA_CATEGORIES.map(c => ({ name: c.label, value: rcaDağılım[c.id] || 0, color: c.color })).filter(x => x.value > 0));

    setKpiAylikDurus(tDurus); setKpiToplamIs(tIs); setKpiToplamSure(tEfor); setKpiDurusluIsSayisi(dIsAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })).sort((a, b) => b.adet - a.adet));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })).sort((a, b) => b.dakika - a.dakika));
    let pList = Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] }));
    pList.sort((a, b) => filterPerfSiralama === "efor" ? b.eforDk - a.eforDk : b.isSayisi - a.isSayisi);
    setPersonelPerformans(pList);
    setEkipmanListesi(Array.from(aktifEq).sort()); setPersonelHavuzu(Array.from(tumP).sort());
    
    let arrEq = Object.keys(eqData).map(k => ({ ekipman: k, ...eqData[k] })).sort((a, b) => b.count - a.count);
    setEkipmanPerformans(filterEqLimit === "all" ? arrEq : arrEq.slice(0, Number(filterEqLimit)));
  }, [rawLogs, rcaLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterPerfSiralama, filterEqYil, filterEqAy, filterEqHat, filterEqLimit]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Sistem yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" alt="Logo" className="h-12 bg-white rounded p-1" />
            <div>
              <h1 className="text-2xl font-bold">DFU BI & Bakım Yönetimi</h1>
              <p className="text-gray-400 text-sm">Yönetici Analiz ve Performans İzleme Paneli</p>
            </div>
          </div>
          <div className="flex gap-2">
            {userEmail.includes("dfutech") && <button onClick={handleFactoryReset} className="bg-red-900 text-xs px-3 py-2 rounded">Sistemi Sıfırla</button>}
            <button onClick={() => window.print()} className="bg-gray-800 px-4 py-2 rounded text-sm">PDF Çıktısı</button>
            <button onClick={() => auth.signOut()} className="bg-red-600 px-4 py-2 rounded text-sm">Çıkış</button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl text-center font-bold text-sm">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl text-center font-bold text-sm">Aktif İşler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl text-center font-bold text-sm">🔒 EKED Takip</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl text-center font-bold text-sm">📅 PM Takvimi</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl text-center font-bold text-sm">📋 İş Listesi</Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
            <p className="text-xs text-gray-400 font-bold uppercase">Toplam İş</p>
            <h3 className="text-3xl font-black text-green-400">{kpiToplamIs}</h3>
            <p className="text-[10px] text-gray-500 mt-1">Süre: {kpiToplamSure} dk</p>
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
            <p className="text-xs text-gray-400 font-bold uppercase">Duruşlu İş</p>
            <h3 className="text-3xl font-black text-red-400">{kpiDurusluIsSayisi}</h3>
            <p className="text-[10px] text-gray-500 mt-1">Kayıp: {kpiAylikDurus} dk</p>
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-blue-500/30">
            <p className="text-xs text-blue-400 font-bold uppercase">Duruş Oranı</p>
            <h3 className="text-3xl font-black text-blue-400">%{kpiToplamSure > 0 ? ((kpiAylikDurus/kpiToplamSure)*100).toFixed(1) : 0}</h3>
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-purple-500/30">
            <p className="text-xs text-purple-400 font-bold uppercase">Tesis MTTR</p>
            <h3 className="text-3xl font-black text-purple-400">{kpiToplamIs > 0 ? (kpiToplamSure/kpiToplamIs).toFixed(1) : 0} <span className="text-sm">dk</span></h3>
          </div>
          <div className="bg-gray-900 p-5 rounded-2xl border border-yellow-500/30">
            <p className="text-xs text-yellow-400 font-bold uppercase">Kritik MTBF</p>
            <h3 className="text-3xl font-black text-yellow-400">{globalMTBF} <span className="text-sm">st</span></h3>
          </div>
        </div>

        {/* RCA Manager Section - SADECE ADMIN GÖRÜR */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/30 p-6 rounded-2xl mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-indigo-400 flex items-center gap-2">🧠 Kök Neden Analizi (RCA) Bekleyen Duruşlar</h2>
                <p className="text-xs text-gray-400">Son 5 büyük duruşun kök nedenini belirleyin.</p>
              </div>
              <div className="h-24 w-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={grafikRcaDağılım} innerRadius={20} outerRadius={35} paddingAngle={5} dataKey="value">
                      {grafikRcaDağılım.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="py-2">Ekipman</th><th className="py-2">Duruş Süresi</th><th className="py-2">Mevcut Durum</th><th className="py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {rawLogs.filter(l => l.isDuruslu).slice(0, 5).map(log => {
                    const hasRca = rcaLogs.find(r => r.logId === log.id);
                    return (
                      <tr key={log.id} className="border-b border-gray-800/50 hover:bg-white/5 transition">
                        <td className="py-3 font-bold">{log.ekipmanAdi}</td>
                        <td className="py-3 text-red-400 font-bold">{log.toplamSureDakika} dk</td>
                        <td className="py-3">
                          {hasRca ? (
                            <span className="bg-green-900/40 text-green-400 px-2 py-1 rounded-md text-[10px] font-bold">ANALİZ EDİLDİ</span>
                          ) : (
                            <span className="bg-yellow-900/40 text-yellow-400 px-2 py-1 rounded-md text-[10px] font-bold">BEKLİYOR</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <button 
                            onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs transition"
                          >
                            {hasRca ? "Güncelle" : "Analiz Et"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Charts & Matrix Sections... (Mevcut grafikleriniz buraya devam eder) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-sm font-bold text-yellow-400 mb-4 uppercase">⚡ Enerji Tüketimi</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={grafikElektrik}><XAxis dataKey="ay" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-sm font-bold text-red-400 mb-4 uppercase">🔥 Gaz Tüketimi</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={grafikDogalgaz}><XAxis dataKey="ay" tick={{fontSize:10}}/><YAxis hide/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h3 className="text-sm font-bold text-indigo-400 mb-4 uppercase">📉 RCA Dağılımı</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={grafikRcaDağılım} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60}>
                                {grafikRcaDağılım.map((e,i) => <Cell key={i} fill={e.color}/>)}
                            </Pie>
                            <Tooltip/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Bad Actors Table */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 mb-8">
            <h2 className="text-lg font-bold text-red-400 mb-4">⚠️ En Sık Duruş Yapan Ekipmanlar (Bad Actors)</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead><tr className="text-gray-500 border-b border-gray-800"><th className="pb-2">Ekipman</th><th className="pb-2">Duruş Adedi</th><th className="pb-2">Toplam Süre</th></tr></thead>
                    <tbody>
                        {ekipmanPerformans.map((eq,i) => (
                            <tr key={i} className="border-b border-gray-800/40">
                                <td className="py-3 font-medium">{eq.ekipman}</td>
                                <td className="py-3 text-white">{eq.count} Kez</td>
                                <td className="py-3 text-orange-400 font-bold">{eq.sure} dk</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Personel Matrix */}
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
            <h2 className="text-lg font-bold text-blue-400 mb-4">👤 Personel Performans Matrisi</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead><tr className="text-gray-500 border-b border-gray-800"><th className="pb-2">İsim</th><th className="pb-2">İş Adedi</th><th className="pb-2">Toplam Efor</th><th className="pb-2">Ort. Müdahale</th></tr></thead>
                    <tbody>
                        {personelPerformans.slice(0,10).map((p,i) => (
                            <tr key={i} className="border-b border-gray-800/40">
                                <td className="py-3">{p.isim}</td>
                                <td className="py-3 text-green-400 font-bold">{p.isSayisi}</td>
                                <td className="py-3">{p.eforDk} dk</td>
                                <td className="py-3 text-orange-400">{(p.eforDk/p.isSayisi).toFixed(1)} dk</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

      </div>

      {/* RCA MODAL - SADECE ADMIN */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
          <div className="bg-gray-900 border border-indigo-500/50 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-indigo-400 mb-2">Kök Neden Analizi</h2>
            <p className="text-xs text-gray-400 mb-6">{selectedLogForRca?.ekipmanAdi} - {selectedLogForRca?.toplamSureDakika} dk Duruş</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kök Neden Kategorisi (5M)</label>
                <select 
                  value={rcaForm.category}
                  onChange={(e) => setRcaForm({...rcaForm, category: e.target.value})}
                  className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-sm focus:ring-2 ring-indigo-500 outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {RCA_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Analiz Notu / Aksiyon</label>
                <textarea 
                  value={rcaForm.comment}
                  onChange={(e) => setRcaForm({...rcaForm, comment: e.target.value})}
                  placeholder="Arıza neden kaynaklandı? Tekrar etmemesi için ne yapılmalı?"
                  className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-sm h-24 outline-none focus:ring-2 ring-indigo-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowRcaModal(false)} className="flex-1 bg-gray-800 py-3 rounded-xl font-bold text-sm">Vazgeç</button>
                <button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold text-sm">Analizi Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
