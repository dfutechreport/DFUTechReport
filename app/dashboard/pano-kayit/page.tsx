"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function PanoKayit() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [panoAdi, setPanoAdi] = useState("");
  const [panoYeri, setPanoYeri] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          // İSG ve İK pano ekleyemez
          if (role === "isg" || role === "ik" || role === "uretim") {
            window.location.href = "/";
          } else {
            setUserRole(role);
            setUserName(userSnap.data().name);
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panoAdi || !panoYeri) return alert("Lütfen tüm alanları doldurun.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "electrical_panels"), {
        panoAdi,
        panoYeri,
        ekleyenPersonel: userName,
        kayitTarihi: new Date()
      });
      alert("Pano başarıyla sisteme kaydedildi!");
      setPanoAdi(""); setPanoYeri("");
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto bg-gray-900 border border-indigo-500/50 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-indigo-400 flex items-center gap-2">🔌 Yeni Pano Kayıt Formu</h1>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">İptal</Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Elektrik Panosunun Adı</label>
            <input 
              type="text" value={panoAdi} onChange={e => setPanoAdi(e.target.value)} 
              placeholder="Örn: MCC Ana Dağıtım Panosu" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Panonun Bulunduğu Yer (Hat / Bölge)</label>
            <input 
              type="text" value={panoYeri} onChange={e => setPanoYeri(e.target.value)} 
              placeholder="Örn: Kruvasan Hattı 2. Kat" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 transition">
            {isSubmitting ? "Kaydediliyor..." : "Panoyu Sisteme Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}