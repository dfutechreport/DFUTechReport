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
  
  // VERİ STATE'LERİ
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  // MODALS & FILTERS
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [selectedEked, setSelectedEked] = useState<any>(null);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterElekSayac, setFilterElekSayac] = useState("");
  const [filterGazSayac, setFilterGazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");
  const [elekSayacList, setElekSayacList] = useState<string[]>([]);
  const [gazSayacList, setGazSayacList] = useState<string[]>([]);
  const [suSayacList, setSuSayacList] = useState<string[]>([]);

  // KPI VE GRAFİKLER
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  const RCA_CATEGORIES = [{ id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" }, { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" }, { id: "ortam", label: "Ortam", color: "#8B5CF6" }];

  const downloadFullSnapshot = async () => {
    const pass = window.prompt("Snapshot Şifresi:");
    if (pass !== "161004") return alert("Hatalı!");
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs"];
      let dbBackup: any = {};
      for (const coll of collections) { const snap = await getDocs(collection(db, coll)); dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      const codeRes = await fetch('/api/backup-all'); const codeData = await codeRes.json();
      const blob = new Blob([JSON.stringify({ database: dbBackup, dna: codeData.codeDump }, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `DFU_MASTER_SNAPSHOT.json`; link.click();
    } catch (e) { alert("Hata!"); }
  };

  const handleSystemReset = async () => {
    const isSure = window.confirm("TÜM TEST VERİLERİ SİLİNECEK! Emin misiniz?");
    if (!isSure) return;
    const pass = window.prompt("RESET ŞİFRESİ:");
    if (pass !== "161004") return alert("Hatalı!");
    try {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "root_cause_analysis", "mesai", "pano_takip"];
      for (const collName of targetColls) { const snap = await getDocs(collection(db, collName)); const batch = writeBatch(db); snap.docs.forEach((d) => batch.delete(d.ref)); await batch.commit(); }
      alert("Sıfırlandı."); window.location.reload();
    } catch (e) { alert("Hata!"); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && userSnap.data().isApproved) {
            const role = userSnap.data().role;
            if (role === "ik") { router.push("/admin/mesai"); return; }
            if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
              setIsAdmin(true); setUserRole(role); setUserName(userSnap.data().name);
              await fetchInitialData(); await fetchRcaData();
            } else router.push("/dashboard");
          } else router.push("/");
        } else router.push("/");
      } catch (e) { console.error(e); } finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchRcaData = async () => { const snap = await getDocs(collection(db, "root_cause_analysis")); setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))); };
  
  const fetchInitialData = async () => {
    try {
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
      setKpiOnayBekleyen((await getDocs(query(collection(db, "users"), where("isApproved", "==", false)))).size);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, pD:any = {}, eD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const s = Number(l.toplamSureDakika) || 0;
      if (d.getFullYear().toString() === filterYil) {
        isC++; suC += s; hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) duC += s;
      }
      const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { isSayisi: 0, eforDk: 0 }; pD[p].isSayisi++; pD[p].eforDk += s; } });
      if (l.isDuruslu) { if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 }; eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s; }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, ...pD[k] })).sort((a,b)=> b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil]);

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const elS = new Set<string>(), gzS = new Set<string>(), suS = new Set<string>();
    const tEl:any = {}, tGz:any = {}, tSu:any = {};
    rawMeterLogs.forEach((l: any) => {
      const t = l.tip || "Elektrik";
      if(t==="Elektrik") elS.add(l.sayacAdi); if(t==="Doğalgaz") gzS.add(l.sayacAdi); if(t==="Su") suS.add(l.sayacAdi);
      const ay = `${l.tarih?.split("-")[1]}. Ay`;
      if(t==="Elektrik" && (!filterElekSayac || l.sayacAdi===filterElekSayac)) tEl[ay] = (tEl[ay]||0) + Number(l.deger || 0);
      if(t==="Doğalgaz" && (!filterGazSayac || l.sayacAdi===filterGazSayac)) tGz[ay] = (tGz[ay]||0) + Number(l.deger || 0);
      if(t==="Su" && (!filterSuSayac || l.sayacAdi===filterSuSayac)) tSu[ay] = (tSu[ay]||0) + Number(l.deger || 0);
    });
    setElekSayacList(Array.from(elS).sort()); setGazSayacList(Array.from(gzS).sort()); setSuSayacList(Array.from(suS).sort());
    setGrafikElek(Object.keys(tEl).map(ay=>({ ay, tuketim: tEl[ay] }))); setGrafikGaz(Object.keys(tGz).map(ay=>({ ay, tuketim: tGz[ay] }))); setGrafikSu(Object.keys(tSu).map(ay=>({ ay, tuketim: tSu[ay] })));
  }, [rawMeterLogs, filterElekSayac, filterGazSayac, filterSuSayac]);

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Analiz Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="text-slate-500 font-black uppercase text-xs tracking-widest">Güvenlik Kontrolü...</p></div>;
  if (!isAdmin) return <div className="min-h-screen bg-slate-950 text-red-500 flex justify-center items-center font-black">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden italic font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase tracking-tighter text-indigo-400">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg transition">💾 Sistem Yedeği</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Çıkış</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-xs text-center shadow-lg uppercase">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-xs text-center uppercase font-black">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-xs text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic">📂 EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full animate-pulse">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl text-xs text-center text-white uppercase italic border border-gray-600">📂 Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-xs text-center text-white uppercase italic font-black">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic border border-indigo-500/30">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl text-xs text-center text-white uppercase italic">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-xs text-center text-white uppercase italic">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl text-xs text-center text-white uppercase italic">📂 PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl font-black text-xs text-center shadow-lg uppercase italic">🛠️ Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase italic tracking-widest tracking-widest">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase italic">⌛ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl font-semibold text-xs text-center uppercase italic">📂 Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase italic">⚙️ Hat/Makineler</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl font-semibold text-xs text-center uppercase italic">📢 İSG Duyuru</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-xs text-center text-yellow-500 uppercase italic">🏆 Bakım Ligi</Link>
          {userRole === "admin" && <button onClick={handleSystemReset} className="bg-red-950/40 border border-red-900/50 p-3 rounded-2xl text-[10px] font-black uppercase text-red-500 hover:bg-red-600 transition-all italic tracking-tighter shadow-xl">💀 Sistemi Sıfırla</button>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 italic">
           <div className="bg-slate-900 border-2 border-yellow-600/40 p-7 rounded-[3rem] shadow-2xl relative">
              <h2 className="text-lg font-black text-yellow-500 mb-6 uppercase">🔐 AKTİF EKED</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifEked.map((e, idx) => (<div key={idx} className="bg-slate-950 border border-yellow-600/20 p-5 rounded-3xl flex justify-between items-center hover:bg-yellow-600/10 transition"><div><p className="text-xs text-yellow-500 uppercase">{e.yer}</p><p className="text-gray-100">{e.personel}</p></div><button onClick={() => { setSelectedEked(e); setShowEkedModal(true); }} className="bg-yellow-600 text-black text-[10px] font-black px-4 py-2 rounded-xl transition">Detay</button></div>))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase tracking-widest font-black">Kilit Yok.</p>}
              </div>
           </div>
           <div className="bg-slate-900 border-2 border-red-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 uppercase">🚑 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-slate-950 border border-red-900/30 p-5 rounded-3xl flex justify-between items-center italic"><div><p className="text-xs text-red-400 uppercase">{a.hatAdi}</p><p className="text-gray-100 uppercase">{a.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-xl">İncele</button></div>))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase font-black tracking-widest">Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-slate-900 border-2 border-indigo-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 uppercase tracking-widest">📡 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 font-bold">
                {aktifIsler.map(is => (<div key={is.id} className="bg-slate-950 border border-indigo-900/30 p-5 rounded-3xl flex justify-between items-center transition italic"><div><p className="text-xs text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-gray-100 uppercase">{is.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">Detay</button></div>))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase font-black tracking-widest">Bildirim yok.</p>}
              </div>
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] mb-12 shadow-2xl italic">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest italic underline decoration-indigo-500 font-black">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
              const hasRca = rcaLogs.find(r => r.logId === log.id);
              return (<div key={idx} className="bg-slate-950 p-6 rounded-[30px] border border-slate-800 flex flex-col justify-between h-full hover:border-indigo-500 transition shadow-xl italic font-black"><div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{log.hatAdi}</p><p className="font-bold text-gray-200 uppercase">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 italic uppercase tracking-tighter">{log.toplamSureDakika} dk Kayıp</p></div><button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3 mt-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>{hasRca ? "Girişi Güncelle" : "Analiz Yap"}</button></div>);
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase italic font-bold">
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1 italic tracking-widest">İş Adedi</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1 italic tracking-widest">Efor</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1 italic tracking-widest">Duruş</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1 italic tracking-widest">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 italic font-bold">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase underline underline-offset-8">⚡ Elektrik (kWh)</h2><select value={filterElekSayac} onChange={e=>setFilterElekSayac(e.target.value)} className="w-full bg-slate-950 border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner font-black"><option value="">Tüm Sayaçlar</option>{elekSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px', color:'white'}}/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-red-400 mb-4 uppercase underline underline-offset-8">🔥 Doğalgaz (m³)</h2><select value={filterGazSayac} onChange={e=>setFilterGazSayac(e.target.value)} className="w-full bg-slate-950 border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner font-black"><option value="">Tüm Sayaçlar</option>{gazSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikGaz}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px', color:'white'}}/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl"><h2 className="text-xs font-bold text-blue-400 mb-4 uppercase underline underline-offset-8">💧 Su (m³)</h2><select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-slate-950 border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner font-black"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px', color:'white'}}/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 italic font-bold">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl"><h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest italic underline decoration-indigo-500 font-black">🏆 Personel Performans Matrisi</h2><div className="overflow-x-auto"><table className="w-full text-left text-[11px] uppercase tracking-tighter"><thead className="text-gray-500 border-b border-slate-800"><tr><th className="py-4 font-black">Personel</th><th className="py-4 text-center font-black">İş Adedi</th><th className="py-4 text-right font-black">Efor (MTTR)</th></tr></thead><tbody className="divide-y divide-slate-800">{personelPerformans.map((p,i)=>(<tr key={i} className="hover:bg-slate-800/30 transition shadow-inner italic"><td className="py-4 text-gray-200 font-black">{p.isim}</td><td className="py-4 text-green-400 text-center font-black">{p.isSayisi}</td><td className="py-4 text-indigo-400 text-right font-black">{p.eforDk} dk <span className="text-[8px] text-gray-600">({(p.eforDk/(p.isSayisi || 1)).toFixed(0)})</span></td></tr>))}</tbody></table></div></div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl italic"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
        </div>

        {/* MODALLAR */}
        {showEkedModal && selectedEked && (<div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 italic font-bold text-center"><div className="bg-slate-900 border-2 border-yellow-600/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative text-white"><button onClick={() => setShowEkedModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl">✕</button><h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest mb-8 italic">🔐 EKED BİLGİSİ</h2><div className="space-y-6"><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner font-black uppercase"><p className="text-[9px] text-gray-500 mb-1">Bölge</p><p className="text-xl uppercase tracking-tighter font-black">{selectedEked.yer || "Belirsiz"}</p></div><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner font-black uppercase"><p className="text-[9px] text-gray-500 mb-1">Personel</p><p className="text-xl text-yellow-500 italic">{selectedEked.personel || "İsimsiz"}</p></div><button onClick={() => setShowEkedModal(false)} className="w-full bg-yellow-600 text-black py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Anladım</button></div></div></div>)}
        {showVakaModal && selectedVaka && (<div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-bold italic"><div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden italic"><div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-xl" : "bg-indigo-600 shadow-xl"}`}></div><h2 className="text-2xl font-black text-white mb-8 uppercase italic tracking-widest">Bildirim Detayı</h2><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 mb-10 shadow-inner italic font-black uppercase"><p className="text-gray-300 text-sm italic font-black">"{selectedVaka.arizaDetayi || selectedVaka.aciklama || "Not yok."}"</p></div><button onClick={()=>setShowVakaModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black uppercase text-xs transition shadow-2xl">Kapat</button></div></div>)}
      </div>
    </div>
  );
}