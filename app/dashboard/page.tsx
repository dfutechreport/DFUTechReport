"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId: string | null;
}

function DashboardIcerik() {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: today,
      bitisTarihi: today,
      isDuruslu: false, vardiya: "08:00 - 16:00", linkedOrderId: null, aciklama: ""
    }
  });
  
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
  const [loading, setLoading] = useState(true);

  // DESTEK PERSONELİ STATES
  const [destekListesi, setDestekListesi] = useState<any[]>([]);
  const [secilenDestekler, setSecilenDestekler] = useState<string[]>([]);

  const selectedHat = watch("hatAdi");

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserName(userSnap.data().name || "");
          setUserRole(userSnap.data().role || "");
          await fetchSystemData();
        } else { router.push("/"); }
      } else { router.push("/"); }
      setLoading(false);
    });
  }, [router]);

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

      const uSnap = await getDocs(query(collection(db, "users"), where("role", "in", ["teknisyen", "operator"])));
      setDestekListesi(uSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (selectedHat) {
      const filtered = allAssets.filter(a => a.hatAdi === selectedHat).map(a => a.ekipmanAdi).filter(Boolean).sort();
      setFilteredEkipmanlar(Array.from(new Set(filtered)));
    } else { setFilteredEkipmanlar([]); }
  }, [selectedHat, allAssets]);

  const findStockItem = (id: number) => {
    const row = usedMaterials.find(m => m.id === id);
    if (!row || !row.stockCode) return;
    const searchStr = row.stockCode.trim().toUpperCase();
    const part = allSpareParts.find(p => String(p.id).toUpperCase() === searchStr || (p.stokKodu && p.stokKodu.toUpperCase() === searchStr));
    if (part) {
      setUsedMaterials(prev => prev.map(m => m.id === id ? { ...m, name: part.parcaAdi || part.malzemeAciklamasi || "İsimsiz", stock: part.mevcutMiktar || 0, unit: part.birim || "Adet" } : m));
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
      const currentVal = watch("aciklama");
      setValue("aciklama", currentVal ? currentVal + " " + transcript : transcript);
    };
    recognition.start();
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      const tumEkip = [userName, ...secilenDestekler].join(", ");
      const finalLog = { ...data, bildirenKisi: userName, teknisyen: tumEkip, ekip: secilenDestekler, kayitTarihi: serverTimestamp(), usedMaterials, durum: "Kapalı" };
      await addDoc(collection(db, "maintenance_logs"), finalLog);
      if (data.linkedOrderId) { await updateDoc(doc(db, "work_orders", data.linkedOrderId), { durum: "Kapalı", tamamlanmaTarihi: serverTimestamp() }); }
      alert("Başarıyla Kaydedildi.");
      reset();
      setSecilenDestekler([]);
      setUsedMaterials([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
    } catch (e) { alert("Hata!"); }
  };

  if (loading) return <div className="p-10 text-white italic tracking-widest text-center">SİSTEM YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-sans">
      <div className="max-w-[1440px] mx-auto space-y-6">
        
        {/* NAVİGASYON BUTONLARI (12 ADET) */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-4 rounded-[2.5rem] shadow-2xl">
          <Link href="/dashboard" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Dashboard</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:border-blue-500">Kontrol Formları</Link>
          <Link href="/dashboard/pano-listesi" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:border-blue-500 transition-all">Pano Temizliği</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:border-blue-500 transition-all">Periyodik Bakım</Link>
          <Link href="/admin/pm-takvim" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400 hover:border-blue-500 transition-all">Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400">Sayaç Okuma</Link>
          <Link href="/dashboard/mesai" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400">Mesai Girişi</Link>
          <Link href="/admin/eked" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400">EKED Takip</Link>
          <Link href="/admin/mesai" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400">Mesailerim</Link>
          <Link href="/admin/is-listesi" className="bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-400">Yapılan İşler</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-yellow-500 italic">Bakım Ligi</Link>
          <button onClick={() => signOut(auth)} className="bg-red-900/20 border border-red-900/30 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase text-red-500 ml-auto transition-all hover:bg-red-600 hover:text-white">Çıkış</button>
        </div>

        {/* ISG VE SAHA BİLDİRİMLERİ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-[2.5rem]">
            <h3 className="text-red-500 text-xs font-black mb-4 uppercase italic">⚠️ KRİTİK İSG ALARMLARI</h3>
            {isgAlarmlari.map(a => (
              <div key={a.id} className="bg-red-900/20 p-4 rounded-2xl mb-2 flex justify-between items-center border border-red-800/30 shadow-lg italic font-bold">
                <span className="text-xs text-red-200">{a.aciklama}</span>
                <button type="button" onClick={() => { setValue("hatAdi", a.hatAdi); setValue("ekipmanAdi", a.ekipmanAdi); setValue("linkedOrderId", a.id); }} className="text-[9px] bg-red-600 text-white px-4 py-2 rounded-xl font-black uppercase shadow-lg">Seç</button>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem]">
            <h3 className="text-blue-500 text-xs font-black mb-4 uppercase italic font-black">📡 SAHA BİLDİRİMLERİ</h3>
            <div className="space-y-3">
              {aktifIsler.map(is => (
                <div key={is.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-blue-500 transition-all shadow-inner">
                  <div className="italic font-bold"><p className="text-xs font-bold text-slate-300 uppercase">{is.ekipmanAdi}</p><p className="text-[10px] text-slate-500">{is.hatAdi} - {is.bildirenKisi}</p></div>
                  <button type="button" onClick={() => { setValue("hatAdi", is.hatAdi); setValue("ekipmanAdi", is.ekipmanAdi); setValue("linkedOrderId", is.id); }} className="text-[9px] bg-blue-900/40 text-blue-400 px-4 py-2 rounded-xl font-black hover:bg-blue-600 transition-all uppercase shadow-lg">Seç</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* ANA BİLGİLER VE EKİP SEÇİMİ */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] space-y-8 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest italic font-bold">1. Hat / Bölge</label><select {...register("hatAdi")} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 shadow-inner italic font-bold"><option value="">Hat Seçin</option>{hatlar.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest italic font-bold">2. Ekipman Seçimi</label><select {...register("ekipmanAdi")} disabled={!selectedHat} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 shadow-inner italic font-bold"><option value="">{selectedHat ? "Ekipman Seçiniz" : "Önce Hat Seçiniz"}</option>{filteredEkipmanlar.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
              <div><label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest italic font-bold">3. Vardiya</label><select {...register("vardiya")} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 shadow-inner italic font-bold"><option>08:00 - 16:00</option><option>16:00 - 00:00</option><option>00:00 - 08:00</option></select></div>
            </div>

            <div className="bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800/50 shadow-inner">
              <label className="text-[9px] font-black text-slate-500 block mb-4 uppercase tracking-[0.2em] italic font-bold">Destek Veren Personeller (Ekip)</label>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-xl italic tracking-tighter">{userName} (Lider)</span>
                {secilenDestekler.map(name => (
                  <span key={name} className="bg-slate-800 text-blue-400 border border-slate-700 px-4 py-1.5 rounded-xl text-[9px] font-bold flex items-center gap-2">
                    {name} <button type="button" onClick={() => setSecilenDestekler(prev => prev.filter(t => t !== name))} className="text-slate-500 hover:text-red-500 font-black">×</button>
                  </span>
                ))}
              </div>
              <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-slate-400 outline-none focus:border-blue-500 text-xs italic font-bold"
                onChange={(e) => { const v = e.target.value; if (v && !secilenDestekler.includes(v) && v !== userName) setSecilenDestekler([...secilenDestekler, v]); e.target.value = ""; }}>
                <option value="">Destek Personeli Ekle...</option>
                {destekListesi.filter(t => t.name !== userName).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* TARİH, SAAT VE DURUŞ (GÜNCELLENEN BÖLÜM) */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] space-y-8 shadow-xl">
             <div className="flex items-center gap-4 bg-slate-950 p-6 rounded-[2rem] border border-slate-800 shadow-inner">
                <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 accent-red-600 shadow-lg" id="durus-btn" />
                <label htmlFor="durus-btn" className="text-xs font-black text-red-600 uppercase cursor-pointer italic tracking-widest font-bold">Üretim Duruşlu Arıza</label>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* BAŞLANGIÇ ZAMANI */}
                <div className="bg-slate-950/30 p-5 rounded-3xl border border-slate-800/50">
                  <label className="text-[10px] text-blue-500 font-black mb-3 block uppercase italic font-bold">Arıza Başlangıç</label>
                  <div className="flex gap-4">
                    <input type="date" {...register("baslangicTarihi")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs w-full shadow-inner italic font-bold" />
                    <input type="time" {...register("baslangicSaati")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs w-full shadow-inner italic font-bold" />
                  </div>
                </div>
                {/* BİTİŞ ZAMANI */}
                <div className="bg-slate-950/30 p-5 rounded-3xl border border-slate-800/50">
                  <label className="text-[10px] text-green-500 font-black mb-3 block uppercase italic font-bold">Arıza Bitiş</label>
                  <div className="flex gap-4">
                    <input type="date" {...register("bitisTarihi")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs w-full shadow-inner italic font-bold" />
                    <input type="time" {...register("bitisSaati")} className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-white text-xs w-full shadow-inner italic font-bold" />
                  </div>
                </div>
             </div>
          </div>

          {/* SARF MALZEME MODÜLÜ */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="text-[10px] font-black text-white mb-6 uppercase tracking-[0.3em] italic underline font-bold">Yedek Parça / Sarf Malzeme Kullanımı</h3>
            {usedMaterials.map(row => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-end animate-in fade-in slide-in-from-left duration-300 italic font-bold">
                <div className="md:col-span-1"><input type="text" placeholder="KOD..." value={row.stockCode} onBlur={() => findStockItem(row.id)}
                  onChange={e => setUsedMaterials(prev => prev.map(m => m.id === row.id ? {...m, stockCode: e.target.value} : m))}
                  className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs text-blue-400 font-black uppercase shadow-inner" /></div>
                <div className="md:col-span-2"><div className="w-full bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl text-[10px] text-slate-400 italic truncate font-bold shadow-inner">{row.name}</div></div>
                <div className="flex gap-2 items-center"><input type="number" value={row.quantity} onChange={e => setUsedMaterials(prev => prev.map(m => m.id === row.id ? {...m, quantity: Number(e.target.value)} : m))}
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs text-white text-center font-black" /><span className="text-[10px] text-slate-600 font-bold uppercase">{row.unit}</span></div>
                <button type="button" onClick={() => setUsedMaterials(prev => prev.filter(m => m.id !== row.id))} className="bg-red-900/20 text-red-500 p-4 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-[9px] font-black uppercase shadow-lg shadow-inner">SİL</button>
              </div>
            ))}
            <button type="button" onClick={() => setUsedMaterials([...usedMaterials, {id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet"}])}
            className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em] hover:underline mt-4 italic">+ Yeni Malzeme Ekle</button>
          </div>

          {/* AÇIKLAMA VE MİKROFON */}
          <div className="relative group">
            <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest italic tracking-tighter font-bold">Yapılan İşlem Açıklaması</label>
            <textarea {...register("aciklama")} className="w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] text-white text-sm outline-none focus:border-blue-500 h-52 resize-none shadow-2xl shadow-inner italic font-bold" placeholder="Müdahale detaylarını buraya yazın..." />
            <button type="button" onClick={startDictation} className={`absolute bottom-8 right-8 p-6 rounded-full shadow-2xl transition-all ${isDictating ? 'bg-red-600 animate-pulse text-white' : 'bg-blue-600 text-white hover:scale-110 active:scale-95 shadow-blue-600/20'}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-7 rounded-[3rem] shadow-2xl shadow-blue-900/20 transition-all uppercase tracking-[0.5em] text-sm italic tracking-tighter">
            {isSubmitting ? "Sisteme Kaydediliyor..." : "Bakım Raporunu Sisteme Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white italic tracking-[0.3em] font-black italic">SİSTEM YÜKLENİYOR...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}