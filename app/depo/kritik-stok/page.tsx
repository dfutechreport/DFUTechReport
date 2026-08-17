"use client";

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
}