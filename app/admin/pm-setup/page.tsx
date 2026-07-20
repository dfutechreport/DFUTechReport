"use client";

import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function PMSetup() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");

  const baslat = async () => {
    if (!window.confirm("DİKKAT: Bu işlem Excel verilerinizi veritabanına yükleyecektir. Onaylıyor musunuz?")) return;
    
    setLoading(true);
    try {
      setLog("JSON dosyası okunuyor...");
      // Public klasöründeki dosyayı oku
      const res = await fetch("/pm_data.json");
      const data = await res.json();
      
      setLog("Dosya okundu. Veritabanına aktarım başlıyor...");
      
      const keys = Object.keys(data);
      for (let i = 0; i < keys.length; i++) {
        const makineKodu = keys[i]; // Örn: "KEK-DEPOZİTÖR"
        const makineVerisi = data[makineKodu];
        
        // Veritabanında "pm_master_plan" diye bir tablo oluştur ve her makineyi ID'si ile kaydet
        await setDoc(doc(db, "pm_master_plan", makineKodu), {
          hatAdi: makineVerisi.hat,
          ekipmanAdi: makineVerisi.ekipman,
          siklik: makineVerisi.siklik,
          maddeler: makineVerisi.maddeler,
          aktif: true // Gelecekte bir makinenin bakımını durdurmak isterseniz false yapabilirsiniz
        });
        
        setLog(`Kayıt ediliyor: ${i+1} / ${keys.length} (${makineKodu})`);
      }

      setLog("HARİKA! 64 Makinenin Periyodik Bakım planı ve Checklist kuralları sisteme mühürlendi!");
    } catch (error: any) {
      setLog("Hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center text-white p-4">
      <div className="bg-gray-900 border border-blue-500 p-8 rounded-xl max-w-xl w-full shadow-2xl">
        <h1 className="text-2xl font-bold text-blue-400 mb-4">Excel Entegrasyon Sihirbazı</h1>
        <p className="text-gray-400 mb-6">Lütfen önce pm_data.json dosyasını public klasörüne attığınızdan emin olun. Sonra aşağıdaki butona basın.</p>
        
        <button onClick={baslat} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-lg transition disabled:opacity-50">
          {loading ? "Yükleniyor..." : "Sisteme Entegre Et"}
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