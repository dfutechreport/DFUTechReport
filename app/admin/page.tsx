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
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  // Filtreler
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");
  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  // Sayaç ve Performans
  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]);

  // KPI ve Grafikler
  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // Map & RCA
  const [activeFloor, setActiveFloor] = useState(1);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

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
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().isApproved) {
          const role = snap.data().role;
          setUserRole(role); setUserName(snap.data().name); setUserEmail(user.email || "");
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
    try {
      const snap = await getDocs(collection(db, "root_cause_analysis"));
      setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (e) { console.error(e); }
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

      const eSnap = await getDocs(query(collection(db, "eked_logs"), where("durum", "==", "Açık")));
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRawLogs(logs);

      const mSnap = await getDocs(query(collection(db, "meter_logs"), orderBy("tarih", "asc")));
      setRawMeterLogs(mSnap.docs.map(d => d.data()));

      const yillar = new Set<string>(); const hatlar = new Set<string>();
      logs.forEach(l => {
        if (l.hatAdi) hatlar.add(l.hatAdi);
        if (l.kayitTarihi) yillar.add(l.kayitTarihi.toDate().getFullYear().toString());
      });
      setYilListesi(Array.from(yillar).sort()); setHatListesi(Array.from(hatlar).sort());
    } catch (e) { console.error(e); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", selectedLogForRca.id), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Kaydedildi"); setShowRcaModal(false); fetchRcaData();
  };

  const getHealthStatus = (name: string) => {
    if (aktifIsler.some(i => i.ekipmanAdi === name && i.isDuruslu)) return "bg-red-500 animate-ping";
    const rca = rcaLogs.find(r => r.ekipman === name);
    if (rca && !rca.category) return "bg-orange-500 shadow-xl";
    return "bg-green-500";
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Yetkisiz Erişim</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* NAVİGASYON HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" className="h-10 bg-white rounded p-1" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter text-white">DFU Yönetici Paneli</h1>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Kullanıcı: {userName}</p>
            </div>
          </div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-gray-800 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-gray-700">Vardiya Raporu</Link>
             <button onClick={()=>auth.signOut()} className="bg-red-900/30 text-red-500 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-red-900/30">Çıkış Yap</button>
          </div>
        </div>

        {/* TÜM BUTONLAR (ORİJİNAL LİSTE) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 no-print">
          {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center">🚨 Yeni İş Emri</Link>)}
          {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-900/60 border border-red-500/50 p-3 rounded-xl font-bold text-xs text-center">Aktif İş Emirleri</Link>)}
          {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center">🗄️ Tamamlanan İşler</Link>)}
          {(userRole === "admin" || userRole === "isg") && (
            <>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-xl font-bold text-xs text-center">🗄️ EKED Arşivi</Link>
              <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center">📢 İSG Duyuru</Link>
              <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center">⚡ KAR İhlal Arşivi</Link>
            </>
          )}
          {userRole === "admin" && (
            <>
              <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Hat / Ekipman</Link>
              <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{kpiOnayBekleyen}</span>}</Link>
            </>
          )}
          {userRole !== "uretim" && userRole !== "isg" && (
            <>
              <Link href="/dashboard/pano-kayit" className="bg-indigo-700 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Kayıt</Link>
              <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">🔌 Pano Listesi</Link>
              <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-xl font-semibold text-xs text-center">🗄️ Pano Arşivi</Link>
              <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center">✅ Kontrol Formları</Link>
              <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center">📅 PM Takvimi</Link>
              <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-xl font-bold text-xs text-center">🗄️ PM Arşivi</Link>
              <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center">⚙️ Yedek Parça</Link>
              <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center">📋 Yapılan İşler</Link>
              <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center">⚡ Sayaç Okuma</Link>
              <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center">⏰ Mesai Raporları</Link>
            </>
          )}
        </div>

        {/* CANLI TESİS HARİTASI */}
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-6 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black">📍 Tesis Sağlık Haritası</h2>
            <div className="flex bg-gray-800 p-1 rounded-xl">
              {[-1, 0, 1, 2].map(f => (
                <button key={f} onClick={() => setActiveFloor(f)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold ${activeFloor === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500'}`}>KAT {f===0?"ZEMİN":f}</button>
              ))}
            </div>
          </div>
          <div className="relative w-full aspect-[21/9] bg-black/40 rounded-3xl overflow-hidden border border-gray-800/50">
            <img src={`/map/floor${activeFloor}.png`} className="w-full h-full object-contain opacity-60 group-hover:opacity-80 transition" />
            {EQUIPMENT_LOCATIONS.filter(eq => eq.floor === activeFloor).map(m => (
              <div key={m.id} className="absolute group cursor-pointer p-2 -m-2 z-10" style={{ top: m.y, left: m.x }}>
                <div className={`w-3.5 h-3.5 rounded-full border border-white/40 ${getHealthStatus(m.name)}`}></div>
                <div className="block md:hidden absolute top-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-bold border border-white/10">{m.name}</div>
                <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-gray-800 p-2 rounded-xl text-[9px] z-50 whitespace-nowrap shadow-2xl">{m.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RCA ANALİZ YÖNETİMİ */}
        {userRole === "admin" && (
          <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-3xl mb-8 shadow-xl">
            <h2 className="text-lg font-bold text-indigo-400 mb-6 flex items-center gap-2">🧠 Analiz Bekleyen Duruşlar</h2>
            <div className="space-y-3">
              {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                const hasRca = rcaLogs.find(r => r.logId === log.id);
                return (
                  <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-[10px] text-gray-500 uppercase">{log.hatAdi}</p>
                      <p className="font-bold text-sm">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p>
                    </div>
                    <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`px-5 py-2 rounded-xl text-[10px] font-bold ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>{hasRca ? "Tamamlandı" : "Analiz Et"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ALARMLAR VE DİĞER KPI/GRAFİKLER BURADA DEVAM EDER... */}
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
            <h2 className="text-sm font-bold text-teal-400 mb-6 uppercase">⚡ Hat Bazlı İş Yoğunluğu</h2>
            <div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>

      </div>

      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-8 rounded-[40px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4 uppercase">Kök Neden Analizi</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c=>(<button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-2.5 rounded-xl text-[10px] font-bold border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white':'bg-gray-800 border-gray-700 text-gray-500'}`}>{c.label}</button>))}</div>
              <textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Kök neden ve aksiyon..." className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-sm h-40 text-white outline-none" />
              <div className="flex gap-4"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-gray-800 py-3 rounded-2xl font-bold text-gray-400">İptal</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-3 rounded-2xl font-bold text-white">Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
