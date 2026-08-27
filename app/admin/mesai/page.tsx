"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, where } from "firebase/firestore";
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
          const role = uSnap.data().role;
          setUserRole(role);
          setUserName(uSnap.data().name);
          fetchMesailer();
        } else {
          router.push("/");
        }
      } else {
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMesailer = async () => {
    try {
      // Mesai koleksiyonundan kayıtları çekiyoruz
      const snap = await getDocs(query(collection(db, "mesai"), orderBy("kayitTarihi", "desc")));
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Mesai verileri çekilemedi:", e);
    }
  };

  const handleLogout = async () => {
    if (confirm("Oturumu kapatmak istediğinizden emin misiniz?")) {
      await signOut(auth);
      router.push("/");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-white italic tracking-widest animate-pulse uppercase">İK Sistemleri Hazırlanıyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-10 font-sans italic font-bold">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER PANELİ */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl gap-6">
          <div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mesai Takip Merkezi</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">İnsan Kaynakları ve Puantaj Raporu</p>
          </div>

          <div className="flex gap-4">
            {/* İK ROLÜ HARİCİNDEKİLER İÇİN GERİ DÖN BUTONU */}
            {userRole !== "ik" && (
              <button 
                onClick={() => router.back()}
                className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-lg border border-slate-700 transition-all"
              >
                ← Geri Dön
              </button>
            )}
            
            <button 
              onClick={handleLogout}
              className="bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white px-8 py-3 rounded-2xl font-black text-xs uppercase border border-red-900/30 transition-all shadow-xl"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* MESAİ RAPORLARI TABLOSU */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 italic">
              <tr>
                <th className="p-6">Personel Adı</th>
                <th className="p-6">Tarih / Vardiya</th>
                <th className="p-6">Mesai Nedeni</th>
                <th className="p-6 text-right">Onay Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm italic font-bold uppercase">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-all group">
                  <td className="p-6">
                    <p className="text-slate-200 font-black group-hover:text-blue-400">{log.personelName}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{log.bolum || "Teknik Ekip"}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-slate-300">{log.tarih}</p>
                    <p className="text-[10px] text-slate-600 font-bold tracking-widest">{log.vardiya}</p>
                  </td>
                  <td className="p-6 text-slate-400 font-medium text-xs max-w-xs truncate italic">
                    {log.neden || "Rutin Bakım / Arıza Müdahale"}
                  </td>
                  <td className="p-6 text-right">
                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase ${
                      log.durum === "Onaylandı" 
                        ? "bg-green-900/20 text-green-500 border border-green-900/30" 
                        : "bg-yellow-900/20 text-yellow-500 border border-yellow-900/30"
                    }`}>
                      {log.durum || "Beklemede"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {logs.length === 0 && (
            <div className="p-20 text-center text-slate-600 font-black uppercase italic tracking-widest">
              Sistemde henüz mesai kaydı bulunmuyor.
            </div>
          )}
        </div>

        {/* ALT BİLGİ */}
        <div className="mt-8 text-center opacity-20 italic">
          <p className="text-[10px] text-white uppercase font-black tracking-[0.5em]">DFU Teknik Raporlama • Mesai Veritabanı</p>
        </div>

      </div>
    </div>
  );
}