"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
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

  // --- TAM LİSTE YEDEKLEME ---
  const downloadFullSnapshot = async () => {
    const pass = window.prompt("Snapshot Şifresi:");
    if (pass !== "140826") return alert("Hatalı!");
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs", "kar_arsivi", "pano_kontrolleri", "kontrol_formlari_kayitlari"];
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
      link.download = `DFU_MASTER_FULL_SNAPSHOT.json`;
      link.click();
      alert("Tüm veriler ve kodlar başarıyla yedeklendi.");
    } catch (e) { alert("Yedekleme Hatası!"); }
  };

  // --- TAM LİSTE RESET ---
  const handleSystemReset = async () => {
    const isSure = window.confirm("DİKKAT: İş emirleri, mesailer, sayaçlar ve arıza kayıtları tamamen silinecektir. Onaylıyor musunuz?");
    if (!isSure) return;
    const pass = window.prompt("RESET ŞİFRESİ:");
    if (pass !== "140826") return alert("Hatalı!");
    try {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "overtime_logs", "kar_arsivi", "pano_kontrolleri", "root_cause_analysis"];
      for (const collName of targetColls) {
        const snap = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      alert("Operasyonel veriler temizlendi. Altyapı korundu.");
      window.location.reload();
    } catch (e) { alert("Reset Hatası!"); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "ik") { router.push("/admin/mesai"); return; }
          setIsAdmin(true); setUserRole(role); setUserName(userSnap.data().name);
          fetchInitialData();
        } else router.push("/");
      } else router.push("/");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchInitialData = async () => {
    const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
    const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
    setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
    const ekedSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
    setAktifEked(ekedSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    const logsSnap = await getDocs(collection(db, "maintenance_logs"));
    setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0; const pD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const s = Number(l.toplamSureDakika) || 0;
      if (d.getFullYear().toString() === filterYil) { isC++; suC += s; if(l.isDuruslu) duC += s; }
      const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { isSayisi: 0, eforDk: 0 }; pD[p].isSayisi++; pD[p].eforDk += s; } });
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, ...pD[k] })).sort((a,b)=> b.isSayisi - a.isSayisi));
  }, [rawLogs, filterYil]);

  if (loading) return <div className="p-10 bg-slate-950 text-white flex justify-center items-center italic">YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="p-10 text-red-500 font-bold">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden italic font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase tracking-tighter text-indigo-400">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg italic">💾 Sistem Yedeği</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Çıkış</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-xs text-center shadow-lg uppercase italic font-bold">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-xs text-center uppercase font-black">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-xs text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic">👤 Personel Onay</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic font-bold">🔌 Pano Listesi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic font-black">✅ Kontrol Formları</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic font-bold">📅 PM Takvimi</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic font-bold">📂 Tamamlanan İşler</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-xs text-center text-yellow-500 uppercase italic font-black underline">🏆 Bakım Ligi</Link>
          <button onClick={handleSystemReset} className="bg-red-950/40 border border-red-900/50 p-3 rounded-2xl text-[10px] font-black uppercase text-red-500 hover:bg-red-600 transition-all italic shadow-xl">💀 Sistemi Sıfırla</button>
        </div>

        {/* ... (Alarmlar, KPI'lar ve MTTR Tablosu Burada Devam Eder) ... */}
      </div>
    </div>
  );
}