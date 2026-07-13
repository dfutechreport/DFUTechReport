"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  
  const [filterEnerjiTipi, setFilterEnerjiTipi] = useState("Elektrik");
  const [filterSayac, setFilterSayac] = useState("");
  const [sayacListesi, setSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [grafikEnerjiTuketim, setGrafikEnerjiTuketim] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          // YENİ: Uretim yetkilisi de girebilir
          if (role === "admin" || role === "operator" || role === "uretim") {
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

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => doc.data());
      setRawLogs(logs);

      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      setRawMeterLogs((await getDocs(qMeter)).docs.map(d => d.data()));

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

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const sayacGruplari: Record<string, any[]> = {};
    const aktifSayaclar = new Set<string>();
    rawMeterLogs.forEach(log => {
      const tip = log.tip || "Elektrik";
      if (tip === filterEnerjiTipi) {
        if (log.sayacAdi) aktifSayaclar.add(log.sayacAdi);
        if (filterSayac && log.sayacAdi !== filterSayac) return;
        if (!sayacGruplari[log.sayacAdi]) sayacGruplari[log.sayacAdi] = [];
        sayacGruplari[log.sayacAdi].push(log);
      }
    });
    setSayacListesi(Array.from(aktifSayaclar).sort());
    const aylikTuketimler: Record<string, number> = { "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0, "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0 };
    Object.keys(sayacGruplari).forEach(sayacAdi => {
      const okumalar = sayacGruplari[sayacAdi];
      for (let i = 1; i < okumalar.length; i++) {
        const tuketimFarki = Math.max(0, Number(okumalar[i].deger) - Number(okumalar[i - 1].deger)); 
        const ayAnahtari = `${okumalar[i].tarih.split("-")[1]}. Ay`;
        if (aylikTuketimler[ayAnahtari] !== undefined) aylikTuketimler[ayAnahtari] += tuketimFarki;
      }
    });
    setGrafikEnerjiTuketim(Object.keys(aylikTuketimler).map(ay => ({ ay, tuketim: aylikTuketimler[ay] })).filter(a => a.tuketim > 0));
  }, [rawMeterLogs, filterSayac, filterEnerjiTipi]);


  useEffect(() => {
    if (rawLogs.length === 0) return;
    let toplamDurusDk = 0; let toplamIsAdedi = 0;
    const tumIslerData: Record<string, { adet: number, dakika: number }> = {};
    const durusluIslerData: Record<string, { adet: number, dakika: number }> = {};
    const personelAnaliz: Record<string, { isSayisi: number, eforDk: number }> = {};
    const aktifEkipmanlar = new Set<string>();
    const tumPersoneller = new Set<string>(); 

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
        
        toplamIsAdedi++;
        if (!tumIslerData[groupKey]) tumIslerData[groupKey] = { adet: 0, dakika: 0 };
        tumIslerData[groupKey].adet += 1; tumIslerData[groupKey].dakika += sure;

        if (data.isDuruslu) {
          toplamDurusDk += sure;
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

    setEkipmanListesi(Array.from(aktifEkipmanlar).sort());
    setPersonelHavuzu(Array.from(tumPersoneller).sort());
    setKpiAylikDurus(toplamDurusDk);
    setKpiToplamIs(toplamIsAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })).sort((a, b) => b.adet - a.adet));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })).sort((a, b) => b.dakika - a.dakika));
    
    const formatliPersonel = Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] }));
    if (filterPerfSiralama === "efor") formatliPersonel.sort((a, b) => b.eforDk - a.eforDk);
    else formatliPersonel.sort((a, b) => b.isSayisi - a.isSayisi); 
    setPersonelPerformans(formatliPersonel);

  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterPerfDurus, filterPerfSiralama]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center">Yükleniyor...</div>;
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

  const enerjiTema = filterEnerjiTipi === "Elektrik" ? "yellow" : filterEnerjiTipi === "Doğalgaz" ? "red" : "blue";
  const enerjiBirim = filterEnerjiTipi === "Elektrik" ? "kWh" : filterEnerjiTipi === "Doğalgaz" ? "m³" : "Ton";

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .print-break { page-break-before: always; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } .perf-row { display: none !important; } .perf-row:nth-child(-n+5) { display: table-row !important; } .pdf-top5-mesaj { display: block !important; color: #EF4444 !important; font-size: 12px; font-weight: bold; margin-top: 8px;} }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
            <div className="flex items-center gap-4">
              <img src="/dfulogo.png" alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
              <div>
                {/* YENİ: Başlık Kuralı (Üretim Yetkilisi Eklendi) */}
                <h1 className="text-2xl md:text-3xl font-bold">
                  {userRole === "admin" ? "Yönetici Paneli" : userRole === "uretim" ? "Üretim İzleme Paneli" : "Operatör İzleme Paneli"}
                </h1>
                <p className="text-gray-400 mt-1 text-sm md:text-base"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | İş Zekası (BI)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 no-print">
              {userRole === "admin" && (
                <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">PDF Çıktısı Al</button>
              )}
              <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg">Çıkış Yap</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6 no-print">
            {userRole === "admin" && (
              <>
                <Link href="/admin/ekipmanlar" className="bg-blue-600 px-4 py-2 rounded-xl text-sm">Hat/Ekipman</Link>
                <Link href="/admin/personel" className="bg-purple-600 px-4 py-2 rounded-xl text-sm">Personel Onay</Link>
                <Link href="/admin/duyurular" className="bg-yellow-600 px-4 py-2 rounded-xl text-sm">Duyuru Yayınla</Link>
              </>
            )}
            <Link href="/admin/mesai" className="bg-teal-600 px-4 py-2 rounded-xl text-sm">Mesai Raporları</Link>
            <Link href="/dashboard/sayac" className="bg-emerald-600 px-4 py-2 rounded-xl text-sm">⚡ Elektrik Sayaç Okuma</Link>
            <Link href="/admin/is-listesi" className="bg-indigo-600 px-4 py-2 rounded-xl text-sm">Yapılan İşler</Link>
            <Link href="/dashboard" className="bg-orange-600 px-4 py-2 rounded-xl ml-auto text-sm">Arıza Ekranı ➔</Link>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Bakım Yönetim Sistemi Özet Raporu</h2>
            <p className="text-gray-600">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm mb-2 print:text-black">Filtrelenen İş Emri / Arıza</h3>
              <p className="text-3xl md:text-4xl font-bold text-green-500 print:text-black">{kpiToplamIs}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm mb-2 print:text-black">Filtrelenen Toplam Duruş</h3>
              <p className="text-3xl md:text-4xl font-bold text-red-500 print:text-black">{kpiAylikDurus} <span className="text-lg">dk</span></p>
            </div>
            {userRole === "admin" && (
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                <h3 className="text-gray-400 text-sm mb-2 print:text-black">Onay Bekleyen Personel</h3>
                <p className="text-3xl md:text-4xl font-bold text-blue-500 print:text-black">{kpiOnayBekleyen}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-yellow-700/50 p-5 rounded-2xl mb-6 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-white mb-1 font-bold">Enerji Türü</label>
              <select value={filterEnerjiTipi} onChange={(e) => {setFilterEnerjiTipi(e.target.value); setFilterSayac("");}} className="w-full bg-gray-800 rounded-lg p-2 text-sm text-white">
                <option value="Elektrik">⚡ Elektrik</option><option value="Doğalgaz">🔥 Doğalgaz</option><option value="Su">💧 Su</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className={`block text-xs text-${enerjiTema}-400 mb-1 font-bold`}>Sayaç Seçimi</label>
              <select value={filterSayac} onChange={(e) => setFilterSayac(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm text-white">
                <option value="">Tüm Sayaçlar (Genel Toplam)</option>{sayacListesi.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={() => {setFilterEnerjiTipi("Elektrik"); setFilterSayac("");}} className="bg-gray-800 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
          </div>

          <div className={`bg-gray-900 border p-4 md:p-6 rounded-2xl mb-12 border-t-4 border-t-${enerjiTema}-500`}>
            <h2 className={`text-lg font-bold mb-6 text-${enerjiTema}-400 print:text-black`}>
              {filterEnerjiTipi} Aylık Tüketim Grafiği ({filterSayac ? filterSayac : "Tüm Sayaçlar Toplamı"})
            </h2>
            {grafikEnerjiTuketim.length === 0 ? (
              <div className="h-48 flex justify-center items-center text-gray-500">Tüketim verisi bulunamadı.</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafikEnerjiTuketim} margin={{ top: 25, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ay" tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} />
                    <Legend />
                    <Bar name={`Tüketim (${enerjiBirim})`} dataKey="tuketim" fill={filterEnerjiTipi === "Elektrik" ? "#EAB308" : filterEnerjiTipi === "Doğalgaz" ? "#EF4444" : "#3B82F6"} maxBarSize={60}>
                      <LabelList dataKey="tuketim" position="top" fill={filterEnerjiTipi === "Elektrik" ? "#EAB308" : filterEnerjiTipi === "Doğalgaz" ? "#EF4444" : "#3B82F6"} fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-blue-700/50 p-5 rounded-2xl mb-6 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Yıl</label>
              <select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Ay</label>
              <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
              <select value={filterHat} onChange={(e) => { setFilterHat(e.target.value); setFilterEkipman(""); }} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Ekipman</label>
              <select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="w-full bg-gray-800 rounded-lg p-2 text-sm disabled:opacity-50"><option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{ekipmanListesi.map(e => <option key={e} value={e}>{e}</option>)}</select>
            </div>
            <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterHat(""); setFilterEkipman("");}} className="bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-green-400 print:text-black">Yapılan İşler</h2>
              {grafikTumIslerVerisi.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikTumIslerVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} />
                      <Bar name="İş Adedi" dataKey="adet" fill="#10B981" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#10B981" fontSize={11} fontWeight="bold" /></Bar>
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#3B82F6" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#3B82F6" fontSize={11} fontWeight="bold" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-48 flex justify-center items-center text-gray-500">Veri yok</div>}
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-red-400 print:text-black">Sadece Duruşlu Arızalar</h2>
              {grafikDurusVerisi.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikDurusVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} />
                      <Bar name="Duruş Adedi" dataKey="adet" fill="#F59E0B" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#F59E0B" fontSize={11} fontWeight="bold" /></Bar>
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#EF4444" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#EF4444" fontSize={11} fontWeight="bold" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-48 flex justify-center items-center text-gray-500">Veri yok</div>}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl print-break">
            <h2 className="text-xl font-bold mb-6 text-blue-400 print:text-black">Personel Performans Matrisi</h2>
            <div className="bg-gray-800 border-gray-700 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end no-print">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Yıl</label>
                <select value={filterPerfYil} onChange={(e) => setFilterPerfYil(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Ay</label>
                <select value={filterPerfAy} onChange={(e) => setFilterPerfAy(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Vardiya</label>
                <select value={filterPerfVardiya} onChange={(e) => setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs text-gray-400 mb-1">Arıza Tipi</label>
                <select value={filterPerfDurus} onChange={(e) => setFilterPerfDurus(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="duruslu">Duruşlu</option><option value="durussuz">Duruşsuz</option></select>
              </div>
              <button onClick={() => { setFilterPerfYil(""); setFilterPerfAy(""); setFilterPerfVardiya(""); setFilterPerfPersonel(""); setFilterPerfDurus(""); setFilterPerfSiralama("is"); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
            </div>
            
            <p className="hidden print:block pdf-top5-mesaj mb-2">* Bu rapor otomatik olarak en yüksek performans gösteren ilk 5 personeli listelemektedir.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm md:text-base">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Teknisyen Adı</th>
                    <th className="pb-3 px-2">Toplam İş</th>
                    <th className="pb-3 px-2">Toplam Efor</th>
                    <th className="pb-3 px-2">MTTR</th>
                  </tr>
                </thead>
                <tbody>
                  {personelPerformans.map((p, index) => {
                    const ortalama = p.isSayisi > 0 ? (p.eforDk / p.isSayisi).toFixed(1) : "0";
                    return (
                      <tr key={index} className="border-b border-gray-800 print:border-gray-300 perf-row">
                        <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{p.isim}</td>
                        <td className="py-4 px-2 text-green-400 print:text-black">{p.isSayisi} Adet</td>
                        <td className="py-4 px-2 text-gray-300 print:text-black">{p.eforDk} Dakika</td>
                        <td className="py-4 px-2 text-orange-400 print:text-black">~ {ortalama} dk / İş</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}