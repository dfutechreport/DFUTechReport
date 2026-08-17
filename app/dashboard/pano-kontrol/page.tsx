"use client";

import { useState, useEffect, Suspense } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PanoKontrolIcerik() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = useSearchParams();
  const panoId = searchParams.get("id");
  const panoAdi = searchParams.get("isim");
  const panoYeri = searchParams.get("yer");

  // Form State'leri
  const [chkTemizlik, setChkTemizlik] = useState(false);
  const [karDurumu, setKarDurumu] = useState("EVET"); // EVET / HAYIR

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
    if (!panoId) return alert("Pano kimliği bulunamadı, lütfen listeden tekrar gelin.");

    setIsSubmitting(true);
    const kayitTarihi = new Date();

    try {
      // 1. EĞER TEMİZLİK YAPILDIYSA -> Pano Takip Arşivine Kaydet
      if (chkTemizlik) {
        await addDoc(collection(db, "pano_takip"), {
          panoAdi, panoYeri, personel: userName, islem: "Temizlik ve Kontrol Yapıldı", kayitTarihi
        });
      }

      // 2. EĞER KAR "HAYIR" İSE -> KAR Arşivine Kaydet VE İŞ EMRİ FIRLAT!
      if (karDurumu === "HAYIR") {
        // KAR Arşivi Logu
        await addDoc(collection(db, "kar_takip"), {
          panoAdi, panoYeri, personel: userName, durum: "KAR AKTİF DEĞİL (KAPALI)", kayitTarihi
        });

        // OTOMATİK İŞ EMRİ AÇ (Tüm Panellere Alarm Düşer)
        await addDoc(collection(db, "work_orders"), {
          hatAdi: panoYeri, // Hat bilgisi olarak panonun yerini alıyor
          ekipmanAdi: "KAR devreye alma", // Otomatik Ekipman
          sorunTipi: "Elektrik",
          aciklama: `ACİL İSG ALARMI: ${panoAdi} isimli panonun Kaçak Akım Rölesi devre dışı kalmıştır! Lütfen derhal müdahale edip KAR'ı devreye alın.`,
          isDuruslu: false,
          bildirenKisi: "SİSTEM OTOMASYONU",
          durum: "Açık", 
          kayitTarihi,
          tamamlayanKisi: "",
          tamamlanmaTarihi: null
        });
      }

      alert("Pano kontrol formu başarıyla sisteme işlendi!");
      window.location.href = "/dashboard/pano-listesi";
    } catch (error) { 
      console.error(error); alert("Hata oluştu."); 
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
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-indigo-500/50 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-indigo-400">Pano Temizlik ve Kontrol</h1>
          <Link href="/dashboard/pano-listesi" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-800/50 mb-8">
          <p className="text-indigo-200 text-sm font-medium">İşlem Yapılan Pano:</p>
          <p className="text-2xl font-bold text-white">{panoAdi}</p>
          <p className="text-sm text-gray-400">📍 {panoYeri}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* TEMİZLİK BÖLÜMÜ */}
          <div className="bg-gray-800/50 p-5 rounded-xl border border-gray-700">
            <h3 className="text-gray-300 font-bold mb-4 border-b border-gray-700 pb-2">Rutin Pano Temizliği</h3>
            <label className="flex items-center gap-4 cursor-pointer p-2 hover:bg-gray-800 rounded transition">
              <input type="checkbox" checked={chkTemizlik} onChange={e => setChkTemizlik(e.target.checked)} className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500 bg-gray-900 border-gray-600" />
              <span className={`text-lg font-medium ${chkTemizlik ? 'text-green-400' : 'text-gray-300'}`}>
                {chkTemizlik ? "✅ Pano İçi ve Dışı Temizlendi" : "Pano Temizliği Yapıldı"}
              </span>
            </label>
          </div>

          {/* KAR BÖLÜMÜ (HAYATİ BÖLÜM) */}
          <div className={`p-5 rounded-xl border-2 transition-colors ${karDurumu === 'HAYIR' ? 'bg-red-900/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-gray-800/50 border-gray-700'}`}>
            <label className={`block text-lg font-bold mb-3 ${karDurumu === 'HAYIR' ? 'text-red-400' : 'text-white'}`}>Kaçak Akım Rölesi (KAR) Aktif Mi?</label>
            <select 
              value={karDurumu} 
              onChange={e => setKarDurumu(e.target.value)} 
              className={`w-full p-4 rounded-lg font-bold border-2 focus:outline-none transition-colors ${karDurumu === 'EVET' ? 'bg-gray-800 text-green-400 border-gray-600' : 'bg-red-600 text-white border-red-400 animate-pulse'}`}
            >
              <option value="EVET">EVET (KAR Devrede ve Çalışıyor)</option>
              <option value="HAYIR">HAYIR (KAR Atmış veya Devre Dışı!)</option>
            </select>
            
            {karDurumu === "HAYIR" && (
              <p className="mt-3 text-sm text-red-300 font-bold">⚠️ DİKKAT: Kaydettiğiniz an tüm sisteme Acil İSG İş Emri fırlatılacaktır!</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Sisteme İşleniyor..." : "Pano Kontrolünü Kaydet"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div>Yükleniyor...</div>}><PanoKontrolIcerik /></Suspense>;
}