"use client";
import { useEffect, useState, Suspense } from "react";
import { 
  collection, getDocs, doc, getDoc, query, where, orderBy, 
  setDoc, updateDoc, serverTimestamp, addDoc 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { useForm } from "react-hook-form";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId: string | null;
}

// SVG İKONLAR
const IconUserPlus = () => <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>;
const IconX = () => <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>;

function DashboardIcerik() {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00", linkedOrderId: null, aciklama: ""
    }
  });
  
  // Mevcut States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [allSpareParts, setAllSpareParts] = useState<any[]>([]);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);

  // YENİ: Ekip Çalışması States
  const [allTechnicians, setAllTechnicians] = useState<any[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) { 
          setUserName(userSnap.data().name || ""); 
          setUserRole(userSnap.data().role || ""); 
        }
        await fetchSystemData();
      } else { window.location.href = "/"; }
      setLoading(false);
    });
  }, []);

  const fetchSystemData = async () => {
    try {
      // 1. İş Emirleri
      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      setAktifIsler(wSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Hat/Ekipman Verileri
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());

      // 3. Stok Verileri
      const pSnap = await getDocs(collection(db, "spare_parts"));
      setAllSpareParts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 4. YENİ: Tüm Personeli Çek (Ekip seçimi için)
      const uSnap = await getDocs(collection(db, "users"));
      setAllTechnicians(uSnap.docs.map(d => ({ id: d.id, name: d.data().name })));

    } catch (e) { console.error(e); }
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    try {
      // Bakım Ligi Algoritması ile tam uyum için tüm isimleri virgülle birleştiriyoruz
      const tamEkip = [userName, ...selectedTechs].join(", ");

      const finalLog = {
        ...data,
        bildirenKisi: userName, // Raporu açan asıl kişi
        teknisyen: tamEkip,      // Lider tablosunun okuduğu ana alan
        yardimciTeknisyenler: selectedTechs,
        kayitTarihi: serverTimestamp(),
        durum: "Kapalı"
      };

      await addDoc(collection(db, "maintenance_logs"), finalLog);
      
      // Eğer bir iş emrine bağlıysa onu da kapat
      if (data.linkedOrderId) {
        await updateDoc(doc(db, "work_orders", data.linkedOrderId), {
          durum: "Kapalı",
          tamamlanmaTarihi: serverTimestamp()
        });
      }

      alert("Bakım raporu ve ekip verileri başarıyla kaydedildi.");
      reset();
      setSelectedTechs([]);
    } catch (e) {
      alert("Hata oluştu: " + e);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">Sistem Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto space-y-6">
        
        {/* BAŞLIK */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tighter">ARIZA & BAKIM RAPORU</h1>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Operatör</p>
            <p className="text-blue-400 font-bold">{userName}</p>
          </div>
        </div>

        {/* TEMEL BİLGİLER (Hat, Ekipman, Vardiya) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Hat Seçimi</label>
            <select {...register("hatAdi")} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500">
              <option value="">Hat Seçin</option>
              {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Ekipman</label>
            <input {...register("ekipmanAdi")} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" placeholder="Ekipman Adı..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Vardiya</label>
            <select {...register("vardiya")} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500">
              <option>08:00 - 16:00</option>
              <option>16:00 - 00:00</option>
              <option>00:00 - 08:00</option>
            </select>
          </div>
        </div>

        {/* YENİ: EKİP ÇALIŞMASI (YARDIMCI TEKNİSYENLER) */}
        <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800/50">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-blue-500"><IconUserPlus /></div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ekip Çalışması (Destek Verenler)</label>
          </div>
          
          {/* Seçilenlerin Etiketleri */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="bg-blue-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-lg shadow-blue-500/20">
              {userName} (LİDER)
            </span>
            {selectedTechs.map(name => (
              <span key={name} className="bg-slate-800 text-blue-400 border border-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2">
                {name}
                <button type="button" onClick={() => setSelectedTechs(prev => prev.filter(t => t !== name))} className="text-slate-500 hover:text-red-500">
                  <IconX />
                </button>
              </span>
            ))}
          </div>

          {/* Personel Seçim Menüsü */}
          <select 
            className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-slate-300 outline-none focus:border-blue-500 transition-all text-sm shadow-inner"
            onChange={(e) => {
              const val = e.target.value;
              if (val && !selectedTechs.includes(val) && val !== userName) {
                setSelectedTechs([...selectedTechs, val]);
              }
              e.target.value = ""; 
            }}
          >
            <option value="">Personel Eklemek İçin Seçin...</option>
            {allTechnicians.filter(t => t.name !== userName).map(t => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* DURUŞ VE ZAMAN BİLGİLERİ */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="flex items-center gap-4">
              <input type="checkbox" {...register("isDuruslu")} className="w-6 h-6 rounded-lg accent-red-600" id="durus-check" />
              <label htmlFor="durus-check" className="font-bold text-red-500 cursor-pointer uppercase text-xs tracking-widest">Üretim Duruşlu Arıza</label>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">Başlangıç</label>
                <div className="flex gap-2">
                  <input type="date" {...register("baslangicTarihi")} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs w-full" />
                  <input type="time" {...register("baslangicSaati")} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs w-full" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-slate-500 font-bold uppercase mb-1">Bitiş</label>
                <div className="flex gap-2">
                  <input type="date" {...register("bitisTarihi")} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs w-full" />
                  <input type="time" {...register("bitisSaati")} className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs w-full" />
                </div>
              </div>
           </div>
        </div>

        {/* AÇIKLAMA */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Yapılan İşlem Açıklaması</label>
          <textarea 
            {...register("aciklama")}
            className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500 h-32 resize-none"
            placeholder="Arıza sebebi ve uygulanan çözüm..."
          ></textarea>
        </div>

        {/* KAYDET BUTONU */}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black py-5 rounded-2xl shadow-2xl shadow-blue-600/20 transition-all uppercase tracking-[0.3em] text-sm"
        >
          {isSubmitting ? "KAYDEDİLİYOR..." : "RAPORU SİSTEME GÖNDER"}
        </button>

      </form>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}