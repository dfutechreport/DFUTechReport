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

  // Bakım Filtreleri
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  
  // YENİ: Elektrik Filtreleri
  const [filterSayac, setFilterSayac] = useState("");
  const [sayacListesi, setSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); // Ham sayaç verisi

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  
  const [grafikElektrikTuketim, setGrafikElektrikTuketim] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          if (role === "admin" || role === "operator") {
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

      // SAYAÇ OKUMALARINI ÇEK VE HAFIZAYA AL
      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      const meterSnap = await getDocs(qMeter);
      const meterData = meterSnap.docs.map(d => d.data());
      setRawMeterLogs(meterData);

      // Sayaç İsimlerini Listeye Ekle
      const sayaclar = new Set<string>();
      meterData.forEach(d => { if (d.sayacAdi) sayaclar.add(d.sayacAdi); });
      setSayacListesi(Array.from(sayaclar).sort());

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

  // --- YENİ: FİLTRELİ ENERJİ TÜKETİM (FARK) ALGORİTMASI ---
  useEffect(() => {
    if (rawMeterLogs.length === 0) return;

    const sayacGruplari: Record<string, any[]> = {};
    rawMeterLogs.forEach(log => {
      // Eğer bir sayaç filtrelendiyse ve bu log o sayaca ait değilse yoksay
      if (filterSayac && log.sayacAdi !== filterSayac) return;

      if (!sayacGruplari[log.sayacAdi]) sayacGruplari[log.sayacAdi] = [];
      sayacGruplari[log.sayacAdi].push(log);
    });

    const aylikTuketimler: Record<string, number> = {
      "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0,
      "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0
    };

    Object.keys(sayacGruplari).forEach(sayacAdi => {
      const okumalar = sayacGruplari[sayacAdi];
      for (let i = 1; i < okumalar.length; i++) {
        const oncekiDeger = Number(okumalar[i - 1].deger);
        const suankiDeger = Number(okumalar[i].deger);
        const tuketimFarki = Math.max(0, suankiDeger - oncekiDeger); 
        
        const ayStr = okumalar[i].tarih.split("-")[1]; 
        const ayAnahtari = `${ayStr}. Ay`;

        if (aylikTuketimler[ayAnahtari] !== undefined) {
          aylikTuketimler[ayAnahtari] += tuketimFarki;
        }
      }
    });

    const formatliTuketim = Object.keys(aylikTuketimler).map(ay => ({
      ay: ay,
      tuketim: aylikTuketimler[ay]
    })).filter(a => a.tuketim > 0); 

    setGrafikElektrikTuketim(formatliTuketim);
  }, [rawMeterLogs, filterSayac]); // Sayaç filtresi değiştikçe yeniden hesapla


  // BAKIM VERİLERİ HESAPLAMALARI
  useEffect(() => {
    if (rawLogs.length === 0) return;

    let toplamDurusDk = 0; let toplamIsAdedi = 0;
    const tumIslerData: Record<string, { adet: number, dakika: number }> = {};
    const durusluIslerData: Record<string, { adet: number, dakika: number }> = {};
    const personelAnaliz: Record<string, { isSayisi: number, eforDk: number }> = {};
    const aktifEkipmanlar = new Set<string>();

    rawLogs.forEach((data) => {
      let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tarihObj ? tarihObj.getFullYear().toString() : "";
      const ay = tarihObj ? (tarihObj.getMonth() + 1).toString() : ""; 

      if (filterYil && yil !== filterYil) return;
      if (filterAy && ay !== filterAy) return;
      if (filterHat && data.hatAdi !== filterHat) return;
      if (filterEkipman && data.ekipmanAdi !== filterEkipman) return;

      if (data.ekipmanAdi) aktifEkipmanlar.add(data.ekipmanAdi);

      const groupKey = filterHat ? (data.ekipmanAdi || "Belirsiz") : (data.hatAdi || "Belirsiz");
      const personel = data.bildirenKisi || "Bilinmiyor";
      const sure = Number(data.toplamSureDakika) || 0;
      
      toplamIsAdedi++;

      if (!tumIslerData[groupKey]) tumIslerData[groupKey] = { adet: 0, dakika: 0 };
      tumIslerData[groupKey].adet += 1;
      tumIslerData[groupKey].dakika += sure;

      if (data.isDuruslu) {
        toplamDurusDk += sure;
        if (!durusluIslerData[groupKey]) durusluIslerData[groupKey] = { adet: 0, dakika: 0 };
        durusluIslerData[groupKey].adet += 1;
        durusluIslerData[groupKey].dakika += sure;
      }

      if (!personelAnaliz[personel]) personelAnaliz[personel] = { isSayisi: 0, eforDk: 0 };
      personelAnaliz[personel].isSayisi += 1;
      personelAnaliz[personel].eforDk += sure;
    });

    setEkipmanListesi(Array.from(aktifEkipmanlar).sort());
    setKpiAylikDurus(toplamDurusDk);
    setKpiToplamIs(toplamIsAdedi);

    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })).sort((a, b) => b.adet - a.adet));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })).sort((a, b) => b.dakika - a.dakika));
    setPersonelPerformans(Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] })).sort((a, b) => b.isSayisi - a.isSayisi));

  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman]);

  const filtreleriTemizle = () => { setFilterYil(""); setFilterAy(""); setFilterHat(""); setFilterEkipman(""); setFilterSayac(""); };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Sistem yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  const OzelTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-2xl z-50">
          <p className="font-bold text-white mb-2 border-b border-gray-700 pb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{color: p.color}} className="text-sm">
              {p.name}: <span className="font-bold">{p.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
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

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
            <div className="flex items-center gap-4">
              <img src="/dfulogo.png" alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{userRole === "admin" ? "Yönetici Paneli" : "Operatör İzleme Paneli"}</h1>
                <p className="text-gray-400 mt-1 text-sm md:text-base"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | İş Zekası (BI) Ekranı</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 no-print">
              {userRole === "admin" && (
                <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm md:text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  PDF Çıktısı Al
                </button>
              )}
              <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm md:text-base">Çıkış Yap</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6 no-print">
            {userRole === "admin" && (
              <>
                <Link href="/admin/ekipmanlar" className="bg-blue-600 hover:bg-blue-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base">Hat/Ekipman Yönetimi</Link>
                <Link href="/admin/personel" className="bg-purple-600 hover:bg-purple-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base">Personel Onaylama</Link>
                <Link href="/admin/duyurular" className="bg-yellow-600 hover:bg-yellow-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base">Duyuru Yayınla</Link>
              </>
            )}
            <Link href="/admin/mesai" className="bg-teal-600 hover:bg-teal-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base">Mesai Raporları</Link>
            <Link href="/dashboard/sayac" className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base text-white">⚡ Sayaç Okuma</Link>
            <Link href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold text-sm md:text-base">Tüm İşler Listesi</Link>
            <Link href="/dashboard" className="bg-orange-600 hover:bg-orange-500 px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold ml-auto text-sm md:text-base">Arıza Bildirim Ekranı ➔</Link>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Yıl</label>
              <select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Ay</label>
              <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
              <select value={filterHat} onChange={(e) => { setFilterHat(e.target.value); setFilterEkipman(""); }} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tüm Hatlar</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-gray-400 mb-1">Ekipman</label>
              <select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm disabled:opacity-50"><option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{ekipmanListesi.map(e => <option key={e} value={e}>{e}</option>)}</select>
            </div>
            
            {/* YENİ: SAYAÇ FİLTRESİ */}
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-yellow-400 mb-1 font-bold">Sayaç Grafiği</label>
              <select value={filterSayac} onChange={(e) => setFilterSayac(e.target.value)} className="w-full bg-gray-800 border-yellow-700 text-yellow-400 rounded-lg p-2 text-sm focus:border-yellow-500">
                <option value="">Tüm Sayaçlar (Toplam)</option>
                {sayacListesi.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button onClick={filtreleriTemizle} className="bg-red-900/40 text-red-400 p-2 rounded-lg text-sm h-9">Temizle</button>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Bakım Yönetim Sistemi Özet Raporu</h2>
            <p className="text-gray-600">Rapor Kapsamı: {filterYil || "Tüm Yıllar"} - {filterAy ? `${filterAy}. Ay` : "Tüm Aylar"} | Hat: {filterHat || "Tümü"}</p>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Filtrelenen İş Emri / Arıza</h3>
              <p className="text-3xl md:text-4xl font-bold text-green-500 print:text-black">{kpiToplamIs}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Filtrelenen Toplam Duruş</h3>
              <p className="text-3xl md:text-4xl font-bold text-red-500 print:text-black">{kpiAylikDurus} <span className="text-lg">dk</span></p>
            </div>
            {userRole === "admin" && (
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Onay Bekleyen Personel</h3>
                <p className="text-3xl md:text-4xl font-bold text-blue-500 print:text-black">{kpiOnayBekleyen}</p>
              </div>
            )}
          </div>

          {/* ELEKTRİK TÜKETİM GRAFİĞİ */}
          <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl mb-10 shadow-lg border-b-4 border-b-yellow-500">
            <h2 className="text-lg font-bold mb-6 text-yellow-400 flex items-center gap-2 print:text-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Elektrik Aylık Tüketim Grafiği ({filterSayac ? filterSayac : "Tüm Sayaçlar Toplamı"})
            </h2>
            {grafikElektrikTuketim.length === 0 ? (
              <div className="h-48 flex justify-center items-center text-gray-500 border border-dashed border-gray-800 rounded-xl">Hesaplanmış tüketim verisi bulunamadı. Lütfen peş peşe en az 2 gün sayaç endeksi girin.</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafikElektrikTuketim} margin={{ top: 25, right: 5, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ay" tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} />
                    <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar name="Tüketim (Birim)" dataKey="tuketim" fill="#EAB308" maxBarSize={60}>
                      <LabelList dataKey="tuketim" position="top" fill="#EAB308" fontSize={12} fontWeight="bold" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* BAKIM İŞLERİ GRAFİKLERİ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-green-400 print:text-black">Yapılan İşler</h2>
              {grafikTumIslerVerisi.length > 0 && (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikTumIslerVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                      <Bar name="İş Adedi" dataKey="adet" fill="#10B981" maxBarSize={40}>
                        <LabelList dataKey="adet" position="top" fill="#10B981" fontSize={11} fontWeight="bold" />
                      </Bar>
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#3B82F6" maxBarSize={40}>
                        <LabelList dataKey="dakika" position="top" fill="#3B82F6" fontSize={11} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-red-400 print:text-black">Sadece Duruşlu Arızalar</h2>
              {grafikDurusVerisi.length > 0 && (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikDurusVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} />
                      <Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                      <Bar name="Duruş Adedi" dataKey="adet" fill="#F59E0B" maxBarSize={40}>
                        <LabelList dataKey="adet" position="top" fill="#F59E0B" fontSize={11} fontWeight="bold" />
                      </Bar>
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#EF4444" maxBarSize={40}>
                        <LabelList dataKey="dakika" position="top" fill="#EF4444" fontSize={11} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl print-break">
            <h2 className="text-xl font-bold mb-6 text-blue-400 print:text-black">Personel Performans ve Efor Matrisi</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm md:text-base">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2 md:px-4">Teknisyen Adı</th>
                    <th className="pb-3 px-2 md:px-4">Toplam İş</th>
                    <th className="pb-3 px-2 md:px-4">Toplam Efor</th>
                    <th className="pb-3 px-4">MTTR (Ortalama)</th>
                  </tr>
                </thead>
                <tbody>
                  {personelPerformans.map((p, index) => (
                    <tr key={index} className="border-b border-gray-800 print:border-gray-300">
                      <td className="py-4 px-2 md:px-4 font-medium text-blue-300 print:text-black">{p.isim}</td>
                      <td className="py-4 px-2 md:px-4 text-green-400 print:text-black">{p.isSayisi} Adet</td>
                      <td className="py-4 px-2 md:px-4 text-gray-300 print:text-black">{p.eforDk} Dakika</td>
                      <td className="py-4 px-2 md:px-4 text-orange-400 print:text-black">~ {(p.eforDk / p.isSayisi).toFixed(1)} dk</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}