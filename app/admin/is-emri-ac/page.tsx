"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

export default function IsEmriAc() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [form, setForm] = useState({ hatAdi: "", ekipmanAdi: "", arizaDetayi: "", oncelik: "Normal" });

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserName(uSnap.data().name);
          setUserRole(uSnap.data().role);
          fetchHatlar();
        }
      } else router.push("/");
      setLoading(false);
    });
  }, []);

  const fetchHatlar = async () => {
    const snap = await getDocs(collection(db, "assets"));
    const hSet = new Set<string>();
    snap.forEach(d => { if(d.data().hatAdi) hSet.add(d.data().hatAdi); });
    setHatlar(Array.from(hSet).sort());
  };

  const handleIptal = () => {
    if (userRole === "uretim") {
      router.push("/admin/tamamlanan-isler");
    } else {
      router.push("/admin");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "work_orders"), { ...form, bildirenKisi: userName, durum: "Açık", kayitTarihi: serverTimestamp() });
      alert("İş emri açıldı.");
      handleIptal();
    } catch (e) { alert("Hata!"); }
  };

  if (loading) return <div className="p-10 text-white text-center italic">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-[3rem] w-full max-w-2xl shadow-2xl">
        <h2 className="text-3xl font-black text-white mb-10 italic uppercase tracking-tighter text-center">Yeni Üretim Bildirimi</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <select className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={form.hatAdi} onChange={e=>setForm({...form, hatAdi: e.target.value})} required>
              <option value="">Hat Seçiniz</option>
              {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input type="text" placeholder="Ekipman" className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={form.ekipmanAdi} onChange={e=>setForm({...form, ekipmanAdi: e.target.value})} required />
          </div>
          <textarea placeholder="Arıza Detayı" className="w-full bg-slate-950 border border-slate-800 p-6 rounded-2xl text-white outline-none focus:border-blue-500 h-40 resize-none" value={form.arizaDetayi} onChange={e=>setForm({...form, arizaDetayi: e.target.value})} required />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <button type="button" onClick={handleIptal} className="bg-slate-800 hover:bg-slate-700 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs">İPTAL</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl">YAYINLA</button>
          </div>
        </form>
      </div>
    </div>
  );
}