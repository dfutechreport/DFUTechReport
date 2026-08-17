"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function MesaiGiris() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // Form State'leri
  const [tarih, setTarih] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [tur, setTur] = useState("");
  const [evdenCagirma, setEvdenCagirma] = useState("Yok");
  const [aciklama, setAciklama] = useState("");
  const [hesaplananDakika, setHesaplananDakika] = useState(0);

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

  // Süre Hesaplama Algoritması (Gece yarısını geçen mesaileri algılar)
  useEffect(() => {
    if (tarih && baslangic && bitis) {
      const basSaati = new Date(`${tarih}T${baslangic}`);
      const bitSaati = new Date(`${tarih}T${bitis}`);
      
      // Eğer bitiş saati başlangıçtan küçükse (Örn: 22:00'da girip 06:00'da çıktıysa) 1 gün ekle
      if (bitSaati < basSaati) {
        bitSaati.setDate(bitSaati.getDate() + 1);
      }

      let farkDakika = Math.floor((bitSaati.getTime() - basSaati.getTime()) / 60000);
      
      // Evden çağırma varsa +2 Saat (120 Dk) ekle
      if (evdenCagirma === "Var") farkDakika += 120;

      setHesaplananDakika(Math.max(0, farkDakika));
    } else {
      setHesaplananDakika(0);
    }
  }, [tarih, baslangic, bitis, evdenCagirma]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarih || !baslangic || !bitis || !tur || aciklama.length < 5) {
      setMesaj("Lütfen tüm alanları eksiksiz doldurun (Açıklama min 5 karakter).");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "overtime_logs"), {
        personel: userName,
        tarih: tarih, // YYYY-MM-DD
        baslangicSaati: baslangic,
        bitisSaati: bitis,
        mesaiTuru: tur,
        evdenCagirma: evdenCagirma,
        ekstraSureDk: evdenCagirma === "Var" ? 120 : 0,
        toplamMesaiDk: hesaplananDakika,
        aciklama: aciklama,
        kayitZamani: new Date()
      });
      
      setMesaj("BAŞARILI: Mesai kaydınız sisteme işlendi.");
      setTarih(""); setBaslangic(""); setBitis(""); setTur(""); setAciklama(""); setEvdenCagirma("Yok");
    } catch (error) {
      setMesaj("HATA: Kayıt başarısız.");
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-blue-400">Fazla Mesai Formu</h1>
          <Link href="/dashboard" className="bg-gray-800 px-4 py-2 rounded-lg text-sm hover:bg-gray-700">← Arıza Paneline Dön</Link>
        </div>

        {mesaj && <div className={`p-4 mb-6 rounded-lg font-medium ${mesaj.includes("BAŞARILI") ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>{mesaj}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Mesai Tarihi</label>
              <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Başlangıç Saati</label>
              <input type="time" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bitiş Saati</label>
              <input type="time" value={bitis} onChange={(e) => setBitis(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Mesai Türü</label>
              <select value={tur} onChange={(e) => setTur(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3">
                <option value="">-- Seçiniz --</option>
                <option value="Normal Mesai">Normal Mesai</option>
                <option value="Haftalık İzin Mesaisi">Haftalık İzin Mesaisi</option>
                <option value="Resmi Tatil Mesaisi">Resmi Tatil Mesaisi</option>
                <option value="Vardiya Dönüşü Mesaisi">Vardiya Dönüşü Mesaisi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Evden Çağırma (+2 Saat)</label>
              <select value={evdenCagirma} onChange={(e) => setEvdenCagirma(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-orange-400 font-bold">
                <option value="Yok">Yok</option>
                <option value="Var">Var (TİS Gereği +2 Saat)</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-xl text-center">
            <p className="text-gray-400 text-sm">Hakediş (Otomatik Hesaplanan Toplam Süre)</p>
            <p className="text-3xl font-bold text-blue-400">
              {(hesaplananDakika / 60).toFixed(1)} <span className="text-lg text-gray-400">Saat</span> 
              <span className="text-sm font-normal text-gray-500 ml-2">({hesaplananDakika} dk)</span>
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Mesai Açıklaması (Yapılan İşler)</label>
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} placeholder="Hangi hatta ne iş yapıldı?..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"></textarea>
          </div>

          <button type="submit" disabled={isSubmitting || hesaplananDakika === 0} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl disabled:opacity-50">
            {isSubmitting ? "Kaydediliyor..." : "Mesai Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}