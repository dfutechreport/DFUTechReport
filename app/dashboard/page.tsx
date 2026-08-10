"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  
  // Monitoring States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [yapilanSonIsler, setYapilanSonIsler] = useState<any[]>([]);
  
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
        await fetchData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Aktif İş Bildirimlerini Çek (work_orders)
      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      // 2. Yapılan Son İşleri Çek (maintenance_logs)
      const lQ = query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"), limit(5));
      const lSnap = await getDocs(lQ);
      setYapilanSonIsler(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3. Form İçin Assets ve Stok Verilerini Çek
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

  useEffect(() => {
    if (selectedHat) {
      const filtered = allAssets.filter((a: any) => a.hatAdi === selectedHat).map((a: any) => a.ekipmanAdi);
      setFilteredEkipmanlar(filtered.sort());
    }
  }, [selectedHat, allAssets]);

  useEffect(() => {
    if (baslangic && bitis) {
      const s = new Date(`2024-01-01T${baslangic}`).getTime();
      const e = new Date(`2024-01-01T${bitis}`).getTime();
      let diff = (e - s) / 60000;
      if (diff < 0) diff += 1440;
      setHesaplananSure(diff);
    }
  }, [baslangic, bitis]);

  const handleIsiKapat = async (id: string) => {
    if (!window.confirm("İşi tamamlayıp kapatmak istiyor musunuz?")) return;
    await updateDoc(doc(db, "work_orders", id), { durum: "Kapalı", tamamlayan: userName, kapanisTarihi: serverTimestamp() });
    fetchData();
  };

  const handleMaterialCode = (id: number, code: string) => {
    const searchStr = code.trim().toUpperCase();
    const part = allSpareParts.find(p => (p.stockCode||"").toUpperCase() === searchStr || (p.kod||"").toUpperCase() === searchStr);
    setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, stockCode: code, name: part ? part.name : (code===""?"Kod Bekleniyor":"Hatalı Kod") } : m));
  };

  const sesliYazimBaslat = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const current = watch("aciklama") || "";
      setValue("aciklama", current + (current ? " " : "") + e.results[0][0].transcript);
    };
    rec.start();
  };

  const onSubmit = async (data: any) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      await setDoc(doc(collection(db, "maintenance_logs")), { ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials });
      alert("İş başarıyla kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">TEKNİSYEN PANELİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Teknisyen Dashboard</p><p className="text-sm font-black text-teal-400">{userName}</p></div></div>
           <div className="flex gap-3">
             {["admin", "operator"].includes(userRole) && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2 rounded-xl border border-gray-700">YÖNETİCİ PANELİ</Link>)}
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-4 py-2 rounded-xl border border-red-900/30">ÇIKIŞ YAP</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL KOLON: ALARMLAR VE AKTİF İŞLER */}
          <div className="lg:col-span-1 space-y-6">
            {/* ISG ALARMLARI */}
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/40 border-2 border-red-500 p-5 rounded-[30px] shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-4 flex items-center gap-2">⚠️ KRİTİK İSG ALARMI</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-3 rounded-2xl mb-2 border border-red-900/50">
                    <p className="text-xs font-bold text-white">{a.hatAdi} - {a.ekipmanAdi}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{a.aciklama}</p>
                  </div>
                ))}
              </div>
            )}

            {/* AKTİF İŞ BİLDİRİMLERİ */}
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-xl">
              <h3 className="text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">🔔 Aktif İş Emirleri</h3>
              {aktifIsler.length > 0 ? aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-2xl mb-3 flex justify-between items-center group hover:border-teal-500/50 transition">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p>
                    <p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p>
                  </div>
                  <button onClick={()=>handleIsiKapat(is.id)} className="bg-teal-600 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition">KAPAT</button>
                </div>
              )) : <p className="text-center text-[10px] text-gray-600 italic py-4">Şu an açık iş emri yok.</p>}
            </div>

            {/* YAPILAN SON İŞLER */}
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-[35px] shadow-xl">
              <h3 className="text-xs font-black text-gray-500 uppercase mb-4 tracking-widest">🗄️ Son Yapılan İşler</h3>
              {yapilanSonIsler.map(log => (
                <div key={log.id} className="mb-4 border-l-2 border-gray-700 pl-3">
                  <p className="text-[10px] font-bold text-gray-300">{log.hatAdi} - {log.ekipmanAdi}</p>
                  <p className="text-[9px] text-gray-500">{log.bildirenKisi} | {log.toplamSureDakika} dk</p>
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ KOLON: İŞ KAYIT FORMU */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent"></div>
              <h1 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter">Vardiya / Bakım İş Kaydı</h1>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Hattı Seçin</label>
                  <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Makine / Ekipman</label>
                  <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="">{selectedHat ? "Seçiniz..." : "Önce Hat Seçin"}</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Vardiya</label>
                  <select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/40 p-4 rounded-2xl border border-gray-700">
                    <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" />
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-tighter">Üretim Duruşu Var</label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-center" />
                  <input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-center" />
                </div>

                {/* MALZEME SARFİYATI */}
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyatı</h3><button type="button" onClick={()=>setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", quantity: 1, unit: "Adet" }])} className="bg-teal-600 text-[10px] font-black px-4 py-2 rounded-xl shadow-lg shadow-teal-600/20">+ EKLE</button></div>
                  {usedMaterials.map(m => (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                      <input type="text" placeholder="Kod..." value={m.stockCode} onChange={e=>handleMaterialCode(m.id, e.target.value)} className="col-span-3 bg-gray-800 border-gray-700 rounded-xl p-3 text-[10px] uppercase font-bold text-white outline-none focus:border-teal-500" />
                      <div className={`col-span-4 text-[9px] font-black truncate bg-black/30 p-3 rounded-xl border border-gray-800 ${m.name==="Hatalı Kod"?"text-red-500":"text-teal-400"}`}>{m.name}</div>
                      <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-center font-bold text-white" min="1" />
                      <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="col-span-2 bg-gray-800 border-gray-700 rounded-xl p-3 text-[9px] font-bold text-white"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                      <button type="button" onClick={()=>setUsedMaterials(usedMaterials.filter(x=>x.id!==m.id))} className="col-span-1 text-gray-600 hover:text-red-500 font-bold">✕</button>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-900/20 p-6 rounded-[30px] text-center border border-teal-500/20 shadow-inner">
                  <p className="text-[10px] font-black text-teal-500 mb-1 uppercase tracking-widest">Hesaplanan Müdahale Süresi</p>
                  <h2 className="text-5xl font-black text-white">{hesaplananSure} <span className="text-xs font-normal text-gray-500 uppercase">Dakika</span></h2>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">Yapılan İşlem Özeti</label>
                  <button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg shadow-red-600/30':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>🎙️ SESLE YAZDIR</button></div>
                  <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-1 ring-teal-500" placeholder="Sorunu nasıl çözdüğünüzü ve aldığınız aksiyonu buraya detaylandırın..." />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[40px] shadow-2xl shadow-orange-600/30 transition-all uppercase tracking-[0.2em] text-sm">Raporu Kaydet ve Vardiyayı Devret</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return (<Suspense fallback={<div className="min-h-screen bg-gray-950 flex justify-center items-center font-bold text-white tracking-widest animate-pulse uppercase">Dfu Terminal Başlatılıyor...</div>}><DashboardIcerik /></Suspense>); }
