"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function EkedArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchEked = async () => {
    try {
      const q = query(collection(db, "eked_logs"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        gercekZaman: document.data().kapatmaTarihi ? document.data().kapatmaTarihi.toDate().getTime() : 0,
        kapatmaStr: document.data().kapatmaTarihi ? document.data().kapatmaTarihi.toDate().toLocaleString('tr-TR') : "-"
      }));
      setLogs(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim") {
            window.location.href = "/admin/aktif-isler";
          } else {
            setUserRole(role);
            fetchEked();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "eked_logs", id)); fetchEked(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-300 flex items-center gap-3">🗄️ EKED - LOTO Arşivi</h1>
            <p className="text-gray-400 mt-1">Geçmişte yapılmış ve tamamlanarak kilidi açılmış güvenlik uygulamaları.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Arşivde kayıt bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Uygulama Tarihi</th>
                  <th className="pb-3 px-2">Kaldırılma (Tamamlanma) Zamanı</th>
                  <th className="pb-3 px-2">Uygulayan Personel</th>
                  <th className="pb-3 px-2">Uygulama Yeri</th>
                  <th className="pb-3 px-2 text-green-500">Durum</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-300">{log.tarih}</td>
                    <td className="py-4 px-2 text-gray-400 text-xs">{log.kapatmaStr}</td>
                    <td className="py-4 px-2 font-medium text-blue-300">{log.personel}</td>
                    <td className="py-4 px-2 text-gray-200">{log.yer}</td>
                    <td className="py-4 px-2">
                      <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded border border-green-800/50">✅ Kilit Açıldı</span>
                    </td>
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right space-x-2">
                        <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded">Sil</button>
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