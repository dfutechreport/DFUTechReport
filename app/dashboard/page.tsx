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
  
  // Orijinal States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);

  // YENİ: Destek Personeli States
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
      // 1. Bildirimler
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));

      // 2. Assets
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());

      // 3. Spare Parts
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // YENİ: Sadece Teknisyen ve Operatörleri Çek
      const uSnap = await getDocs(query(collection(db, "users"), where("role", "in", ["teknisyen", "operator"])));
      setDestekListesi(uSnap.docs.map(d => ({ id: d.id, name: d.data().name })));

    } catch (e) { console.error(e); }
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      // Bakım Ligi için isim birleştirme
      const tumEkip = [userName, ...secilenDestekler].join(", ");

      const logData = {
        ...data,
        bildirenKisi: userName,
        teknisyen: tumEkip, // Tüm ekip puan alsın diye
        destekPersonelleri: secilenDestekler,
        kayitTarihi: serverTimestamp(),
        usedMaterials,
        durum: "Kapalı"
      };

      await addDoc(collection(db, "maintenance_logs"), logData);

      // İş emri bağlıysa kapat
      if (data.linkedOrderId) {
        await updateDoc(doc(db, "work_orders", data.linkedOrderId), {
          durum: "Kapalı",
          tamamlanmaTarihi: serverTimestamp()
        });
      }

      alert("Rapor başarıyla kaydedildi.");
      reset();
      setSecilenDestekler([]);
      setUsedMaterials([{ id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }]);
    } catch (e) { alert("Hata: " + e); }
  };

  // Orijinal Stok Arama Motoru (Değişmedi)
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

  if (loading) return <div className="p-10 text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER - Orijinal Tasarım */}
        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic">DFU TEKNİK RAPOR</h1>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">Bakım ve Arıza Kayıt Paneli</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold block uppercase">Aktif Teknisyen</span>
            <span className="text-blue-500 font-bold">{userName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* TEKNİK BİLGİLER BÖLÜMÜ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Hat / Bölge</label>
              <select {...register("hatAdi")} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:border-blue-500">
                <option value="">Seçiniz</option>
                {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Ekipman</label>
              <input {...register("ekipmanAdi")} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:border-blue-500" placeholder="Ekipman Adı..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase">Vardiya</label>
              <select {...register("vardiya")} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-white outline-none focus:border-blue-500">
                <option>08:00 - 16:00</option>
                <option>16:00 - 00:00</option>
                <option>00:00 - 08:00</option>
              </select>
            </div>
          </div>

          {/* YENİ: DESTEK PERSONELİ EKLEME (Orijinal Stilde) */}
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
            <label className="text-[10px] font-bold text-slate-500 block mb-3 uppercase tracking-widest">Destek Veren Personeller (Teknisyen/Operatör)</label>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {secilenDestekler.map(name => (
                <span key={name} className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-2 uppercase">
                  {name}
                  <button type="button" onClick={() => setSecilenDestekler(prev => prev.filter(n => n !== name))} className="text-blue-500 hover:text-red-500 font-black">×</button>
                </span>
              ))}
            </div>

            <select 
              className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-400 outline-none focus:border-blue-500 text-xs"
              onChange={(e) => {
                const val = e.target.value;
                if (val && !secilenDestekler.includes(val) && val !== userName) {
                  setSecilenDestekler([...secilenDestekler, val]);
                }
                e.target.value = "";
              }}
            >
              <option value="">Destek Personeli Ekle...</option>
              {destekListesi.filter(t => t.name !== userName).map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* ZAMAN VE DURUŞ BİLGİLERİ */}
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <input type="checkbox" {...register("isDuruslu")} className="w-5 h-5 accent-red-600" id="durus-toggle" />
              <label htmlFor="durus-toggle" className="text-xs font-black text-red-500 uppercase cursor-pointer">Üretim Duruşlu Arıza</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Başlangıç</span>
                <input type="time" {...register("baslangicSaati")} className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white" />
              </div>
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Bitiş</span>
                <input type="time" {...register("bitisSaati")} className="w-full bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs text-white" />
              </div>
            </div>
          </div>

          {/* STOK YÖNETİMİ - Orijinal Motor (Değişmedi) */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
             <h2 className="text-sm font-black text-white mb-6 uppercase tracking-widest">Kullanılan Yedek Parça / Sarf Malzeme</h2>
             {usedMaterials.map((row) => (
               <div key={row.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-end">
                 <div className="md:col-span-1">
                   <input 
                     type="text" 
                     placeholder="Kod Girin..."
                     className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-blue-400 font-bold"
                     value={row.stockCode}
                     onChange={(e) => setUsedMaterials(prev => prev.map(m => m.id === row.id ? { ...m, stockCode: e.target.value } : m))}
                     onBlur={() => findStockItem(row.id)}
                   />
                 </div>
                 <div className="md:col-span-2">
                   <div className="w-full bg-slate-950/50 border border-slate-800/50 p-3 rounded-xl text-[10px] text-slate-400 font-medium truncate italic">
                     {row.name}
                   </div>
                 </div>
                 <div className="flex gap-2 items-center">
                   <input 
                     type="number" 
                     className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white text-center"
                     value={row.quantity}
                     onChange={(e) => setUsedMaterials(prev => prev.map(m => m.id === row.id ? { ...m, quantity: Number(e.target.value) } : m))}
                   />
                   <span className="text-[10px] text-slate-500 font-bold uppercase">{row.unit}</span>
                 </div>
                 <button 
                  type="button"
                  onClick={() => setUsedMaterials(prev => prev.filter(m => m.id !== row.id))}
                  className="bg-red-900/20 text-red-500 p-3 rounded-xl hover:bg-red-900/40 text-xs font-black"
                 >SİL</button>
               </div>
             ))}
             <button 
              type="button" 
              onClick={() => setUsedMaterials([...usedMaterials, { id: Date.now(), stockCode: "", name: "Kod Bekleniyor", stock: "-", quantity: 1, unit: "Adet" }])}
              className="mt-2 text-blue-500 text-[10px] font-black uppercase hover:underline"
             >+ Yeni Malzeme Ekle</button>
          </div>

          {/* AÇIKLAMA VE KAYDET */}
          <div className="space-y-4">
            <textarea 
              {...register("aciklama")}
              placeholder="Yapılan müdahale ve arıza kök nedeni hakkında detaylı bilgi giriniz..."
              className="w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white outline-none focus:border-blue-500 h-40 resize-none shadow-inner"
            ></textarea>
            
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-5 rounded-3xl shadow-2xl shadow-blue-600/20 transition-all uppercase tracking-[0.2em] text-sm"
            >
              {isSubmitting ? "Sisteme İşleniyor..." : "Bakım Raporunu Tamamla"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Modül Hazırlanıyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}