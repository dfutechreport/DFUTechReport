"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function TamamlananIsler() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [uretimPersonelleri, setUretimPersonelleri] = useState<string[]>([]);
  const [performansListesi, setPerformansListesi] = useState<any[]>([]);
  
  const [filterBildiren, setFilterBildiren] = useState("");
  const [filterAy, setFilterAy] = useState("");

  const fetchOrdersAndPerformans = async () => {
    try {
      const uQ = query(collection(db, "users"), where("role", "==", "uretim"));
      const uSnap = await getDocs(uQ);
      const uretimYetkilileriListesi = uSnap.docs.map(d => d.data().name);
      setUretimPersonelleri(uretimYetkilileriListesi.sort());

      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      
     const rawData: any[] = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().toLocaleString('tr-TR') : "Bilinmiyor",
          gercekZaman: d.tamamlanmaTarihi ? d.tamamlanmaTarihi.toDate().getTime() : 0,
          kayitAyi: d.kayitTarihi ? (d.kayitTarihi.toDate().getMonth() + 1).toString() : ""
        };
      });

      const filtrelenmisData = rawData.filter(d => {
        if (filterBildiren && d.bildirenKisi !== filterBildiren) return false;
        if (filterAy && d.kayitAyi !== filterAy) return false;
        return true;
      });
      setOrders(filtrelenmisData.sort((a, b) => b.gercekZaman - a.gercekZaman));

      const bildirimSayilari: Record<string, number> = {};
      rawData.forEach(d => {
        if (filterAy && d.kayitAyi !== filterAy) return;
        const bildiren = d.bildirenKisi;
        if (uretimYetkilileriListesi.includes(bildiren)) {
          if (!bildirimSayilari[bildiren]) bildirimSayilari[bildiren] = 0;
          bildirimSayilari[bildiren] += 1;
        }
      });

      const siralama = Object.keys(bildirimSayilari).map(k => ({
        isim: k, adet: bildirimSayilari[k]
      })).sort((a, b) => b.adet - a.adet);

      setPerformansListesi(siralama);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchOrdersAndPerformans();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, [filterBildiren, filterAy]); 

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu arşiv kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "work_orders", id)); fetchOrdersAndPerformans(); } catch (error) { alert("Hata"); }
  };

  const handleGeriAl = async (id: string) => {
    if (!window.confirm("Bu iş yanlışlıkla tamamlandıysa tekrar 'Aktif Bekleyen İşler' listesine göndermek ister misiniz?")) return;
    try { 
      await updateDoc(doc(db, "work_orders", id), { durum: "Açık", tamamlayanKisi: "", tamamlanmaTarihi: null });
      fetchOrdersAndPerformans(); 
    } catch (error) { alert("Hata"); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-green-400">Tamamlanmış İş Emirleri Arşivi</h1>
            <p className="text-gray-400 mt-1">Teknisyenler tarafından çözülen ve kapatılan iş taleplerinin arşivi.</p>
          </div>
         <Link href={userRole === "uretim" || userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← İzleme Paneline Dön</Link>
        </div>

        {/* FİLTRELEME ÇUBUĞU */}
        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Kayıt Ayı</label>
            <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm">
              <option value="">Tüm Aylar</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-purple-400 mb-1 font-bold">Bildiren Kişi (Üretim Yetkilisi)</label>
            <select value={filterBildiren} onChange={(e) => setFilterBildiren(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm">
              <option value="">Tüm Personeller</option>{uretimPersonelleri.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <button onClick={() => { setFilterAy(""); setFilterBildiren(""); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
        </div>

        {/* LİSTE */}
        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl shadow-lg overflow-x-auto mb-10">
          {orders.length === 0 ? <div className="text-center py-10 text-gray-500">Bu filtrelere uygun tamamlanmış iş emri bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tamamlanma Tarihi</th><th className="pb-3 px-2 text-purple-400">Bildiren (Üretim)</th><th className="pb-3 px-2 text-green-400">Kapatan (Teknisyen)</th><th className="pb-3 px-2">Hat / Ekipman</th><th className="pb-3 px-2 min-w-[200px]">Arıza Tanımı</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-400 text-xs">{o.tarihFormatli}</td>
                    <td className="py-4 px-2 font-bold text-purple-400">{o.bildirenKisi}</td>
                    <td className="py-4 px-2 font-bold text-green-400">{o.tamamlayanKisi}</td>
                    <td className="py-4 px-2"><div className="font-bold text-gray-200">{o.hatAdi}</div><div className="text-xs text-gray-500">{o.ekipmanAdi} ({o.sorunTipi})</div></td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{o.aciklama}</td>
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right space-x-2">
                        <button onClick={() => handleGeriAl(o.id)} className="bg-orange-900/50 text-orange-400 text-xs px-3 py-2 rounded mb-1">Geri Al</button>
                        <button onClick={() => handleSil(o.id)} className="bg-red-900/50 text-red-400 text-xs px-3 py-2 rounded">Sil</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ÜRETİM YETKİLİSİ LİDERLİK TABLOSU */}
        <div className="bg-gray-900 border border-purple-700/50 p-4 md:p-6 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.1)] overflow-x-auto">
          <h2 className="text-xl font-bold mb-6 text-purple-400 flex items-center gap-2">Üretim Yetkilisi Bildirim Performansı (İlk 3 Lider)</h2>
          {performansListesi.length === 0 ? <div className="text-gray-500 py-4">Filtreye uygun bildirim yapan üretim yetkilisi bulunamadı.</div> : (
            <table className="w-full text-left text-sm md:text-base border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-4">Sıralama</th><th className="pb-3 px-4">Üretim Yetkilisi Adı</th><th className="pb-3 px-4 text-purple-400">Açtığı İş Emri / Bildirim Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {performansListesi.slice(0, 3).map((p, index) => (
                  <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-4 text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</td>
                    <td className="py-4 px-4 font-bold text-gray-200">{p.isim}</td>
                    <td className="py-4 px-4"><span className="bg-purple-900/30 text-purple-400 font-bold px-4 py-1 rounded-full border border-purple-800/50">{p.adet} Adet Bildirim</span></td>
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