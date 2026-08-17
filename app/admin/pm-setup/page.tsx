"use client";

import { useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function PMSetup() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");

  const baslat = async () => {
    if (!window.confirm("DİKKAT: Sistemdeki tüm makinelerin bakım periyodu '3 AYLIK' olarak güncellenecektir. Onaylıyor musunuz?")) return;
    
    setLoading(true);
    try {
      setLog("Veritabanına bağlanılıyor...");
      
      const snap = await getDocs(collection(db, "pm_master_plan"));
      const makineler = snap.docs;
      
      setLog(`${makineler.length} adet makine bulundu. Güncelleme başlıyor...`);
      
      let sayac = 0;
      for (const makine of makineler) {
        sayac++;
        // Mevcut kaydın sadece 'siklik' alanını 3 AYLIK olarak eziyoruz
        await updateDoc(doc(db, "pm_master_plan", makine.id), {
          siklik: "3 AYLIK"
        });
        setLog(`Güncelleniyor: ${sayac} / ${makineler.length} (${makine.id}) -> 3 AYLIK yapıldı`);
      }

      setLog("HARİKA! Sistemdeki tüm makinelerin bakım sıklığı 3 AYLIK olarak güncellendi.");
    } catch (error: any) {
      setLog("Hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center text-white p-4">
      <div className="bg-gray-900 border border-teal-500 p-8 rounded-xl max-w-xl w-full shadow-[0_0_20px_rgba(20,184,166,0.2)]">
        <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-2xl font-bold text-teal-400 mb-4">Periyot Güncelleme Aracı</h1></div>
        <p className="text-gray-400 mb-6">Aşağıdaki butona bastığınızda, sistemdeki tüm makinelerin bakım sıklığı otomatik olarak 3 AYLIK olarak düzeltilecektir.</p>
        
        <button onClick={baslat} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-500 font-bold py-4 rounded-lg transition disabled:opacity-50 text-white shadow-lg">
          {loading ? "Veriler Güncelleniyor..." : "Tümünü 3 AYLIK Olarak Düzelt"}
        </button>

        <div className="mt-6 p-4 bg-black border border-gray-800 rounded font-mono text-sm text-green-400 min-h-[100px]">
          {log || "Bekleniyor..."}
        </div>

        <div className="mt-8 text-center">
          <a href="/admin" className="text-gray-500 hover:text-white transition">← İşlem bitince Admin Panele Dön</a>
        </div>
      </div>
    </div>
  );
}