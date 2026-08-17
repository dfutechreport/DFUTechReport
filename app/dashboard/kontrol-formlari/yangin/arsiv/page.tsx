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

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`YÜKLENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

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
            <h1 className="text-2xl font-bold text-red-500 print:text-black">🗄️ Yangın Pompaları Arşivi</h1>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              <Link href="/dashboard/kontrol-formlari" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Menüye Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Yangın Pompaları Periyodik Kontrol Dökümü</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center text-gray-500 py-10">Kayıt yok.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-red-400 print:text-black">Sızıntı / Kaçak</th>
                    <th className="pb-3 px-2">Dizel Pompa</th><th className="pb-3 px-2">Elektrikli Pompa</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50">
                      <td className="py-4 px-2 font-bold print:text-black">{log.tarih} <br/><span className="text-xs text-gray-500 print:text-black">{log.vardiya}</span></td>
                      <td className="py-4 px-2 text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.kacakDurum === "YOK" ? <span className="text-green-400 print:text-black font-bold">YOK</span> : <span className="text-red-400 print:text-black font-bold">VAR: {log.kacakDetay}</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.dizelPompaOk ? <span className="text-green-400 print:text-black font-bold">Sağlam</span> : <span className="text-red-400 print:text-black font-bold">Arıza: {log.dizelHata}</span>}</td>
                      <td className="py-4 px-2 text-xs print:text-black">{log.elektrikliPompaOk ? <span className="text-green-400 print:text-black font-bold">Sağlam</span> : <span className="text-red-400 print:text-black font-bold">Arıza: {log.elektrikliHata}</span>}</td>
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