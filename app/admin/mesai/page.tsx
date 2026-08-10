"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function MesaiRaporlari() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mesaiList, setMesaiList] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          setUserRole(role);
          // KRİTİK: TEKNİSYEN ROLÜNE GÖRÜNTÜLEME YETKİSİ VERİLDİ
          if (["admin", "operator", "teknisyen"].includes(role)) {
            setIsAuthorized(true);
            fetchMesaiRecords();
          }
        }
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchMesaiRecords = async () => {
    try {
      const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
      const snap = await getDocs(q);
      setMesaiList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;
  if (!isAuthorized) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold">BU SAYFAYI GÖRÜNTÜLEME YETKİNİZ YOK!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
           <h1 className="text-2xl font-black uppercase tracking-tighter text-amber-500">⏰ Mesai Kayıtları Arşivi</h1>
           <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700">Dashboard'a Dön</Link>
        </div>
        
        <div className="bg-gray-900 border border-gray-800 rounded-[30px] p-6 shadow-2xl">
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-4 px-2">Personel</th><th className="pb-4 px-2">Tarih</th><th className="pb-4 px-2">Süre</th><th className="pb-4 px-2">Açıklama</th></tr>
               </thead>
               <tbody className="text-sm">
                 {mesaiList.map((m, i) => (
                   <tr key={i} className="border-b border-gray-800/50 hover:bg-white/5 transition">
                     <td className="py-4 px-2 font-bold">{m.personelIsmi}</td>
                     <td className="py-4 px-2 text-gray-400">{m.tarih}</td>
                     <td className="py-4 px-2 text-amber-400 font-black">{m.sure} Saat</td>
                     <td className="py-4 px-2 text-gray-300 italic">"{m.aciklama}"</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
