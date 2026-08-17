"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import Link from "next/link";

export default function HidroforFormu() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State'leri
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  
  // Checkbox'lar
  const [chkHamSu, setChkHamSu] = useState(false);
  const [chkYangin, setChkYangin] = useState(false);
  const [chkYumusakSu, setChkYumusakSu] = useState(false);
  
  // Tuz Seviyesi Mantığı
  const [chkTuzTam, setChkTuzTam] = useState(true); // Tikliyse tuz tamdır, giriş alanı kaybolur
  const [eklenenTuzKg, setEklenenTuzKg] = useState("");

  const [sertlikSonucu, setSertlikSonucu] = useState("");
  
  // Kaçak Sızıntı Mantığı
  const [kacakDurum, setKacakDurum] = useState("YOK");
  const [kacakDetay, setKacakDetay] = useState("");

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
    if (!vardiya || !sertlikSonucu) return alert("Vardiya ve Sertlik Ölçüm sonucu zorunludur.");
    if (!chkTuzTam && !eklenenTuzKg) return alert("Tuz seviyesi onaysız! Lütfen eklenen tuz miktarını giriniz.");
    if (kacakDurum === "VAR" && !kacakDetay) return alert("Kaçak tespit edildi. Lütfen müdahale/detay bilgisini giriniz.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "form_hidrofor"), {
        tarih, vardiya, personel: userName,
        hamSuDeposuOk: chkHamSu,
        yanginPompasiOk: chkYangin,
        yumusakSuDeposuOk: chkYumusakSu,
        tuzSeviyesiOk: chkTuzTam,
        eklenenTuzKg: chkTuzTam ? "0" : eklenenTuzKg,
        sertlikSonucu: sertlikSonucu,
        kacakDurum: kacakDurum,
        kacakDetayi: kacakDurum === "VAR" ? kacakDetay : "Sorun Yok",
        kayitTarihi: new Date()
      });
      alert("Hidrofor Dairesi formu başarıyla sisteme işlendi!");
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
      <div className="max-w-3xl mx-auto bg-gray-900 border border-blue-500/50 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-blue-500">Hidrofor Dairesi Kontrolü</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Kontrol Tarihi</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya Bilgisi</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-blue-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Kontrol Eden Personel</label><input type="text" value={userName} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed font-bold" /></div>
          </div>

          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700 space-y-4">
            <h3 className="text-blue-400 font-bold mb-4 border-b border-gray-700 pb-2">Durum Onayları (Kutuyu İşaretleyin)</h3>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkHamSu} onChange={e => setChkHamSu(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkHamSu ? 'text-green-400' : 'text-gray-300'}`}>Ham Su Deposu Seviye Normal</span>
            </label>
            
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkYangin} onChange={e => setChkYangin(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkYangin ? 'text-green-400' : 'text-gray-300'}`}>Yangın Pompası Panosu Aktif</span>
            </label>

            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
              <input type="checkbox" checked={chkYumusakSu} onChange={e => setChkYumusakSu(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkYumusakSu ? 'text-green-400' : 'text-gray-300'}`}>Yumuşak Su Deposu Seviye Normal</span>
            </label>

            {/* AKILLI TUZ SEVİYESİ */}
            <div className="mt-6 border-t border-gray-700 pt-4">
              <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded">
                <input type="checkbox" checked={chkTuzTam} onChange={e => setChkTuzTam(e.target.checked)} className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 bg-gray-900 border-gray-600" />
                <span className={`text-lg font-medium ${chkTuzTam ? 'text-green-400' : 'text-red-400'}`}>
                  {chkTuzTam ? "Tuz Seviyesi Tam" : "Tuz Seviyesi Düşük (Tuz Eklendi)"}
                </span>
              </label>
              
              {/* EĞER TİK KALDIRILIRSA BU KUTU AÇILIR */}
              {!chkTuzTam && (
                <div className="ml-10 mt-3 animate-fade-in border-l-4 border-red-500 pl-4">
                  <label className="block text-sm text-red-400 font-bold mb-1">Eklenen Tuz Miktarı (Kg)</label>
                  <input type="number" value={eklenenTuzKg} onChange={e => setEklenenTuzKg(e.target.value)} placeholder="Örn: 50" className="w-full max-w-xs bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-blue-400 font-bold mb-1">Su Sertlik Ölçüm Sonucu (Fr)</label>
              <input type="text" value={sertlikSonucu} onChange={e => setSertlikSonucu(e.target.value)} placeholder="Örn: 0.5" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:border-blue-500" />
            </div>

            {/* AKILLI KAÇAK SIZINTI KONTROLÜ */}
            <div>
              <label className="block text-sm text-blue-400 font-bold mb-1">Kaçak / Sızıntı Kontrolü</label>
              <select value={kacakDurum} onChange={e => setKacakDurum(e.target.value)} className={`w-full p-3 rounded-lg font-bold border focus:outline-none ${kacakDurum === 'YOK' ? 'bg-green-900/30 text-green-400 border-green-600' : 'bg-red-900/30 text-red-400 border-red-600'}`}>
                <option value="YOK">YOK (Sistem Temiz)</option>
                <option value="VAR">VAR (Müdahale Gerekiyor)</option>
              </select>
            </div>
          </div>

          {kacakDurum === "VAR" && (
            <div className="animate-fade-in border-l-4 border-red-500 pl-4 bg-gray-800/30 p-4 rounded-xl">
              <label className="block text-sm text-red-400 font-bold mb-1">Kaçak Bölgesi ve Yapılan İşlem</label>
              <textarea value={kacakDetay} onChange={e => setKacakDetay(e.target.value)} rows={3} placeholder="Nerede sızıntı var, ne yapıldı?..." className="w-full bg-gray-900 border border-red-500/50 rounded-lg p-3 focus:border-red-500 text-white" />
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Hidrofor Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}