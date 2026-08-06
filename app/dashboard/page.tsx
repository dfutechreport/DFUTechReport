"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  const [userName, setUserName] = useState("");
  const [hatlar, setHatlar] = useState<any[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<any[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [manualStockSearch, setManualStockSearch] = useState("");

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) setUserName(userSnap.data().name);
        const hSnap = await getDocs(collection(db, "hatlar"));
        setHatlar(hSnap.docs.map(d => d.data().ad));
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    if (baslangic && bitis) {
      const start = new Date(`2024-01-01T${baslangic}`).getTime();
      const end = new Date(`2024-01-01T${bitis}`).getTime();
      let diff = (end - start) / (1000 * 60);
      if (diff < 0) diff += 1440;
      setHesaplananSure(diff);
    }
  }, [baslangic, bitis]);

  const handleManualStockSearch = () => {
    if (!manualStockSearch.trim()) return;
    window.location.href = `/admin/yedek-parca?q=${encodeURIComponent(manualStockSearch)}`;
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Hata");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => { setValue("aciklama", (watch("aciklama") || "") + " " + e.results[0][0].transcript); };
    rec.start();
  };

  const onSubmit = async (data: any) => {
    try {
      await setDoc(doc(collection(db, "maintenance_logs")), { ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp() });
      alert("Başarıyla kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata oluştu."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-24">
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-2xl font-black mb-10 text-teal-400 border-b border-gray-800 pb-6 uppercase tracking-tighter">Vardiya İş Kaydı</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Hat</label>
              <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Ekipman</label>
              <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 mb-2 block">Başlangıç</label><input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
              <div><label className="text-xs font-bold text-gray-500 mb-2 block">Bitiş</label><input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
            </div>
            <div className="flex items-center gap-4 bg-red-900/10 p-5 rounded-2xl border border-red-900/30">
              <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600" />
              <label className="text-sm font-bold text-red-400 uppercase">Üretim Duruşu Var</label>
            </div>
            <div className="bg-teal-900/20 p-6 rounded-2xl text-center border border-teal-500/20">
              <p className="text-[10px] font-bold text-teal-500 mb-1">Müdahale Süresi</p>
              <h2 className="text-4xl font-black">{hesaplananSure} Dakika</h2>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase">Açıklama</label>
              <button type="button" onClick={sesliYazimBaslat} className={`px-4 py-2 rounded-xl text-xs font-bold ${isDictating?'bg-red-600 animate-pulse':'bg-gray-800 text-teal-400'}`}>Sesle Yazdır</button></div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm" placeholder="Açıklama girin..." />
            </div>
            <button type="submit" disabled={isSubmitting || hesaplananSure<=0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl transition-all shadow-xl shadow-orange-600/20 uppercase tracking-widest">Performansı Kaydet ve Bitir</button>
          </form>
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/20">
          <span className="text-[10px] font-black uppercase hidden sm:inline">Stok Sorgula</span>
          <div className="flex items-center bg-black/20 rounded-xl px-3"><input type="text" value={manualStockSearch} onChange={e=>setManualStockSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleManualStockSearch()} placeholder="Ara..." className="bg-transparent text-[10px] w-28 py-1.5 outline-none" /><button onClick={handleManualStockSearch} className="ml-2">🔍</button></div>
          <Link href="/admin/yedek-parca/sesli" className="p-1 hover:bg-indigo-400 rounded-full transition">🎤</Link>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
