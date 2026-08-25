"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

export default function IsEmriAc() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Form States
  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [arizaDetayi, setArizaDetayi] = useState("");
  const [oncelik, setOncelik] = useState("Normal");
  const [hatlar, setHatlar] = useState<string[]>([]);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserName(uSnap.data().name);
          setUserRole(uSnap.data().role);
          fetchAssets();
        }
      } else router.push("/");
      setLoading(false);
    });
  }, []);

  const fetchAssets = async () => {
    const aSnap = await getDocs(collection(db, "assets"));
    const hSet = new Set<string>();
    aSnap.forEach(d => { if(d.data().hatAdi) hSet.add(d.data().hatAdi); });
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
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "work_orders"), {
        hatAdi, ekipmanAdi, arizaDetayi, oncelik,
        bildirenKisi: userName,
        durum: "Açık",
        kayitTarihi: serverTimestamp()
      });
      alert("İş emri başarıyla yayınlandı.");
      handleIptal();
    } catch (e) { alert("Hata: " + e); }
    setIsSubmitting(false);
  };

  if (loading) return <div className="p-10 text-white italic text-center">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] w-full max-w-2xl shadow-2xl">
        <h2 className="text-3xl font-black text-white mb-8 italic uppercase tracking-tighter">Yeni Üretim Bildirimi</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <select className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={hatAdi} onChange={e=>setHatAdi(e.target.value)} required>
              <option value="">Hat Seçiniz</option>
              {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <input type="text" placeholder="Ekipman Adı" className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={ekipmanAdi} onChange={e=>setEkipmanAdi(e.target.value)} required />
          </div>

          <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:border-blue-500" value={oncelik} onChange={e=>setOncelik(e.target.value)}>
            <option value="Normal">Öncelik: Normal</option>
            <option value="Yüksek">Öncelik: Yüksek (Acil)</option>
            <option value="Kritik">Öncelik: Kritik (Üretim Duruyor)</option>
          </select>

          <textarea placeholder="Arıza / Bildirim Detayı" className="w-full bg-slate-950 border border-slate-800 p-6 rounded-2xl text-white outline-none focus:border-blue-500 h-32 resize-none" value={arizaDetayi} onChange={e=>setArizaDetayi(e.target.value)} required />

          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={handleIptal} className="bg-slate-800 hover:bg-slate-700 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs transition-all">İptal</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl transition-all">{isSubmitting ? "Yayınlanıyor..." : "Bildirimi Yayınla"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}