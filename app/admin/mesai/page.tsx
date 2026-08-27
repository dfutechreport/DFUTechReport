"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

export default function MesaiRaporlari() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists() && uSnap.data().isApproved) {
          const role = uSnap.data().role;
          setUserRole(role);
          fetchMesaiRecords();
        } else router.push("/");
      } else router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMesaiRecords = async () => {
    try {
      // DOĞRU KOLEKSİYON: overtime_logs
      const snap = await getDocs(query(collection(db, "overtime_logs"), orderBy("tarih", "desc")));
      const data = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          personelIsmi: raw.personel || "Bilinmiyor",
          tarih: raw.tarih || "-",
          mesaiTuru: raw.mesaiTuru || "Genel",
          sureSaat: raw.toplamMesaiDk ? (Number(raw.toplamMesaiDk) / 60).toFixed(1) : "0",
          aciklama: raw.aciklama || "-",
          durum: raw.durum || "Beklemede"
        };
      });
      setLogs(data);
    } catch (e) { console.error("Veri hatası:", e); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">MESAİ VERİLERİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-10 font-sans italic font-bold">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mesai Raporları</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Personel Puantaj ve Çalışma Kayıtları</p>
          </div>
          <div className="flex gap-4">
            {userRole !== "ik" && (
              <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-lg border border-slate-700 transition-all">← Geri Dön</button>
            )}
            <button onClick={() => { signOut(auth); router.push("/"); }} className="bg-red-900/20 text-red-500 px-6 py-3 rounded-2xl font-black text-xs uppercase border border-red-900/30">Çıkış Yap</button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
              <tr><th className="p-6">Personel</th><th className="p-6">Tarih</th><th className="p-6">Tür</th><th className="p-6">Süre (Saat)</th><th className="p-6 text-right">Durum</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-all group font-bold italic">
                  <td className="p-6 text-slate-200 uppercase">{log.personelIsmi}</td>
                  <td className="p-6 text-slate-400">{log.tarih}</td>
                  <td className="p-6 text-slate-400 uppercase text-xs">{log.mesaiTuru}</td>
                  <td className="p-6 text-blue-400 font-black">{log.sureSaat} Saat</td>
                  <td className="p-6 text-right"><span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${log.durum === "Onaylandı" ? "bg-green-900/20 text-green-500 border border-green-900/30" : "bg-blue-900/20 text-blue-500 border border-blue-900/30"}`}>{log.durum}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="p-20 text-center text-slate-600 font-black uppercase italic tracking-widest">Sistemde mesai kaydı bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}