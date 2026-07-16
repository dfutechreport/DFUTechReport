"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function YanginFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Kaçak Sızıntı
  const [kacakDurum, setKacakDurum] = useState("YOK");
  const [kacakDetay, setKacakDetay] = useState("");

  // Pompalar
  const [chkDizel, setChkDizel] = useState(true);
  const [dizelHata, setDizelHata] = useState("");
  
  const [chkElektrikli, setChkElektrikli] = useState(true);
  const [elektrikliHata, setElektrikliHata] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) setUserName(userSnap.data().name);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya) return alert("Vardiya seçimi zorunludur.");
    if (kacakDurum === "VAR" && !kacakDetay) return alert("Kaçak detayı girilmelidir.");
    if (!chkDizel && !dizelHata) return alert("Dizel Pompa arızası seçildi, lütfen detay girin.");
    if (!chkElektrikli && !elektrikliHata) return alert("Elektrikli Pompa arızası seçildi, lütfen detay girin.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_yangin"), {
        tarih, vardiya, personel: userName,
        kacakDurum, kacakDetay: kacakDurum === "VAR" ? kacakDetay : "Sızıntı Yok",
        dizelPompaOk: chkDizel, dizelHata: chkDizel ? "Sorun Yok" : dizelHata,
        elektrikliPompaOk: chkElektrikli, elektrikliHata: chkElektrikli ? "Sorun Yok" : elektrikliHata,
        kayitTarihi: new Date()
      });
      alert("Yangın Pompası formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-red-500/50 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-red-500">Yangın Pompaları Haftalık Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-red-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-red-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <label className="block text-sm text-red-400 font-bold mb-3">Kaçak / Sızıntı Kontrolü</label>
            <select value={kacakDurum} onChange={e => setKacakDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${kacakDurum === 'YOK' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
              <option value="YOK">YOK (Sistem Temiz)</option>
              <option value="VAR">VAR (Müdahale Gerekiyor)</option>
            </select>
            {kacakDurum === "VAR" && (
              <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-900/50 p-4 rounded-xl">
                <label className="block text-sm text-red-400 font-bold mb-1">Kaçak Bölgesi ve Yapılan İşlem</label>
                <textarea value={kacakDetay} onChange={e => setKacakDetay(e.target.value)} rows={2} placeholder="Nerede sızıntı var, ne yapıldı?..." className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
              </div>
            )}
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-6">
            <h3 className="text-red-400 font-bold border-b border-gray-700 pb-2">Pompa Test Onayları (Kutuyu Kaldırırsanız Hata Alanı Açılır)</h3>
            
            <div className="space-y-3">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkDizel} onChange={e => setChkDizel(e.target.checked)} className="w-6 h-6 text-red-600 rounded focus:ring-red-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkDizel ? 'text-green-400' : 'text-red-400'}`}>{chkDizel ? "Dizel Pompa Sağlam" : "Dizel Pompa Arızalı"}</span>
              </label>
              {!chkDizel && <input type="text" value={dizelHata} onChange={e => setDizelHata(e.target.value)} placeholder="Dizel pompadaki arıza nedir?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 ml-2 text-white" />}
            </div>

            <div className="space-y-3 border-t border-gray-700 pt-4">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkElektrikli} onChange={e => setChkElektrikli(e.target.checked)} className="w-6 h-6 text-red-600 rounded focus:ring-red-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkElektrikli ? 'text-green-400' : 'text-red-400'}`}>{chkElektrikli ? "Elektrikli Pompa Sağlam" : "Elektrikli Pompa Arızalı"}</span>
              </label>
              {!chkElektrikli && <input type="text" value={elektrikliHata} onChange={e => setElektrikliHata(e.target.value)} placeholder="Elektrikli pompadaki arıza nedir?" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 ml-2 text-white" />}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Yangın Pompası Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}