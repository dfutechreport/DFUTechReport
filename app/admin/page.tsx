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

  // MAP & RCA States
  const [activeFloor, setActiveFloor] = useState(1);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" },
    { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" },
    { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  const EQUIPMENT_LOCATIONS = [
    { id: "kek-hatti", name: "KEK HATTI", floor: 1, x: "65%", y: "48%" },
    { id: "baget-hatti", name: "BAGET HATTI", floor: 1, x: "78%", y: "35%" },
    { id: "silo-grubu", name: "SILO GRUBU", floor: 0, x: "85%", y: "22%" },
    { id: "hamurhane", name: "HAMURHANE", floor: 0, x: "55%", y: "40%" },
    { id: "su-deposu", name: "SU DEPOSU", floor: -1, x: "20%", y: "60%" },
    { id: "pogaca-hatti", name: "PASTRY POĞAÇA HATTI", floor: 2, x: "70%", y: "28%" }
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
          // TEKNISYEN ROLÜ EKLENDİ - DÖNGÜYÜ KIRAN KRİTİK SATIR
          if (role === "admin" || role === "operator" || role === "uretim" || role === "isg" || role === "teknisyen") {
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
      
      const isgAlarmlari = wData.filter(d => d.ekipmanAdi === "KAR devreye alma");
      const pmAlarmlari = wData.filter(d => d.sorunTipi === "Planlı Bakım");
      const normalIsler = wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım");

      setAktifIsgAlarmlari(isgAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifPmAlarmlari(pmAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifIsler(normalIsler.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const eSnap = await getDocs(eQ);
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRawLogs(logs);

      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      const meterSnap = await getDocs(qMeter);
      setRawMeterLogs(meterSnap.docs.map(d => d.data()));

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      
      logs.forEach(data => {
        if (data.hatAdi) hatlar.add(data.hatAdi);
        let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
        if (tarihObj) yillar.add(tarihObj.getFullYear().toString());
      });

      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());
    } catch (error) { console.error(error); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Kategori seçin.");
    try {
      await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), {
        logId: selectedLogForRca.id,
        ekipman: selectedLogForRca.ekipmanAdi,
        category: rcaForm.category,
        why: rcaForm.why,
        analizEden: userName,
        tarih: serverTimestamp()
      }, { merge: true });
      alert("Analiz kaydedildi.");
      setShowRcaModal(false);
      fetchRcaData();
    } catch (e) { alert("Kaydedilemedi."); }
  };

  const getHealthStatus = (ekipmanAdi: string) => {
    const isArıza = aktifIsler.some((is: any) => is.ekipmanAdi === ekipmanAdi && is.isDuruslu);
    if (isArıza) return "bg-red-500 animate-ping";
    const rca = rcaLogs.find((r: any) => r.ekipman === ekipmanAdi);
    if (rca && !rca.category) return "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]";
    return "bg-green-500";
  };

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("İşi bitirdiğinizi onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.reload();
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleFactoryReset = async () => {
    if (userEmail !== "dfutechreport@gmail.com" && userEmail !== "ilker.yilmaz@donukfirincilik.com.tr") return alert("Yetkisiz!");
    if (window.confirm("DİKKAT: TÜM OPERASYONEL VERİLER SİLİNECEK!") && window.prompt("SİL yazın") === "SİL") {
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
    const tuketimElektrik = initAylar(); const tuketimDogalgaz = initAylar(); const tuketimSu = initAylar();

    Object.keys(sayacGruplari).forEach(sayacAdi => {
      const okumalar = sayacGruplari[sayacAdi];
      const tip = okumalar[0].tip || "Elektrik"; 
      for (let i = 1; i < okumalar.length; i++) {
        const tuketimFarki = Math.max(0, Number(okumalar[i].deger) - Number(okumalar[i - 1].deger)); 
        const ayAnahtari = `${okumalar[i].tarih.split("-")[1]}. Ay`;
        if (tip === "Elektrik" && tuketimElektrik[ayAnahtari] !== undefined) tuketimElektrik[ayAnahtari] += tuketimFarki;
        else if (tip === "Doğalgaz" && tuketimDogalgaz[ayAnahtari] !== undefined) tuketimDogalgaz[ayAnahtari] += tuketimFarki;
        else if (tip === "Su" && tuketimSu[ayAnahtari] !== undefined) tuketimSu[ayAnahtari] += tuketimFarki;
      }
    });
    const formatData = (dataObj: any) => Object.keys(dataObj).map(ay => ({ ay, tuketim: dataObj[ay] })).filter(a => a.tuketim > 0);
    setGrafikElektrik(formatData(tuketimElektrik)); setGrafikDogalgaz(formatData(tuketimDogalgaz)); setGrafikSu(formatData(tuketimSu));
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let topDurusDk = 0; let topIsAdedi = 0; let topMudahaleDk = 0; let durusluIsAdedi = 0;
    const tumIslerData: Record<string, { adet: number, dakika: number }> = {};
    const durusluIslerData: Record<string, { adet: number, dakika: number }> = {};
    const personelAnaliz: Record<string, { isSayisi: number, eforDk: number }> = {};
    const aktifEkipmanlar = new Set<string>(); const tumPersoneller = new Set<string>(); 
    const eqData: Record<string, { hat: string, count: number, sure: number }> = {};

    rawLogs.forEach((data) => {
      let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tarihObj ? tarihObj.getFullYear().toString() : "";
      const ay = tarihObj ? (tarihObj.getMonth() + 1).toString() : ""; 
      
      if (data.isDuruslu && data.ekipmanAdi) {
        if ((!filterEqYil || yil === filterEqYil) && (!filterEqAy || ay === filterEqAy) && (!filterEqHat || data.hatAdi === filterEqHat)) {
          const ekipman = data.ekipmanAdi;
          if (!eqData[ekipman]) eqData[ekipman] = { hat: data.hatAdi || "-", count: 0, sure: 0 };
          eqData[ekipman].count += 1;
          eqData[ekipman].sure += (Number(data.toplamSureDakika) || 0);
        }
      }

      if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterHat || data.hatAdi === filterHat) && (!filterEkipman || data.ekipmanAdi === filterEkipman)) {
        if (data.ekipmanAdi) aktifEkipmanlar.add(data.ekipmanAdi);
        const groupKey = filterHat ? (data.ekipmanAdi || "Belirsiz") : (data.hatAdi || "Belirsiz");
        topIsAdedi++; topMudahaleDk += (Number(data.toplamSureDakika) || 0);
        if (!tumIslerData[groupKey]) tumIslerData[groupKey] = { adet: 0, dakika: 0 };
        tumIslerData[groupKey].adet += 1; tumIslerData[groupKey].dakika += (Number(data.toplamSureDakika) || 0);
        if (data.isDuruslu) {
          topDurusDk += (Number(data.toplamSureDakika) || 0); durusluIsAdedi++;
          if (!durusluIslerData[groupKey]) durusluIslerData[groupKey] = { adet: 0, dakika: 0 };
          durusluIslerData[groupKey].adet += 1; durusluIslerData[groupKey].dakika += (Number(data.toplamSureDakika) || 0);
        }
      }

      const isEkibi = Array.isArray(data.isiYapanlar) && data.isiYapanlar.length > 0 ? data.isiYapanlar : [data.bildirenKisi || "Bilinmiyor"];
      isEkibi.forEach((p: string) => {
        tumPersoneller.add(p);
        if ((!filterPerfYil || yil === filterPerfYil) && (!filterPerfAy || ay === filterPerfAy) && (!filterPerfVardiya || data.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
           if (!personelAnaliz[p]) personelAnaliz[p] = { isSayisi: 0, eforDk: 0 };
           personelAnaliz[p].isSayisi += 1; personelAnaliz[p].eforDk += (Number(data.toplamSureDakika) || 0);
        }
      });
    });

    setGlobalMTBF(topIsAdedi > 0 ? (topMudahaleDk / topIsAdedi).toFixed(1) : "0");
    setEkipmanListesi(Array.from(aktifEkipmanlar).sort()); setPersonelHavuzu(Array.from(tumPersoneller).sort());
    setKpiAylikDurus(topDurusDk); setKpiToplamIs(topIsAdedi); setKpiToplamSure(topMudahaleDk); setKpiDurusluIsSayisi(durusluIsAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })));
    setPersonelPerformans(Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] })).sort((a,b) => b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eqData).map(k => ({ ekipman: k, ...eqData[k] })).sort((a,b) => b.count - a.count).slice(0, Number(filterEqLimit)));
  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterEqYil, filterEqAy, filterEqHat, filterEqLimit]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white font-bold">DFU Sistem Yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold italic">Yetkisiz Erişim veya Onaylanmamış Hesap!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" alt="Logo" className="h-12 bg-white rounded-lg p-1" />
            <div>
              <h1 className="text-2xl font-black">DFU Bakım Yönetimi</h1>
              <p className="text-gray-500 text-xs uppercase tracking-widest">{userRole} Paneli | Hoşgeldin, {userName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-gray-800 px-4 py-2 rounded-xl text-xs font-bold no-print">PDF Rapor</button>
            <button onClick={() => auth.signOut()} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold no-print">Güvenli Çıkış</button>
          </div>
        </div>

        {/* BUTON GRUBU */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl text-center font-bold text-xs">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl text-center font-bold text-xs">Aktif İşler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl text-center font-bold text-xs">🔒 EKED Takip</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl text-center font-bold text-xs">📅 PM Takvimi</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl text-center font-bold text-xs">📋 İş Listesi</Link>
        </div>

        {/* CANLI TESİS HARİTASI */}
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-6 md:p-8 mb-8 shadow-2xl no-print relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tighter">📍 Tesis Sağlık Haritası</h2>
            <div className="flex bg-gray-800 p-1.5 rounded-2xl border border-gray-700">
              {[-1, 0, 1, 2].map(f => (
                <button key={f} onClick={() => setActiveFloor(f)} className={`px-4 py-1.5 rounded-xl text-[10px] font-bold ${activeFloor === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500'}`}>KAT {f===0?"ZEMİN":f}</button>
              ))}
            </div>
          </div>
          <div className="relative w-full aspect-[21/9] bg-black/40 rounded-3xl overflow-hidden border border-gray-800/50">
            <img src={`/map/floor${activeFloor}.png`} className="w-full h-full object-contain opacity-60" onError={(e) => {(e.target as HTMLImageElement).src = 'https://placehold.co/1200x500/111827/4F46E5?text=Plan+Yuklenemedi';}} />
            {EQUIPMENT_LOCATIONS.filter(eq => eq.floor === activeFloor).map(m => (
              <div key={m.id} className="absolute group cursor-pointer p-2 -m-2 z-10" style={{ top: m.y, left: m.x }}>
                <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-white/40 ${getHealthStatus(m.name)}`}></div>
                <div className="block md:hidden absolute top-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] text-white font-bold border border-white/10 shadow-2xl">{m.name}</div>
                <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-gray-800 p-2 rounded-xl text-[9px] z-50 whitespace-nowrap">{m.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RCA ANALİZ YÖNETİMİ */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-3xl mb-8 shadow-xl">
            <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">🧠 Analiz Bekleyen Duruşlar</h2>
            <div className="space-y-3">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50 transition">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-[10px] text-gray-500 uppercase truncate">{log.hatAdi} | {log.id}</p>
                      <p className="font-bold text-gray-200 text-sm truncate">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p>
                    </div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`shrink-0 px-5 py-2 rounded-xl text-[10px] font-bold ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>
                      {hasRca ? "Güncellendi" : "Analiz Et"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-3xl font-black text-green-400">{kpiToplamIs}</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruşlu İş</p><h3 className="text-3xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-indigo-900/30"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Duruş Oranı</p><h3 className="text-3xl font-black text-indigo-400">%{((kpiAylikDurus/kpiToplamSure)*100).toFixed(1)}</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-purple-900/30"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">MTTR (Ort)</p><h3 className="text-3xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs).toFixed(0)} <span className="text-sm">dk</span></h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-yellow-900/30"><p className="text-[10px] text-yellow-400 uppercase font-bold mb-1">İstikrar</p><h3 className="text-3xl font-black text-yellow-400">%{((1 - kpiDurusluIsSayisi/kpiToplamIs)*100).toFixed(1)}</h3></div>
        </div>

        {/* CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl">
            <h2 className="text-sm font-bold text-indigo-400 mb-6 uppercase tracking-widest">📊 Kök Neden Dağılımı</h2>
            {rcaLogs.length > 0 ? (
               <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c => ({ name: c.label, value: rcaLogs.filter(r => r.category === c.id).length, color: c.color })).filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">{RCA_CATEGORIES.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            ) : <div className="h-48 flex items-center justify-center text-xs text-gray-600 italic">Veri Bekleniyor...</div>}
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl lg:col-span-2">
            <h2 className="text-sm font-bold text-teal-400 mb-6 uppercase tracking-widest">⚡ Hat Bazlı İş Yoğunluğu</h2>
            <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>

      </div>

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-8 rounded-[40px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter">Arıza Kök Neden Analizi</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c => ( <button key={c.id} onClick={() => setRcaForm({...rcaForm, category: c.id})} className={`p-2.5 rounded-xl text-[9px] font-bold border transition ${rcaForm.category === c.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e => setRcaForm({...rcaForm, why: e.target.value})} placeholder="Duruş nedenini ve aksiyon planını girin..." className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-xs h-40 text-white outline-none focus:ring-1 ring-indigo-500" />
              <div className="flex gap-4">
                <button onClick={() => setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-bold text-xs text-gray-400">İptal</button>
                <button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-bold text-xs text-white">Analizi Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
