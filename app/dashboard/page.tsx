"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  
  // States
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState("");
  const [hatlar, setHatlar] = useState<any[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<any[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [manualStockSearch, setManualStockSearch] = useState("");

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  // Auth & Initial Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) setUserName(userSnap.data().name);
        fetchIlkVeriler();
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchIlkVeriler = async () => {
    const hSnap = await getDocs(collection(db, "hatlar"));
    setHatlar(hSnap.docs.map(d => d.data().ad));
  };

  useEffect(() => {
    if (selectedHat) {
      const fetchEkipman = async () => {
        const q = query(collection(db, "ekipmanlar"), where("hat", "==", selectedHat));
        const eSnap = await getDocs(q);
        setEkipmanlar(eSnap.docs.map(d => d.data().ad));
      };
      fetchEkipman();
    }
  }, [selectedHat]);

  // Süre Hesaplama
  useEffect(() => {
    if (baslangic && bitis) {
      const start = new Date(`2024-01-01T${baslangic}`).getTime();
      const end = new Date(`2024-01-01T${bitis}`).getTime();
      let diff = (end - start) / (1000 * 60);
      if (diff < 0) diff += 1440; // Gece vardiyası devri
      setHesaplananSure(diff);
    }
  }, [baslangic, bitis]);

  // Hibrit Stok Sorgu
  const handleManualStockSearch = () => {
    if (!manualStockSearch.trim()) return;
    window.location.href = `/admin/yedek-parca?q=${encodeURIComponent(manualStockSearch)}`;
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Tarayıcınız ses desteği sunmuyor.");
    const recognition = new Recognition();
    recognition.lang = "tr-TR";
    recognition.onstart = () => setIsDictating(true);
    recognition.onend = () => setIsDictating(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setValue("aciklama", watch("aciklama") + " " + transcript);
    };
    recognition.start();
  };

  const onSubmit = async (data: any) => {
    try {
      const logRef = doc(collection(db, "maintenance_logs"));
      await setDoc(logRef, {
        ...data,
        toplamSureDakika: hesaplananSure,
        bildirenKisi: userName,
        kayitTarihi: serverTimestamp()
      });
      alert("İş başarıyla kaydedildi.");
      window.location.reload();
    } catch (e) { alert("Hata oluştu."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-20">
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-3xl font-black mb-10 text-teal-400 border-b border-gray-800 pb-6 uppercase tracking-tighter">Vardiya Raporu / İş Kaydı</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Üretim Hattı</label>
                <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500">
                  <option value="">Hat Seçin</option>
                  {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ekipman / Makine</label>
                <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500">
                  <option value="">Ekipman Seçin</option>
                  {ekipmanlar.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Başlangıç Saati</label>
                <input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bitiş Saati</label>
                <input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500" />
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-800/50 p-6 rounded-2xl border border-gray-700">
              <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-teal-500" />
              <label className="text-sm font-bold text-red-400">BU ARIZA ÜRETİM DURUŞUNA NEDEN OLDU</label>
            </div>

            <div className="bg-teal-900/20 border border-teal-500/30 p-6 rounded-2xl text-center">
              <p className="text-xs text-teal-400 font-bold uppercase mb-1">Hesaplanan Toplam Müdahale Süresi</p>
              <h2 className="text-4xl font-black text-white">{hesaplananSure} <span className="text-sm font-normal text-gray-400">Dakika</span></h2>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">Yapılan İşlem / Açıklama</label>
                <button type="button" onClick={sesliYazimBaslat} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDictating ? 'bg-red-600 animate-pulse' : 'bg-gray-800 hover:bg-gray-700 text-teal-400'}`}>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                   {isDictating ? "Dinleniyor..." : "Sesle Yazdır"}
                </button>
              </div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-white outline-none focus:ring-2 ring-teal-500" placeholder="İşlemi detaylandırın..." />
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl shadow-xl shadow-orange-600/20 transition-all disabled:opacity-50">
              {isSubmitting ? "KAYDEDİLİYOR..." : "RAPORU TAMAMLA VE KAYDET"}
            </button>
          </form>
        </div>
      </div>

      {/* --- HİBRİT STOK SORGU PANELİ --- */}
      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center gap-4 transition-all border border-indigo-400/30">
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Stok Sorgula</span>
          <div className="flex items-center bg-black/20 rounded-xl px-3 border border-white/10">
            <input 
              type="text" 
              value={manualStockSearch} 
              onChange={(e) => setManualStockSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualStockSearch()}
              placeholder="Parça adı/kod..." 
              className="bg-transparent text-[10px] text-white w-28 sm:w-44 py-2 outline-none placeholder-indigo-300"
            />
            <button onClick={handleManualStockSearch} className="ml-2 text-indigo-200 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </button>
          </div>
          <Link href="/admin/yedek-parca/sesli" className="p-2 hover:bg-indigo-500 rounded-full transition-all relative group">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}
