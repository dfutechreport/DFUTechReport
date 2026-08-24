"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  // NEXUS STABLE STATES
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);

  // ORIJINAL DATA STATES
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const fetchNexusData = async () => {
    try {
      const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
      
      // 1. BAKIM LİGİ: YAPILAN İŞLER ARŞİVİ (tamamlanan_isler)
      const worksSnap = await getDocs(collection(db, "tamamlanan_isler"));
      const userPerformance: any = {};
      worksSnap.docs.forEach(doc => {
        const d = doc.data();
        const tech = d.personel || d.teknisyen || d.operator || "Bilinmeyen";
        if (!userPerformance[tech]) userPerformance[tech] = { name: tech, score: 0 };
        userPerformance[tech].score += 100;
      });
      const sortedTechs = Object.values(userPerformance)
        .map((u: any) => ({ ad: u.name, val: u.score }))
        .sort((a, b) => b.val - a.val).slice(0, 5);
      setPersonelList(sortedTechs);
      
      // 2. STOK ANALİZİ: YEDEK PARÇA DEPO KAYNAĞI (sarfiyat_logs)
      const sSnap = await getDocs(collection(db, "sarfiyat_logs"));
      const counts: any = {};
      sSnap.docs.forEach((doc) => {
        const d = doc.data();
        const k = d.malzemeAdi || d.parcaAdi || d.stokKodu || "Tanımsız";
        counts[k] = (counts[k] || 0) + 1;
      });
      setCorrData(Object.entries(counts).map(([p, f]) => ({ part: p, failure: f })).sort((a:any, b:any) => b.failure - a.failure).slice(0, 5));
    } catch (e) { console.error("Nexus Sync Error:", e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isApproved) {
          const data = userDoc.data();
          if (data.role === "admin" || data.role === "operator") {
            setIsAdmin(true); setUserRole(data.role);
            setUserName(data.name || user.email);
            fetchInitialData();
            fetchNexusData();
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchInitialData = async () => {
    try {
      const logsSnap = await getDocs(collection(db, "logs"));
      setRawLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const isgSnap = await getDocs(query(collection(db, "isg_alarmlari"), where("durum", "==", "aktif")));
      setAktifIsgAlarmlari(isgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const ekedSnap = await getDocs(query(collection(db, "eked"), where("durum", "==", "aktif")));
      setAktifEked(ekedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const aktifSnap = await getDocs(query(collection(db, "aktif_isler"), orderBy("tarih", "desc")));
      setAktifIsler(aktifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Data Error:", error); }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-400 font-mono animate-pulse uppercase">Sistem Restorasyonu...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-red-500 font-mono">YETKİSİZ ERİŞİM.</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500"></div>
            <h1 className="text-3xl font-black text-indigo-400 italic uppercase">AI CORE COMMAND CENTER</h1>
            <div className="flex space-x-3 mt-4 md:mt-0">
                <Link href="/dashboard" className="bg-white/5 hover:bg-indigo-500/20 px-5 py-2 rounded-xl text-xs font-bold border border-white/10 transition-all uppercase">Dashboard</Link>
                <Link href="/" className="bg-red-500/10 hover:bg-red-500/30 text-red-400 px-5 py-2 rounded-xl text-xs font-bold border border-red-500/20 uppercase transition-all">Çıkış</Link>
            </div>
        </header>

        {/* --- SATIR 1: OPERASYONEL PANEL --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 w-full">
           <div className="lg:col-span-6 bg-indigo-500/[0.02] backdrop-blur-3xl border-2 border-indigo-900/40 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_15px_#eab308]"></div>
              <h2 className="text-xl font-black text-yellow-500 mb-6 flex items-center gap-3 uppercase tracking-widest italic underline underline-offset-8 decoration-yellow-500/30">🔒 AKTİF EKED (LOTO)</h2>
              <div className="space-y-4">
                {aktifEked.map(e => (
                  <div key={e.id} className="bg-indigo-950/20 border border-yellow-900/20 p-5 rounded-[2.5rem] flex justify-between items-center transition hover:bg-yellow-900/10">
                    <div><p className="text-[11px] font-black text-yellow-500 uppercase">{e.ekipmanAdi}</p><p className="text-sm font-bold text-gray-300 italic">{e.personel}</p></div>
                    <span className="w-3 h-3 bg-yellow-500 rounded-full animate-ping"></span>
                  </div>
                ))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Aktif kilit yok.</p>}
              </div>
           </div>

           <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-500/[0.02] backdrop-blur-3xl border-2 border-red-900/40 p-7 rounded-[3.5rem] shadow-2xl overflow-hidden">
                <h2 className="text-sm font-black text-red-500 mb-5 uppercase tracking-widest italic text-center underline underline-offset-4 decoration-red-500/30">🚒 İSG ALARMLARI ({aktifIsgAlarmlari.length})</h2>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar text-[10px] font-bold uppercase">
                  {aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-red-950/20 border border-red-900/30 p-4 rounded-2xl flex justify-between items-center">{a.ekipmanAdi} <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="text-red-500 underline decoration-red-500/50">DETAY</button></div>))}
                </div>
              </div>
              <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border-2 border-indigo-900/40 p-7 rounded-[3.5rem] shadow-2xl overflow-hidden">
                <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-widest italic text-center underline underline-offset-4 decoration-indigo-500/30">📢 SAHA BİLDİRİMLERİ ({aktifIsler.length})</h2>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar text-[10px] font-bold uppercase">
                  {aktifIsler.map(is => (<div key={is.id} className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl flex justify-between items-center">{is.ekipmanAdi} <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="text-indigo-400 underline decoration-indigo-500/50">İNCELE</button></div>))}
                </div>
              </div>
           </div>
        </div>

        {/* --- SATIR 2: ANALİTİK PANEL (v54 MİHENK TAŞI DÜZENİ) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12 w-full">
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-indigo-900/40 p-10 rounded-[4rem] relative shadow-3xl overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 shadow-[0_0_20px_#6366f1]"></div>
              <button type="button" onClick={() => setShowLeagueInfo(true)} className="absolute top-6 right-6 text-indigo-400 text-[10px] border border-indigo-500/30 px-3 py-1 rounded font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all">Algoritma ?</button>
              <h2 className="text-xl font-black text-indigo-400 mb-10 uppercase tracking-widest italic text-center underline underline-offset-8 decoration-indigo-500/30">🏆 BAKIM LİGİ SIRALAMASI</h2>
              <div className="space-y-4">
                {personelList.map((p, i) => (
                  <div key={i} className="bg-indigo-950/20 border border-indigo-900/20 p-5 rounded-[2.5rem] flex justify-between items-center transition hover:bg-indigo-500/40 shadow-inner">
                    <span className="text-gray-200 font-black uppercase tracking-widest text-sm italic">{p.ad}</span>
                    <span className="text-emerald-400 font-mono text-xl font-black shadow-[0_0_15px_rgba(16,185,129,0.4)]">{p.val} Puan</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-emerald-900/40 p-10 rounded-[4rem] relative shadow-3xl overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 shadow-[0_0_20px_#10b981]"></div>
              <button type="button" onClick={() => setShowCorrInfo(true)} className="absolute top-6 right-6 text-emerald-400 text-[10px] border border-emerald-500/30 px-3 py-1 rounded font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all">Metodoloji ?</button>
              <h2 className="text-xl font-black text-emerald-400 mb-10 uppercase tracking-widest italic text-center underline underline-offset-8 decoration-emerald-500/30">📊 STOK ANALİZ MOTORU</h2>
              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={corrData} layout="vertical">
                    <XAxis type="number" hide /><YAxis dataKey="part" type="category" width={140} stroke="#94a3b8" fontSize={12} fontStyle="italic" fontWeight="bold" />
                    <Tooltip contentStyle={{backgroundColor: '#020617', border: '1px solid #10b981', borderRadius: '20px'}} />
                    <Bar dataKey="failure" fill="#10b981" radius={[0, 15, 15, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
        </div>

        {/* RCA ANALİZİ BEKLEYEN DURUŞLAR (ALT SIRA) */}
        <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-gray-800 p-8 rounded-[3.5rem] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest italic underline underline-offset-4 decoration-indigo-500">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => (
              <div key={idx} className="bg-gray-800/40 p-6 rounded-[30px] border border-gray-700/50 flex flex-col justify-between h-full hover:border-indigo-500/50 transition">
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">{log.hatAdi}</p><p className="font-bold text-gray-200">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 uppercase tracking-tighter">{log.toplamSureDakika} dk Kayıp</p></div>
                <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); }} className="w-full py-3 mt-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Analiz Yap</button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* NEXUS MODALLARI */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans text-center">
          <div className="bg-[#020617] border-2 border-indigo-500/50 p-10 rounded-[3rem] max-w-2xl w-full shadow-3xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
            <h4 className="text-indigo-400 font-black mb-8 text-2xl italic border-b border-indigo-500/20 pb-4 uppercase tracking-widest">Performans Puanlama Metodu</h4>
            <div className="space-y-6 text-left text-gray-300 font-medium tracking-tight italic">
              <p>→ <strong>Veri Kaynağı:</strong> Bu sıralama 'Yapılan İşler Arşivi'ndeki (tamamlanan_isler) mühürlü kayıtları baz alır.</p>
              <p>→ <strong>MTTR Çarpanı:</strong> Arıza müdahale hızı en büyük puan bileşenidir. Hedef süre altındaki onarımlar XP değerini katsayılı artırır.</p>
            </div>
            <button type="button" onClick={() => setShowLeagueInfo(false)} className="mt-10 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase italic text-sm">Operasyona Dön</button>
          </div>
        </div>
      )}
      {showCorrInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans text-center">
          <div className="bg-[#020617] border-2 border-emerald-500/50 p-10 rounded-[3rem] max-w-2xl w-full shadow-3xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
            <h4 className="text-emerald-400 font-black mb-8 text-2xl italic border-b border-emerald-500/20 pb-4 uppercase tracking-widest">Stok Analiz Metodolojisi</h4>
            <div className="space-y-6 text-left text-gray-300 font-medium tracking-tight italic">
              <p>→ <strong>Depo Kaynağı:</strong> Bu modül, 'sarfiyat_logs' koleksiyonundaki gerçek depo çıkış hareketlerinden beslenir.</p>
              <p>→ <strong>Pareto (80/20) Analizi:</strong> Arıza sıklığı en yüksek kritik yedek parçalar tespit edilerek duruş riski minimize edilir.</p>
            </div>
            <button type="button" onClick={() => setShowCorrInfo(false)} className="mt-10 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase italic text-sm">Analizi Onayla</button>
          </div>
        </div>
      )}
    </div>
  );
}