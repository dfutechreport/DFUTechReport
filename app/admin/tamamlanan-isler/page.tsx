"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function TamamlananIsler() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchOrders();
        } else router.push("/");
      } else router.push("/");
    });
  }, []);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), 
        tarih: d.data().tamamlanmaTarihi?.toDate().toLocaleString('tr-TR') || "Bilinmiyor" 
      }));
      setOrders(data.sort((a, b) => b.tarih.localeCompare(a.tarih)));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="p-10 text-white italic text-center">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800">
          <div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">ÜRETİM PANELİ</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Kapatılan İş Emirleri Arşivi</p>
          </div>
          <div className="flex gap-4">
            <Link href="/admin/is-emri-ac" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl transition-all">+ YENİ İŞ EMRİ</Link>
            <button onClick={() => signOut(auth)} className="bg-slate-800 text-slate-400 px-6 py-3 rounded-2xl font-bold text-xs uppercase border border-slate-700">ÇIKIŞ</button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest">
              <tr><th className="p-6">Ekipman</th><th className="p-6">Arıza</th><th className="p-6 text-right">Kapanış</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-800/30 transition-all">
                  <td className="p-6 font-black text-slate-200 uppercase">{o.ekipmanAdi}<p className="text-[10px] text-slate-500">{o.hatAdi}</p></td>
                  <td className="p-6 text-slate-400 italic text-sm">{o.arizaDetayi}</td>
                  <td className="p-6 text-right font-mono text-xs text-slate-500">{o.tari}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}