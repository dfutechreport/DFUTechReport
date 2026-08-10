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
  const [hatlar, setHatlar] = useState<any[]>([]);
  const [ekipmanlar, setEkipmanlar] = useState<any[]>([]);
  const [hesaplananSure, setHesaplananSure] = useState(0);

  const selectedHat = watch("hatAdi");
  const baslangic = watch("baslangicSaati");
  const bitis = watch("bitisSaati");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) setUserName(userSnap.data().name);
        
        const hSnap = await getDocs(collection(db, "hatlar"));
        setHatlar(hSnap.docs.map(d => d.data().ad || d.data().name));
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedHat) {
      const fetchEkipman = async () => {
        const q = query(collection(db, "ekipmanlar"), where("hat", "==", selectedHat));
        const eSnap = await getDocs(q);
        setEkipmanlar(eSnap.docs.map(d => d.data().ad || d.data().name));
      };
      fetchEkipman();
    }
  }, [selectedHat]);

  useEffect(() => {
    if (baslangic && bitis) {
      const start = new Date(`2024-01-01T${baslangic}`).getTime();
      const end = new Date(`2024-01-01T${bitis}`).getTime();
      let diff = (end - start) / (1000 * 60);
      if (diff < 0) diff += 1440; // Gece vardiyası devri
      setHesaplananSure(diff);
    }
  }, [baslangic, bitis]);

  const onSubmit = async (data: any) => {
    try {
      const logRef = doc(collection(db, "maintenance_logs"));
      await setDoc(logRef, {
        ...data,
        toplamSureDakika: hesaplananSure,
        bildirenKisi: userName,
        kayitTarihi: serverTimestamp()
      });
      alert("İş başarıyla kaydedildi.");
      window.location.reload();
    } catch (e) {
      alert("Hata oluştu, lütfen tekrar deneyin.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
          <div className="flex items-center gap-4">
            <p className="text-xs font-bold text-teal-400">{userName}</p>
            <button onClick={() => auth.signOut()} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-lg">Çıkış</button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-xl font-black mb-8 text-white border-b border-gray-800 pb-4 uppercase tracking-tighter">Vardiya İş Kayıt Formu</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Üretim Hattı</label>
                <select {...register("hatAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 ring-teal-500">
                  <option value="">Hat Seçin</option>
                  {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ekipman / Makine</label>
                <select {...register("ekipmanAdi")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 ring-teal-500">
                  <option value="">Ekipman Seçin</option>
                  {ekipmanlar.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Başlangıç Saati</label>
                <input type="time" {...register("baslangicSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bitiş Saati</label>
                <input type="time" {...register("bitisSaati")} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 outline-none focus:ring-2 ring-teal-500" />
              </div>
            </div>

            <div className="bg-teal-900/20 border border-teal-500/20 p-6 rounded-2xl text-center">
              <p className="text-[10px] text-teal-400 font-bold uppercase mb-1">Hesaplanan Müdahale Süresi</p>
              <h2 className="text-4xl font-black text-white">{hesaplananSure} <span className="text-sm font-normal text-gray-400">Dakika</span></h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Yapılan İşlem / Açıklama</label>
              <textarea 
                {...register("aciklama")} 
                rows={4} 
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 ring-teal-500 outline-none" 
                placeholder="İşlemi detaylandırın..." 
              />
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-600/20 transition-all uppercase tracking-widest">
              {isSubmitting ? "Kaydediliyor..." : "Raporu Kaydet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}
