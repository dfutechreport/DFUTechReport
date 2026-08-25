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
  const [userName, setUserName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchOrders();
        } else router.push("/");
      } else router.push("/");
    });
    return () => unsubscribe();
  }, []);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        tarihFormatli: document.data().tamamlanmaTarihi?.toDate().toLocaleString('tr-TR') || "Bilinmiyor"
      }));
      setOrders(data.sort((a, b) => b.tarihFormatli.localeCompare(a.tarihFormatli)));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">Veriler Çekiliyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* ÜRETİM HEADER VE AKSİYON BUTONLARI */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Üretim Paneli</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Kapatılan Bildirimler ve Performans Takibi</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/admin/is-emri-ac" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-900/20 transition-all">
              + Yeni İş Emri Aç
            </Link>
            <button onClick={handleLogout} className="bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-500 px-6 py-4 rounded-2xl font-bold text-xs uppercase border border-slate-700 transition-all">
              Çıkış
            </button>
          </div>
        </div>

        {/* TAMAMLANAN İŞLER LİSTESİ */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="p-6">Hat / Ekipman</th>
                <th className="p-6">Arıza Detayı</th>
                <th className="p-6">Bildiren</th>
                <th className="p-6 text-right">Kapanış Tarihi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-800/30 transition-all group">
                  <td className="p-6">
                    <p className="font-black text-slate-200 uppercase group-hover:text-blue-400">{order.ekipmanAdi}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{order.hatAdi}</p>
                  </td>
                  <td className="p-6 text-slate-400 font-medium italic">{order.arizaDetayi}</td>
                  <td className="p-6 font-bold text-slate-300">{order.bildirenKisi}</td>
                  <td className="p-6 text-right font-mono text-xs text-slate-500">{order.tarihFormatli}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}