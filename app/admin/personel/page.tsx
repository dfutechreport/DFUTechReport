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
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists() && uSnap.data().role === "admin") {
          setIsAdmin(true); fetchKullanicilar();
        } else { window.location.href = "/dashboard"; }
      } else { window.location.href = "/"; }
    });
  }, []);

  const fetchKullanicilar = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setKullanicilar(data.sort((a: any, b: any) => (a.isApproved === b.isApproved) ? 0 : (a.isApproved ? 1 : -1)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleRolGuncelle = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole, isApproved: true });
      alert("Personel Rolü ve Onayı Güncellendi.");
      fetchKullanicilar();
    } catch (e) { alert("Hata!"); }
  };

  const handleSil = async (userId: string) => {
    if (confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) {
      await deleteDoc(doc(db, "users", userId)); fetchKullanicilar();
    }
  };

  if (loading) return <div className="p-10 text-white italic">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-2xl">
          <h1 className="text-2xl font-black text-white italic uppercase tracking-widest">Personel Yetkilendirme</h1>
          <Link href="/admin" className="bg-gray-800 text-white px-6 py-2 rounded-xl text-xs font-bold">Admin Panel</Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl italic font-bold">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black">
              <tr><th className="p-6">Ad Soyad</th><th className="p-6">E-Posta</th><th className="p-6">Mevcut Rol</th><th className="p-6">İşlemler</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {kullanicilar.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-all">
                  <td className="p-6 text-white uppercase">{u.name} {!u.isApproved && <span className="text-red-500 text-[8px] border border-red-500 px-1 ml-2 rounded">ONAY BEKLİYOR</span>}</td>
                  <td className="p-6 text-slate-500 text-sm">{u.email}</td>
                  <td className="p-6"><span className="bg-slate-800 px-3 py-1 rounded-lg text-blue-400 text-xs font-black uppercase">{u.role}</span></td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      <select 
                        className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-[10px] uppercase font-black text-white outline-none"
                        onChange={(e) => handleRolGuncelle(u.id, e.target.value)}
                        value={u.role}
                      >
                        <option value="">Rol Seç...</option>
                        <option value="admin">Yönetici</option>
                        <option value="teknisyen">Teknisyen</option>
                        <option value="operator">Operatör</option>
                        <option value="uretim">Üretim Yetkilisi</option>
                        <option value="ik">İK Yetkilisi</option> {/* YENİ EKLENDİ */}
                        <option value="isg">İSG Uzmanı</option>
                        <option value="depo">Depo Sorumlusu</option>
                      </select>
                      <button onClick={() => handleSil(u.id)} className="bg-red-900/20 text-red-500 p-2 rounded-lg text-[10px] font-black uppercase border border-red-900/30">Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}