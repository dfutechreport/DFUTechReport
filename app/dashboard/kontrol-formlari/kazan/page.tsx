"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function KazanFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  const [kondensSicaklik, setKondensSicaklik] = useState("");
  const [buharSicaklik, setBuharSicaklik] = useState("");
  const [buharBasinc, setBuharBasinc] = useState("");
  const [iletkenlik, setIletkenlik] = useState("");
  
  // Şartlı Alan (Kimyasal Tank)
  const [kimyasalDurum, setKimyasalDurum] = useState("DOLU");
  const [kimyasalMiktar, setKimyasalMiktar] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserName(userSnap.data().name);
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya || !kondensSicaklik || !buharSicaklik || !buharBasinc || !iletkenlik) {
      return alert("Lütfen formdaki tüm sıcaklık ve basınç değerlerini doldurun.");
    }
    if (kimyasalDurum === "BOŞ" && !kimyasalMiktar) {
      return alert("Kimyasal tankı BOŞ seçildi. Lütfen eklenen miktarı giriniz!");
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_kazan"), {
        tarih,
        vardiya,
        personel: userName,
        kondensSicaklik: Number(kondensSicaklik),
        buharSicaklik: Number(buharSicaklik),
        buharBasinc: Number(buharBasinc),
        iletkenlik: Number(iletkenlik),
        kimyasalDurum,
        eklenenKimyasal: kimyasalDurum === "BOŞ" ? kimyasalMiktar : "Ekleme Yapılmadı",
        kayitTarihi: new Date()
      });
      alert("Kazan Dairesi formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

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
      <div className="max-w-3xl mx-auto bg-gray-900 border border-orange-500/50 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-orange-500">Kazan Dairesi Günlük Kontrol</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label>
              <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-orange-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label>
              <input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Kondens Tank Sıcaklığı (°C)</label>
              <input type="number" step="0.1" value={kondensSicaklik} onChange={e => setKondensSicaklik(e.target.value)} placeholder="Örn: 85.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazan Sıcaklığı (°C)</label>
              <input type="number" step="0.1" value={buharSicaklik} onChange={e => setBuharSicaklik(e.target.value)} placeholder="Örn: 140" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazanı Basıncı (Bar)</label>
              <input type="number" step="0.1" value={buharBasinc} onChange={e => setBuharBasinc(e.target.value)} placeholder="Örn: 6.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm text-orange-400 font-bold mb-1">Buhar Kazanı İletkenlik Değeri (µS/cm)</label>
              <input type="number" step="0.1" value={iletkenlik} onChange={e => setIletkenlik(e.target.value)} placeholder="Örn: 3000" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-orange-500" />
            </div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <label className="block text-sm font-bold text-gray-300 mb-3">Kazan Kimyasal Tankları Durumu</label>
            <select value={kimyasalDurum} onChange={e => setKimyasalDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${kimyasalDurum === 'DOLU' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
              <option value="DOLU">DOLU (Ekleme Yapılmadı)</option>
              <option value="BOŞ">BOŞ (Seviye Düşük - Ekleme Yapıldı)</option>
            </select>

            {kimyasalDurum === "BOŞ" && (
              <div className="animate-fade-in border-l-4 border-red-500 pl-4">
                <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Kimyasal Miktarı (Lt / Kg)</label>
                <input type="text" value={kimyasalMiktar} onChange={e => setKimyasalMiktar(e.target.value)} placeholder="Ne kadar kimyasal eklendi?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500" />
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Kazan Dairesi Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}