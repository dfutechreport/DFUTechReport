"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);

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
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          if (role === "admin" || role === "operator" || role === "uretim" || role === "isg") {
            setIsAdmin(true); 
            fetchIlkVeriler(); 
          }
        }
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
      
      const isgAlarmlari = wData.filter(d => d.ekipmanAdi === "KAR devreye alma");
      const normalIsler = wData.filter(d => d.ekipmanAdi !== "KAR devreye alma");

      setAktifIsgAlarmlari(isgAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifIsler(normalIsler.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const eSnap = await getDocs(eQ);
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => doc.data());
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

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Form otomatik açılacaktır.")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.href = `/dashboard?hat=${encodeURIComponent(islem.hatAdi)}&ekipman=${encodeURIComponent(islem.ekipmanAdi)}&sorun=${encodeURIComponent(islem.sorunTipi)}&duruslu=${islem.isDuruslu ? 'true' : 'false'}&aciklama=${encodeURIComponent(islem.aciklama)}`;
    } catch (error) { alert("Hata oluştu."); }
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

    rawLogs.forEach((data) => {
      let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tarihObj ? tarihObj.getFullYear().toString() : "";
      const ay = tarihObj ? (tarihObj.getMonth() + 1).toString() : ""; 

      let grafikPass = true;
      if (filterYil && yil !== filterYil) grafikPass = false;
      if (filterAy && ay !== filterAy) grafikPass = false;
      if (filterHat && data.hatAdi !== filterHat) grafikPass = false;
      if (filterEkipman && data.ekipmanAdi !== filterEkipman) grafikPass = false;

      const sure = Number(data.toplamSureDakika) || 0;
      const isEkibi = Array.isArray(data.isiYapanlar) && data.isiYapanlar.length > 0 ? data.isiYapanlar : [data.bildirenKisi || "Bilinmiyor"];
      isEkibi.forEach((p: string) => tumPersoneller.add(p)); 

      if (grafikPass) {
        if (data.ekipmanAdi) aktifEkipmanlar.add(data.ekipmanAdi);
        const groupKey = filterHat ? (data.ekipmanAdi || "Belirsiz") : (data.hatAdi || "Belirsiz");
        topIsAdedi++; topMudahaleDk += sure;
        if (!tumIslerData[groupKey]) tumIslerData[groupKey] = { adet: 0, dakika: 0 };
        tumIslerData[groupKey].adet += 1; tumIslerData[groupKey].dakika += sure;
        if (data.isDuruslu) {
          topDurusDk += sure; durusluIsAdedi++;
          if (!durusluIslerData[groupKey]) durusluIslerData[groupKey] = { adet: 0, dakika: 0 };
          durusluIslerData[groupKey].adet += 1; durusluIslerData[groupKey].dakika += sure;
        }
      }

      let perfPass = true;
      if (filterPerfYil && yil !== filterPerfYil) perfPass = false;
      if (filterPerfAy && ay !== filterPerfAy) perfPass = false;
      if (filterPerfVardiya && data.vardiya !== filterPerfVardiya) perfPass = false;
      if (filterPerfDurus === "duruslu" && data.isDuruslu !== true) perfPass = false;
      if (filterPerfDurus === "durussuz" && data.isDuruslu !== false) perfPass = false;

      if (perfPass) {
        isEkibi.forEach((personelIsmi: string) => {
          if (filterPerfPersonel && personelIsmi !== filterPerfPersonel) return;
          if (!personelAnaliz[personelIsmi]) personelAnaliz[personelIsmi] = { isSayisi: 0, eforDk: 0 };
          personelAnaliz[personelIsmi].isSayisi += 1; personelAnaliz[personelIsmi].eforDk += sure;
        });
      }
    });

    setEkipmanListesi(Array.from(aktifEkipmanlar).sort()); setPersonelHavuzu(Array.from(tumPersoneller).sort());
    setKpiAylikDurus(topDurusDk); setKpiToplamIs(topIsAdedi); setKpiToplamSure(topMudahaleDk); setKpiDurusluIsSayisi(durusluIsAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })).sort((a, b) => b.adet - a.adet));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })).sort((a, b) => b.dakika - a.dakika));
    const formatliPersonel = Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] }));
    if (filterPerfSiralama === "efor") formatliPersonel.sort((a, b) => b.eforDk - a.eforDk);
    else formatliPersonel.sort((a, b) => b.isSayisi - a.isSayisi); 
    setPersonelPerformans(formatliPersonel);
  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterPerfDurus, filterPerfSiralama]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Sistem yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  const OzelTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-2xl z-50">
          <p className="font-bold text-white mb-2">{label}</p>
          {payload.map((p: any, i: number) => (<p key={i} style={{color: p.color}} className="text-sm">{p.name}: <b>{p.value}</b></p>))}
        </div>
      );
    } return null;
  };

  const durusSureYuzde = kpiToplamSure > 0 ? ((kpiAylikDurus / kpiToplamSure) * 100).toFixed(1) : "0";

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .print-break { page-break-before: always; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } .perf-row { display: none !important; } .perf-row:nth-child(-n+5) { display: table-row !important; } .pdf-top5-mesaj { display: block !important; color: #EF4444 !important; font-size: 12px; font-weight: bold; margin-top: 8px;} }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
            <div className="flex items-center gap-4">
              <img src="/dfulogo.png" alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{userRole === "admin" ? "Yönetici Paneli" : userRole === "isg" ? "İSG (Güvenlik) Paneli" : userRole === "uretim" ? "Üretim İzleme Paneli" : "Operatör İzleme Paneli"}</h1>
                <p className="text-gray-400 mt-1 text-sm md:text-base"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | İş Zekası (BI)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 no-print">
              {(userRole === "admin" || userRole === "isg") && (
                <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm md:text-base"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al</button>
              )}
              <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg">Çıkış Yap</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 no-print">
            {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(220,38,38,0.5)] transition">🚨 Yeni İş Emri</Link>)}
            {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-900/60 hover:bg-red-600 border border-red-500/50 text-red-100 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition"><span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>Aktif İş Emirleri</Link>)}
            {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ Arşivlenen İşler</Link>)}
            {(userRole === "admin" || userRole === "isg") && (
              <>
                <Link href="/admin/eked" className="bg-yellow-600 hover:bg-yellow-500 text-black p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(202,138,4,0.4)] transition">🔒 EKED Takip</Link>
                <Link href="/admin/eked/arsiv" className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-gray-200 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ EKED Arşivi</Link>
                <Link href="/admin/duyurular" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">📢 İSG Duyuru</Link>
                <Link href="/admin/kar-takip" className="bg-red-800 hover:bg-red-700 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚡ KAR İhlal Arşivi</Link>
              </>
            )}
            {userRole === "admin" && (
              <>
                <Link href="/admin/ekipmanlar" className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚙️ Hat / Ekipman</Link>
                <Link href="/admin/personel" className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">👤 Personel Onay</Link>
              </>
            )}
            
            {(userRole === "admin" || userRole === "operator" || userRole === "isg" || userRole === "teknisyen") && (
              <>
                <Link href="/dashboard/pano-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🔌 Pano Listesi</Link>
                <Link href="/admin/pano-takip" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ Pano Takip Arşivi</Link>
              </>
            )}
            {userRole !== "uretim" && userRole !== "isg" && (
              <>
                <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(6,182,212,0.4)] transition">✅ Kontrol Formları</Link>
                <Link href="/admin/yedek-parca" className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(192,38,211,0.4)] transition">⚙️ Yedek Parça</Link>
                <Link href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">📋 Yapılan İşler</Link>
                <Link href="/dashboard/sayac" className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚡ Sayaç Okuma</Link>
                <Link href="/admin/mesai" className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⏰ Mesai Raporları</Link>
                <Link href="/dashboard" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🛠️ Vardiya Raporu</Link>
              </>
            )}
          </div>

          {(userRole === "admin" || userRole === "operator" || userRole === "teknisyen" || userRole === "isg") && aktifIsgAlarmlari.length > 0 && (
            <div className="bg-red-900/40 border-[3px] border-red-500 p-6 rounded-2xl mb-10 shadow-[0_0_30px_rgba(239,68,68,0.5)] no-print relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)]"></div>
              <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2 relative z-10"><span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span></span> ACİL İSG ALARMI: KAR DEVRE DIŞI KALMIŞTIR! (Müdahale Bekliyor)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
                {aktifIsgAlarmlari.map(islem => (
                  <div key={islem.id} className="bg-gray-900 border border-red-500 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500 animate-pulse"></div>
                    <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p></div>
                    {userRole !== "isg" && <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg border border-red-400">✅ İşi Tamamla (KAR'ı Devreye Al)</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {userRole !== "isg" && aktifIsler.length > 0 && (
            <div className="bg-red-900/20 border-2 border-red-500/50 p-6 rounded-2xl mb-10 shadow-2xl no-print">
              <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span></span> Üretimden Gelen Aktif Bildirimler (Müdahale Bekleyen İş Emirleri)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aktifIsler.map(islem => (
                  <div key={islem.id} className={`bg-gray-900 border border-red-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-500/80`}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1 line-clamp-2">{islem.aciklama}</p></div>
                    {userRole !== "uretim" && <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-[0_0_15px_rgba(22,163,74,0.4)]">✅ İşi Tamamla</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(userRole === "admin" || userRole === "operator" || userRole === "isg" || userRole === "teknisyen") && aktifEked.length > 0 && (
            <div className="bg-yellow-900/20 border-2 border-yellow-500/50 p-6 rounded-2xl mb-10 shadow-[0_0_20px_rgba(202,138,4,0.15)] relative overflow-hidden no-print">
              <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ca8a04_10px,#ca8a04_20px)]"></div>
              <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2 relative z-10"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span></span> DİKKAT: Sahada Aktif Kilitli (EKED) Alanlar Var!</h2>
              <div className="space-y-3 relative z-10">
                {aktifEked.map(eked => (
                  <div key={eked.id} className="bg-gray-900 border border-yellow-700/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div><p className="text-xs text-yellow-500/80 mb-1">{eked.tarih} | Kilitli Bırakan: {eked.personel}</p><p className="font-bold text-white text-lg">📍 {eked.yer}</p></div>
                    <span className="bg-yellow-600 text-black font-bold text-xs px-3 py-1 rounded animate-pulse">ENERJİ KESİK</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(userRole === "admin" || userRole === "operator") && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-5 rounded-2xl shadow-lg"><p className="text-xs md:text-sm text-gray-400 font-semibold mb-1">Toplam Yapılan İş</p><h3 className="text-2xl md:text-3xl font-bold text-green-400">{kpiToplamIs} <span className="text-sm text-gray-500 font-normal">Adet</span></h3><p className="text-xs text-gray-500 mt-2 font-medium">Toplam Efor: <span className="text-white">{kpiToplamSure} dk</span></p></div>
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-5 rounded-2xl shadow-lg"><p className="text-xs md:text-sm text-gray-400 font-semibold mb-1">Duruşlu İş Sayısı</p><h3 className="text-2xl md:text-3xl font-bold text-red-400">{kpiDurusluIsSayisi} <span className="text-sm text-gray-500 font-normal">Adet</span></h3><p className="text-xs text-gray-500 mt-2 font-medium">Kritik Duruş: <span className="text-white">{kpiAylikDurus} dk</span></p></div>
                <div className="bg-gray-900 border border-orange-500/30 p-4 md:p-5 rounded-2xl shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden flex flex-col justify-center"><div className="flex justify-between items-center border-b border-gray-700/50 pb-2 mb-2"><span className="text-xs md:text-sm text-green-400 font-bold">Toplam Çalışma:</span><span className="text-lg md:text-xl font-bold text-white">{kpiToplamSure} <span className="text-xs text-gray-400">dk</span></span></div><div className="flex justify-between items-center"><span className="text-xs md:text-sm text-red-400 font-bold">Toplam Duruş:</span><span className="text-lg md:text-xl font-bold text-white">{kpiAylikDurus} <span className="text-xs text-gray-400">dk</span></span></div></div>
                <div className="bg-gray-900 border border-blue-500/30 p-4 md:p-5 rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.1)] relative overflow-hidden"><p className="text-xs md:text-sm text-blue-300 font-semibold mb-1 relative z-10">Duruş Yüzdesi (Süre)</p><h3 className="text-2xl md:text-3xl font-bold text-blue-400 relative z-10">%{kpiToplamSure > 0 ? ((kpiAylikDurus / kpiToplamSure) * 100).toFixed(1) : "0"}</h3><p className="text-xs text-gray-400 mt-2 relative z-10">Toplam efora oranı</p></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-gray-900 border border-yellow-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-yellow-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-yellow-400 print:text-black flex items-center gap-2">⚡ Elektrik Tüketimi (kWh)</h2></div><select value={filterElektrikSayac} onChange={(e) => setFilterElektrikSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-yellow-500"><option value="">Tüm Elektrik Sayaçları</option>{elektrikSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikElektrik.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElektrik}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#EAB308" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#EAB308" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
                <div className="bg-gray-900 border border-red-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-red-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-red-400 print:text-black flex items-center gap-2">🔥 Doğalgaz Tüketimi (m³)</h2></div><select value={filterDogalgazSayac} onChange={(e) => setFilterDogalgazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-red-500"><option value="">Tüm Doğalgaz Sayaçları</option>{dogalgazSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikDogalgaz.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDogalgaz}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#EF4444" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#EF4444" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
                <div className="bg-gray-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-blue-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-blue-400 print:text-black flex items-center gap-2">💧 Su Tüketimi (Ton)</h2></div><select value={filterSuSayac} onChange={(e) => setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-blue-500"><option value="">Tüm Su Sayaçları</option>{suSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikSu.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#3B82F6" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#3B82F6" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
              </div>

              <div className="bg-gray-900 border border-blue-700/50 p-5 rounded-2xl mb-6 flex flex-wrap gap-4 items-end no-print shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <div className="w-full mb-1 border-b border-gray-800 pb-2"><h3 className="text-blue-500 font-bold flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg> Arıza ve Bakım Filtreleri</h3></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Yıl</label><select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ay</label><select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label><select value={filterHat} onChange={(e) => { setFilterHat(e.target.value); setFilterEkipman(""); }} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ekipman</label><select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="w-full bg-gray-800 rounded-lg p-2 text-sm disabled:opacity-50"><option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{ekipmanListesi.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterHat(""); setFilterEkipman("");}} className="bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-sm h-9">Bakımı Sıfırla</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl"><h2 className="text-lg font-bold mb-6 text-green-400 print:text-black">Yapılan İşler</h2>{grafikTumIslerVerisi.length > 0 ? (<div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" /><Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} /><Bar name="İş Adedi" dataKey="adet" fill="#10B981" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#10B981" fontSize={11} fontWeight="bold" /></Bar><Bar name="Süre (Dk)" dataKey="dakika" fill="#3B82F6" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#3B82F6" fontSize={11} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>) : <div className="h-48 flex justify-center items-center text-gray-500 border border-dashed border-gray-800 rounded-xl">Filtreye uygun veri yok</div>}</div>
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl"><h2 className="text-lg font-bold mb-6 text-red-400 print:text-black">Sadece Duruşlu Arızalar</h2>{grafikDurusVerisi.length > 0 ? (<div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDurusVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" /><Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} /><Bar name="Duruş Adedi" dataKey="adet" fill="#F59E0B" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#F59E0B" fontSize={11} fontWeight="bold" /></Bar><Bar name="Süre (Dk)" dataKey="dakika" fill="#EF4444" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#EF4444" fontSize={11} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>) : <div className="h-48 flex justify-center items-center text-gray-500 border border-dashed border-gray-800 rounded-xl">Filtreye uygun duruş yok</div>}</div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl print-break">
                <h2 className="text-xl font-bold mb-6 text-blue-400 print:text-black">Personel Performans Matrisi</h2>
                <div className="bg-gray-800 border-gray-700 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end no-print">
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Yıl</label><select value={filterPerfYil} onChange={(e) => setFilterPerfYil(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ay</label><select value={filterPerfAy} onChange={(e) => setFilterPerfAy(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Vardiya</label><select value={filterPerfVardiya} onChange={(e) => setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Personel Seçimi</label><select value={filterPerfPersonel} onChange={(e) => setFilterPerfPersonel(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tüm Ekipler</option>{personelHavuzu.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Arıza Tipi</label><select value={filterPerfDurus} onChange={(e) => setFilterPerfDurus(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="duruslu">Duruşlu</option><option value="durussuz">Duruşsuz</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-blue-400 mb-1 font-bold">Sıralama</label><select value={filterPerfSiralama} onChange={(e) => setFilterPerfSiralama(e.target.value)} className="w-full bg-blue-900/30 text-blue-400 rounded-lg p-2 text-sm font-bold"><option value="is">En Çok İş</option><option value="efor">En Çok Efor</option></select></div>
                  <button onClick={() => { setFilterPerfYil(""); setFilterPerfAy(""); setFilterPerfVardiya(""); setFilterPerfPersonel(""); setFilterPerfDurus(""); setFilterPerfSiralama("is"); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
                </div>
                <p className="hidden print:block pdf-top5-mesaj mb-2">* Bu rapor otomatik olarak en yüksek performans gösteren ilk 5 personeli listelemektedir.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm md:text-base">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                        <th className="pb-3 px-2 md:px-4">Teknisyen Adı</th><th className="pb-3 px-2 md:px-4">Toplam İş</th><th className="pb-3 px-2 md:px-4">Toplam Efor</th><th className="pb-3 px-4">MTTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personelPerformans.map((p, index) => {
                        const ortalama = p.isSayisi > 0 ? (p.eforDk / p.isSayisi).toFixed(1) : "0";
                        return (
                          <tr key={index} className="border-b border-gray-800 print:border-gray-300 perf-row">
                            <td className="py-4 px-2 md:px-4 font-medium text-blue-300 print:text-black">{index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : ""}{p.isim}</td>
                            <td className="py-4 px-2 md:px-4 text-green-400 print:text-black">{p.isSayisi} Adet</td>
                            <td className="py-4 px-2 md:px-4 text-gray-300 print:text-black">{p.eforDk} Dakika</td>
                            <td className="py-4 px-2 md:px-4 text-orange-400 print:text-black">~ {ortalama} dk / İş</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}