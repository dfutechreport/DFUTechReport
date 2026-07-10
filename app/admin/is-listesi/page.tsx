"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

export default function IsListesi() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // Düzenleme (Modal) State'leri
  const [editModalAcik, setEditModalAcik] = useState(false);
  const [duzenlenenIs, setDuzenlenenIs] = useState<any>(null);
  
  // Form State'leri (Sadece en çok hata yapılan kısımları düzeltmek için)
  const [editSure, setEditSure] = useState(0);
  const [editAciklama, setEditAciklama] = useState("");
  const [editDuruslu, setEditDuruslu] = useState(false);

  const fetchLogs = async () => {
    try {
      const q = query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      
      const data = snap.docs.map(document => {
        const logData = document.data();
        return {
          id: document.id,
          ...logData,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          fetchLogs();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  // SİLME İŞLEMİ (Sadece Admin)
  const handleSil = async (id: string) => {
    if (!window.confirm("DİKKAT: Bu arıza/bakım kaydını kalıcı olarak silmek istediğinize emin misiniz? Grafikler etkilenecektir.")) return;
    try {
      await deleteDoc(doc(db, "maintenance_logs", id));
      alert("Kayıt başarıyla silindi.");
      fetchLogs();
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Silme işlemi başarısız oldu.");
    }
  };

  // DÜZENLEME PENCERESİNİ AÇMA
  const handleDuzenleClick = (islem: any) => {
    setDuzenlenenIs(islem);
    setEditSure(islem.toplamSureDakika || 0);
    setEditAciklama(islem.aciklama || "");
    setEditDuruslu(islem.isDuruslu || false);
    setEditModalAcik(true);
  };

  // DEĞİŞİKLİKLERİ VERİTABANINA KAYDETME
  const handleDuzenlemeKaydet = async () => {
    if (editSure < 0) return alert("Süre sıfırdan küçük olamaz!");
    
    try {
      const isRef = doc(db, "maintenance_logs", duzenlenenIs.id);
      await updateDoc(isRef, {
        toplamSureDakika: Number(editSure),
        aciklama: editAciklama,
        isDuruslu: editDuruslu
      });
      alert("Kayıt başarıyla güncellendi.");
      setEditModalAcik(false);
      fetchLogs(); // Tabloyu yenile
    } catch (error) {
      console.error(error);
      alert("Güncelleme hatası.");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Kayıtlar Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 relative">
      
      {/* DÜZENLEME MODALI (Sadece butona basılınca açılır) */}
      {editModalAcik && duzenlenenIs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-gray-900 border border-blue-500 rounded-2xl shadow-2xl p-8 max-w-xl w-full">
            <h2 className="text-xl font-bold text-blue-400 mb-6 border-b border-gray-800 pb-3">Kayıt Düzenle</h2>
            
            <div className="space-y-4">
              <div className="text-sm text-gray-400 mb-4 bg-gray-800 p-3 rounded-lg">
                <span className="font-bold text-white">{duzenlenenIs.hatAdi}</span> - {duzenlenenIs.ekipmanAdi} <br/>
                Kayıt Eden: {duzenlenenIs.bildirenKisi}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Müdahale/Duruş Süresi (Dakika)</label>
                <input 
                  type="number" value={editSure} onChange={(e) => setEditSure(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Hat Duruşu Olarak Sayılsın mı?</label>
                <select 
                  value={editDuruslu ? "evet" : "hayir"} 
                  onChange={(e) => setEditDuruslu(e.target.value === "evet")}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white"
                >
                  <option value="evet">Evet, Hattı Durdurdu (Kırmızı Grafiğe Gider)</option>
                  <option value="hayir">Hayır, Hat Çalıştı (Sadece İş Adedine Gider)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Açıklama / Yapılan İş</label>
                <textarea 
                  value={editAciklama} onChange={(e) => setEditAciklama(e.target.value)} rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleDuzenlemeKaydet} className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-lg transition">Kaydet</button>
                <button onClick={() => setEditModalAcik(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 font-bold py-3 rounded-lg transition">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NORMAL LİSTE EKRANI */}
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Tüm İşler / Seyir Defteri</h1>
            <p className="text-gray-400 mt-1">Sisteme girilen tüm arıza ve bakım kayıtlarının kronolojik listesi.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Panele Dön
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
                  <th className="pb-3 px-2 w-1/4">Açıklama</th>
                  
                  {/* AKSİYON SÜTUNU SADECE ADMİNE GÖRÜNÜR */}
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
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
                    
                    {/* AKSİYON BUTONLARI (Sadece Admin) */}
                    {userRole === "admin" && (
                      <td className="py-4 px-2 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => handleDuzenleClick(log)} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white text-xs px-3 py-2 rounded transition border border-blue-800/50">
                          Düzenle
                        </button>
                        <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded transition border border-red-800/50">
                          Sil
                        </button>
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
  );
}