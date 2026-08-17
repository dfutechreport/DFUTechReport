"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

type Ekipman = {
  id: string;
  hatAdi: string;
  ekipmanAdi: string;
  durum: string;
};

export default function EkipmanYonetimi() {
  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [durum, setDurum] = useState("Aktif");
  const [ekipmanlar, setEkipmanlar] = useState<Ekipman[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // YENİ: Düzenleme (Edit) State'leri
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);

  const ekipmanlariGetir = async () => {
    try {
      const q = query(collection(db, "assets"), orderBy("hatAdi"));
      const querySnapshot = await getDocs(q);
      const liste: Ekipman[] = [];
      querySnapshot.forEach((document) => {
        liste.push({ id: document.id, ...document.data() } as Ekipman);
      });
      setEkipmanlar(liste);
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  useEffect(() => {
    ekipmanlariGetir();
  }, []);

  // KAYDET VEYA GÜNCELLE FONKSİYONU
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi) {
      setMesaj("Lütfen hat ve ekipman adını eksiksiz girin!");
      return;
    }

    setLoading(true);
    setMesaj("");

    try {
      if (duzenlenenId) {
        // GÜNCELLEME İŞLEMİ
        const ekipmanRef = doc(db, "assets", duzenlenenId);
        await updateDoc(ekipmanRef, {
          hatAdi: hatAdi,
          ekipmanAdi: ekipmanAdi,
          durum: durum
        });
        setMesaj("Ekipman başarıyla güncellendi!");
      } else {
        // YENİ KAYIT İŞLEMİ
        await addDoc(collection(db, "assets"), {
          hatAdi: hatAdi,
          ekipmanAdi: ekipmanAdi,
          durum: durum,
          eklenmeTarihi: new Date()
        });
        setMesaj("Ekipman başarıyla eklendi!");
      }

      // Formu Sıfırla
      setHatAdi("");
      setEkipmanAdi("");
      setDurum("Aktif");
      setDuzenlenenId(null);
      ekipmanlariGetir(); 

    } catch (error) {
      console.error(error);
      setMesaj("İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // YENİ: SİLME FONKSİYONU
  const handleSil = async (id: string) => {
    if (!window.confirm("Bu ekipmanı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    
    try {
      await deleteDoc(doc(db, "assets", id));
      ekipmanlariGetir();
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi başarısız oldu.");
    }
  };

  // YENİ: DÜZENLEME MODUNA GEÇİŞ
  const handleDuzenle = (ekp: Ekipman) => {
    setHatAdi(ekp.hatAdi);
    setEkipmanAdi(ekp.ekipmanAdi);
    setDurum(ekp.durum || "Aktif");
    setDuzenlenenId(ekp.id);
    setMesaj("");
    window.scrollTo({ top: 0, behavior: "smooth" }); // Form yukarıda olduğu için kaydır
  };

  // Düzenlemeden Vazgeç
  const IptalEt = () => {
    setHatAdi("");
    setEkipmanAdi("");
    setDurum("Aktif");
    setDuzenlenenId(null);
    setMesaj("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-3xl font-bold">Hat ve Ekipman Yönetimi</h1></div>
            <p className="text-gray-400 mt-1"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | Varlık Tanımlama Merkezi</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition">
            ← Dashboard'a Dön
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sol Taraf: Ekipman Ekleme/Düzenleme Formu */}
          <div className="lg:col-span-1">
            <div className={`border p-6 rounded-2xl shadow-lg transition-colors ${duzenlenenId ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-900 border-gray-800'}`}>
              <h2 className={`text-xl font-bold mb-6 ${duzenlenenId ? 'text-blue-400' : 'text-orange-400'}`}>
                {duzenlenenId ? "Ekipmanı Düzenle" : "Yeni Ekipman Ekle"}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Üretim Hattı</label>
                  <input 
                    type="text" value={hatAdi} onChange={(e) => setHatAdi(e.target.value)} placeholder="Örn: Kruvasan Hattı" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Ekipman Adı</label>
                  <input 
                    type="text" value={ekipmanAdi} onChange={(e) => setEkipmanAdi(e.target.value)} placeholder="Örn: Spiral Mikser" 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* YENİ: Durum Değiştirme (Aktif / Pasif / Hurda) */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Çalışma Durumu</label>
                  <select 
                    value={durum} onChange={(e) => setDurum(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Aktif">Aktif (Çalışıyor)</option>
                    <option value="Pasif">Pasif (Kullanım Dışı)</option>
                    <option value="Hurda">Hurda / Perte Çıktı</option>
                  </select>
                </div>

                {mesaj && (
                  <div className={`text-sm font-medium ${mesaj.includes("başarıyla") ? "text-green-400" : "text-red-400"}`}>
                    {mesaj}
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <button 
                    type="submit" disabled={loading}
                    className={`w-full font-bold py-3 px-4 rounded-lg transition disabled:opacity-50 ${duzenlenenId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'}`}
                  >
                    {loading ? "İşleniyor..." : (duzenlenenId ? "Değişiklikleri Kaydet" : "Sisteme Ekle")}
                  </button>
                  
                  {duzenlenenId && (
                    <button type="button" onClick={IptalEt} className="w-full bg-gray-700 hover:bg-gray-600 font-bold py-3 px-4 rounded-lg transition">
                      İptal Et
                    </button>
                  )}
                </div>
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
                        <th className="pb-3 px-4 text-right">Aksiyonlar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ekipmanlar.map((ekp) => (
                        <tr key={ekp.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                          <td className="py-4 px-4 font-medium">{ekp.hatAdi}</td>
                          <td className="py-4 px-4 text-gray-300">{ekp.ekipmanAdi}</td>
                          <td className="py-4 px-4">
                            <span className={`text-xs px-3 py-1 rounded-full border ${
                              ekp.durum === 'Pasif' ? 'bg-orange-900/30 text-orange-400 border-orange-800/50' :
                              ekp.durum === 'Hurda' ? 'bg-red-900/30 text-red-400 border-red-800/50' :
                              'bg-green-900/30 text-green-400 border-green-800/50'
                            }`}>
                              {ekp.durum || 'Aktif'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right space-x-2">
                            <button onClick={() => handleDuzenle(ekp)} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white text-xs px-3 py-2 rounded transition border border-blue-800/50">
                              Düzenle
                            </button>
                            <button onClick={() => handleSil(ekp.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded transition border border-red-800/50">
                              Sil
                            </button>
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