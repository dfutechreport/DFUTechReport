"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  
  // States
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [manualStockSearch, setManualStockSearch] = useState("");
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "", stock: 0, quantity: 1, unit: "Adet" }]);

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  // Initial Data & Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) {
          setUserName(userSnap.data().name || "");
          setUserRole(userSnap.data().role || "");
        }
        const hSnap = await getDocs(collection(db, "hatlar"));
        setHatlar(hSnap.docs.map(d => d.data().ad || d.data().name).sort());
        const pSnap = await getDocs(collection(db, "spare_parts"));
        setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Equipment
  useEffect(() => {
    if (selectedHat) {
      const q = query(collection(db, "ekipmanlar"), where("hat", "==", selectedHat));
      getDocs(q).then(s => setEkipmanlar(s.docs.map(d => d.data().ad || d.data().name).sort()));
    }
  }, [selectedHat]);

  // Duration Calc
  useEffect(() => {
    if (baslangic && bitis) {
      const s = new Date(`2024-01-01T${baslangic}`).getTime();
      const e = new Date(`2024-01-01T${bitis}`).getTime();
      let d = (e - s) / 60000;
      if (d < 0) d += 1440;
      setHesaplananSure(d);
    }
  }, [baslangic, bitis]);

  // Material Logic
  const handleMaterialCode = (id: number, code: string) => {
    const part = allSpareParts.find(p => p.stockCode === code || p.id === code);
    setUsedMaterials(usedMaterials.map(m => m.id === id ? { 
      ...m, stockCode: code, name: part ? part.name : "Parça Bulunamadı", stock: part ? part.stock : 0 
    } : m));
  };

  const addMaterialRow = () => setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "", stock: 0, quantity: 1, unit: "Adet" }]);
  const removeMaterialRow = (id: number) => setUsedMaterials(usedMaterials.filter(m => m.id !== id));

  // Voice Logic (Append Mode)
  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Hata");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      const currentText = watch("aciklama") || "";
      setValue("aciklama", currentText + (currentText ? " " : "") + transcript);
    };
    rec.start();
  };

  const handleManualSearch = () => {
    if (!manualStockSearch.trim()) return;
    window.location.href = `/admin/yedek-parca?q=${encodeURIComponent(manualStockSearch)}`;
  };

  const onSubmit = async (data: any) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode && m.name !== "Parça Bulunamadı");
      await setDoc(doc(collection(db, "maintenance_logs")), { 
        ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials
      });
      alert("Kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-20">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
           <p className="text-sm font-black text-teal-400">{userName}</p></div>
           <div className="flex gap-2">
             <Link href="/admin" className="bg-gray-800 text-[10px] font-bold px-4 py-2 rounded-xl">ADMİN</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-bold px-4 py-2 rounded-xl">ÇIKIŞ</button>
           </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter">Vardiya İş Kaydı</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hattı Seçin</label>
              <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Ekipmanı Seçin</label>
              <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white"><option value="">Seçiniz</option>{ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Vardiya Bilgisi</label>
              <select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white">
                <option value="08:00 - 16:00">08:00 - 16:00</option>
                <option value="16:00 - 24:00">16:00 - 24:00</option>
                <option value="24:00 - 08:00">24:00 - 08:00</option>
              </select></div>
              <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600" />
                <label className="text-xs font-bold text-red-400 uppercase">Üretim Duruşu Var</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Başlangıç</label><input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Bitiş</label><input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4" /></div>
            </div>

            <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-3xl space-y-4">
              <div className="flex justify-between items-center"><h3 className="text-xs font-bold text-gray-400 uppercase">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={addMaterialRow} className="bg-teal-600 text-[10px] font-black px-3 py-1.5 rounded-lg">+ EKLE</button></div>
              {usedMaterials.map(m => (
                <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>handleMaterialCode(m.id, e.target.value)} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs" />
                  <div className="col-span-4 text-[9px] font-bold text-teal-500 truncate bg-black/20 p-3 rounded-xl border border-gray-800">{m.name || "Bekleniyor"}</div>
                  <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-center" />
                  <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[9px]">
                    <option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option>
                  </select>
                  <button type="button" onClick={()=>removeMaterialRow(m.id)} className="col-span-1 text-gray-500">✕</button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase">İşlem Özeti</label>
              <button type="button" onClick={sesliYazimBaslat} className={`px-4 py-2 rounded-xl text-xs font-bold ${isDictating?'bg-red-600 animate-pulse':'bg-gray-800 text-teal-400'}`}>🎙️ Sesle Yazdır</button></div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm" placeholder="Detayları buraya yazın..." />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 py-5 rounded-3xl font-black shadow-xl shadow-orange-600/20 uppercase tracking-widest">Performansı Kaydet</button>
          </form>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/20">
          <span className="text-[10px] font-black uppercase hidden sm:inline">Stok Sorgula</span>
          <div className="flex items-center bg-black/20 rounded-xl px-3"><input type="text" value={manualStockSearch} onChange={e=>setManualStockSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleManualSearch()} placeholder="Ara..." className="bg-transparent text-[10px] w-24 py-2 outline-none" /><button onClick={handleManualSearch}>🔍</button></div>
          <Link href="/admin/yedek-parca/sesli" className="p-1 hover:bg-indigo-400 rounded-full transition">🎤</Link>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
