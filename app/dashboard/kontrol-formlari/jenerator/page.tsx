"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function JeneratorFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Checkbox'lar
  const [chkJenerator1, setChkJenerator1] = useState(false);
  const [chkJenerator2, setChkJenerator2] = useState(false);
  const [chkJenerator3, setChkJenerator3] = useState(false);
  
  // Mazot Tankı Mantığı
  const [mazotDurumu, setMazotDurumu] = useState("DOLU");
  const [eklenenMazotLt, setEklenenMazotLt] = useState("");

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
    if (mazotDurumu === "BOŞ" && !eklenenMazotLt) return alert("Mazot seviyesi BOŞ seçildi. Lütfen eklenen miktarı giriniz.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_jenerator"), {
        tarih, vardiya, personel: userName,
        jen1Ok: chkJenerator1,
        jen2Ok: chkJenerator2,
        jen3Ok: chkJenerator3,
        mazotDurum: mazotDurumu,
        eklenenMazotLt: mazotDurumu === "BOŞ" ? eklenenMazotLt : "Ekleme Yapılmadı",
        kayitTarihi: new Date()
      });
      alert("Jeneratör Dairesi formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/kontrol-formlari";
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-yellow-500/50 rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-yellow-500">Jeneratör Haftalık Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-yellow-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-yellow-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-4">
            <h3 className="text-yellow-400 font-bold mb-4 border-b border-gray-700 pb-2">Jeneratör Çalışma (Test) Onayları</h3>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator1} onChange={e => setChkJenerator1(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator1 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-1 Sorunsuz Çalıştı</span>
            </label>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator2} onChange={e => setChkJenerator2(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator2 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-2 Sorunsuz Çalıştı</span>
            </label>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkJenerator3} onChange={e => setChkJenerator3(e.target.checked)} className="w-6 h-6 text-yellow-600 rounded focus:ring-yellow-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkJenerator3 ? 'text-green-400' : 'text-gray-300'}`}>Jeneratör-3 Sorunsuz Çalıştı</span>
            </label>

            {/* AKILLI MAZOT TANKI SEVİYESİ */}
            <div className="mt-6 border-t border-gray-700 pt-6">
              <label className="block text-sm text-yellow-400 font-bold mb-3">Ortak Mazot Tankı Seviyesi</label>
              <select value={mazotDurumu} onChange={e => setMazotDurumu(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none mb-4 ${mazotDurumu === 'DOLU' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
                <option value="DOLU">DOLU (Seviye Yeterli)</option>
                <option value="BOŞ">BOŞ (Seviye Düşük - Yakıt Eklendi)</option>
              </select>

              {mazotDurumu === "BOŞ" && (
                <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-900/50 p-4 rounded-xl">
                  <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Yakıt Miktarı (Litre)</label>
                  <input type="number" value={eklenenMazotLt} onChange={e => setEklenenMazotLt(e.target.value)} placeholder="Örn: 250" className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Jeneratör Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}