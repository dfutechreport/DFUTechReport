"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

// --- TYPESCRIPT FORM ŞEMASI ---
interface MaintenanceFormData {
  hatAdi: string;
  ekipmanAdi: string;
  vardiya: string;
  isDuruslu: boolean;
  baslangicTarihi: string;
  baslangicSaati: string;
  bitisTarihi: string;
  bitisSaati: string;
  aciklama: string;
  linkedOrderId?: string;
}

function DashboardIcerik() {
  // TypeScript'e form yapısını öğretiyoruz
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false,
      vardiya: "08:00 - 16:00"
    }
  });
  
  // Monitoring States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  
  // Form States
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }]);
  
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [loading, setLoading] = useState(true);

  const selectedHat = watch("hatAdi");
  const basTarih = watch("baslangicTarihi");
  const bitTarih = watch("bitisTarihi");
  const basSaat = watch("baslangicSaati");
  const bitSaat = watch("bitisSaati");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) {
          setUserName(userSnap.data().name || "");
          setUserRole(userSnap.data().role || "");
        }
        await fetchData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => d.data());
      setAllAssets(aData);
      const uniqueHats = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) uniqueHats.add(item.hatAdi); });
      setHatlar(Array.from(uniqueHats).sort());

      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const triggerAutoFill = (order: any) => {
    setValue("hatAdi", order.hatAdi);
    setValue("ekipmanAdi", order.ekipmanAdi);
    setValue("isDuruslu", order.isDuruslu || false);
    setValue("aciklama", (order.aciklama ? `[Not: ${order.aciklama}] ` : ""));
    setValue("linkedOrderId", order.id); 
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

  const handleMaterialCode = (id: number, code: string) => {
    const searchStr = code.trim().toUpperCase();
    const part = allSpareParts.find(p => (p.stockCode||"").toUpperCase() === searchStr || (p.kod||"").toUpperCase() === searchStr);
    setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, stockCode: code, name: part ? part.name : (code===""?"Kod Bekleniyor":"Hatalı Kod") } : m));
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("Tarayıcı desteklemiyor.");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      const current = watch("aciklama") || "";
      setValue("aciklama", current + (current ? " " : "") + transcript);
    };
    rec.start();
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      await setDoc(doc(collection(db, "maintenance_logs")), { 
        ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials 
      });
      if (data.linkedOrderId) {
        await updateDoc(doc(db, "work_orders", data.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() });
      }
      alert("Başarıyla kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase">{userName}</p></div></div>
           <div className="flex gap-3">
             {["admin", "operator", "teknisyen"].includes(userRole) && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-700 transition">ADMİN PANEL</Link>)}
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-5 py-2.5 rounded-xl border border-red-900/30 transition">ÇIKIŞ YAP</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-8">
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/30 border-2 border-red-600 p-6 rounded-[35px] shadow-2xl animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-5 tracking-widest">⚠️ İSG ALARMI</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-2xl mb-3 border border-red-900/50 flex flex-col gap-3">
                    <p className="text-xs font-black text-white">{a.hatAdi} - {a.ekipmanAdi}</p>
                    <button onClick={()=>triggerAutoFill(a)} className="bg-red-600 hover:bg-red-500 text-white text-[9px] font-black py-2.5 rounded-xl transition">İŞİ TAMAMLA</button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-gray-900 border border-gray-800 p-7 rounded-[40px] shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase mb-5 tracking-widest">🔔 Aktif İş Emirleri</h3>
              {aktifIsler.length > 0 ? aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-[20px] mb-3 flex justify-between items-center hover:border-teal-500/50 transition">
                  <div className="flex-1 min-w-0 mr-3"><p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p></div>
                  <button onClick={()=>triggerAutoFill(is)} className="bg-teal-600 hover:bg-teal-500 text-white text-[9px] font-black px-4 py-2 rounded-xl transition shadow-lg shadow-teal-600/20">İŞİ TAMAMLA</button>
                </div>
              )) : <p className="text-center text-[11px] text-gray-600 py-6">Müdahale bekleyen iş yok.</p>}
            </div>
            <Link href="/admin/is-listesi" className="flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 p-5 rounded-[25px] transition shadow-xl text-[11px] font-black uppercase tracking-widest">📋 Tüm İşleri Filtrele</Link>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[50px] p-8 md:p-12 shadow-2xl">
              <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter border-b border-gray-800 pb-5">Bakım İş Bitirme Raporu</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                <input type="hidden" {...register("linkedOrderId")} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Hattı Seçin</label><select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Makine / Ekipman</label><select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="">{!selectedHat ? "Önce Hat Seçin" : "Seçiniz..."}</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Vardiya</label><select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700"><input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600" /><label className="text-[10px] font-black text-red-400 uppercase tracking-widest">Duruş Var</label></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex gap-2"><input type="date" {...register("baslangicTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs font-bold w-full" /><input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs font-bold" /></div>
                  <div className="flex gap-2"><input type="date" {...register("bitisTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs font-bold w-full" /><input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs font-bold" /></div>
                </div>
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-4 shadow-inner">
                  <div className="flex justify-between items-center"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={()=>setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }])} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-xl">+ EKLE</button></div>
                  {usedMaterials.map(m => (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                      <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>handleMaterialCode(m.id, e.target.value)} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-[10px] uppercase font-bold text-white outline-none focus:border-teal-500" />
                      <div className={`col-span-4 text-[9px] font-black truncate bg-black/30 p-3 rounded-xl border border-gray-800 ${m.name==="Hatalı Kod"?"text-red-500":"text-teal-400"}`}>{m.name}</div>
                      <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-center font-bold text-white" min="1" />
                      <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[9px] font-bold text-white"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                      <button type="button" onClick={()=>setUsedMaterials(usedMaterials.filter(x=>x.id!==m.id))} className="col-span-1 text-gray-600 hover:text-red-500 font-bold transition">✕</button>
                    </div>
                  ))}
                </div>
                <div className="bg-teal-900/20 p-7 rounded-[35px] text-center border border-teal-500/20"><p className="text-[10px] font-black text-teal-500 mb-1 uppercase tracking-widest">Müdahale Süresi</p><h2 className="text-5xl font-black text-white">{hesaplananSure} <span className="text-xs font-normal text-gray-500 uppercase">Dakika</span></h2></div>
                <div><div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Yapılan İşlem</label><button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg':'bg-gray-800 text-teal-400'}`}>🎙️ SESLE YAZDIR</button></div><textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-1 ring-teal-500" placeholder="İşlem detaylarını girin..." /></div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[45px] shadow-2xl transition-all uppercase tracking-[0.2em] text-sm">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
