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

  const [editModalAcik, setEditModalAcik] = useState(false);
  const [duzenlenenIs, setDuzenlenenIs] = useState<any>(null);
  
  // YENİ: Saat bazlı form state'leri
  const [editBaslangic, setEditBaslangic] = useState("");
  const [editBitis, setEditBitis] = useState("");
  const [hesaplananSure, setHesaplananSure] = useState(0);
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
    } catch (error) { console.error(error); } finally { setLoading(false); }
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

  // YENİ: Başlangıç ve Bitiş saatleri değiştikçe süreyi otomatik hesapla
  useEffect(() => {
    if (editBaslangic && editBitis) {
      const baslangic = new Date(editBaslangic).getTime();
      const bitis = new Date(editBitis).getTime();
      const farkDakika = Math.floor((bitis - baslangic) / 60000);
      setHesaplananSure(Math.max(0, farkDakika));
    } else {
      setHesaplananSure(0);
    }
  }, [editBaslangic, editBitis]);

  const handleSil = async (id: string) => {
    if (!window.confirm("DİKKAT: Bu arıza/bakım kaydını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "maintenance_logs", id));
      alert("Kayıt silindi.");
      fetchLogs();
    } catch (error) { alert("Silme işlemi başarısız oldu."); }
  };

  const handleDuzenleClick = (islem: any) => {
    setDuzenlenenIs(islem);
    setEditBaslangic(islem.baslangicSaati || "");
    setEditBitis(islem.bitisSaati || "");
    setEditAciklama(islem.aciklama || "");
    setEditDuruslu(islem.isDuruslu || false);
    setEditModalAcik(true);
  };

  const handleDuzenlemeKaydet = async () => {
    if (!editBaslangic || !editBitis) return alert("Lütfen başlangıç ve bitiş saatlerini girin!");
    if (new Date(editBitis) < new Date(editBaslangic)) return alert("Bitiş saati başlangıçtan önce olamaz!");
    
    try {
      const isRef = doc(db, "maintenance_logs", duzenlenenIs.id);
      await updateDoc(isRef, {
        baslangicSaati: editBaslangic,
        bitisSaati: editBitis,
        toplamSureDakika: hesaplananSure, // Hesaplanan süreyi DB'ye atıyoruz
        aciklama: editAciklama,
        isDuruslu: editDuruslu
      });
      alert("Kayıt başarıyla güncellendi.");
      setEditModalAcik(false);
      fetchLogs(); 
    } catch (error) { alert("Güncelleme hatası."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Kayıtlar Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 relative">
      
      {editModalAcik && duzenlenenIs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-gray-900 border border-blue-500 rounded-2xl shadow-2xl p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-blue-400 mb-6 border-b border-gray-800 pb-3">Kayıt Düzenle (Admin)</h2>
            
            <div className="space-y-4">
              <div className="text-sm text-gray-400 mb-4 bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-bold text-white">{duzenlenenIs.hatAdi}</span> - {duzenlenenIs.ekipmanAdi} <br/>
                  Personel: {duzenlenenIs.bildirenKisi}
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">Mevcut Sistem Süresi</span><br/>
                  <span className="font-bold text-red-400">{duzenlenenIs.toplamSureDakika} dk</span>
                </div>
              </div>

              {/* SAAT DÜZENLEME ALANI */}
              <div className="grid grid-cols-2 gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Başlangıç Saati</label>
                  <input type="datetime-local" value={editBaslangic} onChange={(e) => setEditBaslangic(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bitiş Saati</label>
                  <input type="datetime-local" value={editBitis} onChange={(e) => setEditBitis(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500" />
                </div>
                <div className="col-span-2 text-center pt-2 border-t border-gray-700 mt-2">
                  <p className="text-sm text-gray-400">Yeni Hesaplanacak Süre</p>
                  <p className="text-2xl font-bold text-blue-400">{hesaplananSure} <span className="text-sm">dk</span></p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Hat Duruşu Olarak Sayılsın mı?</label>
                <select value={editDuruslu ? "evet" : "hayir"} onChange={(e) => setEditDuruslu(e.target.value === "evet")} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500">
                  <option value="evet">Evet, Hattı Durdurdu</option>
                  <option value="hayir">Hayır, Hat Çalıştı</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Açıklama / Yapılan İş</label>
                <textarea value={editAciklama} onChange={(e) => setEditAciklama(e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500" />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleDuzenlemeKaydet} disabled={hesaplananSure <= 0} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold py-3 rounded-lg transition">Değişikliği Onayla</button>
                <button onClick={() => setEditModalAcik(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 font-bold py-3 rounded-lg transition">Vazgeç</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LİSTE */}
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
                  <th className="pb-3 px-2">Saatler</th>
                  <th className="pb-3 px-2">Duruş?</th>
                  <th className="pb-3 px-2 text-blue-400">Süre</th>
                  <th className="pb-3 px-2 w-1/4">Açıklama</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  // Tabloda Başlangıç ve Bitişi de kısa formatta gösterelim
                  const basSaatiStr = log.baslangicSaati ? new Date(log.baslangicSaati).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) : "-";
                  const bitSaatiStr = log.bitisSaati ? new Date(log.bitisSaati).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) : "-";

                  return (
                    <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2 text-gray-400 text-xs">{log.tarihFormatli}</td>
                      <td className="py-4 px-2 font-medium text-blue-300">{log.bildirenKisi}</td>
                      <td className="py-4 px-2">
                        <div className="font-bold text-gray-200">{log.hatAdi}</div>
                        <div className="text-xs text-gray-500">{log.ekipmanAdi}</div>
                      </td>
                      <td className="py-4 px-2 text-orange-300 font-medium">
                        {basSaatiStr} - {bitSaatiStr}
                      </td>
                      <td className="py-4 px-2">
                        {log.isDuruslu ? <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded border border-red-800/50">Evet</span> : <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded border border-gray-700">Hayır</span>}
                      </td>
                      <td className="py-4 px-2 text-blue-400 font-bold">{log.toplamSureDakika} dk</td>
                      <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-xs break-words">{log.aciklama}</td>
                      
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right space-x-2 whitespace-nowrap">
                          <button onClick={() => handleDuzenleClick(log)} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white text-xs px-3 py-2 rounded transition border border-blue-800/50">Düzenle</button>
                          <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded transition border border-red-800/50">Sil</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}