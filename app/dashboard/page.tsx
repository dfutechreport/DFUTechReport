
"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId?: string;
}

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00"
    }
  });
  
  // Monitoring States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }]);
  
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

  // AUTH VE ANA VERİ ÇEKME
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) {
          setUserName(userSnap.data().name || "");
          setUserRole(userSnap.data().role || "");
        }
        await fetchAllSystemData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchAllSystemData = async () => {
    try {
      // 1. Bildirimler (work_orders)
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      // 2. Hat ve Ekipmanlar (assets) - Robust Check
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      
      const hatSet = new Set<string>();
      aData.forEach((item: any) => {
        const lineName = item.hatAdi || item.hat;
        if (lineName) hatSet.add(lineName);
      });
      setHatlar(Array.from(hatSet).sort());

      // 3. Stok Listesi
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Sistem verisi çekilemedi:", e); }
  };

  // --- AUTO-FILL TETİKLEYİCİ ---
  const triggerAutoFill = (order: any) => {
    setValue("hatAdi", order.hatAdi || order.hat || "");
    setValue("ekipmanAdi", order.ekipmanAdi || order.ekipman || "");
    setValue("isDuruslu", order.isDuruslu || false);
    setValue("linkedOrderId", order.id); 
    setValue("aciklama", (order.aciklama ? `[Bildirim: ${order.aciklama}] ` : ""));
    setShowVakaModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hatta göre ekipman filtrele
  useEffect(() => {
    if (selectedHat) {
      const filtered = allAssets
        .filter((a: any) => (a.hatAdi === selectedHat || a.hat === selectedHat))
        .map((a: any) => a.ekipmanAdi || a.ad || a.name);
      setFilteredEkipmanlar(filtered.sort());
    } else { setFilteredEkipmanlar([]); }
  }, [selectedHat, allAssets]);

  // Süre hesapla
  useEffect(() => {
    if (basTarih && bitTarih && basSaat && bitSaat) {
      const start = new Date(`${basTarih}T${basSaat}`).getTime();
      const end = new Date(`${bitTarih}T${bitSaat}`).getTime();
      let diff = (end - start) / 60000;
      setHesaplananSure(diff > 0 ? diff : 0);
    }
  }, [basTarih, bitTarih, basSaat, bitSaat]);

  const handleMaterialCode = (id: number, code: string) => {
    const searchStr = code.trim().toUpperCase();
    const part = allSpareParts.find(p => (p.stockCode||"").toUpperCase() === searchStr || (p.kod||"").toUpperCase() === searchStr || (p.id||"").toUpperCase() === searchStr);
    setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, stockCode: code, name: part ? part.name : (code===""?"Kod Bekleniyor":"Hatalı Kod") } : m));
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Tarayıcı desteği yok.");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const current = watch("aciklama") || "";
      setValue("aciklama", current + (current ? " " : "") + e.results[0][0].transcript);
    };
    rec.start();
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      await setDoc(doc(collection(db, "maintenance_logs")), { ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials });
      if (data.linkedOrderId) {
        await updateDoc(doc(db, "work_orders", data.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() });
      }
      alert("Rapor Kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata oluştu."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse uppercase tracking-[0.2em]">DFU SİSTEM YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase">{userName}</p></div></div>
           <div className="flex flex-wrap gap-2">
             {(userRole === "admin" || userRole === "operator") && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase tracking-widest transition">Yönetici Paneli</Link>)}
             <Link href="/dashboard/mesai" className="bg-amber-600 text-white text-[10px] font-black px-4 py-2.5 rounded-xl shadow-lg uppercase transition">Mesai Yaz</Link>
             <Link href="/admin/mesai" className="bg-gray-800 text-white text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition">Mesailerim</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-4 py-2.5 rounded-xl border border-red-900/30 transition">Çıkış Yap</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* SOL: İZLEME PANELİ */}
          <div className="lg:col-span-1 space-y-8">
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/40 border-2 border-red-600 p-6 rounded-[35px] shadow-2xl animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-5 tracking-widest flex items-center gap-2">⚠️ KRİTİK İSG</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-2xl mb-3 border border-red-900/50 flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase text-white truncate mr-2">{a.hatAdi}</p>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-900 border border-gray-800 p-7 rounded-[40px] shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase mb-5 tracking-widest tracking-[0.1em]">🔔 Aktif Bildirimler</h3>
              {aktifIsler.length > 0 ? aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-[20px] mb-3 flex justify-between items-center hover:border-teal-500/50 transition">
                  <div className="flex-1 min-w-0 mr-3"><p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p></div>
                  <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-teal-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                </div>
              )) : <p className="text-center text-[10px] text-gray-600 py-6 italic">Açık bildirim bulunmuyor.</p>}
            </div>
            <Link href="/admin/is-listesi" className="flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 p-5 rounded-[25px] transition shadow-xl text-[11px] font-black uppercase tracking-widest">📋 Tüm İşleri Filtrele</Link>
          </div>

          {/* SAĞ: KAYIT FORMU */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[50px] p-8 md:p-12 shadow-2xl relative">
              <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter border-b border-gray-800 pb-5">Bakım İş Bitirme Raporu</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                <input type="hidden" {...register("linkedOrderId")} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Hattı Seçin</label><select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Ekipman</label><select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">{!selectedHat ? "Önce Hat Seçin" : "Seçiniz..."}</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Vardiya</label><select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/40 p-4 rounded-2xl border border-gray-700"><input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" /><label className="text-[10px] font-black text-red-400 uppercase tracking-widest">Duruş Var</label></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-bold">
                   <div className="flex gap-2"><input type="date" {...register("baslangicTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white" /><input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white" /></div>
                   <div className="flex gap-2"><input type="date" {...register("bitisTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white" /><input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white" /></div>
                </div>
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={()=>setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }])} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-xl transition">+ EKLE</button></div>
                  {usedMaterials.map(m => (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center animate-fadeIn">
                      <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>handleMaterialCode(m.id, e.target.value)} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-[10px] uppercase font-bold text-white outline-none focus:border-teal-500" />
                      <div className={`col-span-4 text-[9px] font-black truncate bg-black/30 p-3 rounded-xl border border-gray-800 ${m.name==="Hatalı Kod"?"text-red-500":"text-teal-400"}`}>{m.name}</div>
                      <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-center font-bold text-white" min="1" />
                      <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[9px] font-bold text-white"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                      <button type="button" onClick={()=>setUsedMaterials(usedMaterials.filter(x=>x.id!==m.id))} className="col-span-1 text-gray-600 hover:text-red-500 font-bold transition">✕</button>
                    </div>
                  ))}
                </div>
                <div className="bg-teal-900/20 p-7 rounded-[35px] text-center border border-teal-500/20 shadow-inner"><p className="text-[10px] font-black text-teal-500 mb-1 uppercase tracking-widest">Müdahale Süresi</p><h2 className="text-4xl font-black text-white">{hesaplananSure} <span className="text-xs font-normal">Dakika</span></h2></div>
                <div><div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">İşlem Detayları</label><button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>🎙️ SESLE YAZDIR</button></div><textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[35px] p-6 text-sm text-white outline-none focus:ring-1 ring-teal-500" placeholder="Açıklamanızı detaylandırın..." /></div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[45px] shadow-2xl transition-all uppercase tracking-widest text-sm">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* VAKA DETAY MODALI */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Bildirim Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black tracking-tighter">
                <div><p className="text-[9px] text-gray-500 mb-1">Konum</p><p className="text-sm text-gray-200">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Zaman</p><p className="text-sm text-gray-200">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner">
                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3 tracking-widest underline underline-offset-8">Açıklama Notu:</p>
                <p className="text-gray-300 italic text-sm font-medium leading-relaxed">"{selectedVaka.aciklama || "Not girilmemiş."}"</p>
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
