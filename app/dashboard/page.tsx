"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId: string | null;
}

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00", linkedOrderId: null, aciklama: ""
    }
  });
  
  // States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: 0, quantity: 1, unit: "Adet" }]);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);

  const selectedHat = watch("hatAdi");
  const basTarih = watch("baslangicTarihi");
  const bitTarih = watch("bitisTarihi");
  const basSaat = watch("baslangicSaati");
  const bitSaat = watch("bitisSaati");

  // Initial Sync
  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name || ""); setUserRole(userSnap.data().role || ""); }
        fetchAllData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  const fetchAllData = async () => {
    try {
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  // --- STOK SORGU FONKSİYONU: GÖSTER BUTONU İÇİN ---
  const findStockItem = (id: number) => {
    const row = usedMaterials.find(m => m.id === id);
    if (!row || !row.stockCode) return;
    const searchStr = row.stockCode.trim().toUpperCase();
    const part = allSpareParts.find(p => 
      (p.stockCode && String(p.stockCode).toUpperCase() === searchStr) || 
      (p.id && String(p.id).toUpperCase() === searchStr) ||
      (p.kod && String(p.kod).toUpperCase() === searchStr)
    );
    setUsedMaterials(prev => prev.map(m => m.id === id ? { 
      ...m, 
      name: part ? (part.name || part.malzemeAdi || part.stokAdi || "İsimsiz") : "Hatalı Kod", 
      stock: part ? (Number(part.stock) || 0) : 0 
    } : m));
  };

  // --- DİNAMİK SATIR YÖNETİMİ ---
  const addMaterial = () => setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: 0, quantity: 1, unit: "Adet" }]);
  const removeMaterial = (id: number) => setUsedMaterials(usedMaterials.filter(m => m.id !== id));

  const triggerAutoFill = (order: any) => {
    setValue("hatAdi", order.hatAdi || "");
    setValue("ekipmanAdi", order.ekipmanAdi || "");
    setValue("isDuruslu", order.isDuruslu || false);
    setValue("linkedOrderId", order.id || null); 
    setValue("aciklama", (order.aciklama ? `[Not: ${order.aciklama}] ` : ""));
    setShowVakaModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedHat) {
      const filtered = allAssets.filter((a: any) => a.hatAdi === selectedHat).map((a: any) => a.ekipmanAdi);
      setFilteredEkipmanlar(filtered.sort());
    }
  }, [selectedHat, allAssets]);

  useEffect(() => {
    if (basTarih && bitTarih && basSaat && bitSaat) {
      const start = new Date(`${basTarih}T${basSaat}`).getTime();
      const end = new Date(`${bitTarih}T${bitSaat}`).getTime();
      let diff = (end - start) / 60000;
      setHesaplananSure(diff > 0 ? diff : 0);
    }
  }, [basTarih, bitTarih, basSaat, bitSaat]);

  const sesliYazimBaslat = () => {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!Rec) return alert("Hata");
    const recognition = new Rec(); recognition.lang = "tr-TR";
    recognition.onstart = () => setIsDictating(true); recognition.onend = () => setIsDictating(false);
    recognition.onresult = (e: any) => {
      setValue("aciklama", (watch("aciklama") || "") + " " + e.results[0][0].transcript);
    };
    recognition.start();
  };

  const onSubmit = async (formData: MaintenanceFormData) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      const cleanData = {
        hatAdi: formData.hatAdi || "-",
        ekipmanAdi: formData.ekipmanAdi || "-",
        vardiya: formData.vardiya || "08:00 - 16:00",
        isDuruslu: Boolean(formData.isDuruslu),
        baslangicTarihi: formData.baslangicTarihi || "",
        baslangicSaati: formData.baslangicSaati || "",
        bitisTarihi: formData.bitisTarihi || "",
        bitisSaati: formData.bitisSaati || "",
        aciklama: formData.aciklama || "",
        toplamSureDakika: Number(hesaplananSure) || 0,
        bildirenKisi: userName || "Sistem",
        kayitTarihi: serverTimestamp(),
        kullanilanMalzemeler: materials
      };
      await setDoc(doc(collection(db, "maintenance_logs")), cleanData);
      for (const mat of materials) {
        const part = allSpareParts.find(p => p.stockCode === mat.stockCode || p.id === mat.stockCode);
        if (part?.id) { await updateDoc(doc(db, "spare_parts", part.id), { stock: increment(-mat.quantity) }); }
      }
      if (formData.linkedOrderId) { await updateDoc(doc(db, "work_orders", formData.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() }); }
      alert("Rapor Kaydedildi."); window.location.reload();
    } catch (e: any) { alert("Hata: " + e.message); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse uppercase tracking-[0.2em]">DFU Terminal Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase tracking-tighter">{userName}</p></div></div>
           <div className="flex flex-wrap gap-2">
             {(userRole === "admin" || userRole === "operator") && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase tracking-widest transition">Yönetici Paneli</Link>)}
             <Link href="/dashboard/mesai" className="bg-amber-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition">Mesai Yaz</Link>
             <Link href="/admin/mesai" className="bg-gray-800 text-white text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition">Mesailerim</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-4 py-2.5 rounded-xl border border-red-900/30 transition">ÇIKIŞ</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* SOL PANEL: ALARMLAR VE BİLDİRİMLER */}
          <div className="lg:col-span-1 space-y-8">
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/40 border-2 border-red-600 p-6 rounded-[35px] shadow-2xl animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-5 tracking-widest flex items-center gap-2">⚠️ KRİTİK İSG</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-2xl mb-3 border border-red-900/50 flex justify-between items-center group transition">
                    <p className="text-[10px] font-black uppercase text-white truncate mr-2">{a.hatAdi}</p>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 p-7 rounded-[40px] shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase mb-5 tracking-widest tracking-[0.1em]">🔔 Aktif Bildirimler</h3>
              {aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-[20px] mb-3 flex justify-between items-center hover:border-teal-500/50 transition">
                  <div className="flex-1 min-w-0 mr-3"><p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p></div>
                  <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-teal-600 text-[9px] font-black px-3 py-1.5 rounded-xl uppercase">İncele</button>
                </div>
              ))}
            </div>
            <Link href="/admin/is-listesi" className="flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 p-5 rounded-[25px] transition shadow-xl text-[11px] font-black uppercase font-sans tracking-widest">📋 Tüm İşleri Filtrele</Link>
          </div>

          {/* SAĞ PANEL: BAKIM FORMU */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[50px] p-8 md:p-12 shadow-2xl relative">
              <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter border-b border-gray-800 pb-5">Bakım İş Bitirme Raporu</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                <input type="hidden" {...register("linkedOrderId")} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2 tracking-widest">Üretim Hattı</label><select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2 tracking-widest">Ekipman</label><select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2 tracking-widest">Vardiya</label><select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700"><input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" /><label className="text-[10px] font-black text-red-400 uppercase tracking-widest tracking-widest">Duruş Var</label></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-black uppercase">
                   <div className="flex gap-2"><input type="date" {...register("baslangicTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white" /><input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                   <div className="flex gap-2"><input type="date" {...register("bitisTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white" /><input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                </div>

                {/* --- MALZEME SARFİYATI: FIXED V73 --- */}
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={addMaterial} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-xl transition shadow-lg">+ EKLE</button></div>
                  {usedMaterials.map(m => (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center animate-fadeIn">
                      <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, stockCode:e.target.value}:x))} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-[10px] uppercase font-bold text-white outline-none focus:border-teal-500" />
                      <button type="button" onClick={()=>findStockItem(m.id)} className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-black py-3 rounded-lg uppercase transition">GÖSTER</button>
                      <div className={`col-span-3 text-[9px] font-black truncate bg-black/30 p-3 rounded-xl border border-gray-800 ${m.name==="Hatalı Kod"?"text-red-500":"text-teal-400"}`}>{m.name}</div>
                      <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-1 bg-gray-800 border-gray-700 rounded-xl p-3 text-[10px] text-center font-bold text-white" min="1" />
                      <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[8px] font-bold text-white uppercase"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                      <button type="button" onClick={()=>removeMaterial(m.id)} className="col-span-1 text-gray-600 hover:text-red-500 transition font-bold">✕</button>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-900/20 p-7 rounded-[35px] text-center border border-teal-500/20 shadow-inner font-black uppercase"><p className="text-[10px] font-black text-teal-500 mb-1">Müdahale Süresi</p><h2 className="text-4xl font-black text-white uppercase tracking-[0.1em]">{hesaplananSure} DK</h2></div>
                
                {/* --- AÇIKLAMA VE SESLE YAZDIR --- */}
                <div>
                  <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">İşlem Detayları</label>
                  <button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg shadow-red-600/20':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>🎙️ SESLE YAZDIR</button></div>
                  <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white focus:ring-1 ring-teal-500 outline-none" placeholder="Çözüm sürecini ve alınan aksiyonları detaylandırın..." />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[45px] shadow-2xl transition-all uppercase tracking-widest text-sm tracking-[0.2em]">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* VAKA MODAL - WITH "İŞİ TAMAMLA" */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-sans">
          <div className="bg-gray-900 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest tracking-[0.2em]">Vaka Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-widest">Konum</p><p className="text-sm text-gray-200 uppercase">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1 tracking-widest">Zaman</p><p className="text-sm text-gray-200 tracking-widest">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner">
                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3">Açıklama:</p>
                <p className="text-gray-300 italic text-sm italic font-medium">"{selectedVaka.aciklama || "Not girilmemiş."}"</p>
             </div>
             <div className="flex gap-4">
                <button onClick={()=>setShowVakaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition">Vazgeç</button>
                <button onClick={()=>triggerAutoFill(selectedVaka)} className="flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-green-600/20 transition">İşi Tamamla</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
