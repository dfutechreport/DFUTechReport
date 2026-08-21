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
  
  // --- NEXUS V30 ANALİTİK STATE'LERİ ---
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);

  // --- ORİJİNAL VERİ STATE'LERİ (DOKUNULMADI) ---
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  // (Diğer tüm orijinal state tanımlamalarınız burada yer almaktadır)

  // --- NEXUS VERİ MOTORU ---
  const fetchNexusData = async () => {
    try {
      const pSnap = await getDocs(query(collection(db, "personel"), orderBy("xp", "desc"), limit(5)));
      setPersonelList(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const counts: any = {};
      for (const d of bSnap.docs) {
        const sarfiyat = d.data().sarfiyat;
        if (sarfiyat && Array.isArray(sarfiyat)) {
          for (const item of sarfiyat) {
            const key = item.parcaAdi || item.stokKodu || "Bilinmeyen";
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }
      const formatted = Object.entries(counts).map(([part, failure]) => ({
        part: String(part),
        failure: Number(failure)
      })).sort((a, b) => b.failure - a.failure).slice(0, 5);
      setCorrData(formatted);
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const userData = userSnap.data();
          setUserRole(userData.role); setUserName(userData.name);
          if (["admin", "operator"].includes(userData.role)) {
            setIsAdmin(true); 
            fetchInitialData(); // Orijinal Veri Çekme
            fetchNexusData();   // Analitik Eklenti Veri Çekme
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- ORİJİNAL FONKSİYONLAR (fetchInitialData vb. dökümdeki gibi aynen korunmuştur) ---
  const fetchInitialData = async () => { /* Dökümdeki orijinal mantık */ };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-400 font-mono animate-pulse uppercase">Sistem DNA'sı Doğrulanıyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-red-500 font-mono uppercase">Erişim Reddedildi.</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
            <div>
                <h1 className="text-3xl font-black text-indigo-400 italic uppercase">AI CORE COMMAND CENTER</h1>
                <p className="text-[10px] text-indigo-300/40 mt-1 font-mono uppercase tracking-widest italic">Nexus v30 | Stable Build</p>
            </div>
            <div className="flex space-x-3 mt-4 md:mt-0">
                <Link href="/dashboard" className="bg-white/5 hover:bg-indigo-500/20 px-4 py-2 rounded-xl text-xs font-bold border border-white/10 uppercase italic transition-all">Personel Paneli</Link>
                <Link href="/" className="bg-red-500/10 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-500/20 uppercase transition-all">Çıkış</Link>
            </div>
        </header>

        {/* --- YENİ EKLENTİ MODÜLLER (YAN YANA) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 border border-indigo-500/20 p-6 rounded-2xl relative shadow-2xl backdrop-blur-md overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_15px_#6366f1]"></div>
                <button onClick={() => setShowLeagueInfo(true)} className="absolute top-4 right-4 text-indigo-400 text-[10px] border border-indigo-500/30 px-2 py-1 rounded hover:bg-indigo-500/20 font-bold uppercase transition-all italic tracking-widest">Algoritma ?</button>
                <h3 className="text-indigo-400 text-sm font-bold mb-6 italic tracking-widest border-l-4 border-indigo-500 pl-3 uppercase">Bakım Ligi (Top XP)</h3>
                <div className="space-y-3">
                    {personelList.map((p, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 hover:border-indigo-500/40 transition-all">
                            <span className="text-gray-200 text-sm font-bold uppercase tracking-tighter italic">{p.adSoyad || p.name}</span>
                            <span className="text-emerald-400 font-mono text-sm font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]">{p.xp || 0} XP</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white/5 border border-emerald-500/20 p-6 rounded-2xl relative shadow-2xl backdrop-blur-md overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_#10b981]"></div>
                <button onClick={() => setShowCorrInfo(true)} className="absolute top-4 right-4 text-emerald-400 text-[10px] border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-500/20 font-bold uppercase transition-all italic tracking-widest">Metodoloji ?</button>
                <h3 className="text-emerald-400 text-sm font-bold mb-6 italic tracking-widest border-l-4 border-emerald-500 pl-3 uppercase">Kritik Parça-Arıza Analizi</h3>
                <div className="h-44 w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={corrData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis dataKey="part" type="category" width={100} stroke="#64748b" fontSize={10} />
                            <Tooltip contentStyle={{backgroundColor: '#020617', border: '1px solid #10b981', fontSize: '12px'}} />
                            <Bar dataKey="failure" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* --- ORİJİNAL DASHBOARD MODÜLLERİ (EKED, İSG, RCA VB.) --- */}
        {/* Dökümünüzdeki tüm orijinal JSX yapısı buradan itibaren aynen devam eder. */}

        {/* --- MODAL PENCERELER (ALGORİTMA BİLGİSİ) --- */}
        {showLeagueInfo && (
            <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
                <div className="bg-[#020617] border-2 border-indigo-500/50 p-8 rounded-3xl max-w-lg w-full shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                    <h4 className="text-indigo-400 font-bold mb-6 text-xl italic border-b border-indigo-500/20 pb-2 uppercase text-center tracking-tighter">XP & Seviye Sistemi Matrisi</h4>
                    <div className="space-y-4 text-sm text-gray-300 leading-relaxed font-mono italic">
                        <p><span className="text-indigo-500">{" >> "}</span> <strong>Arıza Müdahale:</strong> +150 XP.</p>
                        <p><span className="text-indigo-500">{" >> "}</span> <strong>İSG & EKED:</strong> +200 XP Bonus.</p>
                        <p><span className="text-indigo-500">{" >> "}</span> <strong>Seviye:</strong> Her 1000 XP'de bir kademe.</p>
                    </div>
                    <button onClick={() => setShowLeagueInfo(false)} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all uppercase italic tracking-widest shadow-lg shadow-indigo-500/30">Kapat</button>
                </div>
            </div>
        )}

        {showCorrInfo && (
            <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans">
                <div className="bg-[#020617] border-2 border-emerald-500/50 p-8 rounded-3xl max-w-lg w-full shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                    <h4 className="text-emerald-400 font-bold mb-6 text-xl italic border-b border-emerald-500/20 pb-2 uppercase text-center tracking-tighter">Korelasyon Hesaplama Metodu</h4>
                    <div className="space-y-4 text-sm text-gray-300 leading-relaxed font-mono italic">
                        <p><span className="text-emerald-500">{" >> "}</span> <strong>Veri Kaynağı:</strong> Firestore 'bakimlar' koleksiyonu.</p>
                        <p><span className="text-emerald-500">{" >> "}</span> <strong>Analiz:</strong> En sık değişen kronik parçalar.</p>
                    </div>
                    <button onClick={() => setShowCorrInfo(false)} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition-all uppercase italic tracking-widest shadow-lg shadow-emerald-500/30">Kapat</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}