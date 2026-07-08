"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

// TypeScript veri tipleri
type Ekipman = {
  id: string;
  hatAdi: string;
  ekipmanAdi: string;
  durum: string;
};

export default function EkipmanYonetimi() {
  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [ekipmanlar, setEkipmanlar] = useState<Ekipman[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // Sayfa yüklendiğinde mevcut ekipmanları veritabanından çek
  const ekipmanlariGetir = async () => {
    try {
      const q = query(collection(db, "assets"), orderBy("hatAdi"));
      const querySnapshot = await getDocs(q);
      const liste: Ekipman[] = [];
      querySnapshot.forEach((doc) => {
        liste.push({ id: doc.id, ...doc.data() } as Ekipman);
      });
      setEkipmanlar(liste);
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  useEffect(() => {
    ekipmanlariGetir();
  }, []);

  // Yeni Ekipman Kaydetme Fonksiyonu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi) {
      setMesaj("Lütfen hat ve ekipman adını eksiksiz girin!");
      return;
    }

    setLoading(true);
    setMesaj("");

    try {
      // Firebase'e kaydet
      await addDoc(collection(db, "assets"), {
        hatAdi: hatAdi,
        ekipmanAdi: ekipmanAdi,
        durum: "Aktif",
        eklenmeTarihi: new Date()
      });
      
      setMesaj("Ekipman başarıyla kaydedildi!");
      setHatAdi("");
      setEkipmanAdi("");
      ekipmanlariGetir(); // Listeyi güncelle
    } catch (error) {
      console.error(error);
      setMesaj("Kayıt sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Üst Menü */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold">Hat ve Ekipman Yönetimi</h1>
            <p className="text-gray-400 mt-1">Tesisteki tüm varlıkları (asset) buradan tanımlayın.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition">
            ← Dashboard'a Dön
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sol Taraf: Ekipman Ekleme Formu */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-6 text-blue-400">Yeni Ekipman Ekle</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Üretim Hattı</label>
                  <input 
                    type="text" 
                    value={hatAdi}
                    onChange={(e) => setHatAdi(e.target.value)}
                    placeholder="Örn: Kruvasan Hattı" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Ekipman Adı</label>
                  <input 
                    type="text" 
                    value={ekipmanAdi}
                    onChange={(e) => setEkipmanAdi(e.target.value)}
                    placeholder="Örn: Spiral Mikser" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {mesaj && (
                  <div className={`text-sm font-medium ${mesaj.includes("başarıyla") ? "text-green-400" : "text-red-400"}`}>
                    {mesaj}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 mt-4"
                >
                  {loading ? "Kaydediliyor..." : "Sisteme Kaydet"}
                </button>
              </form>
            </div>
          </div>

          {/* Sağ Taraf: Mevcut Ekipmanlar Listesi */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-6">Sistemdeki Ekipmanlar</h2>
              
              {ekipmanlar.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Henüz hiç ekipman tanımlanmamış.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-sm">
                        <th className="pb-3 px-4">Üretim Hattı</th>
                        <th className="pb-3 px-4">Ekipman Adı</th>
                        <th className="pb-3 px-4">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ekipmanlar.map((ekp) => (
                        <tr key={ekp.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                          <td className="py-4 px-4 font-medium">{ekp.hatAdi}</td>
                          <td className="py-4 px-4 text-gray-300">{ekp.ekipmanAdi}</td>
                          <td className="py-4 px-4">
                            <span className="bg-green-900/30 text-green-400 text-xs px-3 py-1 rounded-full border border-green-800/50">
                              {ekp.durum}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}