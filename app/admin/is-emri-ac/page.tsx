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
  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserName(uSnap.data().name);
          setUserRole(uSnap.data().role);
        }
      } else router.push("/");
      setLoading(false);
    });
  }, []);

  const handleIptal = () => {
    if (userRole === "uretim") {
      router.push("/admin/tamamlanan-isler");
    } else {
      router.push("/admin");
    }
  };

  if (loading) return <div className="p-10 text-white text-center">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-[3rem] w-full max-w-2xl shadow-2xl">
        <h2 className="text-3xl font-black text-white mb-10 italic uppercase text-center">Yeni Üretim Bildirimi</h2>
        <form className="space-y-6">
          <input type="text" placeholder="Ekipman Adı" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none" required />
          <textarea placeholder="Arıza Detayı" className="w-full bg-slate-950 border border-slate-800 p-6 rounded-2xl text-white outline-none h-40 resize-none" required />
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={handleIptal} className="bg-slate-800 hover:bg-slate-700 text-slate-400 py-5 rounded-2xl font-black uppercase text-xs">İPTAL</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black uppercase text-xs">BİLDİRİMİ YAYINLA</button>
          </div>
        </form>
      </div>
    </div>
  );
}