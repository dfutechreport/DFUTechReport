"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
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
  
  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().role === "admin" && userSnap.data().isApproved) {
          setIsAdmin(true);
          fetchIlkVeriler(); 
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

  const filtreleriTemizle = () => { setFilterYil(""); setFilterAy(""); setFilterHat(""); setFilterEkipman(""); };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Sistem yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  return (
    <>
      {/* Yazdırma (PDF) için özel CSS Stilleri - Bu kısım arka planı beyaza çevirir */}
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

      <div className="min-h-screen bg-gray-950 text-white p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
            <div className="flex items-center gap-4">
  <img src="/dfulogo.png" alt="DFU Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
  <div>
    <h1 className="text-3xl font-bold">Yönetici Paneli</h1>
                <p className="text-gray-400 mt-1"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | İş Zekası (BI) Ekranı</p>
              </div>
            </div>
            {/* Çıkış ve PDF Butonları */}
            <div className="flex gap-3 no-print">
              <button 
                onClick={() => window.print()} 
                className="bg-white text-gray-900 font-bold px-6 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF Çıktısı Al
              </button>
              <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition">Çıkış Yap</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6 no-print">
            <Link href="/admin/ekipmanlar" className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold">Hat ve Ekipman Yönetimi</Link>
            <Link href="/admin/personel" className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-xl font-semibold">Personel Onaylama</Link>
            <Link href="/admin/mesai" className="bg-teal-600 hover:bg-teal-500 px-6 py-3 rounded-xl font-semibold">Mesai Raporları</Link> <Link href="/admin/duyurular" className="bg-yellow-600 hover:bg-yellow-500 px-6 py-3 rounded-xl font-semibold text-white print:hidden">Duyuru Yayınla</Link>
            <Link href="/dashboard" className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-xl font-semibold ml-auto">Arıza Bildirim Ekranı ➔</Link>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Yıl</label>
              <select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Ay</label>
              <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
              <select value={filterHat} onChange={(e) => { setFilterHat(e.target.value); setFilterEkipman(""); }} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm"><option value="">Tüm Hatlar</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Ekipman</label>
              <select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm disabled:opacity-50"><option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{ekipmanListesi.map(e => <option key={e} value={e}>{e}</option>)}</select>
            </div>
            <button onClick={filtreleriTemizle} className="bg-red-900/40 text-red-400 p-2 rounded-lg text-sm h-9">Temizle</button>
          </div>

          {/* Rapor Başlığı (Sadece PDF'te görünür) */}
          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Bakım Yönetim Sistemi Özet Raporu</h2>
            <p className="text-gray-600">
              Rapor Kapsamı: {filterYil || "Tüm Yıllar"} - {filterAy ? `${filterAy}. Ay` : "Tüm Aylar"} | Hat: {filterHat || "Tümü"}
            </p>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Filtrelenen İş Emri / Arıza</h3>
              <p className="text-4xl font-bold text-green-500 print:text-black">{kpiToplamIs}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Filtrelenen Toplam Duruş</h3>
              <p className="text-4xl font-bold text-red-500 print:text-black">{kpiAylikDurus} <span className="text-lg">dk</span></p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h3 className="text-gray-400 text-sm font-semibold mb-2 print:text-black">Onay Bekleyen Personel</h3>
              <p className="text-4xl font-bold text-blue-500 print:text-black">{kpiOnayBekleyen}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-green-400 print:text-black">Yapılan İşler</h2>
              {grafikTumIslerVerisi.length > 0 && (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikTumIslerVerisi}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10}} />
                      <YAxis />
                      <Legend />
                      <Bar name="İş Adedi" dataKey="adet" fill="#10B981" />
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-6 text-red-400 print:text-black">Sadece Duruşlu Arızalar</h2>
              {grafikDurusVerisi.length > 0 && (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={grafikDurusVerisi}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="isim" tick={{fontSize: 10}} />
                      <YAxis />
                      <Legend />
                      <Bar name="Duruş Adedi" dataKey="adet" fill="#F59E0B" />
                      <Bar name="Süre (Dk)" dataKey="dakika" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl print-break">
            <h2 className="text-xl font-bold mb-6 text-blue-400 print:text-black">Personel Performans ve Efor Matrisi</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-4">Teknisyen Adı</th>
                    <th className="pb-3 px-4">Toplam İş</th>
                    <th className="pb-3 px-4">Toplam Efor</th>
                    <th className="pb-3 px-4">MTTR (Ortalama)</th>
                  </tr>
                </thead>
                <tbody>
                  {personelPerformans.map((p, index) => (
                    <tr key={index} className="border-b border-gray-800 print:border-gray-300">
                      <td className="py-4 px-4 font-medium text-blue-300 print:text-black">{p.isim}</td>
                      <td className="py-4 px-4 text-green-400 print:text-black">{p.isSayisi} Adet</td>
                      <td className="py-4 px-4 text-gray-300 print:text-black">{p.eforDk} Dakika</td>
                      <td className="py-4 px-4 text-orange-400 print:text-black">~ {(p.eforDk / p.isSayisi).toFixed(1)} dk</td>
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