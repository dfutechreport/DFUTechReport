"use client";

import { useState } from "react";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "../../../lib/firebase"; // Yolunuz farklıysa ../ ayarlayın
import * as XLSX from "xlsx";
import Link from "next/link";

export default function YedekParcaYoneticisi() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Bu işlem Excel'deki tüm stokları (yaklaşık 13 bin kayıt) veritabanına yazacak/güncelleyecektir. Emin misiniz?")) return;

    setLoading(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Verileri birebir Excel başlıklarınıza göre haritalıyoruz
      const islenecekData = jsonData.map((row: any) => ({
        stokKodu: String(row["Malzeme"]).trim(),
        parcaAdi: row["Malzeme kısa metni"] || "Bilinmeyen Parça",
        mevcutMiktar: Number(row["Tahditsiz klnb."]) || 0,
        birim: row["Temel ölçü birimi"] || "Adet",
        kritikSeviye: 2 // Tüm parçalar için varsayılan alarm limiti: 2 ve altı
      })).filter((d: any) => d.stokKodu !== "undefined" && d.stokKodu !== "");

      const toplam = islenecekData.length;
      let islenen = 0;
      const CHUNK_SIZE = 400; // Firebase kapasitesi

      for (let i = 0; i < toplam; i += CHUNK_SIZE) {
        const chunk = islenecekData.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(item => {
          // Stok kodunu doküman ID'si yapıyoruz (Aynı excel'i tekrar yüklediğinizde eskiyi günceller, çiftleme yapmaz)
          const docRef = doc(collection(db, "spare_parts"), item.stokKodu);
          batch.set(docRef, item, { merge: true });
        });

        await batch.commit();
        islenen += chunk.length;
        setProgress(Math.floor((islenen / toplam) * 100));
      }

      alert(`✅ BAŞARILI! Toplam ${toplam} adet yedek parça stoğu sisteme aktarıldı/güncellendi.`);
    } catch (error) {
      console.error(error);
      alert("Yükleme sırasında hata oluştu!");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 flex justify-center items-center">
      <div className="max-w-2xl w-full bg-gray-900 border border-fuchsia-500/50 rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-fuchsia-400">⚙️ Yedek Parça Stok Yönetimi</h1>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>
        
        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-xl text-center">
          <h2 className="text-lg text-gray-300 font-bold mb-4">Sisteme Excel (.xlsx) İle Stok Yükle / Güncelle</h2>
          <p className="text-sm text-gray-500 mb-6">Excel dosyasındaki "Malzeme", "Malzeme kısa metni" ve "Tahditsiz klnb." sütunları otomatik eşleştirilecektir.</p>
          
          <label className="cursor-pointer bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-3 px-6 rounded-lg transition inline-block">
            {loading ? `Yükleniyor... (%${progress})` : "Excel Dosyasını Seçin"}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={loading} />
          </label>
          
          {loading && (
            <div className="w-full bg-gray-700 rounded-full h-4 mt-6 overflow-hidden">
              <div className="bg-fuchsia-500 h-4 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}