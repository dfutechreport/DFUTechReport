"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, deleteDoc } from "firebase/firestore";
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
      {/* PDF YAZDIRMA STİLLERİ */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-300 flex items-center gap-3 print:text-black">
                <span className="no-print">🗄️</span> EKED - LOTO Arşivi (İSG)
              </h1>
              <p className="text-gray-400 mt-1 print:text-black">Geçmişte yapılmış ve tamamlanarak kilidi açılmış güvenlik uygulamaları.</p>
            </div>
            <div className="flex gap-3 no-print">
              {/* YENİ: PDF ÇIKTISI AL BUTONU */}
              <button 
                onClick={() => window.print()} 
                className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm md:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF Çıktısı Al
              </button>
             <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          {/* Sadece PDF'te çıkacak başlık */}
          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">İSG - Tamamlanmış EKED (LOTO) Kayıt Raporu</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
            {logs.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Arşivde kayıt bulunmuyor.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Uygulama Tarihi</th>
                    <th className="pb-3 px-2">Kaldırılma (Tamamlanma) Zamanı</th>
                    <th className="pb-3 px-2">Uygulayan Personel</th>
                    <th className="pb-3 px-2">Uygulama Yeri</th>
                    <th className="pb-3 px-2 text-green-500 print:text-black">Durum</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2 text-gray-300 print:text-black">{log.tarih}</td>
                      <td className="py-4 px-2 text-gray-400 text-xs print:text-black font-bold">{log.kapatmaStr}</td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 text-gray-200 print:text-black">{log.yer}</td>
                      <td className="py-4 px-2">
                        <span className="bg-green-900/30 text-green-400 print:text-green-700 print:font-bold text-xs px-2 py-1 rounded border border-green-800/50 print:border-none">
                          Kilit Açıldı
                        </span>
                      </td>
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right space-x-2 no-print">
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
    </>
  );
}