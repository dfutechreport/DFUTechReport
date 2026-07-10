"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy, deleteDoc } from "firebase/firestore";
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

  // MANUEL EKLEME STATE'LERİ
  const [yeniEmail, setYeniEmail] = useState("");
  const [yeniIsim, setYeniIsim] = useState("");
  const [yeniRol, setYeniRol] = useState("teknisyen");
  const [ekliyor, setEkliyor] = useState(false);

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

  // MEVCUT KULLANICIYI ONAYLAMA
  const handleApprove = async (userId: string, newRole: string) => {
    if (!window.confirm(`Bu kullanıcıyı "${newRole.toUpperCase()}" yetkisiyle onaylamak istediğinize emin misiniz?`)) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isApproved: true, role: newRole });
      alert("Kullanıcı başarıyla onaylandı!");
      fetchUsers(); 
    } catch (error) { console.error(error); alert("İşlem başarısız oldu."); }
  };

  // YETKİ DEĞİŞTİRME
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Yetkiyi "${newRole.toUpperCase()}" olarak değiştirmek istediğinize emin misiniz?`)) return;
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { role: newRole });
      fetchUsers(); 
    } catch (error) { console.error(error); alert("Yetki güncellenemedi."); }
  };

  // ERİŞİMİ KESME VEYA SİLME
  const handleRevoke = async (userId: string, email: string) => {
    if (!window.confirm("Bu personelin yetkisini almak veya kaydını tamamen SİLMEK istediğinize emin misiniz?")) return;
    try {
      // Eğer kullanıcı hiç giriş yapmamışsa (Manuel eklendiyse) ID'si email ile aynıdır. Direkt silebiliriz.
      if (userId === email) {
        await deleteDoc(doc(db, "users", userId));
      } else {
        await updateDoc(doc(db, "users", userId), { isApproved: false, role: "pending" });
      }
      fetchUsers();
    } catch (error) { console.error(error); }
  };

  // YENİ: MANUEL PERSONEL EKLEME
  const handleManuelEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniEmail.includes("@gmail.com") && !yeniEmail.includes("@donukfirincilik.com.tr")) {
      alert("Lütfen Google altyapısı kullanan geçerli bir mail adresi giriniz.");
      return;
    }
    if (yeniIsim.length < 3) return alert("Lütfen personelin İsim-Soyisim bilgisini doğru girin.");

    setEkliyor(true);
    try {
      // Email adresini ID olarak kullanıp önceden yetkiyi veritabanına mühürlüyoruz
      const lowerEmail = yeniEmail.toLowerCase().trim();
      const userRef = doc(db, "users", lowerEmail); 
      
      const mevcutSnap = await getDoc(userRef);
      if (mevcutSnap.exists()) {
        alert("Bu e-posta adresine sahip bir kayıt zaten var!");
        setEkliyor(false);
        return;
      }

      await setDoc(userRef, {
        email: lowerEmail,
        name: yeniIsim,
        role: yeniRol,
        isApproved: true, // PEŞİNEN ONAYLI !
        createdAt: new Date(),
        manuelEklendi: true
      });

      alert(`${yeniIsim} peşinen onaylandı! İlk giriş yaptığında sistem onu doğrudan içeri alacaktır.`);
      setYeniEmail(""); setYeniIsim(""); setYeniRol("teknisyen");
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert("Kayıt sırasında hata oluştu.");
    } finally {
      setEkliyor(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-3xl font-bold">Personel ve Yetki Yönetimi</h1>
            <p className="text-gray-400 mt-1">Sisteme kayıt olanları onaylayın veya manuel olarak personel yetkilendirin.</p>
          </div>
          <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition">
            ← Panele Dön
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* SOL: MANUEL EKLEME FORMU */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-6 text-purple-400">Yeni Personeli Peşinen Yetkilendir</h2>
              <p className="text-gray-400 text-sm mb-6">Personelin Google (veya şirket) mail adresini girerek ona şimdiden yetki verebilirsiniz. Personel ilk girdiğinde onay beklemez.</p>
              
              <form onSubmit={handleManuelEkle} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">E-Posta (Google Hesabı)</label>
                  <input type="email" required value={yeniEmail} onChange={(e) => setYeniEmail(e.target.value)} placeholder="ahmet@gmail.com" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Resmi İsim - Soyisim</label>
                  <input type="text" required value={yeniIsim} onChange={(e) => setYeniIsim(e.target.value)} placeholder="Ahmet Yılmaz" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Yetki (Rol)</label>
                  <select value={yeniRol} onChange={(e) => setYeniRol(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500">
                    <option value="teknisyen">Teknisyen</option>
                    <option value="operator">Operatör</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button type="submit" disabled={ekliyor} className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-lg transition disabled:opacity-50 mt-4">
                  {ekliyor ? "Ekleniyor..." : "Sisteme Kaydet ve Onayla"}
                </button>
              </form>
            </div>
          </div>

          {/* SAĞ: MEVCUT PERSONEL LİSTESİ */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-6">Sistemdeki Tüm Personeller</h2>
              
              {loading ? (
                <div className="text-center py-10 text-gray-500">Yükleniyor...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-10 text-gray-500">Kayıtlı personel yok.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-sm">
                        <th className="pb-3 px-4">İsim & Soyisim</th>
                        <th className="pb-3 px-4">E-Posta</th>
                        <th className="pb-3 px-4">Durum</th>
                        <th className="pb-3 px-4">Yetki</th>
                        <th className="pb-3 px-4 text-right">Aksiyon</th>
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
                          <td className="py-4 px-4 font-medium">
                            {u.isApproved ? (
                              <select 
                                value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-sm rounded-lg px-2 py-1 focus:border-blue-500 text-blue-400"
                              >
                                <option value="teknisyen">Teknisyen</option><option value="operator">Operatör</option><option value="admin">Admin</option>
                              </select>
                            ) : (<span className="text-gray-500 text-sm">Bekliyor</span>)}
                          </td>
                          <td className="py-4 px-4 text-right space-x-2">
                            {!u.isApproved ? (
                              <>
                                <button onClick={() => handleApprove(u.id, "teknisyen")} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded">Teknisyen Yap</button>
                                <button onClick={() => handleApprove(u.id, "admin")} className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-2 rounded">Admin Yap</button>
                              </>
                            ) : (
                              <button onClick={() => handleRevoke(u.id, u.email)} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white text-xs px-3 py-2 rounded border border-red-800/50">Erişimi Kes</button>
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
      </div>
    </div>
  );
}