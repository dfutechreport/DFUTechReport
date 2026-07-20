"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PeriyodikBakimArsivi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // YENİ: FİLTRELER
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);

  const fetchArsiv = async () => {
    try {
      const q = query(collection(db, "pm_logs"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.kayitTarihi ? d.kayitTarihi.toDate().toLocaleString('tr-TR') : "-",
          gercekZaman: d.kayitTarihi ? d.kayitTarihi.toDate().getTime() : 0,
          yil: d.kayitTarihi ? d.kayitTarihi.toDate().getFullYear().toString() : "",
          ay: d.kayitTarihi ? (d.kayitTarihi.toDate().getMonth() + 1).toString() : ""
        };
      });

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      data.forEach(d => {
        if (d.yil) yillar.add(d.yil);
        if (d.hatAdi) hatlar.add(d.hatAdi);
      });
      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());

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
          if (role === "ik" || role === "uretim") {
            window.location.href = "/";
          } else {
            setUserRole(role);
            fetchArsiv();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu bakım kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "pm_logs", id)); fetchArsiv(); } catch (error) { alert("Hata."); }
  };

  const filteredLogs = logs.filter(log => {
    if (filterYil && log.yil !== filterYil) return false;
    if (filterAy && log.ay !== filterAy) return false;
    if (filterHat && log.hatAdi !== filterHat) return false;
    return true;
  });

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-teal-400 print:text-black">🗄️ Periyodik Bakım (PM) Arşivi</h1>
              <p className="text-gray-400 mt-1 print:text-black">Sahadan doldurulan tüm periyodik bakım (Checklist) formlarının dökümü.</p>
            </div>
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">PDF Çıktısı Al</button>
              <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
            </div>
          </div>

          {/* YENİ: PM ARŞİVİ FİLTRE ÇUBUĞU */}
          <div className="bg-gray-900 border border-teal-800/50 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Yıl</label>
              <select value={filterYil} onChange={e => setFilterYil(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Ay</label>
              <select value={filterAy} onChange={e => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-teal-400 font-bold mb-1">Üretim Hattı</label>
              <select value={filterHat} onChange={e => setFilterHat(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterHat("");}} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Periyodik Bakım (PM) Gerçekleşme Raporu</h2>
            <p className="text-gray-600">Filtre: Yıl {filterYil || "Tümü"} | Ay {filterAy || "Tümü"} | Hat {filterHat || "Tümü"}</p>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-teal-800/50 p-6 rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.15)] overflow-x-auto print:border-none print:shadow-none print:p-0">
            {filteredLogs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıtlı periyodik bakım formu bulunmuyor.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih / Vardiya</th>
                    <th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2 text-teal-400 print:text-black">Bakım Yapılan Makine</th>
                    <th className="pb-3 px-2">Periyot</th>
                    <th className="pb-3 px-2 text-red-400 print:text-black">Hatalı Madde / Check</th>
                    <th className="pb-3 px-2 min-w-[200px]">Açıklama</th>
                    {userRole === "admin" && <th className="pb-3 px-2 text-right no-print">Aksiyon</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2 text-gray-400 text-xs print:text-black font-bold">{log.tarihFormatli} <br/><span className="text-gray-500">{log.vardiya}</span></td>
                      <td className="py-4 px-2 font-medium text-blue-300 print:text-black">{log.personel}</td>
                      <td className="py-4 px-2 font-bold text-white print:text-black text-base">{log.makineKodu}</td>
                      <td className="py-4 px-2 text-gray-400 print:text-black text-xs">{log.bakimPeriyodu}</td>
                      <td className="py-4 px-2 font-bold">
                        {log.hataliMaddeSayisi > 0 ? (
                          <span className="bg-red-900/30 text-red-400 px-3 py-1 rounded-full border border-red-800/50 print:border-none print:text-red-700">
                            {log.hataliMaddeSayisi} Sorun Çıktı!
                          </span>
                        ) : (
                          <span className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full border border-green-800/50 print:border-none print:text-green-700">
                            Sorunsuz (0)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-gray-300 print:text-black text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{log.aciklama}</td>
                      
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right no-print">
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