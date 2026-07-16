"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function MesaiRaporlari() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterPersonel, setFilterPersonel] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [personelListesi, setPersonelListesi] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          // Admin, Operatör veya IK görebilir
          if (role === "admin" || role === "operator" || role === "ik") {
            fetchData();
          } else {
            window.location.href = "/";
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "overtime_logs"), orderBy("tarih", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data);

      const yillar = new Set<string>();
      const personeller = new Set<string>();
      data.forEach((d: any) => {
        if (d.tarih) yillar.add(d.tarih.substring(0, 4));
        if (d.personel) personeller.add(d.personel);
      });
      setYilListesi(Array.from(yillar));
      setPersonelListesi(Array.from(personeller));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const filteredLogs = logs.filter(log => {
    const logYil = log.tarih ? log.tarih.substring(0, 4) : "";
    const logAy = log.tarih ? log.tarih.substring(5, 7) : "";
    const temizAy = filterAy ? filterAy.padStart(2, '0') : "";

    if (filterYil && logYil !== filterYil) return false;
    if (filterAy && logAy !== temizAy) return false;
    if (filterPersonel && log.personel !== filterPersonel) return false;
    return true;
  });

  const toplamDakika = filteredLogs.reduce((acc, curr) => acc + (curr.toplamMesaiDk || 0), 0);
  const toplamSaat = (toplamDakika / 60).toFixed(1);

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Raporlar çekiliyor...</div>;

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
              <h1 className="text-2xl md:text-3xl font-bold text-teal-400 print:text-black">Personel Mesai (Puantaj) Raporları</h1>
              <p className="text-gray-400 mt-1 print:text-black">Teknisyenlerin sahadan girdikleri fazla mesai, hafta sonu ve evden çağrılma dökümleri.</p>
            </div>
            
            <div className="flex gap-3 no-print">
              <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al
              </button>
              
              {/* İK is "Geri Dön" butonu yerine "Çıkış Yap" kullanır, çünkü gidecekleri başka sayfa yok. Diğerleri menüye döner. */}
              {userRole === "ik" ? (
                <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm transition">Çıkış Yap</button>
              ) : (
                <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
              )}
            </div>
          </div>

          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold text-black">Aylık Puantaj ve Mesai Dökümü</h2>
            <p className="text-gray-600">Rapor: {filterPersonel || "Tüm Personeller"} | Dönem: {filterYil || "Tümü"} - {filterAy ? `${filterAy}. Ay` : "Tümü"}</p>
            <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end no-print">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Yıl</label>
              <select value={filterYil} onChange={e => setFilterYil(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Ay</label>
              <select value={filterAy} onChange={e => setFilterAy(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tümü</option>{[...Array(12)].map((_, i) => <option key={i} value={i+1}>{i+1}. Ay</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-400 mb-1">Personel Seçimi</label>
              <select value={filterPersonel} onChange={e => setFilterPersonel(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm focus:border-teal-500">
                <option value="">Tüm Personeller</option>{personelListesi.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterPersonel("");}} className="bg-gray-800 text-gray-300 p-2 rounded-lg text-sm">Filtreyi Sıfırla</button>
            </div>
          </div>

          <div className="bg-teal-900/20 border border-teal-800/50 p-6 rounded-xl mb-8 flex justify-between items-center print:border-none print:bg-white print:p-0">
            <h2 className="text-xl font-bold print:text-black">Filtrelenen Toplam Hakediş Süresi:</h2>
            <p className="text-4xl font-bold text-teal-400 print:text-black">{toplamSaat} <span className="text-lg text-gray-400 print:text-black">Saat</span></p>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto print:border-none print:shadow-none print:p-0">
            {filteredLogs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt bulunmuyor.</div> : (
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                    <th className="pb-3 px-2">Tarih</th>
                    <th className="pb-3 px-2">Personel</th>
                    <th className="pb-3 px-2">Saat (Baş/Bit)</th>
                    <th className="pb-3 px-2">Mesai Türü</th>
                    <th className="pb-3 px-2">Evden Çağ.</th>
                    <th className="pb-3 px-2 text-teal-400 print:text-black">Hakediş (Saat)</th>
                    <th className="pb-3 px-2 min-w-[200px]">Açıklama</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                      <td className="py-3 px-2 print:text-black font-bold">{log.tarih}</td>
                      <td className="py-3 px-2 font-medium text-gray-200 print:text-black">{log.personel}</td>
                      <td className="py-3 px-2 print:text-black text-xs">{log.baslangicSaati} - {log.bitisSaati}</td>
                      <td className="py-3 px-2 text-gray-400 print:text-black text-xs">{log.mesaiTuru}</td>
                      <td className="py-3 px-2 text-orange-400 print:text-orange-600 font-bold">{log.evdenCagirma === "Var" ? "+2 S" : "-"}</td>
                      <td className="py-3 px-2 text-teal-400 print:text-black font-bold">{(log.toplamMesaiDk / 60).toFixed(1)}</td>
                      <td className="py-3 px-2 text-xs text-gray-400 print:text-black whitespace-normal break-words">{log.aciklama}</td>
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