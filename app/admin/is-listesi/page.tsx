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
  
  const [editBaslangic, setEditBaslangic] = useState("");
  const [editBitis, setEditBitis] = useState("");
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [editAciklama, setEditAciklama] = useState("");
  const [editDuruslu, setEditDuruslu] = useState(false);
  const [editVardiya, setEditVardiya] = useState("");
  const [editIsiYapanlarText, setEditIsiYapanlarText] = useState(""); 

  const fetchLogs = async () => {
    try {
      const q = query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => {
        const logData = document.data();
        return {
          id: document.id, ...logData,
          tarihFormatli: logData.kayitTarihi ? logData.kayitTarihi.toDate().toLocaleString('tr-TR') : "Tarih Yok",
          gercekZaman: logData.kayitTarihi ? logData.kayitTarihi.toDate().getTime() : 0
        };
      });
      const siraliData = data.sort((a, b) => b.gercekZaman - a.gercekZaman);
      setLogs(siraliData);
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

  useEffect(() => {
    if (editBaslangic && editBitis) {
      const baslangic = new Date(editBaslangic).getTime();
      const bitis = new Date(editBitis).getTime();
      setHesaplananSure(Math.max(0, Math.floor((bitis - baslangic) / 60000)));
    } else setHesaplananSure(0);
  }, [editBaslangic, editBitis]);

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu kaydı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "maintenance_logs", id)); fetchLogs(); } 
    catch (error) { alert("Silme başarısız."); }
  };

  const handleDuzenleClick = (islem: any) => {
    setDuzenlenenIs(islem);
    setEditBaslangic(islem.baslangicSaati || ""); setEditBitis(islem.bitisSaati || "");
    setEditAciklama(islem.aciklama || ""); setEditDuruslu(islem.isDuruslu || false);
    setEditVardiya(islem.vardiya || "");
    const yapanlarDizisi = Array.isArray(islem.isiYapanlar) ? islem.isiYapanlar : [islem.bildirenKisi];
    setEditIsiYapanlarText(yapanlarDizisi.join(", "));
    setEditModalAcik(true);
  };

  const handleDuzenlemeKaydet = async () => {
    if (!editBaslangic || !editBitis) return alert("Saatler eksik!");
    if (new Date(editBitis) < new Date(editBaslangic)) return alert("Bitiş başlangıçtan önce olamaz!");
    try {
      const isRef = doc(db, "maintenance_logs", duzenlenenIs.id);
      const yeniYapanlar = editIsiYapanlarText.split(",").map(i => i.trim()).filter(i => i !== "");
      await updateDoc(isRef, {
        baslangicSaati: editBaslangic, bitisSaati: editBitis, toplamSureDakika: hesaplananSure, aciklama: editAciklama, isDuruslu: editDuruslu, vardiya: editVardiya, isiYapanlar: yeniYapanlar
      });
      alert("Kayıt güncellendi."); setEditModalAcik(false); fetchLogs(); 
    } catch (error) { alert("Güncelleme hatası."); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Kayıtlar Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      
      {editModalAcik && duzenlenenIs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-gray-900 border border-blue-500 rounded-2xl shadow-2xl p-8 max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-blue-400 mb-6 border-b border-gray-800 pb-3">Kayıt Düzenle (Admin)</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vardiya</label>
                  <select value={editVardiya} onChange={(e) => setEditVardiya(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm">
                    <option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
                  </select>
                </div>
                <div><label className="block text-sm text-gray-400 mb-1">İşi Yapanlar (Virgülle Ayırın)</label><input type="text" value={editIsiYapanlarText} onChange={(e) => setEditIsiYapanlarText(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-white text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                <div><label className="block text-sm text-gray-400 mb-1">Başlangıç Saati</label><input type="datetime-local" value={editBaslangic} onChange={(e) => setEditBaslangic(e.target.value)} className="w-full bg-gray-900 border-gray-700 rounded-lg p-3 text-white text-sm" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Bitiş Saati</label><input type="datetime-local" value={editBitis} onChange={(e) => setEditBitis(e.target.value)} className="w-full bg-gray-900 border-gray-700 rounded-lg p-3 text-white text-sm" /></div>
                <div className="col-span-2 text-center pt-2 border-t border-gray-700 mt-2"><p className="text-sm text-gray-400">Yeni Süre</p><p className="text-2xl font-bold text-blue-400">{hesaplananSure} <span className="text-sm">dk</span></p></div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hat Duruşu Olarak Sayılsın mı?</label>
                <select value={editDuruslu ? "evet" : "hayir"} onChange={(e) => setEditDuruslu(e.target.value === "evet")} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white">
                  <option value="evet">Evet, Hattı Durdurdu</option><option value="hayir">Hayır, Hat Çalıştı</option>
                </select>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Açıklama / Yapılan İş</label><textarea value={editAciklama} onChange={(e) => setEditAciklama(e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" /></div>
              <div className="flex gap-4 pt-4">
                <button onClick={handleDuzenlemeKaydet} disabled={hesaplananSure <= 0} className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-lg transition">Kaydet</button>
                <button onClick={() => setEditModalAcik(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 font-bold py-3 rounded-lg transition">Vazgeç</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div><h1 className="text-2xl md:text-3xl font-bold text-blue-400">Yapılan İşler Listesi</h1><p className="text-gray-400 mt-1">Sisteme girilen tüm kayıtlar.</p></div>
          
          {/* YENİ: Uretim yetkilisi Panele dönebilir */}
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "uretim" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Panele Dön
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-xl shadow-lg overflow-x-auto">
          {logs.length === 0 ? <div className="text-center py-10 text-gray-500">Kayıt bulunmuyor.</div> : (
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih / Vardiya</th><th className="pb-3 px-2">İşi Yapan Ekip</th><th className="pb-3 px-2">Hat / Ekipman</th><th className="pb-3 px-2">Saatler</th><th className="pb-3 px-2">Duruş?</th><th className="pb-3 px-2 text-blue-400">Süre</th><th className="pb-3 px-2 min-w-[200px]">Açıklama</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const basSaatiStr = log.baslangicSaati ? new Date(log.baslangicSaati).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) : "-";
                  const bitSaatiStr = log.bitisSaati ? new Date(log.bitisSaati).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) : "-";
                  const ekipStr = Array.isArray(log.isiYapanlar) ? log.isiYapanlar.join(", ") : log.bildirenKisi;
                  return (
                    <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-2"><div className="text-gray-400 text-xs">{log.tarihFormatli}</div><div className="font-bold text-yellow-500 text-xs mt-1 bg-yellow-900/30 inline-block px-2 py-0.5 rounded">{log.vardiya || "Vardiya Yok"}</div></td>
                      <td className="py-4 px-2 font-medium text-blue-300 max-w-[150px] truncate" title={ekipStr}>{ekipStr}</td>
                      <td className="py-4 px-2"><div className="font-bold text-gray-200">{log.hatAdi}</div><div className="text-xs text-gray-500">{log.ekipmanAdi}</div></td>
                      <td className="py-4 px-2 text-orange-300 font-medium">{basSaatiStr} - {bitSaatiStr}</td>
                      <td className="py-4 px-2">{log.isDuruslu ? <span className="bg-red-900/40 text-red-400 text-xs px-2 py-1 rounded">Evet</span> : <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded">Hayır</span>}</td>
                      <td className="py-4 px-2 text-blue-400 font-bold">{log.toplamSureDakika} dk</td>
                      <td className="py-4 px-2 text-gray-300 text-xs leading-relaxed max-w-[250px] break-words whitespace-normal">{log.aciklama}</td>
                      {userRole === "admin" && (
                        <td className="py-4 px-2 text-right space-x-2">
                          <button onClick={() => handleDuzenleClick(log)} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 text-xs px-3 py-2 rounded mb-1">Düzenle</button>
                          <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 text-xs px-3 py-2 rounded">Sil</button>
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