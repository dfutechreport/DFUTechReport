"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function EkedTakip() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [yer, setYer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEked = async () => {
    try {
      const q = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        gercekZaman: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().getTime() : 0
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
            window.location.href = "/admin/aktif-isler"; // Üretim giremez
          } else {
            setUserRole(role);
            setUserName(userSnap.data().name);
            fetchEked();
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleEkedEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yer) return alert("Lütfen uygulama yapılan yeri giriniz.");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "eked_logs"), {
        tarih: tarih,
        personel: userName,
        yer: yer,
        durum: "Açık",
        kayitTarihi: new Date(),
        kapatmaTarihi: null
      });
      alert("EKED - LOTO uygulaması başarıyla başlatıldı! Tüm panellerde alarm olarak görünecek.");
      setYer(""); fetchEked();
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  const handleEkedKaldir = async (id: string) => {
    if (!window.confirm("DİKKAT: Enerji kilidinin kaldırıldığını ve alanın emniyetli olduğunu onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "eked_logs", id), {
        durum: "Kapalı",
        kapatmaTarihi: new Date()
      });
      fetchEked();
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu kaydı tamamen silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "eked_logs", id)); fetchEked(); } catch (error) { alert("Hata."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-yellow-500 flex items-center gap-3">
              <span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-5 w-5 bg-yellow-500"></span></span>
              EKED - LOTO Takip Paneli
            </h1>
            <p className="text-gray-400 mt-1">Sahadaki kilitli (enerjisi kesilmiş) emniyetli alanların takibi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "isg" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* YENİ EKED FORMU */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border-2 border-yellow-600/50 p-6 rounded-2xl shadow-[0_0_20px_rgba(202,138,4,0.15)]">
              <h2 className="text-xl font-bold mb-6 text-yellow-500 flex items-center gap-2">🔒 Yeni EKED Başlat</h2>
              <form onSubmit={handleEkedEkle} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tarih</label>
                  <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Uygulamayı Yapan Personel</label>
                  <input type="text" value={userName} disabled className="w-full bg-gray-900 border-gray-700 rounded-lg p-3 text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Uygulama Yapılan Yer (Ekipman / Pano)</label>
                  <textarea value={yer} onChange={e => setYer(e.target.value)} placeholder="Örn: Paketleme Ana Panosu Şalteri" rows={3} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-bold py-3 rounded-lg shadow-lg disabled:opacity-50">
                  {isSubmitting ? "İşleniyor..." : "EKED Başlat (Kilitle)"}
                </button>
              </form>
            </div>
          </div>

          {/* AKTİF EKED LİSTESİ */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
              <h2 className="text-xl font-bold mb-4 text-white">Sahadaki Aktif Kilitler</h2>
              {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Şu an sahada aktif bir EKED uygulaması bulunmuyor.</div> : (
                <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="pb-3 px-2">Tarih</th>
                      <th className="pb-3 px-2">Uygulayan Personel</th>
                      <th className="pb-3 px-2">Uygulama Yeri</th>
                      <th className="pb-3 px-2 text-yellow-500">Durum</th>
                      <th className="pb-3 px-2 text-right">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                        <td className="py-4 px-2 text-gray-300 font-bold">{log.tarih}</td>
                        <td className="py-4 px-2 font-medium text-blue-300">{log.personel}</td>
                        <td className="py-4 px-2 text-gray-200 font-bold">{log.yer}</td>
                        <td className="py-4 px-2">
                          <span className="bg-yellow-900/40 text-yellow-500 text-xs px-2 py-1 rounded border border-yellow-700/50 animate-pulse">🔒 Kilitli</span>
                        </td>
                        <td className="py-4 px-2 text-right space-x-2">
                          <button onClick={() => handleEkedKaldir(log.id)} className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded shadow-lg">
                            ✅ İşlem Tamamlandı (Kilidi Aç)
                          </button>
                          {userRole === "admin" && <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded">Sil</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}