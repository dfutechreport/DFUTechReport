"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function MesaiRaporlari() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtreler
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterPersonel, setFilterPersonel] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [personelListesi, setPersonelListesi] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(data);

        // Filtre Seçeneklerini Oluştur
        const yillar = new Set<string>();
        const personeller = new Set<string>();
        data.forEach((d: any) => {
          if (d.tarih) yillar.add(d.tarih.substring(0, 4));
          if (d.personel) personeller.add(d.personel);
        });
        setYilListesi(Array.from(yillar));
        setPersonelListesi(Array.from(personeller));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Verileri Filtrele
  const filteredLogs = logs.filter(log => {
    const logYil = log.tarih ? log.tarih.substring(0, 4) : "";
    const logAy = log.tarih ? log.tarih.substring(5, 7) : "";
    
    // Ay stringini düzeltme (Örn: "07" -> "7")
    const temizAy = filterAy ? filterAy.padStart(2, '0') : "";

    if (filterYil && logYil !== filterYil) return false;
    if (filterAy && logAy !== temizAy) return false;
    if (filterPersonel && log.personel !== filterPersonel) return false;
    return true;
  });

  // KPI Hesaplama
  const toplamDakika = filteredLogs.reduce((acc, curr) => acc + (curr.toplamMesaiDk || 0), 0);
  const toplamSaat = (toplamDakika / 60).toFixed(1);

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Raporlar çekiliyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Personel Mesai (Puantaj) Raporları</h1>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Dashboard'a Dön</Link>
        </div>

        {/* Filtreleme */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Yıl</label>
            <select value={filterYil} onChange={e => setFilterYil(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-blue-500">
              <option value="">Tümü</option>
              {yilListesi.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Ay</label>
            <select value={filterAy} onChange={e => setFilterAy(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-blue-500">
              <option value="">Tümü</option>
              {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{i+1}. Ay</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Personel Seçimi</label>
            <select value={filterPersonel} onChange={e => setFilterPersonel(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-blue-500">
              <option value="">Tüm Personeller</option>
              {personelListesi.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterPersonel("");}} className="bg-red-900/40 text-red-400 p-2 rounded-lg text-sm">Sıfırla</button>
          </div>
        </div>

        {/* KPI */}
        <div className="bg-blue-900/20 border border-blue-800/50 p-6 rounded-xl mb-8 flex justify-between items-center">
          <h2 className="text-xl font-bold">Filtrelenen Toplam Hakediş Süresi:</h2>
          <p className="text-4xl font-bold text-blue-400">{toplamSaat} <span className="text-lg text-gray-400">Saat</span></p>
        </div>

        {/* Tablo */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="pb-3 px-2">Tarih</th>
                <th className="pb-3 px-2">Personel</th>
                <th className="pb-3 px-2">Saat (Baş/Bit)</th>
                <th className="pb-3 px-2">Mesai Türü</th>
                <th className="pb-3 px-2">Evden Çağ.</th>
                <th className="pb-3 px-2 text-blue-400">Hakediş</th>
                <th className="pb-3 px-2">Açıklama</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="py-3 px-2">{log.tarih}</td>
                  <td className="py-3 px-2 font-medium text-gray-200">{log.personel}</td>
                  <td className="py-3 px-2">{log.baslangicSaati} - {log.bitisSaati}</td>
                  <td className="py-3 px-2 text-gray-400">{log.mesaiTuru}</td>
                  <td className="py-3 px-2 text-orange-400 font-bold">{log.evdenCagirma === "Var" ? "+2 Saat" : "-"}</td>
                  <td className="py-3 px-2 text-blue-400 font-bold">{(log.toplamMesaiDk / 60).toFixed(1)} Sa</td>
                  <td className="py-3 px-2 text-xs text-gray-500 max-w-xs truncate" title={log.aciklama}>{log.aciklama}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}