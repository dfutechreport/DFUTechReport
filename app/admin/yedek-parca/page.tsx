"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function YedekParcaArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchArsiv = async () => {
    try {
      // Arıza kayıtları içinden sadece "yedekParcaKodu" boş olmayanları çek
      const q = query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.kayitTarihi ? d.kayitTarihi.toDate().toLocaleString('tr-TR') : "-",
          gercekZaman: d.kayitTarihi ? d.kayitTarihi.toDate().getTime() : 0
        };
      });
      
      // Filtreleme (Sadece yedek parça kodu dolu olanlar)
      const parcaKullanilanlar = data.filter(d => d.yedekParcaKodu && d.yedekParcaKodu.trim() !== "");
      setLogs(parcaKullanilanlar.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "admin" || role === "operator") {
            setUserRole(role);
            fetchArsiv();
          } else window.location.href = "/"; // Sadece Admin ve Operatör görebilir
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

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
              <h1 className="text-2xl md:text-3xl font-bold text-fuchsia-500 print:text-black">⚙️ Yedek Parça Kullanım Arşivi</h1>
              <p className="text-gray-400 mt-1 print:text-black">Tesis genelinde arıza ve bakımlarda kullanılan tüm yedek parçaların resmi dökümü.</p>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Aylık Yedek Parça Kullanım ve Sarfiyat Raporu</h2>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-fuchsia-800/50 p-6 rounded-2xl shadow-[0_0_20px_rgba(192,38,211,0.15)] overflow-x-auto print:border-none print:shadow-none print:p-0">
            {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kullanılan yedek parça kaydı bulunmuyor.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih</th>
                    <th className="pb-3 px-2">Kullanan Personel</th>
                    <th className="pb-3 px-2 text-fuchsia-400 print:text-black">Stok Kodu / Parça</th>
                    <th className="pb-3 px-2 text-fuchsia-400 print:text-black">Miktar</th>
                    <th className="pb-3 px-2">Üretim Hattı</th>
                    <th className="pb-3 px-2">Kullanılan Ekipman</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const ekipStr = Array.isArray(log.isiYapanlar) ? log.isiYapanlar.join(", ") : log.bildirenKisi;
                    return (
                      <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                        <td className="py-4 px-2 text-gray-400 text-xs print:text-black font-bold">{log.tarihFormatli}</td>
                        <td className="py-4 px-2 font-medium text-blue-300 print:text-black max-w-[150px] truncate" title={ekipStr}>{ekipStr}</td>
                        <td className="py-4 px-2 font-bold text-fuchsia-400 print:text-black text-lg">{log.yedekParcaKodu}</td>
                        <td className="py-4 px-2 font-bold text-gray-200 print:text-black">
                          <span className="bg-fuchsia-900/30 text-fuchsia-400 px-3 py-1 rounded-full border border-fuchsia-800/50 print:border-none print:bg-transparent print:text-black">
                            {log.yedekParcaMiktar} {log.yedekParcaBirim}
                          </span>
                        </td>
                        <td className="py-4 px-2 font-bold text-gray-300 print:text-black">{log.hatAdi}</td>
                        <td className="py-4 px-2 text-gray-400 text-xs print:text-black">{log.ekipmanAdi}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </>
  );
}