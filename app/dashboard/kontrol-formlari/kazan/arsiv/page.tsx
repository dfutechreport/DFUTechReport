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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .bg-gray-950, .bg-gray-900 { background: white !important; }
          .text-white, .text-gray-400 { color: black !important; }
          .border-gray-800, .border-gray-700 { border-color: #ddd !important; }
          .shadow-lg { box-shadow: none !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-orange-500 print:text-black">🗄️ Kazan Dairesi Kontrol Arşivi</h1>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition hover:bg-gray-700">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Kazan Dairesi Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-orange-400 print:text-black">Kondens (°C)</th><th className="pb-3 px-2 text-orange-400 print:text-black">Buhar Sic. (°C)</th>
                    <th className="pb-3 px-2 text-orange-400 print:text-black">Basınç (Bar)</th><th className="pb-3 px-2 text-orange-400 print:text-black">İletkenlik</th>
                    <th className="pb-3 px-2 text-blue-400 print:text-black">Kimyasal Durumu</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 text-gray-300 print:text-black font-bold">{log.tarih} <br/><span className="text-xs font-normal text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.kondensSicaklik}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.buharSicaklik}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.buharBasinc}</td>
                      <td className="py-4 px-2 font-bold print:text-black">{log.iletkenlik}</td>
                      <td className="py-4 px-2 text-xs print:text-black">
                        {log.kimyasalDurum === "DOLU" ? <span className="text-green-400 print:text-black font-bold">DOLU</span> : <span className="text-red-400 print:text-black font-bold">EKLENDİ: {log.eklenenKimyasal}</span>}
                      </td>
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right no-print"><button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-3 py-1 rounded text-xs">Sil</button></td>
                      )}
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