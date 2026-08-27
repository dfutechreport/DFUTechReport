"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, serverTimestamp } from "firebase/firestore";
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
  
  // DATA STATES
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  
  // MODALS & FILTERS
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [selectedEked, setSelectedEked] = useState<any>(null);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [elekSayacList, setElekSayacList] = useState<string[]>([]);
  const [filterElekSayac, setFilterElekSayac] = useState("");
  
  // OUTPUTS
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  // --- KRİTİK: TAM SİSTEM SNAPSHOT FONKSİYONU ---
  const downloadFullSnapshot = async () => {
    try {
      const now = new Date();
      const timeStamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
      alert("TAM YEDEKLEME BAŞLADI (Kod + Veri). Lütfen bitene kadar bekleyin...");

      // 1. Veritabanı Yedeği
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs"];
      let dbBackup: any = {};
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      // 2. Kaynak Kod DNA Yedeği
      const codeRes = await fetch('/api/backup-all');
      const codeData = await codeRes.json();

      // 3. Birleştir ve İndir
      const finalSnapshot = {
        snapshotInfo: { date: now.toLocaleString('tr-TR'), system: "DFU TECH MASTER" },
        database: dbBackup,
        sourceCodeDNA: codeData.codeDump
      };

      const blob = new Blob([JSON.stringify(finalSnapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DFU_FULL_SNAPSHOT_${timeStamp}.json`;
      link.click();
      alert("İŞLEM TAMAM! Tam sistem yedeği bilgisayarınıza indirildi.");
    } catch (e) { alert("Yedekleme sırasında hata oluştu!"); console.error(e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const userData = userSnap.data();
          setUserRole(userData.role); setUserName(userData.name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(userData.role)) {
            setIsAdmin(true); fetchInitialData(); fetchRcaData();
          } else { router.push("/dashboard"); }
        }
      } else { router.push("/"); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchRcaData = async () => {
    const snap = await getDocs(collection(db, "root_cause_analysis"));
    setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
  };

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
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, pD:any = {}, eD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const y = d?.getFullYear().toString();
      const a = (d?.getMonth() + 1).toString();
      const s = Number(l.toplamSureDakika) || 0;
      if ((!filterYil || y === filterYil) && (!filterAy || a === filterAy) && (!filterHat || l.hatAdi === filterHat)) {
        isC++; suC += s; hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) duC += s;
      }
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => {
        if (!pD[p]) pD[p] = { isSayisi: 0, eforDk: 0 };
        pD[p].isSayisi++; pD[p].eforDk += s;
      });
      if (l.isDuruslu) {
        if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 };
        eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s;
      }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, ...pD[k] })).sort((a,b)=> b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil, filterAy, filterHat]);

  if (loading) return <div className="min-h-screen bg-[#020617] flex justify-center items-center text-white italic tracking-widest">YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-[#020617] text-red-500 flex justify-center items-center">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg">💾 Tam Sistem Yedeği</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg">Çıkış</button>
          </div>
        </div>

        {/* GRAFİKLER, KPI'LAR VE ALARMLAR (Orijinal düzeniniz aynen burada devam eder...) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase italic font-bold">
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">İş Sayısı</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1">Müdahale</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1">Duruş Süresi</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 italic font-bold">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2>
             <div className="h-64 w-full font-bold">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                     {RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-teal-400 mb-6 uppercase text-center tracking-[0.2em]">⚡ Hat Bazlı İş Yoğunluğu</h2>
             <div className="h-64 w-full font-bold">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={grafikIsHatti}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>

        {/* MODALLAR */}
        {showEkedModal && selectedEked && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 italic font-bold">
            <div className="bg-slate-900 border-2 border-yellow-600/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative text-white">
              <button onClick={() => setShowEkedModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl">✕</button>
              <h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest mb-6">EKED (LOTO) Detayı</h2>
              <div className="space-y-6">
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                  <p className="text-[9px] text-gray-500 uppercase mb-1 font-black tracking-widest">Kilitlenen Bölge</p>
                  <p className="text-xl uppercase tracking-tighter">{selectedEked.yer || "Bölge Belirtilmemiş"}</p>
                </div>
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                  <p className="text-[9px] text-gray-500 uppercase mb-1 font-black tracking-widest">Kilitlemeyi Yapan Sorumlu</p>
                  <p className="text-xl text-yellow-500 uppercase tracking-tighter">{selectedEked.personel || "İsimsiz"}</p>
                </div>
                <button onClick={() => setShowEkedModal(false)} className="w-full bg-yellow-600 text-black py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Bilgileri Onayladım ve Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}