
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
  const [hatlar, setHatlar] = useState<any[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<any[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedParts, setUsedParts] = useState([{ id: Date.now(), stockCode: "", name: "", stock: 0, quantity: 1 }]);
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [manualStockSearch, setManualStockSearch] = useState("");

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  // Initial Data
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
        const pSnap = await getDocs(collection(db, "spare_parts"));
        setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  // --- STOK KODU İLE PARÇA BULMA MANTIĞI ---
  const handleStockCodeChange = (id: number, code: string) => {
    const part = allSpareParts.find(p => p.stockCode === code || p.id === code);
    setUsedParts(usedParts.map(row => {
      if (row.id === id) {
        return { 
          ...row, 
          stockCode: code, 
          name: part ? part.name : "Parça Bulunamadı", 
          stock: part ? part.stock : 0 
        };
      }
      return row;
    }));
  };

  const addPartRow = () => setUsedParts([...usedParts, { id: Date.now(), stockCode: "", name: "", stock: 0, quantity: 1 }]);
  const removePartRow = (id: number) => setUsedParts(usedParts.filter(p => p.id !== id));
  const updateQuantity = (id: number, qty: number) => {
    setUsedParts(usedParts.map(p => p.id === id ? { ...p, quantity: qty } : p));
  };

  const handleManualStockSearch = () => {
    if (!manualStockSearch.trim()) return;
    window.location.href = `/admin/yedek-parca?q=${encodeURIComponent(manualStockSearch)}`;
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Tarayıcı desteği yok.");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => { setValue("aciklama", (watch("aciklama") || "") + " " + e.results[0][0].transcript); };
    rec.start();
  };

  const onSubmit = async (data: any) => {
    try {
      const finalParts = usedParts.filter(p => p.name !== "Parça Bulunamadı" && p.stockCode !== "").map(p => ({
        stockCode: p.stockCode,
        name: p.name,
        quantity: p.quantity
      }));

      await setDoc(doc(collection(db, "maintenance_logs")), { 
        ...data, 
        toplamSureDakika: hesaplananSure, 
        bildirenKisi: userName, 
        kayitTarihi: serverTimestamp(),
        kullanilanParcalar: finalParts
      });
      alert("Rapor başarıyla kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata oluştu."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto mb-24">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4">
             <img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
             <div><p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Aktif Kullanıcı</p><p className="text-sm font-black text-teal-400">{userName}</p></div>
           </div>
           <div className="flex gap-3">
             {["admin", "operator", "teknisyen"].includes(userRole) && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700 hover:bg-gray-700">Admin Panel</Link>)}
             <button onClick={() => auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-red-900/30 hover:bg-red-600 hover:text-white transition">Çıkış</button>
           </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 md:p-12 shadow-2xl">
          <h1 className="text-2xl font-black mb-10 text-white border-b border-gray-800 pb-6 uppercase tracking-tighter">Bakım İş Bitirme Raporu</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-widest">Hattı Seçin</label>
              <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white focus:ring-2 ring-teal-500 outline-none"><option value="">Seçiniz</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-widest">Ekipmanı Seçin</label>
              <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white focus:ring-2 ring-teal-500 outline-none"><option value="">Seçiniz</option>{ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div><label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Başlangıç Saati</label><input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white" /></div>
              <div><label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Bitiş Saati</label><input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white" /></div>
            </div>

            <div className="flex items-center gap-4 bg-red-900/10 p-5 rounded-2xl border border-red-900/20">
              <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" />
              <label className="text-sm font-bold text-red-400 uppercase tracking-widest">Üretim Durdu mu?</label>
            </div>

            {/* YENİ NESİL YEDEK PARÇA MODÜLÜ */}
            <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-3xl space-y-4 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">⚙️ Kullanılan Yedek Parçalar</h3>
                <button type="button" onClick={addPartRow} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-teal-600/20">+ PARÇA EKLE</button>
              </div>
              {usedParts.map((part) => (
                <div key={part.id} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4">
                    <input 
                      type="text" 
                      placeholder="Stok Kodu Yazın..." 
                      value={part.stockCode}
                      onChange={(e) => handleStockCodeChange(part.id, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-white outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="col-span-5 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
                    <p className={`text-[10px] font-bold ${part.name === "Parça Bulunamadı" ? "text-red-500" : "text-teal-400"}`}>
                      {part.name || "Stok kodu bekleniyor..."}
                    </p>
                    {part.stock > 0 && <p className="text-[8px] text-gray-500 mt-0.5">Depo Stoğu: {part.stock} Adet</p>}
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={part.quantity} 
                      onChange={(e) => updateQuantity(part.id, Number(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-center" 
                      min="1" 
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => removePartRow(part.id)} className="text-gray-600 hover:text-red-500 transition">✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-teal-900/20 p-6 rounded-2xl text-center border border-teal-500/20">
              <p className="text-[10px] font-bold text-teal-500 mb-1 uppercase tracking-widest">Hesaplanan Müdahale Süresi</p>
              <h2 className="text-5xl font-black text-white">{hesaplananSure} <span className="text-sm font-normal text-gray-500 uppercase">Dk</span></h2>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Açıklama / Aksiyon</label>
              <button type="button" onClick={sesliYazimBaslat} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg shadow-red-600/30':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>{isDictating?'Dinleniyor...':'Sesle Yazdır'}</button></div>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-3xl p-5 text-sm text-white outline-none focus:ring-2 ring-teal-500" placeholder="Sorunu nasıl çözdüğünüzü detaylandırın..." />
            </div>
            <button type="submit" disabled={isSubmitting || hesaplananSure<=0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-orange-600/30 transition-all uppercase tracking-[0.2em] text-sm">Performansı Kaydet ve Bitir</button>
          </form>
        </div>
      </div>

      {/* HİBRİT STOK SORGU PANELİ - FIXED & STABILIZED */}
      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/20 transition-all hover:scale-105">
          <span className="text-[10px] font-black uppercase hidden sm:inline tracking-widest">Stok Sorgula</span>
          <div className="flex items-center bg-black/30 rounded-xl px-3 border border-white/10">
            <input 
              type="text" 
              value={manualStockSearch} 
              onChange={e=>setManualStockSearch(e.target.value)} 
              onKeyDown={e=>e.key==='Enter'&&handleManualStockSearch()} 
              placeholder="Kod veya isim..." 
              className="bg-transparent text-[10px] w-28 sm:w-44 py-2 outline-none text-white placeholder-indigo-300" 
            />
            <button onClick={handleManualStockSearch} className="ml-2 hover:scale-125 transition">🔍</button>
          </div>
          <Link href="/admin/yedek-parca/sesli" className="p-2 hover:bg-indigo-500 rounded-full transition relative group">
            🎤
            <div className="absolute bottom-12 right-0 bg-black text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap uppercase font-bold border border-white/10">Sesli Komut</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-500 font-bold uppercase tracking-widest animate-pulse">Sistem Hazırlanıyor...</div>}><DashboardIcerik /></Suspense>); }
