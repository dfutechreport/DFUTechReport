"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  const [userEmail, setUserEmail] = useState(""); 
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

  // --- KRİTİK: ŞİFRE KORUMALI TAM SİSTEM SNAPSHOT ---
  const downloadFullSnapshot = async () => {
    const backupPass = window.prompt("Kritik Sistem Yedeği İçin 6 Basamaklı Yetki Şifresini Giriniz:");
    const MASTER_KEY = "161004"; // BURAYI DİLEDİĞİNİZ ŞİFREYLE DEĞİŞTİREBİLİRSİNİZ

    if (!backupPass || backupPass !== MASTER_KEY) {
      alert("Hatalı Şifre! Yetkisiz Erişim Engellendi.");
      return;
    }

    try {
      const now = new Date();
      const timeStamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
      alert("Şifre Doğrulandı. Sistem DNA'sı ve Veriler Paketleniyor. Lütfen Bekleyin...");

      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs"];
      let dbBackup: any = {};
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const codeRes = await fetch('/api/backup-all');
      const codeData = await codeRes.json();

      const finalSnapshot = {
        snapshotInfo: { date: now.toLocaleString('tr-TR'), system: "DFU TECH MASTER SNAPSHOT", author: userName },
        database: dbBackup,
        sourceCodeDNA: codeData.codeDump
      };

      const blob = new Blob([JSON.stringify(finalSnapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `DFU_MASTER_RECOVERY_${timeStamp}.json`;
      link.click();
      alert("Yedekleme Tamamlandı. Güvenli Bir Yerde Saklayınız.");
    } catch (e) { alert("Yedekleme Hatası!"); }
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
      const hatSet = new Set<string>();
      const aSnap = await getDocs(collection(db, "assets"));
      aSnap.docs.forEach(d => { if(d.data().hatAdi) hatSet.add(d.data().hatAdi); });
      setHatListesi(Array.from(hatSet).sort());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0;
    const hD:any = {}, pD:any = {}, eD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const s = Number(l.toplamSureDakika) || 0;
      if (d.getFullYear().toString() === filterYil) {
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
  }, [rawLogs, filterYil]);

  if (loading) return <div className="min-h-screen bg-[#020617] flex justify-center items-center text-white italic">YÜKLENİYOR...</div>;  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><div><h1 className="text-2xl font-black uppercase tracking-tighter">Komuta Merkezi</h1><p className="text-[10px] text-gray-500 font-bold uppercase">{userName} | {userRole}</p></div></div>
          <div className="flex gap-3">
             <Link href="/dashboard" className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg italic">Vardiya Raporu</Link>
             <button onClick={downloadFullSnapshot} className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all italic">💾 Sistem Yedeği</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Çıkış</button>
          </div>
        </div>

        {/* BUTON GRİD */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print italic font-bold">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-xs text-center shadow-lg uppercase">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-xs text-center uppercase">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-xs text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-xs text-center uppercase">📋 Yapılan İşler</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-xs text-center text-yellow-500 uppercase italic">🏆 Bakım Ligi</Link>
        </div>

        {/* ALARM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 italic font-bold">
           <div className="bg-slate-900 border-2 border-yellow-600/40 p-7 rounded-[3rem] shadow-2xl relative">
              <h2 className="text-lg font-black text-yellow-500 mb-6 flex items-center gap-3 uppercase">🔐 AKTİF EKED</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar text-sm">
                {aktifEked.map((e, idx) => (
                  <div key={idx} className="bg-slate-950 border border-yellow-600/20 p-5 rounded-3xl flex justify-between items-center transition hover:bg-yellow-600/10">
                    <div><p className="text-xs text-yellow-500 uppercase">{e.yer}</p><p className="text-gray-100">{e.personel}</p></div>
                    <button onClick={() => { setSelectedEked(e); setShowEkedModal(true); }} className="bg-yellow-600 text-black text-[10px] font-black px-4 py-2 rounded-xl transition active:scale-95">Detay</button>
                  </div>
                ))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 italic">Kilitli sistem yok.</p>}
              </div>
           </div>

           <div className="bg-slate-900 border-2 border-red-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 flex items-center gap-3 uppercase">🚑 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-slate-950 border border-red-900/30 p-5 rounded-3xl flex justify-between items-center italic font-bold">
                    <div><p className="text-xs text-red-400 uppercase">{a.hatAdi}</p><p className="text-gray-100">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition">İncele</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase">Alarm Yok.</p>}
              </div>
           </div>

           <div className="bg-slate-900 border-2 border-indigo-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 flex items-center gap-3 uppercase tracking-widest">📡 BİLDİRİMLER</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-slate-950 border border-indigo-900/30 p-5 rounded-3xl flex justify-between items-center transition">
                    <div><p className="text-xs text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-gray-100">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition">Detay</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-600 italic">Bildirim yok.</p>}
              </div>
           </div>
        </div>

        {/* KPI VE GRAFİKLER */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase italic font-bold">
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1 italic">İş Adedi</p><h3 className="text-4xl font-black text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl"><p className="text-[10px] text-gray-500 font-black mb-1 italic">Efor</p><h3 className="text-4xl font-black text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl"><p className="text-[10px] text-red-500 font-black mb-1 italic">Duruş</p><h3 className="text-4xl font-black text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 font-black mb-1 italic">MTTR</p><h3 className="text-4xl font-black text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 italic font-bold">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl">
             <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2>
             <div className="h-64 w-full">
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
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={grafikIsHatti}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><YAxis tick={{fontSize:10}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[6,6,0,0]} /></BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>

        {/* MODALLAR */}
        {showEkedModal && selectedEked && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 italic font-bold">
            <div className="bg-slate-900 border-2 border-yellow-600/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative text-white text-center">
              <button onClick={() => setShowEkedModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl">✕</button>
              <h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest mb-8 italic">🔐 EKED LOTO BİLGİSİ</h2>
              <div className="space-y-6">
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                  <p className="text-[9px] text-gray-500 uppercase mb-1 font-black">Konum / Makine</p>
                  <p className="text-xl uppercase tracking-tighter">{selectedEked.yer || "Bölge Belirsiz"}</p>
                </div>
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                  <p className="text-[9px] text-gray-500 uppercase mb-1 font-black">Sorumlu Personel</p>
                  <p className="text-xl text-yellow-500 uppercase tracking-tighter italic">{selectedEked.personel || "İsimsiz"}</p>
                </div>
                <button onClick={() => setShowEkedModal(false)} className="w-full bg-yellow-600 text-black py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Bilgileri Onayladım ve Kapat</button>
              </div>
            </div>
          </div>
        )}

        {showVakaModal && selectedVaka && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-bold italic">
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden">
               <div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600" : "bg-indigo-600"}`}></div>
               <h2 className="text-2xl font-black text-white mb-8 uppercase italic tracking-widest">Bildirim Detayı</h2>
               <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 mb-10 shadow-inner"><p className="text-gray-300 italic text-sm">"{selectedVaka.arizaDetayi || selectedVaka.aciklama || "Not yok."}"</p></div>
               <button onClick={()=>setShowVakaModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black uppercase text-xs transition border border-slate-700 italic">Kapat</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}