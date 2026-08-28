"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function MesaiGiris() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState(""); // YENİ: Rol takibi eklendi
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
          setUserRole(userSnap.data().role || "teknisyen"); // Rolü hafızaya aldık
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Süre Hesaplama Algoritması (Orijinal haliyle korundu)
  useEffect(() => {
    if (tarih && baslangic && bitis) {
      const basSaati = new Date(`${tarih}T${baslangic}`);
      const bitSaati = new Date(`${tarih}T${bitis}`);
      if (bitSaati < basSaati) { bitSaati.setDate(bitSaati.getDate() + 1); }
      let farkDakika = Math.floor((bitSaati.getTime() - basSaati.getTime()) / 60000);
      if (evdenCagirma === "Var") farkDakika += 120;
      setHesaplananDakika(Math.max(0, farkDakika));
    } else { setHesaplananDakika(0); }
  }, [tarih, baslangic, bitis, evdenCagirma]);

  // YÖNLENDİRME MANTIĞI (Rola göre dashboard seçer)
  const getDashboardLink = () => {
    if (userRole === "admin") return "/admin";
    if (userRole === "uretim") return "/admin/tamamlanan-isler";
    if (userRole === "ik") return "/admin/mesai";
    return "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarih || !baslangic || !bitis || !tur || aciklama.length < 5) {
      setMesaj("Lütfen tüm alanları eksiksiz doldurun."); return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "overtime_logs"), {
        personel: userName, tarih, baslangicSaati: baslangic, bitisSaati: bitis,
        mesaiTuru: tur, evdenCagirma, toplamMesaiDk: hesaplananDakika,
        aciklama, kayitZamani: new Date()
      });
      setMesaj("BAŞARILI: Mesai kaydınız sisteme işlendi.");
      setTarih(""); setBaslangic(""); setBitis(""); setTur(""); setAciklama(""); setEvdenCagirma("Yok");
    } catch (error) { setMesaj("HATA: Kayıt başarısız."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white italic">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-xl italic font-bold">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-blue-400 uppercase tracking-tighter italic">Fazla Mesai Formu</h1>
          
          {/* GÜNCELLENEN BUTON: Rol bazlı yönlendirme ve yeni isim */}
          <Link 
            href={getDashboardLink()} 
            className="bg-gray-800 px-4 py-2 rounded-lg text-xs uppercase hover:bg-gray-700 transition-all shadow-lg"
          >
            ← Dashboarda Dön
          </Link>
        </div>

        {mesaj && <div className={`p-4 mb-6 rounded-lg font-medium ${mesaj.includes("BAŞARILI") ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>{mesaj}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Mesai Tarihi</label><input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm" /></div>
            <div><label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Başlangıç</label><input type="time" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm" /></div>
            <div><label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Bitiş</label><input type="time" value={bitis} onChange={(e) => setBitis(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Mesai Türü</label>
              <select value={tur} onChange={(e) => setTur(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                <option value="">-- Seçiniz --</option>
                <option value="Normal Mesai">Normal Mesai</option>
                <option value="İzin Mesaisi">Haftalık İzin Mesaisi</option>
                <option value="Resmi Tatil">Resmi Tatil Mesaisi</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Evden Çağırma</label>
              <select value={evdenCagirma} onChange={(e) => setEvdenCagirma(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-orange-400 font-black text-sm">
                <option value="Yok">Yok</option><option value="Var">Var (+2 Saat Bonus)</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 p-6 rounded-xl text-center shadow-inner">
            <p className="text-gray-500 text-[10px] uppercase font-black mb-1">Toplam Hakediş Süresi</p>
            <p className="text-4xl font-black text-blue-400 tracking-tighter italic">{(hesaplananDakika / 60).toFixed(1)} <span className="text-xl text-gray-400">Saat</span></p>
          </div>

          <div><label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Yapılan İşler (Açıklama)</label><textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} placeholder="Detayları buraya yazınız..." className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm italic font-medium"></textarea></div>

          <button type="submit" disabled={isSubmitting || hesaplananDakika === 0} className="w-full bg-blue-600 hover:bg-blue-500 font-black py-5 rounded-xl uppercase text-xs tracking-widest shadow-xl transition-all">
            {isSubmitting ? "KAYDEDİLİYOR..." : "Mesai Formunu Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}