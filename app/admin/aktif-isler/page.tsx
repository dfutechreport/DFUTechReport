"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function AktifIslerListesi() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const fetchOrders = async () => {
    try {
      // Sadece "Açık" (Tamamlanmamış) olan iş emirlerini getir
      const q = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const d = document.data();
        return {
          id: document.id, ...d,
          tarihFormatli: d.kayitTarihi ? d.kayitTarihi.toDate().toLocaleString('tr-TR') : "Bilinmiyor",
          gercekZaman: d.kayitTarihi ? d.kayitTarihi.toDate().getTime() : 0
        };
      });
      // En acil olan (En eski veya en yeni) sıralaması - En yeni en üstte
      setOrders(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchOrders();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Onayladıktan sonra süresini girmek için Arıza Formu otomatik olarak açılacaktır.")) return;

    try {
      // 1. İş Emrini Veritabanında "Kapalı" Yap
      await updateDoc(doc(db, "work_orders", islem.id), {
        durum: "Kapalı",
        tamamlayanKisi: userName,
        tamamlanmaTarihi: new Date()
      });

      // 2. Teknisyeni Arıza Ekranına (Forma) Verilerle Birlikte Fırlat
      window.location.href = `/dashboard?hat=${encodeURIComponent(islem.hatAdi)}&ekipman=${encodeURIComponent(islem.ekipmanAdi)}&sorun=${encodeURIComponent(islem.sorunTipi)}&duruslu=${islem.isDuruslu ? 'true' : 'false'}&aciklama=${encodeURIComponent(islem.aciklama)}`;
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-red-500 flex items-center gap-3">
              <span className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
              </span>
              Tüm Aktif İş Emirleri
            </h1>
            <p className="text-gray-400 mt-1">Üretimden veya yönetimden gelen, müdahale bekleyen tüm işlerin listesi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "uretim" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="bg-gray-900 border-2 border-red-900/50 p-4 md:p-6 rounded-xl shadow-2xl overflow-x-auto">
          {orders.length === 0 ? <div className="text-center py-10 text-gray-500 font-medium">Şu an tesiste bekleyen hiçbir aktif iş emri yok. Harika!</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Açılış Tarihi</th>
                  <th className="pb-3 px-2">Bildiren Kişi</th>
                  <th className="pb-3 px-2">Hat / Ekipman</th>
                  <th className="pb-3 px-2">Sorun Tipi</th>
                  <th className="pb-3 px-2 text-red-400">Duruş Var Mı?</th>
                  <th className="pb-3 px-2 min-w-[200px]">Arıza Detayı</th>
                  <th className="pb-3 px-2 text-right">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 text-gray-400 text-xs font-bold">{o.tarihFormatli}</td>
                    <td className="py-4 px-2 font-medium text-orange-300">{o.bildirenKisi}</td>
                    <td className="py-4 px-2"><div className="font-bold text-gray-200">{o.hatAdi}</div><div className="text-xs text-gray-500">{o.ekipmanAdi}</div></td>
                    <td className="py-4 px-2 text-gray-300">{o.sorunTipi}</td>
                    <td className="py-4 px-2">
                      {o.isDuruslu ? <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded font-bold border border-red-800/50">Kritik Duruş</span> : <span className="text-gray-500 text-xs">Hayır</span>}
                    </td>
                    <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{o.aciklama}</td>
                    <td className="py-4 px-2 text-right space-x-2">
                      <button 
                        onClick={() => handleIsiTamamla(o)} 
                        className="bg-green-600 hover:bg-green-500 text-white font-bold text-xs px-4 py-2 rounded shadow-lg transition"
                      >
                        ✅ İşi Tamamla
                      </button>
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