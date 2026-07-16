"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function KazanArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_kazan"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({ id: document.id, ...document.data() }));
      setLogs(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_kazan", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div><h1 className="text-2xl font-bold text-orange-500">🗄️ Kazan Dairesi Kontrol Arşivi</h1></div>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                  <th className="pb-3 px-2 text-orange-400">Kondens (°C)</th><th className="pb-3 px-2 text-orange-400">Buhar Sic. (°C)</th>
                  <th className="pb-3 px-2 text-orange-400">Basınç (Bar)</th><th className="pb-3 px-2 text-orange-400">İletkenlik</th>
                  <th className="pb-3 px-2 text-blue-400">Kimyasal Durumu</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-4 px-2 text-gray-300 font-bold">{log.tarih} <br/><span className="text-xs font-normal text-gray-500">{log.vardiya}</span></td>
                    <td className="py-4 px-2 font-medium text-blue-300">{log.personel}</td>
                    <td className="py-4 px-2 font-bold">{log.kondensSicaklik}</td>
                    <td className="py-4 px-2 font-bold">{log.buharSicaklik}</td>
                    <td className="py-4 px-2 font-bold">{log.buharBasinc}</td>
                    <td className="py-4 px-2 font-bold">{log.iletkenlik}</td>
                    <td className="py-4 px-2 text-xs">
                      {log.kimyasalDurum === "DOLU" ? <span className="text-green-400">DOLU</span> : <span className="text-red-400">EKLENDİ: {log.eklenenKimyasal}</span>}
                    </td>
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>
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