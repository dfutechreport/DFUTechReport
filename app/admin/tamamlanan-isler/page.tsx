"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function TamamlananIsler() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchOrders = async () => {
    try {
      // Sadece "Kapalı" olan iş emirlerini getir
      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().toLocaleString('tr-TR') : "Bilinmiyor",
          gercekZaman: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().getTime() : 0
        };
      });
      // En son tamamlanan en üste
      setOrders(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchOrders();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "work_orders", id)); fetchOrders(); } catch (error) { alert("Hata"); }
  };

  const handleGeriAl = async (id: string) => {
    if (!window.confirm("Bu işi yanlışlıkla tamamlandıysa tekrar 'Aktif Bekleyen İşler' listesine göndermek ister misiniz?")) return;
    try { 
      await updateDoc(doc(db, "work_orders", id), { durum: "Açık", tamamlayanKisi: "", tamamlanmaTarihi: null });
      fetchOrders(); 
    } catch (error) { alert("Hata"); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-green-400">Tamamlanmış Üretim Bildirimleri</h1>
            <p className="text-gray-400 mt-1">Teknisyenler tarafından çözülen ve kapatılan iş taleplerinin arşivi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "uretim" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl shadow-lg overflow-x-auto">
          {orders.length === 0 ? <div className="text-center py-10 text-gray-500">Tamamlanmış iş emri bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tamamlanma Tarihi</th>
                  <th className="pb-3 px-2">Bildiren (Üretim)</th>
                  <th className="pb-3 px-2 text-green-400">Kapatan (Teknisyen)</th>
                  <th className="pb-3 px-2">Hat / Ekipman</th>
                  <th className="pb-3 px-2 min-w-[200px]">Arıza Tanımı</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon (Admin)</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-400 text-xs">{o.tarihFormatli}</td>
                    <td className="py-4 px-2 font-medium text-orange-300">{o.bildirenKisi}</td>
                    <td className="py-4 px-2 font-bold text-green-400">{o.tamamlayanKisi}</td>
                    <td className="py-4 px-2"><div className="font-bold text-gray-200">{o.hatAdi}</div><div className="text-xs text-gray-500">{o.ekipmanAdi} ({o.sorunTipi})</div></td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{o.aciklama}</td>
                    
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right space-x-2">
                        <button onClick={() => handleGeriAl(o.id)} className="bg-orange-900/50 hover:bg-orange-600 text-orange-400 hover:text-white text-xs px-3 py-2 rounded mb-1 border border-orange-800/50">Geri Al</button>
                        <button onClick={() => handleSil(o.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded border border-red-800/50">Sil</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}