"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MesaiRaporlari() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists() && uSnap.data().isApproved) {
          setUserRole(uSnap.data().role);
          setUserName(uSnap.data().name);
          fetchMesailer();
        }
      } else router.push("/");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMesailer = async () => {
    const snap = await getDocs(query(collection(db, "mesai"), orderBy("kayitTarihi", "desc")));
    setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) return <div className="p-10 text-white italic text-center">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 font-sans italic font-bold">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mesai Raporları</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">İnsan Kaynakları Paneli</p>
          </div>
          <div className="flex gap-4">
            {/* İK ROLÜNDE DEĞİLSE GERİ DÖN BUTONUNU GÖSTER */}
            {userRole !== "ik" && (
              <Link href="/admin" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg">Admin Panel</Link>
            )}
            <button onClick={handleLogout} className="bg-red-900/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase border border-red-900/30 hover:bg-red-600 hover:text-white transition-all">Çıkış Yap</button>
          </div>
        </div>

        {/* MESAİ LİSTESİ TABLOSU (Orijinal düzeniniz burada yer alır...) */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
              <tr><th className="p-6">Personel</th><th className="p-6">Zaman / Vardiya</th><th className="p-6 text-right">Durum</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-all">
                  <td className="p-6 font-black text-slate-200 uppercase">{log.personelName}</td>
                  <td className="p-6 text-slate-400 italic">{log.tarih} | {log.vardiya}</td>
                  <td className="p-6 text-right font-black text-blue-500 uppercase text-xs">{log.durum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}