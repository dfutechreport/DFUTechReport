"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());

  const downloadFullSnapshot = async () => {
    const pass = window.prompt("Snapshot Şifresi:");
    if (pass !== "140826") return alert("Hatalı!");
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs", "kar_arsivi", "pano_kontrolleri"];
      let dbBackup: any = {};
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const codeRes = await fetch('/api/backup-all');
      const codeData = await codeRes.json();
      const blob = new Blob([JSON.stringify({ database: dbBackup, dna: codeData.codeDump }, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `DFU_MASTER_FULL_YEDEK.json`;
      link.click();
    } catch (e) { alert("Hata!"); }
  };

  const handleSystemReset = async () => {
    const isSure = window.confirm("DİKKAT: Veriler silinecektir!");
    if (!isSure || window.prompt("RESET ŞİFRESİ:") !== "140826") return alert("İşlem İptal!");
    try {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "overtime_logs", "kar_arsivi", "pano_kontrolleri", "root_cause_analysis"];
      for (const collName of targetColls) {
        const snap = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      window.location.reload();
    } catch (e) { alert("Hata!"); }
  };

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists() && uSnap.data().isApproved) {
          const role = uSnap.data().role;
          if (role === "ik") return router.push("/admin/mesai");
          setIsAdmin(true); setUserRole(role); setUserName(uSnap.data().name);
          const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
          const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
          setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
          const ekedSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
          setAktifEked(ekedSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
          const logsSnap = await getDocs(collection(db, "maintenance_logs"));
          setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        }
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0; const pD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      if (d.getFullYear().toString() === filterYil) {
        isC++; suC += (Number(l.toplamSureDakika) || 0);
        if(l.isDuruslu) duC += (Number(l.toplamSureDakika) || 0);
        const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
        crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { is: 0, efor: 0 }; pD[p].is++; pD[p].efor += (Number(l.toplamSureDakika) || 0); } });
      }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, is: pD[k].is, mttr: (pD[k].efor/pD[k].is).toFixed(0) })).sort((a,b)=> b.is - a.is));
  }, [rawLogs, filterYil]);

  if (loading) return <div className="p-10 bg-slate-950 min-h-screen text-white flex justify-center items-center">YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="p-10 bg-slate-950 min-h-screen text-red-500 font-bold">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans italic font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><h1 className="text-2xl font-black uppercase text-indigo-400">Komuta Merkezi</h1></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase">💾 Yedek Al</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase">Çıkış</button>
          </div>
        </div>

        {/* --- EKSİKSİZ 23 BUTON GRİDİ --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-[10px] text-center uppercase">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-[10px] text-center uppercase">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-[10px] text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase">📂 EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-[10px] text-center uppercase">👤 Personel Onay</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-[10px] text-center uppercase">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl text-[10px] text-center uppercase border border-gray-600">📂 Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-[10px] text-center uppercase">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl text-[10px] text-center uppercase">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-[10px] text-center uppercase border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl text-[10px] text-center uppercase">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-[10px] text-center uppercase">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl text-[10px] text-center uppercase">📂 PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase font-black">🛠️ Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl text-[10px] text-center uppercase">⌛ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase">📂 Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl text-[10px] text-center uppercase">⚙️ Hat/Makineler</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl text-[10px] text-center uppercase">📢 İSG Duyuru</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-[10px] text-center text-yellow-500 uppercase">🏆 Bakım Ligi</Link>
          <button onClick={handleSystemReset} className="bg-red-950 border border-red-900 p-3 rounded-2xl text-[10px] text-red-500 uppercase">💀 Reset</button>
        </div>

        {/* ALARMLAR VE MTTR TABLOSU */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 italic">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
             <h2 className="text-lg font-black text-yellow-500 mb-4 uppercase italic tracking-widest">🏆 Personel MTTR Matrisi</h2>
             <table className="w-full text-left text-[11px] uppercase tracking-tighter">
                <thead className="text-gray-500 border-b border-slate-800"><tr><th className="py-3">Personel</th><th className="py-3 text-center">İş Adedi</th><th className="py-3 text-right">MTTR (Efor)</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {personelPerformans.map((p,i)=>(<tr key={i}><td className="py-3 text-gray-200">{p.isim}</td><td className="py-3 text-green-400 text-center">{p.is}</td><td className="py-3 text-indigo-400 text-right">{p.mttr} dk/iş</td></tr>))}
                </tbody>
             </table>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
             <h2 className="text-lg font-black text-red-500 mb-4 uppercase italic tracking-widest">🚑 Kritik Alarmlar</h2>
             {aktifIsgAlarmlari.map(a=>(<div key={a.id} className="bg-slate-950 p-4 rounded-2xl mb-2 flex justify-between items-center italic"><span>{a.ekipmanAdi}</span><button onClick={()=>router.push("/admin/aktif-isler")} className="bg-red-600 px-3 py-1 rounded-lg text-[9px]">GİT</button></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}