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
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
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

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name || ""); setUserRole(userSnap.data().role || ""); }
        await fetchSystemData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  const fetchSystemData = async () => {
    try {
      // 1. Bildirimler
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      // 2. assets (Hat ve Ekipmanlar)
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());

      // 3. KRİTİK: MASTER STOK LİSTESİ (13.000 Satır)
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  // --- KRİTİK: DFU GERÇEK ALAN EŞLEME MOTORU (V83) ---
  const findStockItem = (id: number) => {
    const row = usedMaterials.find(m => m.id === id);
    if (!row || !row.stockCode) return;
    const searchStr = row.stockCode.trim().toUpperCase();
    
    // Hem belgenin kimliğinde hem de stokKodu alanında ara
    const part = allSpareParts.find(p => 
      String(p.id).toUpperCase() === searchStr || 
      (p.stokKodu && String(p.stokKodu).toUpperCase() === searchStr) ||
      (p.stockCode && String(p.stockCode).toUpperCase() === searchStr)
    );

    setUsedMaterials(prev => prev.map(m => {
      if (m.id === id) {
        if (!part) return { ...m, name: "Hatalı Kod", stock: "0" };

        // GERÇEK ALANLAR: parcaAdi ve mevcutMiktar (Dump Analizine Göre)
        const resolvedName = part.parcaAdi || part.name || part.malzemeAdi || "İsim Tanımsız";
        const resolvedStock = part.mevcutMiktar ?? part.stock ?? part.stok ?? 0;

        return { 
          ...m, 
          name: String(resolvedName), 
          stock: String(resolvedStock) 
        };
      }
      return m;
    }));
  };

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
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if(!Recognition) return alert("Hata");
    const rec = new Recognition(); rec.lang = "tr-TR";
    rec.onstart = () => setIsDictating(true); rec.onend = () => setIsDictating(false);
    rec.onresult = (e: any) => {
      const currentText = watch("aciklama") || "";
      const transcript = e.results[0][0].transcript;
      setValue("aciklama", currentText + (currentText ? " " : "") + transcript);
    };
    rec.start();
  };

  const onSubmit = async (formData: MaintenanceFormData) => {
    try {
      const materials = usedMaterials.filter(m => m.stockCode !== "" && !["Hatalı Kod", "Kod Bekleniyor"].includes(m.name));
      const cleanData = {
        hatAdi: formData.hatAdi || "-", ekipmanAdi: formData.ekipmanAdi || "-", vardiya: formData.vardiya || "08:00 - 16:00",
        isDuruslu: Boolean(formData.isDuruslu), baslangicTarihi: formData.baslangicTarihi || "", baslangicSaati: formData.baslangicSaati || "",
        bitisTarihi: formData.bitisTarihi || "", bitisSaati: formData.bitisSaati || "", aciklama: formData.aciklama || "",
        toplamSureDakika: Number(hesaplananSure) || 0, bildirenKisi: userName || "Sistem", kayitTarihi: serverTimestamp(), kullanilanMalzemeler: materials
      };
      await setDoc(doc(collection(db, "maintenance_logs")), cleanData);
      for (const mat of materials) {
        const part = allSpareParts.find(p => String(p.id).toUpperCase() === mat.stockCode.toUpperCase() || (p.stokKodu && String(p.stokKodu).toUpperCase() === mat.stockCode.toUpperCase()));
        if (part?.id) { 
          const yeniMiktar = (Number(part.mevcutMiktar) || 0) - Number(mat.quantity);
          await updateDoc(doc(db, "spare_parts", part.id), { mevcutMiktar: yeniMiktar }); 
          
          // KRİTİK STOK MAİL TETİKLEYİCİ
          if (yeniMiktar <= 2) {
            try {
              await fetch('/api/send-mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  parcaAdi: part.parcaAdi,
                  stokKodu: part.stokKodu || part.id,
                  kalanStok: yeniMiktar,
                  birim: part.birim || "Adet",
                  teknisyen: userName || "Teknisyen",
                  hat: formData.hatAdi || "Genel",
                  ekipman: formData.ekipmanAdi || "Genel"
                }),
              });
            } catch (mailErr) { console.error("Kritik stok maili gönderilemedi:", mailErr); }
          }
        }
      }
      if (formData.linkedOrderId) { await updateDoc(doc(db, "work_orders", formData.linkedOrderId), { durum: "Kapalı", tamamlayan: userName, tamamlanmaTarihi: serverTimestamp() }); }
      alert("Rapor Kaydedildi."); window.location.reload();
    } catch (e: any) { alert("Hata: " + e.message); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,58,138,0.15),_transparent_70%)]"></div>
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-yellow-500/10 blur-[100px] rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-32 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-80 h-0.5 bg-slate-900 rounded-full overflow-hidden mb-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400 to-transparent w-full animate-[scan_2s_infinite_ease-in-out]"></div>
      </div>
      <p className="text-slate-500 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">{`SYNCHRONIZING GLOBAL MISSION DATA...`}</p>
      <style jsx>{` @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><div><p className="text-sm font-black text-teal-400 uppercase tracking-tighter">{userName}</p></div></div>
           <div className="flex flex-wrap gap-2">
             {(userRole === "admin" || userRole === "operator") && (<Link href="/admin" className="bg-gray-800 text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition tracking-widest">Admin Panel</Link>)}
             
             <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 text-white text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest hover:bg-cyan-500">✅ Kontrol Formları</Link>
             <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 text-white text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest hover:bg-emerald-500">🛠️ Manuel PM</Link>
             <Link href="/admin/eked" className="bg-yellow-600 text-black text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest hover:bg-yellow-500">🔒 EKED Uygula</Link>
             <Link href="/dashboard/pano-listesi" className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest hover:bg-indigo-500">🔌 Pano Temizliği</Link>
             <Link href="/dashboard/sayac" className="bg-blue-600 text-white text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest hover:bg-blue-500">⚡ Sayaç Okuma</Link>
             <Link href="/dashboard/mesai" className="bg-amber-600 text-white text-[10px] font-black px-4 py-2.5 rounded-3xl shadow-2xl transition-transform active:scale-95 uppercase transition tracking-widest">Mesai Yaz</Link>
             <Link href="/admin/mesai" className="bg-gray-800 text-white text-[10px] font-black px-4 py-2.5 rounded-xl border border-gray-700 uppercase transition tracking-widest">Mesailerim</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black px-4 py-2.5 rounded-xl border border-red-900/30 transition">ÇIKIŞ</button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* SOL PANEL (İZLEME) */}
          <div className="lg:col-span-1 space-y-8">
            {isgAlarmlari.length > 0 && (
              <div className="bg-red-950/40 border-2 border-red-600 p-6 rounded-[35px] shadow-2xl animate-pulse">
                <h3 className="text-red-500 font-black text-xs uppercase mb-5 tracking-widest flex items-center gap-2 tracking-tighter">⚠️ KRİTİK İSG</h3>
                {isgAlarmlari.map(a => (
                  <div key={a.id} className="bg-black/40 p-4 rounded-2xl mb-3 border border-red-900/50 flex justify-between items-center group">
                    <p className="text-[10px] font-black uppercase text-white truncate mr-2">{a.hatAdi}</p>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border border-gray-800 p-7 rounded-[40px] shadow-2xl">
              <h3 className="text-[11px] font-black text-gray-500 uppercase mb-5 tracking-widest">🔔 Aktif Bildirimler</h3>
              {aktifIsler.map(is => (
                <div key={is.id} className="bg-gray-800/40 border border-gray-700/50 p-4 rounded-[20px] mb-3 flex justify-between items-center hover:border-teal-500/50 transition duration-300">
                  <div className="flex-1 min-w-0 mr-3"><p className="text-[10px] font-black text-teal-400 uppercase truncate">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200 truncate">{is.ekipmanAdi}</p></div>
                  <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-teal-600 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase">İncele</button>
                </div>
              ))}
            </div>
            <Link href="/admin/is-listesi" className="flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 p-5 rounded-[25px] transition shadow-xl text-[11px] font-black uppercase tracking-widest">📋 Tüm İşleri Filtrele</Link>
          </div>

          {/* SAĞ PANEL (FORM) */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border border-gray-800 rounded-[50px] p-8 md:p-12 shadow-2xl relative">
              <h2 className="text-2xl font-black mb-8 text-white uppercase tracking-tighter border-b border-gray-800 pb-5">Bakım İş Bitirme Raporu</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
                <input type="hidden" {...register("linkedOrderId")} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Üretim Hattı</label><select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2">Ekipman</label><select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-teal-500"><option value="">Seçiniz...</option>{filteredEkipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-6 uppercase font-black tracking-tighter">
                  <div><label className="text-[10px] font-black text-gray-500 uppercase mb-2 block ml-2 tracking-widest">Vardiya</label><select {...register("vardiya")} className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm text-white outline-none font-bold"><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-2xl border border-gray-700"><input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded accent-red-600 cursor-pointer" /><label className="text-[10px] font-black text-red-400 uppercase tracking-widest tracking-widest">Duruş Var</label></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-bold uppercase">
                   <div className="flex gap-2"><input type="date" {...register("baslangicTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white font-bold" /><input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                   <div className="flex gap-2"><input type="date" {...register("bitisTarihi")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs w-full text-white font-bold" /><input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-3 text-xs text-white font-black text-center" /></div>
                </div>

                {/* --- MALZEME SARFİYATI: V83 ZIRHLI TASARIM --- */}
                <div className="bg-gray-800/20 border border-gray-800 p-6 rounded-[35px] space-y-6 shadow-inner">
                  <div className="flex justify-between items-center mb-2"><h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">⚙️ Malzeme Sarfiyat Listesi</h3><button type="button" onClick={()=>setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }])} className="bg-teal-600 hover:bg-teal-500 text-[10px] font-black px-4 py-2 rounded-3xl shadow-2xl transition-transform active:scale-95 shadow-teal-600/20 transition">+ EKLE</button></div>
                  
                  {usedMaterials.map(m => (
                    <div key={m.id} className="bg-black/30 p-5 rounded-[30px] border border-gray-700/50 space-y-4 animate-fadeIn transition-all shadow-xl">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder="Stok Kodu Girin..." value={m.stockCode} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, stockCode:e.target.value}:x))} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-3 text-[10px] uppercase font-black text-white outline-none focus:border-indigo-500" />
                        <div className="flex gap-2 w-full sm:w-auto">
                           <button type="button" onClick={()=>findStockItem(m.id)} className="flex-1 sm:px-8 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black py-3 rounded-xl uppercase transition">GÖSTER</button>
                           <button type="button" onClick={()=>setUsedMaterials(usedMaterials.filter(x=>x.id!==m.id))} className="bg-gray-800 text-red-500 px-4 rounded-xl border border-gray-700 hover:bg-red-900 transition">✕</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5/90 p-4 rounded-2xl border border-gray-800 min-h-[50px] flex items-center">
                           <p className={`text-[11px] font-black uppercase flex-1 ${m.name === "Hatalı Kod" ? "text-red-500" : "text-teal-400"}`}>{m.name}</p>
                        </div>
                        {m.stock !== "-" && (
                          <div className="bg-amber-600 text-white p-3 rounded-2xl flex justify-between items-center shadow-lg border border-amber-400/30">
                             <span className="text-[10px] font-black uppercase tracking-widest">Sistemdeki Güncel Stok:</span>
                             <span className="text-lg font-black tracking-tighter">{m.stock} ADET</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 flex flex-col gap-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Miktar</label>
                           <input type="number" value={m.quantity} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, quantity:Number(e.target.value)}:x))} className="w-full bg-gray-800 p-3 rounded-xl text-lg font-black text-white border border-gray-700 text-center" min="1" />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                           <label className="text-[9px] font-black text-gray-500 uppercase ml-2">Birim</label>
                           <select value={m.unit} onChange={e=>setUsedMaterials(usedMaterials.map(x=>x.id===m.id?{...x, unit:e.target.value}:x))} className="w-full bg-gray-800 p-3 rounded-xl text-xs font-black text-white border border-gray-700 uppercase"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-teal-900/20 p-7 rounded-[35px] text-center border border-teal-500/20 shadow-inner font-black uppercase"><p className="text-[10px] font-black text-teal-500 mb-1">Müdahale Süresi</p><h2 className="text-4xl text-white">{hesaplananSure} DK</h2></div>
                
                {/* --- AÇIKLAMA VE SESLE YAZDIR --- */}
                <div>
                  <div className="flex justify-between items-center mb-3"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">İşlem Detayları</label>
                  <button type="button" onClick={sesliYazimBaslat} className={`px-5 py-2 rounded-2xl text-[10px] font-black transition-all ${isDictating?'bg-red-600 animate-pulse shadow-lg shadow-red-600/20':'bg-gray-800 text-teal-400 hover:bg-gray-700'}`}>🎙️ SESLE YAZDIR</button></div>
                  <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-[30px] p-6 text-sm text-white focus:ring-1 ring-teal-500 outline-none font-medium" placeholder="Çözüm sürecini ve aldığınız aksiyonları detaylandırın..." />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-[45px] shadow-2xl transition-all uppercase tracking-widest text-sm">Raporu Kaydet</button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* VAKA DETAY MODALI */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-sans">
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl" : "bg-indigo-600 shadow-2xl"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Vaka Detay Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1">Konum</p><p className="text-sm text-gray-200">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Zaman</p><p className="text-sm text-gray-200">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner">
                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3 underline underline-offset-8">Açıklama Notu:</p>
                <p className="text-gray-300 italic text-sm font-medium leading-relaxed font-bold tracking-tighter">"{selectedVaka.aciklama || "Not girilmemiş."}"</p>
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