"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function YanginArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_yangin"), orderBy("kayitTarihi", "desc"));
      setLogs((await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role); fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Kalıcı olarak silinecek, emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_yangin", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <h1 className="text-2xl font-bold text-red-500">🗄️ Yangın Pompaları Arşivi</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                  <th className="pb-3 px-2 text-red-400">Sızıntı / Kaçak</th>
                  <th className="pb-3 px-2">Dizel Pompa</th><th className="pb-3 px-2">Elektrikli Pompa</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-4 px-2 font-bold">{log.tarih} <br/><span className="text-xs text-gray-500">{log.vardiya}</span></td>
                    <td className="py-4 px-2 text-blue-300">{log.personel}</td>
                    <td className="py-4 px-2 text-xs">{log.kacakDurum === "YOK" ? <span className="text-green-400">YOK</span> : <span className="text-red-400">VAR: {log.kacakDetay}</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.dizelPompaOk ? <span className="text-green-400">Sağlam</span> : <span className="text-red-400">Arıza: {log.dizelHata}</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.elektrikliPompaOk ? <span className="text-green-400">Sağlam</span> : <span className="text-red-400">Arıza: {log.elektrikliHata}</span>}</td>
                    {userRole === "admin" && <td className="py-4 px-2 text-right"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
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