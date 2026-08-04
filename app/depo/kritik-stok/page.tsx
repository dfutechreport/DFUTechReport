"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import * as XLSX from "xlsx";

export default function KritikStokRaporu() {
  const [loading, setLoading] = useState(true);
  const [kritikParcalar, setKritikParcalar] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          // Sadece Admin ve Depo yetkilileri bu raporu görebilir
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
      // 1. Ana depodaki (spare_parts) 2 ve altına düşmüş malzemeleri bul
      const partsSnap = await getDocs(collection(db, "spare_parts"));
      const kritikStoklarMap: Record<string, { ad: string, kalan: number, birim: string }> = {};
      
      partsSnap.forEach(d => {
        const p = d.data();
        if (p.mevcutMiktar <= 2) {
          kritikStoklarMap[d.id] = { ad: p.parcaAdi, kalan: p.mevcutMiktar, birim: p.birim };
        }
      });

      // 2. Bakım loglarına (maintenance_logs) gidip bu kritik parçaların SON KULLANILDIĞI YERLERİ bul
      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const birlesikRapor: any[] = [];

      logsSnap.forEach(d => {
        const data = d.data();
        if (data.yedekParcaKodu && kritikStoklarMap[data.yedekParcaKodu]) {
          birlesikRapor.push({
            id: d.id,
            tarihObj: data.kayitTarihi ? data.kayitTarihi.toDate() : new Date(),
            tarihStr: data.kayitTarihi ? data.kayitTarihi.toDate().toLocaleString('tr-TR') : "-",
            stokKodu: data.yedekParcaKodu,
            parcaAdi: kritikStoklarMap[data.yedekParcaKodu].ad,
            mevcutStok: kritikStoklarMap[data.yedekParcaKodu].kalan,
            birim: kritikStoklarMap[data.yedekParcaKodu].birim,
            kullanimYeri: `${data.hatAdi || "-"} / ${data.ekipmanAdi || "-"}`,
            personel: Array.isArray(data.isiYapanlar) ? data.isiYapanlar.join(", ") : (data.bildirenKisi || "-")
          });
        }
      });

      // Tarihe göre sırala (En son kullanılanı en üste al)
      birlesikRapor.sort((a, b) => b.tarihObj.getTime() - a.tarihObj.getTime());
      
      // Aynı parçanın sadece EN SON kullanımını almak için filtrele
      const essizRapor: any[] = [];
      const gorulenKodlar = new Set();
      
      for (const item of birlesikRapor) {
        if (!gorulenKodlar.has(item.stokKodu)) {
          gorulenKodlar.add(item.stokKodu);
          essizRapor.push(item);
        }
      }

      setKritikParcalar(essizRapor);
    } catch (error) {
      console.error("Kritik stoklar çekilirken hata:", error);
    }
    setLoading(false);
  };

  const exportToXLSX = () => {
    if (kritikParcalar.length === 0) return alert("Dışa aktarılacak kritik stok bulunamadı.");

    const excelData = kritikParcalar.map(p => ({
      "Kullanım Tarihi (Son)": p.tarihStr,
      "Stok Kodu": p.stokKodu,
      "Malzeme Adı": p.parcaAdi,
      "Mevcut Stok Miktarı": `${p.mevcutStok} ${p.birim}`,
      "Kullanım Yeri": p.kullanimYeri,
      "Kullanan Personel": p.personel
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kritik_Stok_Raporu");
    XLSX.writeFile(workbook, `Kritik_Stok_Siparis_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-red-500 font-bold tracking-widest">Rapor Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="bg-gray-900 border border-red-500/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-red-400 font-bold mb-1 text-sm tracking-wider uppercase">Tedarik Zinciri ve Satın Alma</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Kritik Stok Bildirim Raporu
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Sistemde miktarı 2 veya daha altına düşmüş (Satın almaya iletilmesi gereken) acil ihtiyaç listesi.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportToXLSX} className="bg-green-700 hover:bg-green-600 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              .XLSX İndir
            </button>
            {/* Akıllı Geri Dönüş: Depoysa depoya, Adminse admine döner */}
            <button onClick={() => window.history.back()} className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold transition shadow-lg border border-gray-700">← Geri Dön</button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-white">Listelenen Kritik Parça Adedi: <span className="text-red-400">{kritikParcalar.length} Adet</span></h3>
          </div>
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
                {kritikParcalar.length > 0 ? kritikParcalar.map((row, index) => (
                  <tr key={index} className="border-b border-gray-800 transition hover:bg-red-900/30 bg-red-900/10">
                    <td className="py-4 px-4 font-medium text-gray-300 whitespace-nowrap">{row.tarihStr}</td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-red-300">{row.stokKodu}</div>
                      <div className="text-xs text-gray-400">{row.parcaAdi}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-black text-red-500 text-lg">{row.mevcutStok}</span> <span className="text-gray-500 text-xs">{row.birim}</span>
                    </td>
                    <td className="py-4 px-4 font-bold text-teal-300">{row.kullanimYeri}</td>
                    <td className="py-4 px-4 text-gray-300">{row.personel}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-500">Sistemde 2 ve altında stoğu kalan acil malzeme bulunmamaktadır.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}