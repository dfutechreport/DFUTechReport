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
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [activeFloor, setActiveFloor] = useState(1);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  const EQUIPMENT_LOCATIONS = [
    { id: "k1", name: "KEK HATTI", floor: 1, x: "65%", y: "48%" }, { id: "k2", name: "BAGET HATTI", floor: 1, x: "78%", y: "35%" },
    { id: "z1", name: "SILO GRUBU", floor: 0, x: "85%", y: "22%" }, { id: "z2", name: "HAMURHANE", floor: 0, x: "55%", y: "40%" },
    { id: "b1", name: "SU DEPOSU", floor: -1, x: "20%", y: "60%" }, { id: "p1", name: "PASTRY POĞAÇA HATTI", floor: 2, x: "70%", y: "28%" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().isApproved) {
          const role = snap.data().role;
          setUserRole(role); setUserName(snap.data().name);
          if (["admin", "operator", "uretim", "isg", "teknisyen"].includes(role)) {
            setIsAdmin(true); fetchIlkVeriler(); fetchRcaData();
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

  const fetchIlkVeriler = async () => {
    const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
    setAktifIsler(wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    const logsSnap = await getDocs(collection(db, "maintenance_logs"));
    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    setRawLogs(logs);

    let tIs=0, tSure=0, tDurus=0, dAdet=0; const hData:any = {};
    logs.forEach(l => {
      tIs++; tSure += (l.toplamSureDakika || 0);
      if(l.isDuruslu) { tDurus += (l.toplamSureDakika || 0); dAdet++; }
      hData[l.hatAdi] = (hData[l.hatAdi] || 0) + 1;
    });
    setKpiToplamIs(tIs); setKpiToplamSure(tSure); setKpiAylikDurus(tDurus); setKpiDurusluIsSayisi(dAdet);
    setGrafikTumIslerVerisi(Object.keys(hData).map(k=>({ isim: k, adet: hData[k] })));
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", selectedLogForRca.id), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  const getHealthStatus = (name: string) => {
    if (aktifIsler.some(i => i.ekipmanAdi === name && i.isDuruslu)) return "bg-red-500 animate-ping";
    if (rcaLogs.find(r => r.ekipman === name && !r.category)) return "bg-orange-500 shadow-xl";
    return "bg-green-500";
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" />
          <h1 className="text-2xl font-black uppercase">DFU Yönetici Paneli</h1></div>
          <button onClick={()=>auth.signOut()} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold">Çıkış</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl text-center font-bold text-xs">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl text-center font-bold text-xs">Aktif İşler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl text-center font-bold text-xs">🔒 EKED Takip</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl text-center font-bold text-xs">📅 PM Takvimi</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl text-center font-bold text-xs">📋 İş Listesi</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-6 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black">📍 Tesis Sağlık Haritası</h2>
            <div className="flex bg-gray-800 p-1 rounded-xl">
              {[-1, 0, 1, 2].map(f => (
                <button key={f} onClick={() => setActiveFloor(f)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${activeFloor === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500'}`}>KAT {f===0?"ZEMİN":f}</button>
              ))}
            </div>
          </div>
          <div className="relative w-full aspect-[21/9] bg-black/40 rounded-3xl overflow-hidden">
            <img src={`/map/floor${activeFloor}.png`} className="w-full h-full object-contain opacity-60" />
            {EQUIPMENT_LOCATIONS.filter(eq => eq.floor === activeFloor).map(m => (
              <div key={m.id} className="absolute group cursor-pointer" style={{ top: m.y, left: m.x }}>
                <div className={`w-4 h-4 rounded-full border border-white/40 ${getHealthStatus(m.name)}`}></div>
                <div className="block md:hidden absolute top-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-bold whitespace-nowrap">{m.name}</div>
                <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black p-2 rounded-xl text-[9px] z-50 whitespace-nowrap">{m.name}</div>
              </div>
            ))}
          </div>
        </div>

        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-3xl mb-8 shadow-xl">
            <h2 className="text-lg font-bold text-indigo-400 mb-4">🧠 Analiz Bekleyen Duruşlar</h2>
            <div className="space-y-3">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl flex items-center justify-between border border-gray-700/50">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-[10px] text-gray-500 uppercase">{log.hatAdi}</p>
                      <p className="font-bold text-sm">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p>
                    </div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); }} className={`px-5 py-2 rounded-xl text-[10px] font-bold ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>Analiz</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-3xl font-black text-green-400">{kpiToplamIs}</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruş Sayısı</p><h3 className="text-3xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-indigo-900/30"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Kayıp Süre</p><h3 className="text-3xl font-black text-indigo-400">{kpiAylikDurus} dk</h3></div>
          <div className="bg-gray-900 p-5 rounded-3xl border border-purple-900/30"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">MTTR (Ort)</p><h3 className="text-3xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs).toFixed(0)} dk</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl">
            <h2 className="text-sm font-bold text-indigo-400 mb-6 uppercase">📊 Kök Neden Dağılımı</h2>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name: c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl lg:col-span-2">
            <h2 className="text-sm font-bold text-teal-400 mb-6 uppercase">⚡ İş Yoğunluğu</h2>
            <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>
      </div>

      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-8 rounded-[30px] w-full max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 uppercase">Kök Neden Analizi</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>(<button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-2.5 rounded-xl text-[10px] font-bold border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white':'bg-gray-800 border-gray-700 text-gray-500'}`}>{c.label}</button>))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Analiz..." className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm h-40 text-white outline-none" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-3 rounded-2xl font-bold text-gray-400">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-3 rounded-2xl font-bold text-white">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
