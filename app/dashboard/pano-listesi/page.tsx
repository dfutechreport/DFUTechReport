"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, addDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import DashboardReturn from "@/components/DashboardReturn";

export default function PanoListesi() {
  const [panolar, setPanolar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  // Pano Kayıt State'leri
  const [panoAdi, setPanoAdi] = useState("");
  const [panoYeri, setPanoYeri] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            setUserName(userSnap.data().name);
            fetchPanolar();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  // Pano Ekleme Fonksiyonu
  const handlePanoEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!panoAdi || !panoYeri) return alert("Lütfen pano adı ve yerini girin.");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "electrical_panels"), {
        panoAdi, panoYeri, ekleyenPersonel: userName, kayitTarihi: new Date()
      });
      alert("Pano başarıyla eklendi!");
      setPanoAdi(""); setPanoYeri("");
      fetchPanolar(); 
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu panoyu sistemden kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "electrical_panels", id)); fetchPanolar(); } catch (error) { alert("Hata."); }
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
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* BAŞLIK VE GERİ DÖNÜŞ PANELİ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-indigo-400">🔌 Sistemdeki Elektrik Panoları</h1>
            <p className="text-gray-400 mt-1">Tesis genelindeki panoların kaydı, listesi ve kontrol erişimi.</p>
          </div>
          <DashboardReturn />
        </div> {/* <--- Hata buradaydı, kapatma etiketi eklendi */}

        {/* PANO EKLEME FORMU */}
        <div className="bg-gray-900 border border-indigo-500/50 p-6 rounded-2xl shadow-[0_0_15px_rgba(99,102,241,0.15)] mb-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-auto flex-1">
            <label className="block text-sm text-indigo-300 font-bold mb-1">Yeni Pano Adı</label>
            <input type="text" value={panoAdi} onChange={e => setPanoAdi(e.target.value)} placeholder="Örn: MCC Ana Dağıtım" className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" />
          </div>
          <div className="w-full md:w-auto flex-1">
            <label className="block text-sm text-indigo-300 font-bold mb-1">Panonun Yeri (Hat/Bölge)</label>
            <input type="text" value={panoYeri} onChange={e => setPanoYeri(e.target.value)} placeholder="Örn: Kruvasan Hattı" className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none" />
          </div>
          <button onClick={handlePanoEkle} disabled={isSubmitting} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-lg shadow-lg disabled:opacity-50 h-[48px]">
            {isSubmitting ? "Ekleniyor..." : "Sisteme Ekle"}
          </button>
        </div>

        {/* PANO LİSTESİ TABLOSU */}
        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl shadow-lg overflow-x-auto">
          {panolar.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıtlı pano bulunmuyor. Lütfen yukarıdan ekleyin.</div> : (
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