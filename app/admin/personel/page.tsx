"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
};

export default function PersonelYonetimi() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("isApproved")); 
      const querySnapshot = await getDocs(q);
      const liste: User[] = [];
      querySnapshot.forEach((document) => {
        liste.push({ id: document.id, ...document.data() } as User);
      });
      setUsers(liste);
    } catch (error) {
      console.error("Kullanıcılar çekilirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // İLK ONAY İŞLEMİ (Onaysız kişiyi onaylama ve rol verme)
  const handleApprove = async (userId: string, newRole: string) => {
    if (!window.confirm(`Bu kullanıcıyı "${newRole.toUpperCase()}" yetkisiyle onaylamak istediğinize emin misiniz?`)) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isApproved: true, role: newRole });
      alert("Kullanıcı başarıyla onaylandı!");
      fetchUsers(); 
    } catch (error) {
      console.error(error); alert("İşlem başarısız oldu.");
    }
  };

  // YENİ: MEVCUT ONAYLI KULLANICININ ROLÜNÜ DEĞİŞTİRME
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Bu kullanıcının yetkisini "${newRole.toUpperCase()}" olarak değiştirmek istediğinize emin misiniz?`)) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { role: newRole });
      fetchUsers(); 
    } catch (error) {
      console.error(error); alert("Yetki güncellenemedi.");
    }
  };

  // ERİŞİMİ KESME (Kullanıcıyı askıya alma)
  const handleRevoke = async (userId: string) => {
    if (!window.confirm("Bu kullanıcının sisteme erişimini durdurmak istediğinize emin misiniz?")) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isApproved: false, role: "pending" });
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold">Personel ve Yetki Yönetimi</h1>
            <p className="text-gray-400 mt-1">Sisteme kayıt olanları onaylayın, yetkilerini verin veya düzenleyin.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition">
            ← Dashboard'a Dön
          </Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Personel listesi yükleniyor...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Sistemde henüz kayıtlı personel yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-sm">
                    <th className="pb-3 px-4">İsim & Soyisim</th>
                    <th className="pb-3 px-4">E-Posta (Gmail)</th>
                    <th className="pb-3 px-4">Durum</th>
                    <th className="pb-3 px-4">Yetki (Rol)</th>
                    <th className="pb-3 px-4 text-right">Aksiyonlar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-4 px-4 font-medium">{u.name}</td>
                      <td className="py-4 px-4 text-gray-400 text-sm">{u.email}</td>
                      <td className="py-4 px-4">
                        {u.isApproved ? (
                          <span className="bg-green-900/30 text-green-400 text-xs px-3 py-1 rounded-full border border-green-800/50">Onaylı</span>
                        ) : (
                          <span className="bg-orange-900/30 text-orange-400 text-xs px-3 py-1 rounded-full border border-orange-800/50 animate-pulse">Onay Bekliyor</span>
                        )}
                      </td>
                      
                      {/* YETKİ GÖSTERİMİ VE DÜZENLEMESİ */}
                      <td className="py-4 px-4 font-medium">
                        {u.isApproved ? (
                          <select 
                            value={u.role} 
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`bg-gray-800 border border-gray-700 text-sm rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 ${u.role === 'admin' ? 'text-green-400' : 'text-blue-400'}`}
                          >
                            <option value="teknisyen">Teknisyen</option>
                            <option value="operator">Operatör</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="text-gray-500 text-sm">Bekliyor</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right space-x-2">
                        {/* Onaysızsa: Hızlı Onay Butonları */}
                        {!u.isApproved ? (
                          <>
                            <button onClick={() => handleApprove(u.id, "teknisyen")} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded transition">Teknisyen Yap</button>
                            <button onClick={() => handleApprove(u.id, "operator")} className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded transition">Operatör Yap</button>
                            <button onClick={() => handleApprove(u.id, "admin")} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-2 rounded transition">Admin Yap</button>
                          </>
                        ) : (
                          /* Onaylıysa: Askıya Alma Butonu */
                          <button onClick={() => handleRevoke(u.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded transition border border-red-800/50">
                            Erişimi Kes
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}