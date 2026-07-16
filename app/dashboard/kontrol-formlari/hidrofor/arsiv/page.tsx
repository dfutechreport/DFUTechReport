"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function HidroforArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "form_hidrofor"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role); fetchArsiv();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "form_hidrofor", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <h1 className="text-2xl font-bold text-blue-500">🗄️ Hidrofor Dairesi Kontrol Arşivi</h1>
          <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt yok.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                  <th className="pb-3 px-2">Sertlik</th><th className="pb-3 px-2">Ham Su</th><th className="pb-3 px-2">Yangın P.</th><th className="pb-3 px-2">Yumuşak Su</th>
                  <th className="pb-3 px-2">Tuz Durumu</th><th className="pb-3 px-2 text-red-400">Kaçak Kontrolü</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-4 px-2 font-bold">{log.tarih} <br/><span className="text-xs font-normal text-gray-500">{log.vardiya}</span></td>
                    <td className="py-4 px-2 text-blue-300">{log.personel}</td>
                    <td className="py-4 px-2 font-bold">{log.sertlikSonucu}</td>
                    <td className="py-4 px-2 text-xs">{log.hamSuDeposuOk ? <span className="text-green-400">Normal</span> : <span className="text-red-400">Hatalı</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.yanginPompasiOk ? <span className="text-green-400">Normal</span> : <span className="text-red-400">Hatalı</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.yumusakSuDeposuOk ? <span className="text-green-400">Normal</span> : <span className="text-red-400">Hatalı</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.tuzSeviyesiOk ? <span className="text-green-400">Tam</span> : <span className="text-orange-400">Eklendi: {log.eklenenTuzKg}kg</span>}</td>
                    <td className="py-4 px-2 text-xs">{log.kacakDurum === "YOK" ? <span className="text-green-400">YOK</span> : <span className="text-red-400">VAR: {log.kacakDetayi}</span>}</td>
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