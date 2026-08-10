
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
  const bas = watch("baslangicSaati");
  const bit = watch("bitisSaati");

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userSnap = await getDoc(doc(db, "users", u.uid));
        if (userSnap.exists()) setUserName(userSnap.data().name);
        const hSnap = await getDocs(collection(db, "hatlar"));
        setHatlar(hSnap.docs.map(d => d.data().ad));
      } else { window.location.href = "/"; }
    });
  }, []);

  useEffect(() => {
    if (selectedHat) {
      const q = query(collection(db, "ekipmanlar"), where("hat", "==", selectedHat));
      getDocs(q).then(s => setEkipmanlar(s.docs.map(d => d.data().ad)));
    }
  }, [selectedHat]);

  useEffect(() => {
    if (bas && bit) {
      const s = new Date(`2024-01-01T${bas}`).getTime();
      const e = new Date(`2024-01-01T${bit}`).getTime();
      let diff = (e - s) / 60000;
      if (diff < 0) diff += 1440;
      setHesaplananSure(diff);
    }
  }, [bas, bit]);

  const onSubmit = async (data: any) => {
    try {
      await setDoc(doc(collection(db, "maintenance_logs")), { ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: serverTimestamp() });
      alert("Kaydedildi."); window.location.reload();
    } catch (e) { alert("Hata."); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><button onClick={()=>auth.signOut()} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold">Çıkış</button></div>
        <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-800">
          <h1 className="text-xl font-black mb-8 border-b border-gray-800 pb-4 uppercase">Vardiya İş Kayıt Formu</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <select {...register("hatAdi")} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm"><option value="">Hat Seçin</option>{hatlar.map(h=><option key={h} value={h}>{h}</option>)}</select>
              <select {...register("ekipmanAdi")} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm"><option value="">Ekipman Seçin</option>{ekipmanlar.map(e=><option key={e} value={e}>{e}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="time" {...register("baslangicSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-4" />
              <input type="time" {...register("bitisSaati")} className="bg-gray-800 border-gray-700 rounded-xl p-4" />
            </div>
            <div className="bg-teal-900/20 p-4 rounded-xl text-center border border-teal-500/20"><p className="text-xs text-teal-400 font-bold uppercase">Müdahale Süresi</p><h2 className="text-3xl font-black">{hesaplananSure} dk</h2></div>
            <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-sm" placeholder="Açıklama..." />
            <button type="submit" disabled={isSubmitting || hesaplananSure<=0} className="w-full bg-orange-600 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Raporu Kaydet</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }
