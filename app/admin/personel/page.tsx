"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, orderBy, deleteDoc } from "firebase/firestore";
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

  const [yeniEmail, setYeniEmail] = useState("");
  const [yeniIsim, setYeniIsim] = useState("");
  const [yeniRol, setYeniRol] = useState("teknisyen");
  const [ekliyor, setEkliyor] = useState(false);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("isApproved")); 
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleApprove = async (userId: string, newRole: string) => {
    if (!window.confirm(`Bu kullanıcıyı "${newRole.toUpperCase()}" yetkisiyle onaylamak istediğinize emin misiniz?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { isApproved: true, role: newRole });
      alert("Kullanıcı onaylandı!"); fetchUsers(); 
    } catch (error) { alert("İşlem başarısız."); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Yetkiyi "${newRole.toUpperCase()}" olarak değiştirmek istediğinize emin misiniz?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole }); fetchUsers(); 
    } catch (error) { alert("Yetki güncellenemedi."); }
  };

  const handleRevoke = async (userId: string, email: string) => {
    if (!window.confirm("Bu personelin yetkisini almak veya kaydını SİLMEK istediğinize emin misiniz?")) return;
    try {
      if (userId === email) await deleteDoc(doc(db, "users", userId));
      else await updateDoc(doc(db, "users", userId), { isApproved: false, role: "pending" });
      fetchUsers();
    } catch (error) { console.error(error); }
  };

  const handleManuelEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniEmail || !yeniEmail.includes("@")) return alert("Geçerli e-posta giriniz.");
    if (yeniIsim.trim().length < 3) return alert("Personel ismini girin.");

    setEkliyor(true);
    try {
      const lowerEmail = yeniEmail.toLowerCase().trim();
      const userRef = doc(db, "users", lowerEmail); 
      const mevcutSnap = await getDoc(userRef);
      if (mevcutSnap.exists()) { alert("Bu e-posta sistemde var!"); setEkliyor(false); return; }

      await setDoc(userRef, { email: lowerEmail, name: yeniIsim, role: yeniRol, isApproved: true, createdAt: new Date(), manuelEklendi: true });
      alert(`${yeniIsim} peşinen onaylandı!`);
      setYeniEmail(""); setYeniIsim(""); setYeniRol("teknisyen"); fetchUsers();
    } catch (error: any) { alert("Hata: " + error.message); } finally { setEkliyor(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold">Personel ve Yetki Yönetimi</h1>
            <p className="text-gray-400 mt-1">Sisteme kayıt olanları onaylayın veya manuel olarak yetkilendirin.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium transition">← Panele Dön</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-4 text-purple-400">Yeni Personel Ekle</h2>
              <form onSubmit={handleManuelEkle} className="space-y-4">
                <div><label className="block text-sm text-gray-400 mb-1">E-Posta</label><input type="email" required value={yeniEmail} onChange={(e) => setYeniEmail(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 focus:border-purple-500" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Resmi İsim - Soyisim</label><input type="text" required value={yeniIsim} onChange={(e) => setYeniIsim(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 focus:border-purple-500" /></div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Yetki (Rol)</label>
                  <select value={yeniRol} onChange={(e) => setYeniRol(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 focus:border-purple-500">
                    <option value="teknisyen">Teknisyen</option>
                    <option value="operator">Operatör</option>
                    <option value="uretim">Üretim Yetkilisi</option>
                    {/* YENİ: İSG Rolü Eklendi */}
                    <option value="isg">İSG Yetkilisi</option>
                    <option value="ik">İnsan Kaynakları (İK)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={ekliyor} className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-lg mt-4 disabled:opacity-50">
                  {ekliyor ? "Ekleniyor..." : "Sisteme Kaydet"}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg overflow-x-auto">
              <h2 className="text-xl font-bold mb-4">Sistemdeki Tüm Personeller</h2>
              {users.length === 0 ? <p className="text-gray-500">Personel yok.</p> : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="pb-3 px-2">İsim & Soyisim</th><th className="pb-3 px-2">E-Posta</th><th className="pb-3 px-2">Durum</th><th className="pb-3 px-2">Yetki</th><th className="pb-3 px-2 text-right">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                        <td className="py-4 px-2 font-medium">{u.name}</td>
                        <td className="py-4 px-2 text-gray-400">{u.email}</td>
                        <td className="py-4 px-2">
                          {u.isApproved ? <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded">Onaylı</span> : <span className="bg-orange-900/30 text-orange-400 px-2 py-1 rounded">Onay Bekliyor</span>}
                        </td>
                        <td className="py-4 px-2 font-medium">
                          {u.isApproved ? (
                            <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="bg-gray-800 border-gray-700 rounded p-1 text-blue-400">
                              <option value="teknisyen">Teknisyen</option>
                              <option value="operator">Operatör</option>
                              <option value="uretim">Üretim Yetkilisi</option>
                              <option value="isg">İSG Yetkilisi</option>
                              <option value="ik">İnsan Kaynakları</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : <span className="text-gray-500">Bekliyor</span>}
                        </td>
                        <td className="py-4 px-2 text-right space-x-1 whitespace-nowrap">
                          {!u.isApproved ? (
                            <>
                              <button onClick={() => handleApprove(u.id, "teknisyen")} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded mb-1">Teknisyen</button>
                              <button onClick={() => handleApprove(u.id, "operator")} className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded mb-1">Operatör</button>
                              {/* Hızlı İSG Onay Butonu */}
                              <button onClick={() => handleApprove(u.id, "isg")} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs px-2 py-1 rounded">İSG Yap</button>
                            </>
                          ) : (
                            <button onClick={() => handleRevoke(u.id, u.email)} className="bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded border border-red-800/50">Erişimi Kes</button>
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

      </div>
    </div>
  );
}