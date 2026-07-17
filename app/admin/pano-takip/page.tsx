"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PanoTakipArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "pano_takip"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        tarihFormatli: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().toLocaleString('tr-TR') : "-"
      }));
      setLogs(data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "uretim" || role === "ik") { window.location.href = "/"; } 
          else { setUserRole(role); fetchArsiv(); }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "pano_takip", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <h1 className="text-2xl font-bold text-indigo-500 print:text-black">🗄️ Pano Temizlik ve Takip Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">PDF Çıktısı Al</button>
              <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Kontrol Tarihi</th><th className="pb-3 px-2">Pano Adı</th><th className="pb-3 px-2">Pano Yeri</th><th className="pb-3 px-2 text-indigo-400 print:text-black">İşlem</th><th className="pb-3 px-2">Kontrol Eden</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 text-gray-300 print:text-black font-bold">{log.tarihFormatli}</td>
                      <td className="py-4 px-2 font-bold text-white print:text-black">{log.panoAdi}</td>
                      <td className="py-4 px-2 text-gray-400 print:text-black">{log.panoYeri}</td>
                      <td className="py-4 px-2 text-green-400 print:text-black font-bold">{log.islem}</td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      {userRole === "admin" && <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}