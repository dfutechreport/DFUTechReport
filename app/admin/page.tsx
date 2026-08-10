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
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  // KPI ve Grafikler
  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);

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
          // TEKNISYEN DAHİL EDİLDİ - DÖNGÜ ÇÖZÜLDÜ
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
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wSnap = await getDocs(query(collection(db, "work_orders"), where("durum", "==", "Açık")));
      const wData = wSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setAktifIsgAlarmlari(wData.filter(d => d.ekipmanAdi === "KAR devreye alma"));
      setAktifPmAlarmlari(wData.filter(d => d.sorunTipi === "Planlı Bakım"));
      setAktifIsler(wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım").slice(0, 5));

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
    } catch (e) { console.error(e); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Kategori Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Analiz Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">SİSTEM YÜKLENİYOR...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold text-xl uppercase">Giriş Yetkisi Bekleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white rounded p-1" /><h1 className="text-xl font-black uppercase tracking-tighter">Yönetici Paneli</h1></div>
          <div className="flex gap-3"><Link href="/dashboard" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700">Vardiya Raporu</Link><button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-red-900/30">Güvenli Çıkış</button></div>
        </div>

        {/* TÜM BUTONLAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
          {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg hover:bg-red-500 transition">🚨 Yeni İş Emri</Link>)}
          {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-xl font-bold text-xs text-center hover:bg-red-600 transition">Aktif İşler</Link>)}
          {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center hover:bg-gray-600 transition">🗄️ Tamamlanan İşler</Link>)}
          {(userRole === "admin" || userRole === "isg") && (
            <><Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center hover:bg-yellow-500 transition">🔒 EKED Takip</Link><Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center">📢 İSG Duyuru</Link></>
          )}
          {userRole === "admin" && (<Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{kpiOnayBekleyen}</span>}</Link>)}
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Yedek Parça</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-xl font-black text-xs text-center">🛠️ Manuel PM Başlat</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">📋 Yapılan İşler</Link>
        </div>

        {/* RCA ANALİZ */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-3xl mb-12 shadow-xl">
            <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2 uppercase tracking-tighter">🧠 Analiz Bekleyen Duruşlar</h2>
            <div className="space-y-3">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50 transition">
                    <div className="flex-1 min-w-0 mr-4"><p className="text-[10px] text-gray-500 uppercase">{log.hatAdi}</p><p className="font-bold text-sm text-white">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p></div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`px-5 py-2 rounded-xl text-[10px] font-bold transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>{hasRca ? "Tamamlandı" : "Analiz Et"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI VE GRAFİKLER */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-3xl font-black text-green-400">{kpiToplamIs}</h3></div>
           <div className="bg-gray-900 p-5 rounded-3xl border border-gray-800"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruş Sayısı</p><h3 className="text-3xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
           <div className="bg-gray-900 p-5 rounded-3xl border border-indigo-900/30"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Kayıp Süre</p><h3 className="text-3xl font-black text-indigo-400">{kpiAylikDurus} dk</h3></div>
           <div className="bg-gray-900 p-5 rounded-3xl border border-purple-900/30"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">MTTR (Ort)</p><h3 className="text-3xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs || 0).toFixed(0)} dk</h3></div>
        </div>
      </div>

      {/* RCA MODAL */}
      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-8 rounded-[40px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4 uppercase">Arıza Analizi</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>(<button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-2.5 rounded-xl text-[10px] font-bold border transition ${rcaForm.category === c.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>{c.label}</button>))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Analiz..." className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm h-40 text-white outline-none focus:ring-1 ring-indigo-500" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-3 rounded-2xl font-bold text-gray-400">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-3 rounded-2xl font-bold text-white">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

