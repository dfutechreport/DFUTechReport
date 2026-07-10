"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function SayacOkuma() {
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  // Veri State'leri
  const [sayaclar, setSayaclar] = useState<any[]>([]);
  const [gecmisOkumalar, setGecmisOkumalar] = useState<any[]>([]);
  const [girisDegerleri, setGirisDegerleri] = useState<Record<string, string>>({}); // Her sayaç için input değeri

  // Admin Ekleme/Düzenleme State'leri
  const [yeniSayacAdi, setYeniSayacAdi] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [duzenlenenLog, setDuzenlenenLog] = useState<any>(null);

  // Günün Tarihi (YYYY-MM-DD)
  const bugun = new Date().toISOString().split('T')[0];

  const fetchVeriler = async () => {
    try {
      // Sayaç İsimlerini Çek
      const sayacSnap = await getDocs(collection(db, "meters"));
      setSayaclar(sayacSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Geçmiş Okumaları Çek
      const q = query(collection(db, "meter_logs"), orderBy("timestamp", "desc"));
      const logSnap = await getDocs(q);
      setGecmisOkumalar(logSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
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
          setUserName(userSnap.data().name);
          fetchVeriler();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  // YENİ SAYAÇ TANIMLAMA (Sadece Admin)
  const handleSayacEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniSayacAdi) return;
    try {
      await addDoc(collection(db, "meters"), { name: yeniSayacAdi });
      setYeniSayacAdi("");
      fetchVeriler();
    } catch (error) { alert("Hata!"); }
  };

  // PERSONEL SAYAÇ DEĞERİ GİRİŞİ
  const handleDegerKaydet = async (sayacId: string, sayacAdi: string) => {
    const deger = girisDegerleri[sayacId];
    if (!deger) return alert("Lütfen bir değer giriniz.");

    try {
      await addDoc(collection(db, "meter_logs"), {
        tarih: bugun,
        sayacAdi: sayacAdi,
        deger: Number(deger),
        personel: userName,
        timestamp: new Date()
      });
      alert(`${sayacAdi} okuması başarıyla kaydedildi.`);
      
      // Inputu temizle ve listeyi yenile
      setGirisDegerleri(prev => ({ ...prev, [sayacId]: "" }));
      fetchVeriler();
    } catch (error) {
      console.error(error); alert("Kaydedilemedi.");
    }
  };

  // GEÇMİŞ KAYDI DÜZENLEME (Sadece Admin)
  const handleDuzenlemeKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "meter_logs", duzenlenenLog.id), {
        tarih: duzenlenenLog.tarih,
        sayacAdi: duzenlenenLog.sayacAdi,
        deger: Number(duzenlenenLog.deger)
      });
      alert("Kayıt güncellendi.");
      setEditModal(false);
      fetchVeriler();
    } catch (error) { alert("Güncellenemedi!"); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu okuma kaydını silmek istediğinize emin misiniz?")) return;
    await deleteDoc(doc(db, "meter_logs", id));
    fetchVeriler();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      
      {/* ADMİN DÜZENLEME MODALI */}
      {editModal && duzenlenenLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-gray-900 border border-blue-500 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-blue-400 mb-6">Okuma Kaydını Düzenle (Admin)</h2>
            <form onSubmit={handleDuzenlemeKaydet} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tarih</label>
                <input type="date" value={duzenlenenLog.tarih} onChange={e => setDuzenlenenLog({...duzenlenenLog, tarih: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sayaç Adı</label>
                <input type="text" value={duzenlenenLog.sayacAdi} onChange={e => setDuzenlenenLog({...duzenlenenLog, sayacAdi: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sayaç Değeri (kWh vb.)</label>
                <input type="number" value={duzenlenenLog.deger} onChange={e => setDuzenlenenLog({...duzenlenenLog, deger: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 font-bold py-3 rounded-lg">Kaydet</button>
                <button type="button" onClick={() => setEditModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 font-bold py-3 rounded-lg">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400 flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Elektrik Sayaç Okuma
            </h1>
            <p className="text-gray-400 mt-1">Günlük enerji tüketim değerlerini girin ve takip edin.</p>
          </div>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">
            ← Panele Dön
          </Link>
        </div>

        {/* ADMİN - YENİ SAYAÇ EKLEME ALANI */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-yellow-400 mb-1 font-bold">Yeni Sayaç Tanımla (Sadece Admin)</label>
              <input type="text" value={yeniSayacAdi} onChange={e => setYeniSayacAdi(e.target.value)} placeholder="Örn: Ana Pano Trafosu" className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            </div>
            <button onClick={handleSayacEkle} className="bg-yellow-600 hover:bg-yellow-500 font-bold px-6 py-3 rounded-lg text-white">Ekle</button>
          </div>
        )}

        {/* VERİ GİRİŞ TABLOSU (Herkes İçin) */}
        <div className="bg-gray-900 border border-yellow-600/30 p-6 rounded-xl shadow-lg overflow-x-auto mb-10 relative">
          <h2 className="text-xl font-bold mb-4 text-white">Bugünün Sayaç Değerlerini Girin</h2>
          
          {sayaclar.length === 0 ? (
            <div className="text-gray-500 py-4">Sistemde kayıtlı sayaç yok. Lütfen yöneticinize bildirin.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-gray-800/50">
                  <th className="p-3">Okuma Tarihi</th>
                  <th className="p-3">Sayaç Adı</th>
                  <th className="p-3 text-yellow-400">Sayaç Değeri (Giriş)</th>
                  <th className="p-3">Personel</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {sayaclar.map(sayac => (
                  <tr key={sayac.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    {/* Tarih (Kilitli) */}
                    <td className="p-3 text-gray-400 font-medium">{bugun}</td>
                    
                    {/* Sayaç Adı (Kilitli) */}
                    <td className="p-3 font-bold text-gray-200">{sayac.name}</td>
                    
                    {/* Değer Girişi (AÇIK) */}
                    <td className="p-3">
                      <input 
                        type="number" 
                        placeholder="Değer Girin..."
                        value={girisDegerleri[sayac.id] || ""}
                        onChange={(e) => setGirisDegerleri({...girisDegerleri, [sayac.id]: e.target.value})}
                        className="w-full max-w-[200px] bg-gray-800 border border-yellow-500/50 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-400"
                      />
                    </td>
                    
                    {/* Personel İsmi (Otomatik) */}
                    <td className="p-3 text-blue-300">{userName}</td>
                    
                    {/* Kaydet Butonu */}
                    <td className="p-3 text-right">
                      <button onClick={() => handleDegerKaydet(sayac.id, sayac.name)} className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-lg">
                        Kaydet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* GEÇMİŞ KAYITLAR DÖKÜMÜ (HISTORY) */}
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-300">Geçmiş Sayaç Okuma Dökümleri</h2>
          {gecmisOkumalar.length === 0 ? (
            <div className="text-gray-500 py-4">Henüz geçmiş kayıt yok.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Okuma Tarihi</th>
                  <th className="pb-3 px-2">Sayaç Adı</th>
                  <th className="pb-3 px-2 text-yellow-400">Okunan Değer</th>
                  <th className="pb-3 px-2">Personel</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon (Admin)</th>}
                </tr>
              </thead>
              <tbody>
                {gecmisOkumalar.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-2 text-gray-300">{log.tarih}</td>
                    <td className="py-3 px-2 font-bold text-gray-200">{log.sayacAdi}</td>
                    <td className="py-3 px-2 text-yellow-400 font-bold text-lg">{log.deger}</td>
                    <td className="py-3 px-2 text-blue-300">{log.personel}</td>
                    {userRole === "admin" && (
                      <td className="py-3 px-2 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => { setDuzenlenenLog(log); setEditModal(true); }} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 hover:text-white text-xs px-3 py-1 rounded border border-blue-800/50">Düzenle</button>
                        <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-1 rounded border border-red-800/50">Sil</button>
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