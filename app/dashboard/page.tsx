"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; // DOĞRU YOL
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

  // OUTPUTS
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  const RCA_CATEGORIES = [{ id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" }, { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" }, { id: "ortam", label: "Ortam", color: "#8B5CF6" }];

  const downloadFullSnapshot = async () => {
    if (window.prompt("Snapshot Şifresi:") !== "161004") return alert("Hatalı!");
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs"];
      let dbBackup: any = {};
      for (const coll of collections) { const snap = await getDocs(collection(db, coll)); dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() })); }
      const codeRes = await fetch('/api/backup-all'); const codeData = await codeRes.json();
      const blob = new Blob([JSON.stringify({ database: dbBackup, dna: codeData.codeDump }, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `DFU_MASTER_SNAPSHOT.json`; link.click();
    } catch (e) { alert("Hata!"); }
  };

  const handleSystemReset = async () => {
    if (window.confirm("RESET?") && window.prompt("RESET ŞİFRESİ:") === "161004") {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "overtime_logs", "kar_arsivi", "pano_takip"];
      for (const collName of targetColls) { const snap = await getDocs(collection(db, collName)); const batch = writeBatch(db); snap.docs.forEach((d) => batch.delete(d.ref)); await batch.commit(); }
      window.location.reload();
    }
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
            setIsAdmin(true); setUserRole(role); setUserName(userSnap.data().name);
            await fetchInitialData(); await fetchRcaData();
          }
        }
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
    let isC=0, suC=0, duC=0; const hD:any = {}, pD:any = {}, eD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const s = Number(l.toplamSureDakika) || 0;
      if (d.getFullYear().toString() === filterYil) { isC++; suC += s; hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1; if(l.isDuruslu) duC += s; }
      const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { is: 0, efor: 0 }; pD[p].is++; pD[p].efor += s; } });
      if (l.isDuruslu) { if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 }; eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s; }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, is: pD[k].is, mttr: (pD[k].efor / pD[k].is).toFixed(0) })).sort((a,b)=> b.is - a.is));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil]);

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const elS = new Set<string>(), gzS = new Set<string>(), suS = new Set<string>();
    const tEl:any = {}, tGz:any = {}, tSu:any = {};
    rawMeterLogs.forEach((l: any) => {
      const t = l.tip || "Elektrik"; const ay = `${l.tarih?.split("-")[1]}. Ay`;
      if(t==="Elektrik") { elS.add(l.sayacAdi); if(!filterElekSayac || l.sayacAdi===filterElekSayac) tEl[ay] = (tEl[ay]||0) + Number(l.deger || 0); }
      if(t==="Doğalgaz") { gzS.add(l.sayacAdi); if(!filterGazSayac || l.sayacAdi===filterGazSayac) tGz[ay] = (tGz[ay]||0) + Number(l.deger || 0); }
      if(t==="Su") { suS.add(l.sayacAdi); if(!filterSuSayac || l.sayacAdi===filterSuSayac) tSu[ay] = (tSu[ay]||0) + Number(l.deger || 0); }
    });
    setElekSayacList(Array.from(elS).sort()); setGazSayacList(Array.from(gzS).sort()); setSuSayacList(Array.from(suS).sort());
    setGrafikElek(Object.keys(tEl).map(ay=>({ ay, tuketim: tEl[ay] }))); setGrafikGaz(Object.keys(tGz).map(ay=>({ ay, tuketim: tGz[ay] }))); setGrafikSu(Object.keys(tSu).map(ay=>({ ay, tuketim: tSu[ay] })));
  }, [rawMeterLogs, filterElekSayac, filterGazSayac, filterSuSayac]);

  const handleSaveRca = async () => { if (!rcaForm.category) return alert("Seçiniz"); await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true }); alert("Analiz Kaydedildi"); setShowRcaModal(false); fetchRcaData(); };

  if (loading) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center italic tracking-widest"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-white uppercase">SİSTEMLER SENKRONİZE EDİLİYOR...</p></div>;
  if (!isAdmin) return <div className="min-h-screen bg-slate-950 text-red-500 flex justify-center items-center font-black uppercase italic tracking-widest">YETKİSİZ ERİŞİM!</div>;        {/* --- PERSONEL PERFORMANS MATRİSİ VE RCA PARETO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 italic font-black">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
            <h2 className="text-lg font-black text-white mb-6 uppercase underline decoration-indigo-500 font-black italic tracking-widest">🏆 Personel Performans Matrisi</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] uppercase tracking-tighter italic font-black">
                <thead className="text-gray-500 border-b border-slate-800">
                  <tr><th className="py-4 font-black">Personel</th><th className="py-4 text-center font-black">İş Adedi</th><th className="py-4 text-right font-black">Efor (MTTR)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {personelPerformans.map((p,i)=>(
                    <tr key={i} className="hover:bg-slate-800/30 transition shadow-inner italic font-black">
                      <td className="py-4 text-gray-200 font-black italic">{p.isim}</td>
                      <td className="py-4 text-green-400 text-center font-black italic">{p.isSayisi}</td>
                      <td className="py-4 text-indigo-400 text-right font-black italic">
                        {p.eforDk} dk <span className="text-[8px] text-gray-600 italic">({(p.eforDk/(p.isSayisi || 1)).toFixed(0)} dk/iş)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl italic font-black uppercase">
             <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2>
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie 
                    data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" labelLine={false} 
                    label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                   >
                     {RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>        {/* --- RCA ANALİZ MODALI VE DOSYA KAPANIŞI (BÖLÜM 2-B) --- */}
        {showRcaModal && selectedLogForRca && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4 font-bold italic">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative">
              <h2 className="text-xl font-black text-white mb-8 uppercase text-center tracking-[0.2em]">Root Cause Analysis</h2>
              <div className="space-y-6 italic">
                <div className="grid grid-cols-3 gap-2 italic">
                  {RCA_CATEGORIES.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => setRcaForm({ ...rcaForm, category: c.id })} 
                      className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category === c.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/30' : 'bg-slate-950 border-slate-800 text-gray-500 hover:border-indigo-400'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <textarea 
                  value={rcaForm.why} 
                  onChange={e => setRcaForm({ ...rcaForm, why: e.target.value })} 
                  placeholder="Duruş nedenini detaylandırın..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40 shadow-inner italic font-black" 
                />
                <div className="flex gap-4 italic">
                  <button 
                    onClick={() => setShowRcaModal(false)} 
                    className="flex-1 bg-slate-800 py-4 rounded-[20px] font-black text-gray-400 text-xs uppercase"
                  >
                    Vazgeç
                  </button>
                  <button 
                    onClick={handleSaveRca} 
                    className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl shadow-indigo-900/40 text-xs uppercase transition hover:bg-indigo-500"
                  >
                    Analizi Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div> {/* max-w-7xl kapanışı */}
    </div>   {/* min-h-screen kapanışı */}
  );
}