"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function IsListesi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    // Sadece "Onaylı" olan tüm personellere izin ver
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists() || userSnap.data().isApproved !== true) {
          window.location.href = "/"; // Onaysızsa ana sayfaya at
        }
      } else {
        window.location.href = "/"; // Giriş yapmadıysa ana sayfaya at
      }
    });

    const fetchLogs = async () => {
      try {
        // En yeni kayıttan en eskiye doğru (desc) sıralı getir
        const q = query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"));
        const snap = await getDocs(q);
        
        const data = snap.docs.map(doc => {
          const logData = doc.data();
          return {
            id: doc.id,
            ...logData,
            // Tarihi okunabilir formata çevir
            tarihFormatli: logData.kayitTarihi ? logData.kayitTarihi.toDate().toLocaleString('tr-TR') : "Tarih Yok"
          };
        });
        
        setLogs(data);
      } catch (error) {
        console.error("Kayıtlar çekilirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Kayıtlar Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Tüm İşler / Seyir Defteri</h1>
            <p className="text-gray-400 mt-1">Sisteme girilen tüm arıza ve bakım kayıtlarının kronolojik listesi.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Dashboard'a Dön
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Henüz girilmiş bir iş/arıza kaydı bulunmuyor.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Kayıt Tarihi</th>
                  <th className="pb-3 px-2">Personel</th>
                  <th className="pb-3 px-2">Hat / Ekipman</th>
                  <th className="pb-3 px-2">Sorun Tipi</th>
                  <th className="pb-3 px-2">Duruş?</th>
                  <th className="pb-3 px-2 text-blue-400">Süre</th>
                  <th className="pb-3 px-2 w-1/3">Açıklama / Müdahale</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-400 text-xs">{log.tarihFormatli}</td>
                    <td className="py-4 px-2 font-medium text-blue-300">{log.bildirenKisi}</td>
                    <td className="py-4 px-2">
                      <div className="font-bold text-gray-200">{log.hatAdi}</div>
                      <div className="text-xs text-gray-500">{log.ekipmanAdi}</div>
                    </td>
                    <td className="py-4 px-2 text-gray-400">{log.sorunTipi}</td>
                    <td className="py-4 px-2">
                      {log.isDuruslu ? (
                        <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded border border-red-800/50">Evet</span>
                      ) : (
                        <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded border border-gray-700">Hayır</span>
                      )}
                    </td>
                    <td className="py-4 px-2 text-blue-400 font-bold">{log.toplamSureDakika} dk</td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-xs break-words">
                      {log.aciklama}
                    </td>
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