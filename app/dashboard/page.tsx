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
  const [userRole, setUserRole] = useState("");
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
        if (userSnap.exists()) {
          setUserName(userSnap.data().name);
          setUserRole(userSnap.data().role);
        }
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
    if (!Recognition) return alert("Tarayıcı ses desteği vermiyor.");
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
        
        {/* ÜST NAVİGASYON - HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4">
             <img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
             <div>
               <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Kullanıcı</p>
               <p className="text-sm font-black text-teal-400">{userName || "Yükleniyor..."}</p>
             </div>
           </div>
           <div className="flex gap-3">
             {["admin", "operator", "teknisyen"].includes(userRole) && (
               <Link href="/admin" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-700 transition">Yönetici Paneli</Link>
             )}
             <button onClick={() => auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-red-900/30 hover:bg-red-600 hover:text-white transition">Çıkış Yap</button>
           </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-2xl font-black mb-10 text-white border-b border-gray-800 pb-6 uppercase tracking-tighter">Vardiya İş Kaydı</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Üretim Hattı</label>
              <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Makine / Ekipman</label>
              <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Arıza Başlangıç</label><input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
              <div><label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Arıza Bitiş</label><input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
            </div>
            <div className="flex items-center gap-4 bg-red-900/10 p-5 rounded-2xl border border-red-900/20">
              <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600" />
              <label className="text-sm font-bold text-red-400 uppercase">Hatta Duruş Oluştu</label>
            </div>
            <div className="bg-teal-900/20 p-6 rounded-2xl text-center border border-teal-500/20">
              <p className="text-[10px] font-bold text-teal-500 mb-1">Müdahale Süresi</p>
              <h2 className="text-4xl font-black">{hesaplananSure} Dakika</h2>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase">Yapılan İşlem</label>
              <button type="button" onClick={sesliYazimBaslat} className={`px-4 py-2 rounded-xl text-xs font-bold ${isDictating?'bg-red-600 animate-pulse':'bg-gray-800 text-teal-400'}`}>{isDictating?'Dinleniyor...':'Sesle Yazdır'}</button></div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm" placeholder="Arıza detaylarını ve çözümünüzü girin..." />
            </div>
            <button type="submit" disabled={isSubmitting || hesaplananSure<=0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl transition-all shadow-xl shadow-orange-600/20 uppercase tracking-widest">Raporu Kaydet ve Bitir</button>
          </form>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/20">
          <span className="text-[10px] font-black uppercase hidden sm:inline">Stok Sorgula</span>
          <div className="flex items-center bg-black/20 rounded-xl px-3"><input type="text" value={manualStockSearch} onChange={e=>setManualStockSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleManualStockSearch()} placeholder="Parça adı/kod..." className="bg-transparent text-[10px] w-28 py-1.5 outline-none" /><button onClick={handleManualStockSearch} className="ml-2">🔍</button></div>
          <Link href="/admin/yedek-parca/sesli" className="p-1 hover:bg-indigo-400 rounded-full transition">🎤</Link>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
