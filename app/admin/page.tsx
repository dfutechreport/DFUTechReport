"use client";
import * as XLSX from "xlsx";
import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, Area, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import Link from "next/link";
import { useRouter } from "next/navigation";

const RCA_CATEGORIES = [
  { id: "insan", label: "İnsan", color: "#3B82F6" }, { id: "makine", label: "Makine", color: "#EF4444" },
  { id: "malzeme", label: "Malzeme", color: "#10B981" }, { id: "metot", label: "Metot", color: "#F59E0B" },
  { id: "ortam", label: "Ortam", color: "#8B5CF6" }
];

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // States
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);
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
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  const [showKpiModal, setShowKpiModal] = useState(false);
  const [selectedKpiLogDetails, setSelectedKpiLogDetails] = useState<any[]>([]);
  const [showKpiDetailWindow, setShowKpiDetailWindow] = useState(false);
  const [kpiFYil, setKpiFYil] = useState(new Date().getFullYear().toString());
  const [kpiFAy, setKpiFAy] = useState("");
  const [kpiFHat, setKpiFHat] = useState("");
  const [kpiFPersonel, setKpiFPersonel] = useState("");
  const [kpiFDurus, setKpiFDurus] = useState("HEPSİ");
  const [showMeterImportModal, setShowMeterImportModal] = useState(false);
  const [isMeterImporting, setIsMeterImporting] = useState(false);

  const formatExcelTime = (val: any) => {
    if (!val) return "00:00";
    if (typeof val === 'string') {
      const m = val.match(/(\d{1,2})[:.](\d{1,2})/);
      return m ? `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}` : "00:00";
    }
    if (typeof val === 'number') {
      const totalSeconds = Math.round(val * 24 * 60 * 60);
      return `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}`;
    }
    return "00:00";
  };

  const norm = (s: any) => String(s || "").replace(/[İIı]/g, 'I').replace(/[ŞŞ]/g, 'S').replace(/[ĞĞ]/g, 'G').replace(/[ÜÜ]/g, 'U').replace(/[ÖÖ]/g, 'O').replace(/[ÇÇ]/g, 'C').replace(/\s/g, '').toUpperCase();

  const getCol = (row: any, keyword: string) => {
    const kNorm = norm(keyword);
    const key = Object.keys(row).find(k => norm(k).includes(kNorm));
    return key ? row[key] : null;
  };

  const handleExcelImport = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const aylar: any = { "OCAK":"01","SUBAT":"02","MART":"03","NISAN":"04","MAYIS":"05","HAZİRAN":"06","TEMMUZ":"07","AGUSTOS":"08","EYLUL":"09","EKIM":"10","KASIM":"11","ARALIK":"12" };
      const mapped = data.map((row: any) => {
        const ay = aylar[norm(getCol(row, "AY"))] || "01";
        const tarih = `${getCol(row, "YIL")||"2026"}-${ay}-${String(getCol(row, "GUN")||"01").padStart(2, '0')}`;
        const start = formatExcelTime(getCol(row, "BASLANGIC"));
        const end = formatExcelTime(getCol(row, "BITIS"));
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let duration = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (duration < 0) duration += 1440;
        const p1 = String(getCol(row, "PERSONEL 1") || "Sistem").trim();
        return {
          hatAdi: String(getCol(row, "HAT") || "").trim(), ekipmanAdi: String(getCol(row, "EKIPMAN") || "").trim(),
          aciklama: String(getCol(row, "IS") || "-"), baslangicSaati: start, bitisSaati: end, 
          baslangicTarihi: tarih, bitisTarihi: tarih, toplamSureDakika: duration,
          vardiya: getCol(row, "VARDIYA") || "08:00 - 16:00", isDuruslu: String(getCol(row, "DURUS") || "").toUpperCase() !== "YOK",
          teknisyen: p1, yardimciTeknisyenler: [getCol(row, "PERSONEL 2"), getCol(row, "PERSONEL 3")].filter(p => p && p !== "-"),
          bildirenKisi: p1, usedMaterials: [], durum: "Kapalı", kayitTarihi: new Date(), isImported: true
        };
      });
      setImportPreview(mapped.filter(i => i.hatAdi)); setShowImportModal(true);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (!window.confirm("Aktarım başlatılsın mı?")) return;
    setIsImporting(true);
    try {
      for (let i = 0; i < importPreview.length; i += 500) {
        const batch = writeBatch(db);
        importPreview.slice(i, i + 500).forEach(item => {
          const uId = `imp_${item.baslangicTarihi}_${item.hatAdi}_${item.ekipmanAdi}_${item.baslangicSaati}`.replace(/\s+/g, '_').replace(/\//g, '-');
          batch.set(doc(db, "maintenance_logs", uId), item);
        });
        await batch.commit();
      }
      alert("Aktarım Başarılı"); setShowImportModal(false); window.location.reload();
    } catch (err) { alert(err); } finally { setIsImporting(false); }
  };

  const clearOldImports = async () => {
    if (!window.confirm("KORUNANLAR DIŞINDAKİ TÜM KAYITLAR SİLİNECEK?")) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "maintenance_logs"));
      const allowed = ["DFUTECHREPORT", "HALILCAKIR", "TEKNIKSERVIS"];
      const toDelete = snap.docs.filter(d => {
          const data = d.data();
          const bk = norm(data.bildirenKisi);
          const tk = norm(data.teknisyen);
          const isAllowed = allowed.some(a => bk.includes(a) || tk.includes(a));
          return !isAllowed || data.isImported === true;
      });
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      alert(`${toDelete.length} kayıt silindi.`); window.location.reload();
    } catch (err) { alert("Hata: " + err); setLoading(false); }
  };

  const handleMeterDataImport = async (files: FileList) => {
    if (files.length === 0) return;
    setIsMeterImporting(true);
    try {
      const logSnap = await getDocs(collection(db, "meter_logs"));
      const allLogDocs = logSnap.docs;
      for (let i = 0; i < allLogDocs.length; i += 500) {
        const b = writeBatch(db);
        allLogDocs.slice(i, i + 500).forEach(d => b.delete(d.ref));
        await b.commit();
      }
      const uniqueMeters: Record<string, string[]> = { "Elektrik": [], "Su": [], "Doğalgaz": [] };
      const allLogs: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const workbook = XLSX.read(await file.arrayBuffer());
        const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let type = file.name.toUpperCase().includes("ELEK") ? "Elektrik" : file.name.toUpperCase().includes("DOGAL") || file.name.toUpperCase().includes("DOĞAL") ? "Doğalgaz" : "Su";
        data.forEach(row => {
          const rawTs = row["Zaman damgası"];
          const dateStr = typeof rawTs === 'number' ? new Date((rawTs - 25569) * 86400 * 1000).toISOString().split('T')[0] : new Date(rawTs).toISOString().split('T')[0];
          Object.keys(row).forEach(key => {
            if (key !== "Zaman damgası" && !isNaN(Number(row[key]))) {
              if (!uniqueMeters[type].includes(key)) uniqueMeters[type].push(key);
              allLogs.push({ sayacAdi: key, deger: Number(row[key]), tarih: dateStr, tip: type, personel: "Sistem", timestamp: serverTimestamp() });
            }
          });
        });
      }
      for (let i = 0; i < allLogs.length; i += 500) {
        const b = writeBatch(db);
        allLogs.slice(i, i + 500).forEach(l => b.set(doc(collection(db, "meter_logs")), l));
        await b.commit();
      }
      const mBatch = writeBatch(db);
      for (const [t, ads] of Object.entries(uniqueMeters)) {
        for (const ad of ads) {
            // FIXED: SLASH REPLACEMENT FOR FIRESTORE PATHS
            const mId = `${t}_${ad}`.replace(/\s+/g,'_').replace(/\//g, '-');
            mBatch.set(doc(db, "meters", mId), { adi: ad, tip: t }, { merge: true });
        }
      }
      await mBatch.commit();
      alert("Sayaçlar güncellendi."); window.location.reload();
    } catch (e: any) { alert(e.message); } finally { setIsMeterImporting(false); }
  };

  const handleCopyScript = () => {
    const dnaScript = "Get-ChildItem -Recurse -Include *.tsx,*.ts | ForEach-Object { \"--- FILE: $($_.FullName) ---\" + [char]96 + \"n\" | Out-File -Append PROJE_DOKUMU.txt; Get-Content $_.FullName | Out-File -Append PROJE_DOKUMU.txt; [char]96 + \"n\" + [char]96 + \"n\" | Out-File -Append PROJE_DOKUMU.txt }";
    navigator.clipboard.writeText(dnaScript);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const downloadFullSnapshot = async () => {
    if (window.prompt("Şifre:") !== "161004") return;
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs", "kar_arsivi"];
      let dbBackup: any = {};
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const payload = { database: dbBackup, dna: "ULTIMATE_V37", date: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
      link.download = `DFU_MASTER_DNA_BACKUP.json`; link.click();
    } catch (e) { alert("Hata!"); }
  };

  const handleSystemReset = async () => {
    if (window.confirm("RESET?") && window.prompt("ŞİFRE:") === "161004") {
      setLoading(true);
      const targetColls = ["maintenance_logs", "work_orders", "meter_logs", "eked_logs", "overtime_logs", "kar_arsivi", "pano_takip", "root_cause_analysis"];
      for (const c of targetColls) {
        const snap = await getDocs(collection(db, c));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      window.location.reload();
    }
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
      setKpiOnayBekleyen((await getDocs(query(collection(db, "users"), where("isApproved", "==", false)))).size);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().isApproved) {
          const role = snap.data().role;
          if (role === "ik") return router.push("/admin/mesai");
          setIsAdmin(true); setUserRole(role); setUserName(snap.data().name);
          await fetchInitialData(); 
        }
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let isC=0, suC=0, duC=0; const hD:any = {}, pD:any = {}, eD:any = {};
    rawLogs.forEach((l: any) => {
      const d = l.kayitTarihi?.toDate ? l.kayitTarihi.toDate() : new Date(l.kayitTarihi);
      const s = Number(l.toplamSureDakika) || 0;
      if (d.getFullYear().toString() === filterYil) {
        isC++; suC += s; hD[l.hatAdi] = (hD[l.hatAdi] || 0) + 1;
        if(l.isDuruslu) duC += s;
      }
      const crew = Array.isArray(l.yardimciTeknisyenler) ? [l.bildirenKisi, ...l.yardimciTeknisyenler] : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!pD[p]) pD[p] = { isSayisi: 0, eforDk: 0 }; pD[p].isSayisi++; pD[p].eforDk += s; } });
      if (l.isDuruslu) { if (!eD[l.ekipmanAdi]) eD[l.ekipmanAdi] = { count: 0, sure: 0 }; eD[l.ekipmanAdi].count++; eD[l.ekipmanAdi].sure += s; }
    });
    setKpiTotals({ is: isC, sure: suC, durus: duC, mttr: isC > 0 ? (suC/isC) : 0 });
    setGrafikIsHatti(Object.entries(hD).map(([name, value]) => ({ name, value })).sort((a:any,b:any)=>b.value-a.value));
    setPersonelPerformans(Object.entries(pD).map(([name, v]:any) => ({ name, is: v.isSayisi, efor: v.eforDk })).sort((a:any,b:any)=>b.efor-a.efor));
    setEkipmanPerformans(Object.entries(eD).map(([name, v]:any) => ({ name, count: v.count, sure: v.sure })).sort((a:any,b:any)=>b.sure-a.sure));
  }, [rawLogs, filterYil]);

  useEffect(() => {
    const groups:any = { Elek:{}, Gaz:{}, Su:{} };
    rawMeterLogs.forEach(log => {
      const d = new Date(log.tarih);
      if (d.getFullYear().toString() === filterYil) {
        const m = (d.getMonth()+1).toString().padStart(2,'0');
        if (log.tip === "Elektrik" && (!filterElekSayac || log.sayacAdi === filterElekSayac)) groups.Elek[m] = (groups.Elek[m]||0) + log.deger;
        if (log.tip === "Doğalgaz" && (!filterGazSayac || log.sayacAdi === filterGazSayac)) groups.Gaz[m] = (groups.Gaz[m]||0) + log.deger;
        if (log.tip === "Su" && (!filterSuSayac || log.sayacAdi === filterSuSayac)) groups.Su[m] = (groups.Su[m]||0) + log.deger;
      }
    });
    setGrafikElek(Object.entries(groups.Elek).map(([name, value]) => ({ name, value })));
    setGrafikGaz(Object.entries(groups.Gaz).map(([name, value]) => ({ name, value })));
    setGrafikSu(Object.entries(groups.Su).map(([name, value]) => ({ name, value })));
  }, [rawMeterLogs, filterYil, filterElekSayac, filterGazSayac, filterSuSayac]);

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest">Yükleniyor...</div>;
  if (!isAdmin) return <div className="p-10 text-red-500 font-bold uppercase italic text-center">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden italic font-black uppercase selection:bg-indigo-500">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-10 border-b border-gray-800 pb-8 no-print">
          <div className="flex items-center gap-4 w-full lg:w-auto justify-center lg:justify-start"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><h1 className="text-xl md:text-2xl font-black uppercase text-indigo-400 tracking-tighter">Komuta Merkezi</h1></div>
          <div className="flex flex-wrap justify-center lg:justify-end gap-2 md:gap-3 w-full lg:w-auto">
             <button onClick={() => setShowKpiModal(true)} className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border border-white/10 animate-pulse">📈 KPI ANALİZ</button>
             <Link href="/dashboard" className="bg-slate-800 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border border-slate-700 text-center flex items-center">Vardiya Raporu</Link>
             <button onClick={clearOldImports} className="bg-red-900/40 border border-red-500/30 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg hover:bg-red-800 text-center">🗑️ TEMİZLE</button>
             <label className="bg-orange-600 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border border-orange-500/30 cursor-pointer hover:bg-orange-500 text-center flex items-center">📊 IMPORT <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} /></label>
             <button onClick={() => setShowMeterImportModal(true)} className="bg-emerald-600 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border border-emerald-500/30 text-center">🔌 SAYAÇ</button>
             <button onClick={downloadFullSnapshot} className="bg-slate-700 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg italic text-center">💾 YEDEK</button>
             <button onClick={handleCopyScript} type="button" className={`${copySuccess ? 'bg-indigo-500' : 'bg-slate-800'} px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border border-indigo-500/30 transition-all text-center`}>{copySuccess ? '✓ KOPYALANDI' : '🧬 DNA'}</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase shadow-lg text-center">Çıkış</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-[10px] text-center uppercase shadow-lg">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-[10px] text-center uppercase">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-[10px] text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📂 EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-[10px] text-center uppercase relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[8px] px-1 rounded-full animate-pulse">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl text-[10px] text-center uppercase border border-gray-600 text-white">📂 Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📝 Formlar</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📑 Görev Listesi</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl text-[10px] text-center uppercase text-white shadow-xl">🚨 Kaçak Akım</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📅 PM Takvim</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📂 PM Arşiv</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">✅ PM Girişi</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">💧 Sayaç Girişi</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⏳ Mesai Arşivi</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white shadow-lg">🏁 Biten İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white shadow-lg">🏭 Envanter</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white shadow-lg">📢 Duyurular</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/30 p-3 rounded-2xl text-[10px] text-center uppercase text-yellow-500 font-black">🏆 Bakım Ligi</Link>
          {userRole === "admin" && <button onClick={handleSystemReset} className="bg-red-950 border border-red-500/50 p-3 rounded-2xl text-[10px] text-red-500 font-black uppercase">☢️ SİSTEMİ SIFIRLA</button>}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] mb-12 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-widest italic mb-6">📉 RCA Pareto Analizi (5 Neden)</h2>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rawLogs.filter((l:any)=>l.rcaCategory===c.id).length }))} innerRadius={60} outerRadius={120} paddingAngle={5} dataKey="value">
                  {RCA_CATEGORIES.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black text-white">
              <h2 className="text-xs text-yellow-400 mb-4 uppercase underline">⚡ Elektrik</h2>
              <div className="h-48"><ResponsiveContainer><BarChart data={grafikElek}><XAxis dataKey="name" stroke="#555" fontSize={8} /><Tooltip contentStyle={{backgroundColor:'#000', borderRadius:'10px'}} /><Bar dataKey="value" fill="#fbbf24" /></BarChart></ResponsiveContainer></div>
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black text-white">
              <h2 className="text-xs text-red-400 mb-4 uppercase underline">🔥 Doğalgaz</h2>
              <div className="h-48"><ResponsiveContainer><BarChart data={grafikGaz}><XAxis dataKey="name" stroke="#555" fontSize={8} /><Tooltip contentStyle={{backgroundColor:'#000', borderRadius:'10px'}} /><Bar dataKey="value" fill="#f87171" /></BarChart></ResponsiveContainer></div>
           </div>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black text-white">
              <h2 className="text-xs text-blue-400 mb-4 uppercase underline">💧 Su</h2>
              <div className="h-48"><ResponsiveContainer><BarChart data={grafikSu}><XAxis dataKey="name" stroke="#555" fontSize={8} /><Tooltip contentStyle={{backgroundColor:'#000', borderRadius:'10px'}} /><Bar dataKey="value" fill="#60a5fa" /></BarChart></ResponsiveContainer></div>
           </div>
        </div>
      </div>

      {showKpiModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setShowKpiModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-indigo-500/30 w-full max-w-[95%] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col text-white font-black italic uppercase">
            <div className="p-8 border-b border-indigo-500/20 flex justify-between items-center bg-orange-500/5"><div><h2 className="text-xl text-orange-500 tracking-widest">📈 KPI ANALİZ MERKEZİ</h2></div><button onClick={() => setShowKpiModal(false)} className="text-indigo-500/50 hover:text-orange-500 text-3xl">✕</button></div>
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <div className="w-full lg:w-80 bg-black/30 border-r border-slate-800 p-6 space-y-4 overflow-y-auto text-[9px]">
                <h3 className="text-indigo-500 uppercase tracking-widest">Filtreleme</h3>
                <div><label className="text-slate-500 block">YIL</label><select value={kpiFYil} onChange={e=>setKpiFYil(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2"><option value="2025">2025</option><option value="2026">2026</option></select></div>
                <div><label className="text-slate-500 block">AY</label><select value={kpiFAy} onChange={e=>setKpiFAy(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2"><option value="">TÜM AYLAR</option>{["01","02","03","04","05","06","07","08","09","10","11","12"].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="text-slate-500 block">HAT</label><select value={kpiFHat} onChange={e=>setKpiFHat(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2"><option value="">TÜM HATTAR</option>{Array.from(new Set(rawLogs.map(l=>l.hatAdi))).filter(Boolean).sort().map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="text-slate-500 block">PERSONEL</label><select value={kpiFPersonel} onChange={e=>setKpiFPersonel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2"><option value="">TÜM PERSONEL</option>{Array.from(new Set(rawLogs.map(l=>l.teknisyen))).filter(Boolean).sort().map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-slate-500 block">DURUŞ</label><div className="flex gap-2">{["HEPSİ", "VAR", "YOK"].map(d=><button key={d} onClick={()=>setKpiFDurus(d)} className={`flex-1 py-2 rounded-xl border ${kpiFDurus === d ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{d}</button>)}</div></div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto bg-slate-950/50">
                <div className="h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={(() => {
                        const filtered = rawLogs.filter(l => {
                          const d = l.baslangicTarihi || "";
                          const matchYil = d.startsWith(kpiFYil);
                          const matchAy = !kpiFAy || d.split('-')[1] === kpiFAy;
                          const matchHat = !kpiFHat || l.hatAdi === kpiFHat;
                          const matchPers = !kpiFPersonel || l.teknisyen === kpiFPersonel;
                          const matchDurus = kpiFDurus === "HEPSİ" || (kpiFDurus === "VAR" ? l.isDuruslu : !l.isDuruslu);
                          return matchYil && matchAy && matchHat && matchPers && matchDurus;
                        });
                        const groups: any = {};
                        filtered.forEach(f => {
                          const key = kpiFHat ? f.ekipmanAdi : f.hatAdi;
                          if(!groups[key]) groups[key] = { name: key, sure: 0, adet: 0, logs: [] };
                          groups[key].sure += Number(f.toplamSureDakika) || 0;
                          groups[key].adet += 1;
                          groups[key].logs.push(f);
                        });
                        return Object.values(groups).sort((a:any, b:any) => b.sure - a.sure);
                      })()}
                      onClick={(data: any) => { if(data && data.activePayload) { setSelectedKpiLogDetails(data.activePayload[0].payload.logs); setShowKpiDetailWindow(true); } }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{backgroundColor:'rgba(15, 23, 42, 0.9)', border:'1px solid rgba(99, 102, 241, 0.5)', borderRadius:'20px', backdropFilter: 'blur(10px)'}} />
                      <Area yAxisId="right" type="monotone" name="İş Adedi" dataKey="adet" fill="#6366f133" stroke="#6366f1" />
                      <Bar yAxisId="left" dataKey="sure" name="Toplam Süre (DK)" fill="#818cf8" radius={[10, 10, 0, 0]} barSize={35} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showKpiDetailWindow && (
        <div className="fixed inset-0 z-[130] flex items-center justify-end p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowKpiDetailWindow(false)}></div>
          <div className="relative bg-slate-900 border-l-4 border-indigo-500 w-full max-w-xl h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50"><h3 className="text-lg font-black text-white italic uppercase tracking-widest">🔍 İş Detay Arşivi</h3><button onClick={()=>setShowKpiDetailWindow(false)} className="text-slate-500 hover:text-white text-2xl">✕</button></div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-white uppercase italic font-black">
              {selectedKpiLogDetails.map((log, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl hover:border-indigo-500/50 transition-all"><div className="flex justify-between text-[9px] font-black text-indigo-400 mb-2"><span>{log.baslangicTarihi}</span><span className="text-emerald-400">{log.toplamSureDakika} DK</span></div><h4 className="text-white text-xs font-black mb-2">{log.hatAdi} - {log.ekipmanAdi}</h4><p className="text-slate-400 text-[11px] font-bold italic leading-relaxed uppercase">"{log.aciklama}"</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-white uppercase font-black italic">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => !isImporting && setShowImportModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-orange-500/30 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col font-black italic text-white uppercase">
            <div className="p-8 border-b border-orange-500/10 flex justify-between items-center bg-orange-500/5 uppercase tracking-widest"><div><h2 className="text-xl text-orange-500">📊 EXCEL ÖNİZLEME</h2><p className="text-[10px] text-slate-500 mt-1">Toplam {importPreview.length} kayıt.</p></div><button onClick={() => !isImporting && setShowImportModal(false)} className="text-orange-500/50 hover:text-orange-500 text-2xl">✕</button></div>
            <div className="p-6 overflow-y-auto flex-1"><table className="w-full text-left text-[10px] uppercase font-bold italic">
                <thead className="sticky top-0 bg-slate-900 text-orange-500/70 border-b border-slate-800"><tr><th className="p-3">Tarih</th><th className="p-3">Zaman</th><th className="p-3">Süre</th><th className="p-3">Hat / Ekipman</th><th className="p-3">SORUMLU</th><th className="p-3">Duruş</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{importPreview.slice(0, 100).map((row, idx) => (<tr key={idx} className="hover:bg-orange-500/5"><td className="p-3 text-slate-400 whitespace-nowrap">{row.baslangicTarihi}</td><td className="p-3 text-indigo-400 whitespace-nowrap font-mono">{row.baslangicSaati} - {row.bitisSaati}</td><td className="p-3 text-amber-500 font-black">{row.toplamSureDakika} DK</td><td className="p-3 text-white"><span className="text-emerald-400">{row.hatAdi}</span> / {row.ekipmanAdi}</td><td className="p-3 text-indigo-300 font-black">{row.teknisyen}</td><td className="p-3">{row.isDuruslu ? '🔴 VAR' : '🟢 YOK'}</td></tr>))}</tbody>
              </table></div>
            <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-4 text-[10px] font-black uppercase"><button onClick={() => setShowImportModal(false)} disabled={isImporting} className="bg-slate-800 px-8 py-3 rounded-xl text-white hover:bg-slate-700">İPTAL</button><button onClick={confirmImport} disabled={isImporting} className="bg-orange-600 text-white px-10 py-3 rounded-xl shadow-xl hover:bg-orange-500 flex items-center gap-2">{isImporting ? '⏳ AKTARILIYOR...' : '🚀 AKTARIMI BAŞLAT'}</button></div>
          </div>
        </div>
      )}

      {showMeterImportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !isMeterImporting && setShowMeterImportModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-emerald-500/30 w-full max-w-md rounded-[3rem] shadow-2xl p-10 flex flex-col items-center text-center text-white font-black italic uppercase">
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6">Sayaç DNA Aktarımı</h2>
            <p className="text-xs text-slate-400 mb-8 font-bold italic">Lütfen Elektrik, Su ve Doğalgaz dosyalarını seçin.</p>
            <input type="file" multiple accept=".xlsx, .xls" onChange={(e) => e.target.files && handleMeterDataImport(e.target.files)} disabled={isMeterImporting} className="w-full text-xs text-slate-500 file:bg-emerald-600 file:text-white file:border-0 file:py-3 file:px-6 file:rounded-full file:font-black file:uppercase cursor-pointer" />
            {isMeterImporting && <div className="mt-8 text-[10px] text-emerald-400 font-black animate-pulse uppercase">VERİLER YAZILIYOR...</div>}
            {!isMeterImporting && <button onClick={() => setShowMeterImportModal(false)} className="mt-8 text-[10px] text-slate-600 uppercase font-black">KAPAT</button>}
          </div>
        </div>
      )}
    </div>
  );
}
