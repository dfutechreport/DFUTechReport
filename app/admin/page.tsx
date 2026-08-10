
"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  // Monitoring States
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);
  
  // Inspection Modals
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);

  // Filters
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [yilListesi, setYilListesi] = useState<string[]>([]);

  // Detailed Personnel Matrix Filters (FIXED: personelHavuzu added)
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  // Metrics
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  // RCA states
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().isApproved) {
          const role = snap.data().role;
          setUserRole(role); setUserName(snap.data().name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
            setIsAdmin(true); fetchInitialData(); fetchRcaData();
          } else { window.location.href = "/dashboard"; }
        }
      } else { window.location.href = "/"; }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchRcaData = async () => {
    const snap = await getDocs(collection(db, "root_cause_analysis"));
    setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
  };

  const fetchInitialData = async () => {
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık"), orderBy("kayitTarihi", "desc")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma"));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım"));

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawLogs(logs);

      const aSnap = await getDocs(collection(db, "assets"));
      const uniqueHats = new Set<string>();
      aSnap.docs.forEach(d => { if (d.data().hatAdi) uniqueHats.add(d.data().hatAdi); });
      setHatListesi(Array.from(uniqueHats).sort());

      const yillar = new Set<string>();
      logs.forEach(l => { if (l.kayitTarihi) yillar.add(l.kayitTarihi.toDate().getFullYear().toString()); });
      setYilListesi(Array.from(yillar).sort());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isCount=0, sureCount=0, durusCount=0;
    const hatData:any = {}, pData:any = {}, eqData:any = {}, pNames = new Set<string>();

    rawLogs.forEach(l => {
      const date = l.kayitTarihi?.toDate();
      const yil = date?.getFullYear().toString();
      const ay = (date?.getMonth() + 1).toString();
      const sure = Number(l.toplamSureDakika) || 0;

      if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterHat || l.hatAdi === filterHat)) {
        isCount++; sureCount += sure;
        hatData[l.hatAdi] = (hatData[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) { durusCount += sure; }
      }

      const ekip = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      ekip.forEach((p: string) => {
        if(p) pNames.add(p);
        if ((!filterYil || yil === filterYil) && (!filterAy || ay === filterAy) && (!filterPerfVardiya || l.vardiya === filterPerfVardiya) && (!filterPerfPersonel || p === filterPerfPersonel)) {
           if (!pData[p]) pData[p] = { isSayisi: 0, eforDk: 0 };
           pData[p].isSayisi++; pData[p].eforDk += sure;
        }
      });

      if (l.isDuruslu) {
        if (!eqData[l.ekipmanAdi]) eqData[l.ekipmanAdi] = { count: 0, sure: 0 };
        eqData[l.ekipmanAdi].count++; eqData[l.ekipmanAdi].sure += sure;
      }
    });

    setPersonelHavuzu(Array.from(pNames).sort());
    setKpiTotals({ is: isCount, sure: sureCount, durus: durusCount, mttr: isCount > 0 ? (sureCount/isCount) : 0 });
    setGrafikIsHatti(Object.keys(hatData).map(k=>({ isim: k, adet: hatData[k] })));
    setPersonelPerformans(Object.keys(pData).map(k=>({ isim: k, ...pData[k] })).sort((a,b)=> filterPerfSiralama === "efor" ? b.eforDk - a.eforDk : b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eqData).map(k=>({ ekipman: k, ...eqData[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil, filterAy, filterHat, filterPerfVardiya, filterPerfPersonel, filterPerfSiralama]);

  const handleInspectVaka = (vaka: any) => { setSelectedVaka(vaka); setShowVakaModal(true); };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Analiz Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse uppercase tracking-[0.2em]">DFU Sistem Hazırlanıyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white rounded p-1" /><h1 className="text-xl font-black uppercase tracking-tighter">Denetim & BI Merkezi</h1></div>
          <div className="flex gap-3 no-print">
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700">Vardiya Raporu</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-red-900/30 transition">Çıkış</button>
          </div>
        </div>

        {/* BUTTON GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl font-bold text-xs text-center">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full animate-bounce">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center uppercase tracking-tighter">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-xl font-bold text-xs text-center border border-indigo-500/30 tracking-tighter">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center tracking-tighter">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center">📅 PM Takvimi</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center">⏰ Mesai Raporları</Link>
        </div>

        {/* ALARM & NOTIFICATION CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-gray-900 border-2 border-red-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-3 tracking-widest">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-red-950/20 border border-red-900/30 p-5 rounded-[25px] flex justify-between items-center group transition">
                    <div><p className="text-[10px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-sm font-bold text-gray-100">{a.ekipmanAdi}</p></div>
                    <button onClick={()=>handleInspectVaka(a)} className="bg-red-600 text-white text-[10px] font-black px-5 py-2 rounded-xl shadow-lg hover:bg-red-500">İNCELE</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic">Kritik alarm yok.</p>}
              </div>
           </div>
           <div className="bg-gray-900 border-2 border-indigo-900/40 p-7 rounded-[40px] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-3 tracking-widest">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-indigo-950/20 border border-indigo-900/30 p-5 rounded-[25px] flex justify-between items-center group transition">
                    <div><p className="text-[10px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-sm font-bold text-gray-100">{is.ekipmanAdi}</p></div>
                    <button onClick={()=>handleInspectVaka(is)} className="bg-indigo-600 text-white text-[10px] font-black px-5 py-2 rounded-xl shadow-lg hover:bg-indigo-500">İNCELE</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic">Bekleyen bildirim yok.</p>}
              </div>
           </div>
        </div>

        {/* RCA TASK LIST */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-[0.2em]">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
              const hasRca = rcaLogs.find(r => r.logId === log.id);
              return (
                <div key={idx} className="bg-gray-800/40 p-6 rounded-[30px] border border-gray-700/50 flex flex-col justify-between h-full hover:border-indigo-500/50 transition">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{log.hatAdi}</p>
                    <p className="font-bold text-gray-200">{log.ekipmanAdi}</p>
                    <p className="text-red-400 font-black text-xs mt-1 uppercase">{log.toplamSureDakika} dk Kayıp</p>
                  </div>
                  <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3 mt-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-xl'}`}>
                    {hasRca ? "Güncelle" : "Analiz Yap"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* KPI SECTION */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase">
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800"><p className="text-[10px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-3xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-gray-800"><p className="text-[10px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-3xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-red-900/20"><p className="text-[10px] text-red-500 font-black mb-1">Duruş</p><h3 className="text-3xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-gray-900 p-6 rounded-[30px] border border-indigo-900/20"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-3xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        {/* PERSONNEL PERFORMANCE - FULLY FIXED V44 */}
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-[45px] mb-12 shadow-2xl">
           <h2 className="text-xl font-black text-blue-400 mb-8 uppercase tracking-widest flex items-center gap-3">👤 PERSONEL PERFORMANS MATRİSİ</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 bg-gray-800/40 p-6 rounded-[25px] border border-gray-700/50">
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Vardiya</label><select value={filterPerfVardiya} onChange={e=>setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Teknisyen</label><select value={filterPerfPersonel} onChange={e=>setFilterPerfPersonel(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Tüm Ekip</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="text-[9px] text-gray-500 uppercase font-black mb-1 block ml-1">Duruş Tipi</label><select value={filterPerfDurus} onChange={e=>setFilterPerfDurus(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-2 text-xs text-white"><option value="">Hepsi</option><option value="durus">Duruşlu</option><option value="normal">Normal</option></select></div>
              <div><label className="text-[9px] text-blue-400 uppercase font-black mb-1 block ml-1">Sıralama</label><select value={filterPerfSiralama} onChange={e=>setFilterPerfSiralama(e.target.value)} className="w-full bg-indigo-950 border border-indigo-500/30 rounded-xl p-2 text-xs text-white font-black"><option value="is">İş Sayısı</option><option value="efor">Toplam Efor</option></select></div>
           </div>
           <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-gray-500 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest"><tr><th className="pb-4">İsim</th><th className="pb-4">İş Sayısı</th><th className="pb-4">Top. Efor</th><th className="pb-4 text-blue-400">MTTR (Ort)</th></tr></thead><tbody className="text-sm">{personelPerformans.slice(0,10).map((p,i)=>(<tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition"><td className="py-4 font-bold text-gray-200">{i<3?"⭐ ":""}{p.isim}</td><td className="py-4 text-green-400 font-black">{p.isSayisi} Adet</td><td className="py-4 font-black">{p.eforDk} dk</td><td className="py-4 text-indigo-400 font-black">{(p.eforDk/p.isSayisi || 0).toFixed(1)} dk</td></tr>))}</tbody></table></div>
        </div>

      </div>

      {/* VAKA İNCELEME MODALI */}
      {showVakaModal && selectedVaka && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[1000] p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 md:p-12 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-2xl shadow-red-600/50" : "bg-indigo-600 shadow-2xl shadow-indigo-600/50"}`}></div>
             <h2 className="text-2xl font-black text-white mb-8 uppercase tracking-widest">Vaka Analiz Raporu</h2>
             <div className="grid grid-cols-2 gap-8 mb-8 border-b border-gray-800 pb-8 uppercase font-black">
                <div><p className="text-[9px] text-gray-500 mb-1">Konum</p><p className="text-sm text-gray-200">{selectedVaka.hatAdi} / {selectedVaka.ekipmanAdi}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Bildiren</p><p className="text-sm text-gray-200">{selectedVaka.bildirenKisi || "Sistem"}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Zaman</p><p className="text-sm text-gray-200">{selectedVaka.kayitTarihi?.toDate().toLocaleString('tr-TR')}</p></div>
                <div><p className="text-[9px] text-gray-500 mb-1">Etki</p><p className={selectedVaka.isDuruslu ? "text-red-500 text-sm" : "text-green-500 text-sm"}>{selectedVaka.isDuruslu ? "Duruşlu" : "Normal"}</p></div>
             </div>
             <div className="bg-black/40 p-6 rounded-3xl border border-gray-800 mb-10 shadow-inner">
                <p className="text-[10px] text-indigo-400 uppercase font-black mb-3 tracking-widest underline underline-offset-8 decoration-indigo-800">Orijinal Açıklama:</p>
                <p className="text-gray-300 italic leading-relaxed text-sm">"{selectedVaka.aciklama || "Açıklama mevcut değil."}"</p>
             </div>
             <button onClick={()=>setShowVakaModal(false)} className="w-full bg-gray-800 hover:bg-gray-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-2xl">Kapat</button>
          </div>
        </div>
      )}

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tighter text-center tracking-[0.2em]">Root Cause Analysis</h2>
            <p className="text-[10px] text-center text-gray-500 mb-8 uppercase font-bold tracking-widest">{selectedLogForRca?.ekipmanAdi}</p>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>( <button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/30':'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-400'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruşun nedenini ve kalıcı aksiyon planını detaylandırın..." className="w-full bg-gray-800 border-gray-800 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40 shadow-inner" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-[20px] font-black text-gray-400 tracking-widest text-xs uppercase">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-600/30 tracking-widest text-xs uppercase">Analizi Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
