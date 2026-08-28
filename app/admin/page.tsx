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
  const [userRole, setUserRole] = useState(""); const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [rawLogs, setRawLogs] = useState<any[]>([]); const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]); const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]); const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [showEkedModal, setShowEkedModal] = useState(false); const [selectedEked, setSelectedEked] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false); const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showRcaModal, setShowRcaModal] = useState(false); const [rcaForm, setRcaForm] = useState({ category: "", why: "" });
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);

  const downloadFullSnapshot = async () => {
    if (window.prompt("Şifre:") !== "140826") return alert("Hatalı!");
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs", "kar_arsivi"];
      let dbBackup: any = {};
      for (const coll of collections) { const snap = await getDocs(collection(db, coll)); dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      const codeRes = await fetch('/api/backup-all'); const codeData = await codeRes.json();
      const blob = new Blob([JSON.stringify({ database: dbBackup, dna: codeData.codeDump }, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `DFU_MASTER_YEDEK.json`; link.click();
    } catch (e) { alert("Hata!"); }
  };

  const handleSystemReset = async () => {
    if (window.confirm("RESET?") && window.prompt("RESET ŞİFRESİ:") === "140826") {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "overtime_logs", "kar_arsivi", "pano_takip"];
      for (const collName of targetColls) { const snap = await getDocs(collection(db, collName)); const batch = writeBatch(db); snap.docs.forEach((d) => batch.delete(d.ref)); await batch.commit(); }
      window.location.reload();
    }
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
          const mSnap = await getDocs(query(collection(db, "meter_logs"), orderBy("tarih", "asc")));
          setRawMeterLogs(mSnap.docs.map(d => d.data()));
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
        isC++; suC += (Number(l.toplamSureDakika) || 0); if(l.isDuruslu) duC += (Number(l.toplamSureDakika) || 0);
        const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
        crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { is: 0, efor: 0 }; pD[p].is++; pD[p].efor += (Number(l.toplamSureDakika) || 0); } });
      }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, is: pD[k].is, mttr: (pD[k].efor/pD[k].is).toFixed(0) })).sort((a,b)=> b.is - a.is));
  }, [rawLogs, filterYil]);

  if (loading) return <div className="p-10 bg-slate-950 min-h-screen text-white flex justify-center items-center uppercase italic font-black">Yükleniyor...</div>;
  if (!isAdmin) return <div className="p-10 text-red-500 font-bold uppercase">YETKİSİZ!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans italic font-bold">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex justify-between items-center border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><h1 className="text-2xl font-black uppercase text-indigo-400">Komuta Merkezi</h1></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg">💾 Yedek</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg">Çıkış</button>
          </div>
        </div>

        {/* EKSİKSİZ 23 BUTON GRİDİ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-[10px] text-center uppercase shadow-lg">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-[10px] text-center uppercase">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-[10px] text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase">📂 EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-[10px] text-center uppercase relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[8px] px-1 rounded-full animate-bounce">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-[10px] text-center uppercase">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl text-[10px] text-center uppercase border border-gray-600">📂 Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-[10px] text-center uppercase">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl text-[10px] text-center uppercase">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-[10px] text-center uppercase border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl text-[10px] text-center uppercase">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-[10px] text-center uppercase">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl text-[10px] text-center uppercase">📂 PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase font-black italic">🛠️ Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl text-[10px] text-center uppercase">⌛ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase font-black">📂 Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl text-[10px] text-center uppercase italic">⚙️ Hat/Makineler</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl text-[10px] text-center uppercase italic">📢 İSG Duyuru</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-[10px] text-center text-yellow-500 uppercase">🏆 Bakım Ligi</Link>
          <button onClick={handleSystemReset} className="bg-red-950 border border-red-900 p-3 rounded-2xl text-[10px] text-red-500 uppercase">💀 Reset</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center uppercase italic font-bold">
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">İş Adedi</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">Efor</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1">Duruş</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 italic font-bold">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase underline">⚡ Elektrik</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-red-400 mb-4 uppercase underline">🔥 Doğalgaz</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-blue-400 mb-4 uppercase underline">💧 Su</h2><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 italic font-bold">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
            <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest italic underline decoration-indigo-500">🏆 Performans Matrisi</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-[11px] uppercase tracking-tighter italic font-black"><thead className="text-gray-500 border-b border-slate-800"><tr><th className="py-4">Personel</th><th className="py-4 text-center">İş Adedi</th><th className="py-4 text-right">Efor (MTTR)</th></tr></thead><tbody className="divide-y divide-slate-800">{personelPerformans.map((p,i)=>(<tr key={i} className="hover:bg-slate-800/30 transition italic font-black"><td className="py-4 text-gray-200">{p.isim}</td><td className="py-4 text-green-400 text-center">{p.is}</td><td className="py-4 text-indigo-400 text-right">{p.mttr} dk/iş</td></tr>))}</tbody></table></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl italic font-black"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Analizi</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
        </div>

        {showEkedModal && selectedEked && (<div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 italic font-bold text-center"><div className="bg-slate-900 border-2 border-yellow-600/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative text-white"><button onClick={() => setShowEkedModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl">✕</button><h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest mb-8">🔐 EKED LOTO</h2><div className="space-y-6 text-white uppercase italic"><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner font-black tracking-widest"><p className="text-xl">{selectedEked.yer}</p></div><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner font-black"><p className="text-xl text-yellow-500 italic">{selectedEked.personel}</p></div><button onClick={() => setShowEkedModal(false)} className="w-full bg-yellow-600 text-black py-5 rounded-2xl font-black uppercase text-xs shadow-xl transition-all font-black">Onaylandı</button></div></div></div>)}
        {showVakaModal && selectedVaka && (<div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-bold italic"><div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden italic"><div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600" : "bg-indigo-600"}`}></div><h2 className="text-2xl font-black text-white mb-8 uppercase italic tracking-widest">Detay</h2><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 mb-10 shadow-inner italic font-black uppercase"><p className="text-gray-300 text-sm">"{selectedVaka.arizaDetayi || selectedVaka.aciklama || "Yok."}"</p></div><button onClick={()=>setShowVakaModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black uppercase text-xs transition shadow-2xl italic font-black uppercase">Kapat</button></div></div>)}
      </div>
    </div>
  );
}