"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }]);

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) {
          setUserName(userSnap.data().name || "");
          setUserRole(userSnap.data().role || "");
        }
        await fetchInitialData();
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchInitialData = async () => {
    try {
      const hSnap = await getDocs(collection(db, "hatlar"));
      setHatlar(hSnap.docs.map(d => d.data().ad || d.data().name || d.id).sort());
      
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Veri hatası:", e); }
  };

  useEffect(() => {
    if (selectedHat) {
      const q = query(collection(db, "ekipmanlar"), where("hat", "==", selectedHat));
      getDocs(q).then(s => setEkipmanlar(s.docs.map(d => d.data().ad || d.data().name).sort()));
    }
  }, [selectedHat]);

  useEffect(() => {
    if (baslangic && bitis) {
      const s = new Date(`2024-01-01T${baslangic}`).getTime();
      const e = new Date(`2024-01-01T${bitis}`).getTime();
      let d = (e - s) / 60000;
      if (d < 0) d += 1440;
      setHesaplananSure(d);
    }
  }, [baslangic, bitis]);

  // --- KRİTİK: ROBUST STOK KODU ARAMA MOTORU ---
  const handleMaterialCode = (id: number, inputCode: string) => {
    if (!inputCode) {
      setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, stockCode: "", name: "Kod Bekleniyor" } : m));
      return;
    }

    const searchStr = inputCode.trim().toUpperCase();
    
    // Çoklu alan tarama: stockCode, kod veya belge ID'si
    const part = allSpareParts.find(p => 
      (p.stockCode && p.stockCode.toUpperCase() === searchStr) || 
      (p.kod && p.kod.toUpperCase() === searchStr) ||
      (p.id && p.id.toUpperCase() === searchStr)
    );

    setUsedMaterials(prev => prev.map(m => {
      if (m.id === id) {
        return { 
          ...m, 
          stockCode: inputCode, 
          name: part ? part.name : "Hatalı Kod"
        };
      }
      return m;
    }));
  };

  const addMaterialRow = () => setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }]);
  const removeMaterialRow = (id: number) => setUsedMaterials(usedMaterials.filter(m => m.id !== id));

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Hata");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      const current = watch("aciklama") || "";
      setValue("aciklama", current + (current ? " " : "") + transcript);
    };
    rec.start();
  };

  const onSubmit = async (data: any) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      await setDoc(doc(collection(db, "maintenance_logs")), { 
        ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials
      });
      alert("Başarıyla kaydedildi."); window.location.reload();
    } catch (e) { alert("Kaydedilemedi."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-10">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
           <p className="text-sm font-black text-teal-400 uppercase tracking-tighter">{userName}</p></div>
           <div className="flex gap-2">
             {["admin", "operator", "teknisyen"].includes(userRole) && (<Link href="/admin" className="bg-gray-800 text-[10px] font-bold px-4 py-2 rounded-xl">ADMİN PANEL</Link>)}
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-bold px-4 py-2 rounded-xl">GÜVENLİ ÇIKIŞ</button>
           </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-2xl font-black mb-8 text-white uppercase tracking-widest border-b border-gray-800 pb-4">Vardiya İş Kaydı</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Hattı Seçin</label>
              <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 ring-teal-500">
                <option value="">Seçiniz...</option>
                {hatlar.map(h=><option key={h} value={h}>{h}</option>)}
              </select></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Ekipman</label>
              <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 ring-teal-500">
                <option value="">{selectedHat ? "Seçiniz..." : "Önce Hat Seçin"}</option>
                {ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}
              </select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Vardiya</label>
              <select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white outline-none">
                <option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select></div>
              <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600" />
                <label className="text-xs font-bold text-red-400 uppercase tracking-tighter">Üretim Duruşu Var</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Başlangıç</label><input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Bitiş</label><input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white" /></div>
            </div>

            {/* MALZEME SARFİYATI - ROBUST VERSION */}
            <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-3xl space-y-4">
              <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={addMaterialRow} className="bg-teal-600 text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-lg">+ YENİ SATIR</button></div>
              {usedMaterials.map(m => (
                <div key={m.id} className="grid grid-cols-12 gap-2 items-center animate-fadeIn">
                  <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>handleMaterialCode(m.id, e.target.value)} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs outline-none focus:border-teal-500 text-white uppercase" />
                  <div className={`col-span-4 text-[9px] font-bold truncate bg-black/30 p-3 rounded-xl border border-gray-800 ${m.name === "Hatalı Kod" ? "text-red-500" : "text-teal-400"}`}>{m.name}</div>
                  <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-center text-white" min="1" />
                  <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[9px] text-white">
                    <option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option>
                  </select>
                  <button type="button" onClick={()=>removeMaterialRow(m.id)} className="col-span-1 text-gray-600 hover:text-red-500 transition-colors">✕</button>
                </div>
              ))}
            </div>

            <div className="bg-teal-900/20 p-6 rounded-2xl text-center border border-teal-500/20">
              <p className="text-[10px] font-bold text-teal-500 mb-1 uppercase tracking-widest">Müdahale Süresi</p>
              <h2 className="text-4xl font-black text-white">{hesaplananSure} <span className="text-sm font-normal text-gray-500 uppercase">Dakika</span></h2>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase">Yapılan İşlem / Açıklama</label>
              <button type="button" onClick={sesliYazimBaslat} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg':'bg-gray-800 text-teal-400'}`}>🎙️ Sesle Yazdır</button></div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm text-white outline-none focus:ring-1 ring-teal-500" placeholder="Detayları buraya ekleyin..." />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl shadow-xl shadow-orange-600/20 uppercase transition-all tracking-widest">Raporu Sisteme Kaydet</button>
          </form>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-500 font-bold uppercase tracking-widest animate-pulse">Sistem Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
