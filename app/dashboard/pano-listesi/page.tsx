"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function PanoListesi() {
  const [panolar, setPanolar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const fetchPanolar = async () => {
    try {
      const q = query(collection(db, "electrical_panels"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data()
      }));
      setPanolar(data);
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
            fetchPanolar();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu panoyu sistemden kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "electrical_panels", id)); fetchPanolar(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-indigo-400">🔌 Sistemdeki Elektrik Panoları</h1>
            <p className="text-gray-400 mt-1">Tesis genelindeki panoların listesi ve kontrol erişimi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl shadow-lg overflow-x-auto">
          {panolar.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıtlı pano bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Pano Adı</th>
                  <th className="pb-3 px-2">Bulunduğu Yer</th>
                  <th className="pb-3 px-2 text-gray-500">Ekleyen</th>
                  <th className="pb-3 px-2 text-right">Aksiyon (Kontrol)</th>
                </tr>
              </thead>
              <tbody>
                {panolar.map(pano => (
                  <tr key={pano.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                    <td className="py-4 px-2 font-bold text-white text-base">{pano.panoAdi}</td>
                    <td className="py-4 px-2 text-indigo-300 font-medium">{pano.panoYeri}</td>
                    <td className="py-4 px-2 text-gray-500 text-xs">{pano.ekleyenPersonel}</td>
                    <td className="py-4 px-2 text-right space-x-2 flex justify-end">
                      
                      {/* KONTROL FORMU BUTONU - TIKLAYINCA ID ve İSİM URL ÜZERİNDEN GİDECEK */}
                      <Link 
                        href={`/dashboard/pano-kontrol?id=${pano.id}&isim=${encodeURIComponent(pano.panoAdi)}&yer=${encodeURIComponent(pano.panoYeri)}`} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-lg transition"
                      >
                        ✅ Kontrol ve Temizlik Yap
                      </Link>

                      {userRole === "admin" && (
                        <button onClick={() => handleSil(pano.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded-lg transition border border-red-800/50">Sil</button>
                      )}
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