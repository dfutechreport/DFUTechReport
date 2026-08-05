"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";

export default function PersonelYonetimi() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kullanicilar, setKullanicilar] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const currentUserRef = doc(db, "users", user.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        
        if (currentUserSnap.exists() && currentUserSnap.data().role === "admin") {
          setIsAdmin(true);
          fetchKullanicilar();
        } else {
          window.location.href = "/dashboard";
        }
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchKullanicilar = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      data.sort((a: any, b: any) => {
        if (a.isApproved === b.isApproved) return 0;
        return a.isApproved ? 1 : -1;
      });
      
      setKullanicilar(data);
    } catch (error) {
      console.error("Kullanıcılar çekilirken hata:", error);
    }
    setLoading(false);
  };

  const handleLocalRoleChange = (userId: string, val: string) => {
    setKullanicilar(prev => prev.map(u => u.id === userId ? { ...u, role: val } : u));
  };

  const handleOnayla = async (userId: string, currentRole: string) => {
    if (!currentRole) return alert("Lütfen onaylamadan önce listeden bir rol seçiniz!");
    try {
      await updateDoc(doc(db, "users", userId), { isApproved: true, role: currentRole });
      alert("Personel başarıyla onaylandı.");
      fetchKullanicilar();
    } catch (error) {
      alert("Onaylama sırasında hata oluştu.");
    }
  };

  const handleRolDegistir = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      alert("Rol başarıyla güncellendi.");
      fetchKullanicilar();
    } catch (error) {
      alert("Rol güncellenirken hata oluştu.");
    }
  };

  const handleSil = async (userId: string) => {
    if (!window.confirm("DİKKAT: Bu personelin sisteme erişimini tamamen silmek istediğinize emin misiniz?")) return;
    try {
      // 1. Kullanıcıyı Firestore veritabanından sileriz
      await deleteDoc(doc(db, "users", userId));
      alert("Kullanıcı kaydı başarıyla silindi. (Not: Bu kişi kendi şifresiyle tekrar kayıt olabilir ancak yine onayınıza düşecektir).");
      fetchKullanicilar();
    } catch (error) {
      alert("Silme işlemi başarısız.");
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Veriler yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-purple-400 font-bold mb-1 text-sm tracking-wider uppercase">Yetki Yönetimi</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Sistem Personel Kontrolü
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Giriş ekranından (Google veya Şifre ile) sisteme kayıt olan personelleri onaylayın ve rollerini atayın.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold shadow-lg transition flex items-center border border-gray-700">← Panele Dön</Link>
        </div>

        <div className="overflow-x-auto bg-gray-900 rounded-xl border border-gray-700 shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-800">
              <tr className="text-gray-400 text-sm">
                <th className="py-4 px-4 font-bold border-b border-gray-700">İsim Soyisim</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">E-Posta Adresi</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">Sistem Durumu</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700">Kullanıcı Rolü (Yetki)</th>
                <th className="py-4 px-4 font-bold border-b border-gray-700 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((user) => (
                <tr key={user.id} className={`border-b border-gray-800 transition ${user.isApproved ? 'hover:bg-gray-800/50' : 'bg-red-900/10 hover:bg-red-900/20'}`}>
                  <td className="py-4 px-4 font-bold text-white">{user.name}</td>
                  <td className="py-4 px-4 text-gray-400 text-sm">{user.email}</td>
                  <td className="py-4 px-4">
                    {user.isApproved ? (
                      <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-800/50">✅ Onaylı</span>
                    ) : (
                      <span className="bg-red-900/40 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-800/50 animate-pulse">⏳ Bekliyor</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <select 
                      value={user.role || ""} 
                      onChange={(e) => {
                        if (user.isApproved) handleRolDegistir(user.id, e.target.value);
                        else handleLocalRoleChange(user.id, e.target.value);
                      }}
                      className={`bg-gray-900 border rounded-lg p-2 text-sm focus:outline-none w-full min-w-[160px] ${!user.role && !user.isApproved ? 'border-red-500 text-red-400' : 'border-gray-600 text-gray-300 focus:border-purple-500'}`}
                    >
                      <option value="">-- Rol Seçin --</option>
                      <option value="admin">Yönetici (Admin)</option>
                      <option value="teknisyen">Bakım Teknisyeni</option>
                      <option value="operator">Teknik Operatör</option>
                      <option value="uretim">Üretim Bildiricisi</option>
                      <option value="isg">İSG (Güvenlik)</option>
                      <option value="depo">Depo ve Stok Sorumlusu</option>
                    </select>
                  </td>
                  <td className="py-4 px-4 text-right flex justify-end gap-2">
                    {!user.isApproved && (
                      <button onClick={() => handleOnayla(user.id, user.role)} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg">Onayla</button>
                    )}
                    <button onClick={() => handleSil(user.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50 px-4 py-2 rounded-lg text-xs font-bold transition">Sil</button>
                  </td>
                </tr>
              ))}
              {kullanicilar.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Sistemde onay bekleyen veya kayıtlı kullanıcı bulunmamaktadır.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}