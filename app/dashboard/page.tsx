"use client";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, setDoc, updateDoc, serverTimestamp, increment, addDoc, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// TYPESCRIPT FORM ŞEMASI
interface MaintenanceFormData {
  hatAdi: string; ekipmanAdi: string; vardiya: string; isDuruslu: boolean;
  baslangicTarihi: string; baslangicSaati: string; bitisTarihi: string; bitisSaati: string;
  aciklama: string; linkedOrderId: string | null;
}

function DashboardIcerik() {
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<MaintenanceFormData>({
    defaultValues: {
      baslangicTarihi: new Date().toISOString().split('T')[0],
      bitisTarihi: new Date().toISOString().split('T')[0],
      isDuruslu: false, vardiya: "08:00 - 16:00"
    }
  });

  const fetchNexusData = async () => {
    try {
      const pSnap = await getDocs(query(collection(db, "personel"), orderBy("xp", "desc"), limit(5)));
      setPersonelList(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const bSnap = await getDocs(collection(db, "bakimlar"));
      const counts: any = {};
      for (const d of bSnap.docs) {
        const s = d.data().sarfiyat;
        if (s && Array.isArray(s)) {
          for (const item of s) {
            const key = item.parcaAdi || item.stokKodu || "Bilinmeyen";
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }
      setCorrData(Object.entries(counts).map(([part, count]) => ({ part, failure: Number(count) }))
        .sort((a:any, b:any) => b.failure - a.failure).slice(0, 5));
    } catch (err) { console.error("Nexus Error:", err); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) { setUserRole(userSnap.data().role); fetchNexusData(); }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
          <h1 className="text-2xl font-black italic text-indigo-400">TECHNICIAN COMMAND</h1>
          <Link href="/admin" className="text-xs border border-indigo-500/30 px-4 py-2 rounded-xl">Admin</Link>
        </header>

        {/* NEXUS ANALİTİKLER - İSTEDİĞİNİZ KONUM */}
        {["teknisyen", "admin", "operator"].includes(userRole) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 w-full">
            <div className="bg-white/5 border border-indigo-500/20 p-5 rounded-[2.5rem] relative backdrop-blur-md shadow-xl">
              <button onClick={() => setShowLeagueInfo(true)} className="absolute top-4 right-4 text-indigo-400 text-[10px] border border-indigo-500/30 px-2 py-1 rounded-lg font-bold">XP ?</button>
              <h3 className="text-indigo-400 text-xs font-black mb-4 uppercase tracking-widest">🏆 Bakım Ligi</h3>
              <div className="space-y-2">
                {personelList.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-black/30 p-3 rounded-2xl border border-white/5 text-[11px] font-bold">
                    <span>{p.adSoyad || p.name}</span>
                    <span className="text-emerald-400 font-mono italic">{p.xp || 0} XP</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 border border-emerald-500/20 p-5 rounded-[2.5rem] relative backdrop-blur-md shadow-xl">
              <button onClick={() => setShowCorrInfo(true)} className="absolute top-4 right-4 text-emerald-400 text-[10px] border border-emerald-500/30 px-2 py-1 rounded-lg font-bold">Analiz ?</button>
              <h3 className="text-emerald-400 text-xs font-black mb-4 uppercase tracking-widest">📊 Arıza Analizi</h3>
              <div className="h-40 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={corrData} layout="vertical">
                    <XAxis type="number" hide /><YAxis dataKey="part" type="category" width={80} stroke="#64748b" fontSize={8} />
                    <Tooltip contentStyle={{backgroundColor: '#020617', border: '1px solid #10b981'}} /><Bar dataKey="failure" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Orijinal Dashboard İçeriği (Formlar vb.) buradan devam eder... */}
        {/* ... */}

      </div>

      {/* NEXUS MODALLARI - ANA DIV İÇİNDE */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans">
          <div className="bg-[#020617] border-2 border-indigo-500/50 p-8 rounded-[40px] max-w-lg w-full shadow-3xl">
            <h4 className="text-indigo-400 font-black mb-6 text-xl italic border-b border-indigo-500/20 pb-2 uppercase text-center">XP Algoritması</h4>
            <p className="text-sm text-gray-300 mb-6">Müdahale hızı ve planlı bakım başarısı üzerinden XP tanımlanır.</p>
            <button onClick={() => setShowLeagueInfo(false)} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase">Kapat</button>
          </div>
        </div>
      )}
      {showCorrInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-sans">
          <div className="bg-[#020617] border-2 border-emerald-500/50 p-8 rounded-[40px] max-w-lg w-full shadow-3xl">
            <h4 className="text-emerald-400 font-black mb-6 text-xl italic border-b border-emerald-500/20 pb-2 uppercase text-center">Analiz Metodu</h4>
            <p className="text-sm text-gray-300 mb-6">Sarfiyat frekansı ile kronik arıza odakları tespit edilir.</p>
            <button onClick={() => setShowCorrInfo(false)} className="w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase">Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() { return (<Suspense fallback={<div>Yükleniyor...</div>}><DashboardIcerik /></Suspense>); }