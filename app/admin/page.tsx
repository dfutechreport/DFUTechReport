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
  
  // NEXUS ANALİTİK STATE'LERİ
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);

  // OPERASYONEL STATE'LER
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [showRcaModal, setShowRcaModal] = useState(false);

  const fetchNexusData = async () => {
    try {
      const uSnap = await getDocs(query(collection(db, "users"), limit(50)));
      const pData = uSnap.docs.map(doc => {
        const d = doc.data();
        // Veri Fix: Tüm olası puan alanlarını kontrol et
        const score = d.xp || d.performance || d.performanceScore || d.puan || d.score || 0;
        return { 
          id: doc.id, 
          ad: d.name || d.displayName || d.adSoyad || "İsimsiz",
          val: Number(score)
        };
      });
      setPersonelList(pData.sort((a, b) => b.val - a.val).slice(0, 5));
      
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const c: any = {};
      bSnap.docs.forEach(doc => {
        const sarfiyat = doc.data().sarfiyat;
        if (sarfiyat && Array.isArray(sarfiyat)) {
          sarfiyat.forEach((item: any) => {
            const k = item.parcaAdi || item.stokKodu || "Bilinmeyen";
            c[k] = (c[k] || 0) + 1;
          });
        }
      });
      setCorrData(Object.entries(c).map(([p, f]) => ({ part: p, failure: f })).sort((a:any, b:any) => b.failure - a.failure).slice(0, 5));
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
    } catch (error) { console.error("Initial Data Error:", error); }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-400 font-mono animate-pulse uppercase">Sistem Restorasyonu...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-red-500 font-mono">YETKİSİZ ERİŞİM.</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* --- HEADER --- */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500"></div>
            <h1 className="text-3xl font-black text-indigo-400 italic uppercase tracking-tighter">AI CORE COMMAND CENTER</h1>
            <div className="flex space-x-3 mt-4 md:mt-0">
                <Link href="/dashboard" className="bg-white/5 hover:bg-indigo-500/20 px-5 py-2 rounded-2xl text-xs font-bold border border-white/10 transition-all uppercase italic">Personel Paneli</Link>
                <Link href="/" className="bg-red-500/10 hover:bg-red-500/30 text-red-400 px-5 py-2 rounded-2xl text-xs font-bold border border-red-500/20 transition-all uppercase tracking-tighter">Çıkış</Link>
            </div>
        </header>

        {/* --- SATIR 1: OPERASYONEL PANEL (3 SÜTUNLU GENİŞ YAPI) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
           {/* AKTİF EKED (SOLDA) */}
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border-2 border-indigo-900/40 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500 shadow-[0_0_15px_#eab308]"></div>
              <h2 className="text-xl font-black text-yellow-500 mb-6 flex items-center gap-3 uppercase tracking-widest italic underline underline-offset-8">🔒 AKTİF EKED (LOTO)</h2>
              <div className="space-y-4">
                {aktifEked.map(e => (
                  <div key={e.id} className="bg-indigo-950/20 border border-yellow-900/20 p-5 rounded-[2rem] flex justify-between items-center transition hover:bg-yellow-900/10">
                    <div><p className="text-xs font-black text-yellow-500 uppercase">{e.ekipmanAdi}</p><p className="text-sm font-bold text-gray-300">{e.personel}</p></div>
                    <span className="w-3 h-3 bg-yellow-500 rounded-full animate-ping"></span>
                  </div>
                ))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 text-xs italic font-bold">Aktif kilit yok.</p>}
              </div>
           </div>

           {/* ISG ALARMLARI (ORTADA) */}
           <div className="bg-red-500/[0.02] backdrop-blur-3xl border-2 border-red-900/40 p-8 rounded-[3.5rem] shadow-2xl overflow-hidden">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-2 uppercase tracking-widest italic text-center underline underline-offset-4">🚒 İSG ALARMLARI ({aktifIsgAlarmlari.length})</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-red-950/20 border border-red-900/30 p-4 rounded-2xl flex justify-between items-center text-[10px] font-bold uppercase">{a.ekipmanAdi} <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="text-red-500 underline">DETAY</button></div>))}
              </div>
           </div>

           {/* SAHA BİLDİRİMLERİ (SAĞDA) */}
           <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border-2 border-indigo-900/40 p-8 rounded-[3.5rem] shadow-2xl overflow-hidden">
              <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-2 uppercase tracking-widest italic text-center underline underline-offset-4">📢 SAHA BİLDİRİMLERİ ({aktifIsler.length})</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (<div key={is.id} className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl flex justify-between items-center text-[10px] font-bold uppercase">{is.ekipmanAdi} <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="text-indigo-400 underline">İNCELE</button></div>))}
              </div>
           </div>
        </div>

        {/* --- SATIR 2: ANALİTİK PANEL (MOR BÖLGE: TAM GENİŞLİK VE AYRI SATIR) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full mt-10">
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-indigo-900/40 p-10 rounded-[4rem] relative shadow-3xl overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 shadow-[0_0_20px_#6366f1]"></div>
              <button type="button" onClick={() => setShowLeagueInfo(true)} className="absolute top-6 right-6 text-indigo-400 text-[10px] border border-indigo-500/30 px-3 py-1 rounded font-black uppercase">Algoritma ?</button>
              <h2 className="text-2xl font-black text-indigo-400 mb-10 uppercase tracking-[0.2em] italic text-center underline underline-offset-8 decoration-indigo-500/30">🏆 BAKIM LİGİ SIRALAMASI</h2>
              <div className="space-y-5">
                {personelList.map((p, i) => (
                  <div key={i} className="bg-indigo-950/20 border border-indigo-900/20 p-6 rounded-[2.5rem] flex justify-between items-center transition hover:bg-indigo-500/40">
                    <span className="text-gray-200 font-black uppercase tracking-widest text-base italic">{p.ad}</span>
                    <span className="text-emerald-400 font-mono text-2xl font-black shadow-[0_0_15px_rgba(16,185,129,0.4)]">{p.val} XP</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-emerald-900/40 p-10 rounded-[4rem] relative shadow-3xl overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 shadow-[0_0_20px_#10b981]"></div>
              <button type="button" onClick={() => setShowCorrInfo(true)} className="absolute top-6 right-6 text-emerald-400 text-[10px] border border-emerald-500/30 px-3 py-1 rounded font-black uppercase">Metodoloji ?</button>
              <h2 className="text-2xl font-black text-emerald-400 mb-10 uppercase tracking-[0.2em] italic text-center underline underline-offset-8 decoration-emerald-500/30">📊 STOK ANALİZ MOTORU</h2>
              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={corrData} layout="vertical">
                    <XAxis type="number" hide /><YAxis dataKey="part" type="category" width={140} stroke="#94a3b8" fontSize={13} fontStyle="italic" fontWeight="bold" />
                    <Tooltip contentStyle={{backgroundColor: '#020617', border: '1px solid #10b981', borderRadius: '20px'}} />
                    <Bar dataKey="failure" fill="#10b981" radius={[0, 15, 15, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
        </div>

        {/* RCA TASK LIST (ALT BÖLGE) */}
        <div className="bg-indigo-500/[0.02] backdrop-blur-3xl border border-gray-800 p-8 rounded-[3.5rem] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-8 uppercase tracking-widest italic underline underline-offset-4 decoration-indigo-500">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => (
              <div key={idx} className="bg-gray-800/40 p-6 rounded-[35px] border border-gray-700/50 flex flex-col justify-between h-full hover:border-indigo-500/50 transition shadow-xl">
                <div><p className="text-[10px] font-bold text-gray-500 uppercase">{log.hatAdi}</p><p className="font-bold text-gray-200">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 uppercase tracking-tighter">{log.toplamSureDakika} dk Kayıp</p></div>
                <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); }} className="w-full py-4 mt-6 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Analiz Yap</button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* NEXUS MODALLARI */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans text-center">
          <div className="bg-[#020617] border-2 border-indigo-500/50 p-10 rounded-[3rem] max-w-lg w-full shadow-3xl">
            <h4 className="text-indigo-400 font-black mb-6 text-xl italic border-b border-indigo-500/20 pb-4 uppercase tracking-widest">Performans Algoritması</h4>
            <p className="text-gray-300 text-sm italic font-bold">Teknik personel başarısı users koleksiyonu verileriyle anlık puanlanır.</p>
            <button type="button" onClick={() => setShowLeagueInfo(false)} className="mt-10 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all">Anlaşıldı</button>
          </div>
        </div>
      )}
      {showCorrInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans text-center">
          <div className="bg-[#020617] border-2 border-emerald-500/50 p-10 rounded-[3rem] max-w-lg w-full shadow-3xl">
            <h4 className="text-emerald-400 font-black mb-6 text-xl italic border-b border-emerald-500/20 pb-4 uppercase tracking-widest">Stok Analiz Metodu</h4>
            <p className="text-gray-300 text-sm italic font-bold">En sık arıza yaratan parçalar Firestore sarfiyat verileri üzerinden tespit edilir.</p>
            <button type="button" onClick={() => setShowCorrInfo(false)} className="mt-10 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all">Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}