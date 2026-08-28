"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function IsEmriAc() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [seciliHat, setSeciliHat] = useState("");

  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [sorunTipi, setSorunTipi] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [isDuruslu, setIsDuruslu] = useState(false);

  const [sistemSaati, setSistemSaati] = useState<Date | null>(null);
  const [gosterilenSaatStr, setGosterilenSaatStr] = useState("");

  useEffect(() => {
    const suAn = new Date();
    setSistemSaati(suAn);
    setGosterilenSaatStr(suAn.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          
          if (role !== "admin" && role !== "uretim" && role !== "operator") window.location.href = "/";
          
          const snap = await getDocs(collection(db, "assets"));
          setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- DİNAMİK YÖNLENDİRME MANTIĞI ---
  const getDashboardLink = () => {
    if (userRole === "admin") return "/admin";
    if (userRole === "uretim") return "/admin/tamamlanan-isler";
    return "/dashboard";
  };

  const benzersizHatlar = Array.from(new Set(assets.map(a => a.hatAdi)));
  const filtrelenmisEkipmanlar = assets.filter(a => a.hatAdi === seciliHat);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi || !sorunTipi || aciklama.length < 5) return alert("Lütfen tüm alanları doldurun.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "work_orders"), {
        hatAdi, ekipmanAdi, sorunTipi, aciklama, isDuruslu,
        bildirenKisi: userName,
        durum: "Açık", 
        kayitTarihi: sistemSaati, 
        tamamlayanKisi: "",
        tamamlanmaTarihi: null
      });
      alert("İş Emri başarıyla açıldı! Teknisyenlerin ekranına yansıyacaktır.");
      window.location.href = getDashboardLink(); // Dinamik dönüş
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black italic tracking-widest uppercase">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-gray-900 border border-red-500/50 rounded-2xl shadow-2xl p-8 italic font-bold">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-red-400 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Yeni Üretim Bildirimi
          </h1>
          
          {/* GÜNCELLENEN BUTON: Dinamik link ve yeni isim */}
          <Link 
            href={getDashboardLink()} 
            className="bg-gray-800 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-gray-700 transition-all border border-gray-700"
          >
            ← Dashboarda Dön
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase text-xs">Sistem Kayıt Saati (Kilitli)</label>
            <input type="text" value={gosterilenSaatStr} disabled className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-red-400 font-bold opacity-70 cursor-not-allowed text-center text-lg tracking-wider" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1 uppercase text-[10px]">Sorun Yaşanan Hat</label>
              <select value={hatAdi} onChange={(e) => { setHatAdi(e.target.value); setSeciliHat(e.target.value); setEkipmanAdi(""); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 text-sm">
                <option value="">-- Hat Seçiniz --</option>{benzersizHatlar.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1 uppercase text-[10px]">Arızalı Ekipman</label>
              <select value={ekipmanAdi} onChange={(e) => setEkipmanAdi(e.target.value)} disabled={!seciliHat} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white disabled:opacity-50 focus:outline-none focus:border-red-500 text-sm">
                <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>
                {filtrelenmisEkipmanlar.map(e => <option key={e.id} value={e.ekipmanAdi}>{e.ekipmanAdi}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1 uppercase text-[10px]">Sorun Tipi</label>
              <select value={sorunTipi} onChange={(e) => setSorunTipi(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 text-sm">
                <option value="">-- Seçiniz --</option><option value="Mekanik">Mekanik</option><option value="Elektrik">Elektrik</option><option value="Otomasyon">Otomasyon</option><option value="Diğer">Diğer</option>
              </select>
            </div>
            <div className="flex flex-col justify-center">
              <label className="block text-sm font-medium text-gray-400 mb-3 uppercase text-[10px]">Hat Duruşu Var Mı?</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isDuruslu} onChange={(e) => setIsDuruslu(e.target.checked)} />
                <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600 shadow-lg"></div>
                <span className="ml-3 text-sm font-medium text-gray-300 uppercase text-[11px]">{isDuruslu ? <span className="text-red-400 font-black">Kritik: Hat Durdu</span> : "Normal: Hat Çalışıyor"}</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1 uppercase text-[10px]">Sorun Detayı</label>
            <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={4} placeholder="Teknisyene sorunu detaylandırın..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 text-sm italic" />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 font-black py-5 rounded-xl shadow-xl disabled:opacity-50 text-white transition-all uppercase tracking-widest text-sm">
            {isSubmitting ? "Sisteme İletiliyor..." : "İş Emrini Gönder (Alarm Ver)"}
          </button>
        </form>
      </div>
    </div>
  );
}