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
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00", linkedOrderId: null, aciklama: ""
    }
  });
  
  // --- ORIJINAL STATES (page.txt ile BİREBİR) ---
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [loading, setLoading] = useState(true);

  // YENİ EKLENEN STATE (DESTEK PERSONELİ)
  const [destekListesi, setDestekListesi] = useState<any[]>([]);
  const [secilenDestekler, setSecilenDestekler] = useState<string[]>([]);

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

      // YENİ: Sadece Teknisyen ve Operatörleri Çek
      const uSnap = await getDocs(query(collection(db, "users"), where("role", "in", ["teknisyen", "operator"])));
      setDestekListesi(uSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    } catch (e) { console.error(e); }
  };

  // --- ORIJINAL V83 STOK MOTORU (page.txt'den BİREBİR) ---
  const findStockItem = (id: number) => {
    const row = usedMaterials.find(m => m.id === id);
    if (!row || !row.stockCode) return;
    const searchStr = row.stockCode.trim().toUpperCase();
    const part = allSpareParts.find(p => String(p.id).toUpperCase() === searchStr || (p.stokKodu && p.stokKodu.toUpperCase() === searchStr));
    if (part) {
      setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, name: part.malzemeAciklamasi || "İsimsiz", stock: part.stokMiktari || 0, unit: part.birim || "Adet" } : m));
    } else {
      setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, name: "BULUNAMADI", stock: "-", unit: "Adet" } : m));
    }
  };

  const startDictation = () => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.onstart = () => setIsDictating(true);
    recognition.onend = () => setIsDictating(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const current = watch("aciklama");
      setValue("aciklama", current ? current + " " + transcript : transcript);
    };
    recognition.start();
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      const tumEkip = [userName, ...secilenDestekler].join(", ");
      const finalLog = {
        ...data,
        bildirenKisi: userName,
        teknisyen: tumEkip,
        yardimciTeknisyenler: secilenDestekler,
        kayitTarihi: serverTimestamp(),
        usedMaterials,
        durum: "Kapalı"
      };
      await addDoc(collection(db, "maintenance_logs"), finalLog);
      if (data.linkedOrderId) {
        await updateDoc(doc(db, "work_orders", data.linkedOrderId), { durum: "Kapalı", tamamlanmaTarihi: serverTimestamp() });
      }
      alert("Kayıt Başarılı");
      reset();
      setSecilenDestekler([]);
      setUsedMaterials([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
    } catch (e) { alert(e); }
  };

  if (loading) return <div className="p-10 text-white italic">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* --- ORIJINAL ÜST BUTON GRUBU (page.txt'den GERİ GELDİ) --- */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">DFU TEKNİK DASHBOARD</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-none">Bakım ve Arıza Kayıt Portalı</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/pano-kontrol" className="bg-slate-900 border border-slate-800 p-3 rounded-2xl hover:border-blue-500 transition-all text-[10px] font-black uppercase text-slate-400">Pano Kontrol</Link>
            <Link href="/dashboard/periyodik-bakim" className="bg-slate-900 border border-slate-800 p-3 rounded-2xl hover:border-blue-500 transition-all text-[10px] font-black uppercase text-slate-400">Periyodik Bakım</Link>
            <Link href="/admin/bakim-ligi" className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl text-[10px] font-black uppercase text-yellow-500">Bakım Ligi</Link>
          </div>
        </div>

        {/* ISG VE SAHA BİLDİRİMLERİ (ORIJINAL DÜZEN VE BUTONLAR) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-[2.5rem]">
            <h3 className="text-red-500 text-xs font-black mb-4 tracking-widest uppercase italic">⚠️ KRİTİK İSG ALARMLARI</h3>
            {isgAlarmlari.map(a => (
              <div key={a.id} className="bg-red-900/20 p-4 rounded-2xl mb-2 flex justify-between items-center border border-red-800/30">
                <span className="text-xs text-red-200">{a.aciklama}</span>
                <button type="button" onClick={() => { setValue("hatAdi", a.hatAdi); setValue("ekipmanAdi", a.ekipmanAdi); setValue("linkedOrderId", a.id); }} className="text-[9px] bg-red-600 text-white px-3 py-1 rounded-lg font-black uppercase shadow-lg">Seç</button>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem]">
            <h3 className="text-blue-500 text-xs font-black mb-4 tracking-widest uppercase italic">📡 SAHA BİLDİRİMLERİ</h3>
            <div className="space-y-3">
              {aktifIsler.map(is => (
                <div key={is.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500 transition-all">
                  <div><p className="text-xs font-bold text-slate-300 uppercase">{is.ekipmanAdi}</p><p className="text-[10px] text-slate-500 italic">{is.hatAdi} - {is.bildirenKisi}</p></div>
                  <button type="button" onClick={() => { setValue("hatAdi", is.hatAdi); setValue("ekipmanAdi", is.ekipmanAdi); setValue("linkedOrderId", is.id); }} className="text-[9px] bg-blue-900/40 text-blue-400 px-3 py-2 rounded-lg font-black hover:bg-blue-600 hover:text-white transition-all">SEÇ</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Hat Seçimi</label><select {...register("hatAdi")} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500"><option value="">Hat Seçin</option>{hatlar.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Ekipman</label><input {...register("ekipmanAdi")} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Vardiya</label><select {...register("vardiya")} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500"><option>08:00 - 16:00</option><option>16:00 - 00:00</option><option>00:00 - 08:00</option></select></div>
            </div>

            {/* YENİ: DESTEK PERSONELİ (ORIJINAL DÜZEN İÇİNDE) */}
            <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800/50">
              <label className="text-[9px] font-black text-slate-500 block mb-4 uppercase tracking-[0.2em]">Destek Veren Teknisyenler (Ekip)</label>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter">{userName} (Lider)</span>
                {secilenDestekler.map(name => (
                  <span key={name} className="bg-slate-800 text-blue-400 border border-slate-700 px-3 py-1 rounded-full text-[9px] font-bold flex items-center gap-2">
                    {name} <button type="button" onClick={() => setSecilenDestekler(prev => prev.filter(t => t !== name))} className="text-slate-500 hover:text-red-500 font-black">×</button>
                  </span>
                ))}
              </div>
              <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-slate-400 outline-none focus:border-blue-500 text-xs"
                onChange={(e) => { const v = e.target.value; if (v && !secilenDestekler.includes(v) && v !== userName) setSecilenDestekler([...secilenDestekler, v]); e.target.value = ""; }}>
                <option value="">Destek Personeli Ekle...</option>
                {destekListesi.filter(t => t.name !== userName).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* ZAMAN VE DURUŞ (ORIJINAL) */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
             <div className="flex items-center gap-4 bg-slate-950 p-5 rounded-3xl border border-slate-800">
                <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 accent-red-600" id="durus-btn" />
                <label htmlFor="durus-btn" className="text-xs font-black text-red-600 uppercase cursor-pointer italic">Üretim Duruşlu Arıza</label>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-widest text-center italic">Başlangıç</label><input type="time" {...register("baslangicSaati")} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-2xl text-white text-xs text-center" /></div>
                <div><label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-widest text-center italic">Bitiş</label><input type="time" {...register("bitisSaati")} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-2xl text-white text-xs text-center" /></div>
             </div>
          </div>

          {/* SARF MALZEME (ORIJINAL V83 MANTIĞI GERİ GELDİ) */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem]">
            <h3 className="text-[10px] font-black text-white mb-6 uppercase tracking-[0.3em] italic">Yedek Parça / Sarf Malzeme Kullanımı</h3>
            {usedMaterials.map(row => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-end">
                <div className="md:col-span-1"><input type="text" placeholder="KOD..." value={row.stockCode} onBlur={() => findStockItem(row.id)}
                  onChange={e => setUsedMaterials(prev => prev.map(m => m.id === row.id ? {...m, stockCode: e.target.value} : m))}
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs text-blue-400 font-black uppercase shadow-inner" /></div>
                <div className="md:col-span-2"><div className="w-full bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl text-[10px] text-slate-500 italic truncate font-bold">{row.name}</div></div>
                <div className="flex gap-2 items-center"><input type="number" value={row.quantity} onChange={e => setUsedMaterials(prev => prev.map(m => m.id === row.id ? {...m, quantity: Number(e.target.value)} : m))}
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs text-white text-center font-black" /><span className="text-[10px] text-slate-600 font-bold uppercase">{row.unit}</span></div>
                <button type="button" onClick={() => setUsedMaterials(prev => prev.filter(m => m.id !== row.id))} className="bg-red-900/20 text-red-500 p-4 rounded-2xl hover:bg-red-600 transition-all text-[9px] font-black uppercase">SİL</button>
              </div>
            ))}
            <button type="button" onClick={() => setUsedMaterials([...usedMaterials, {id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet"}])}
            className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em] hover:underline mt-4 tracking-tighter italic">+ Yeni Malzeme Ekle</button>
          </div>

          {/* AÇIKLAMA VE MİKROFON (ORIJINAL) */}
          <div className="relative group">
            <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest">Yapılan İşlem Açıklaması</label>
            <textarea {...register("aciklama")} className="w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] text-white text-sm outline-none focus:border-blue-500 h-52 resize-none shadow-inner" placeholder="Müdahale detaylarını buraya yazın..." />
            <button type="button" onClick={startDictation} className={`absolute bottom-8 right-8 p-5 rounded-full shadow-2xl transition-all ${isDictating ? 'bg-red-600 animate-pulse text-white' : 'bg-blue-600 text-white hover:scale-110 active:scale-95'}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-7 rounded-[3rem] shadow-2xl shadow-blue-900/20 transition-all uppercase tracking-[0.4em] text-sm">
            {isSubmitting ? "Sisteme Kaydediliyor..." : "Bakım Raporunu Sisteme Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white italic">Yükleniyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}