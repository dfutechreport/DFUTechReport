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
  const [copySuccess, setCopySuccess] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [showKpiDetailWindow, setShowKpiDetailWindow] = useState(false);
  const [kpiFYil, setKpiFYil] = useState("");
  const [kpiFAy, setKpiFAy] = useState("");
  const [kpiFHat, setKpiFHat] = useState("");
  const [kpiFPersonel, setKpiFPersonel] = useState("");
  const [kpiFDurus, setKpiFDurus] = useState("HEPSİ");
  const [showMeterImportModal, setShowMeterImportModal] = useState(false);
  const [isMeterImporting, setIsMeterImporting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [showVakaModal, setShowVakaModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });
  const [filterYil, setFilterYil] = useState(new Date().getFullYear().toString());
  const [filterElekSayac, setFilterElekSayac] = useState("");
  const [filterGazSayac, setFilterGazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");
  const [kpiTotals, setKpiTotals] = useState({ is: 0, sure: 0, durus: 0, mttr: 0 });
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]);
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [selectedEked, setSelectedEked] = useState<any>(null);
  const [selectedVaka, setSelectedVaka] = useState<any>(null);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [selectedKpiLogDetails, setSelectedKpiLogDetails] = useState<any[]>([]);
  const [grafikIsHatti, setGrafikIsHatti] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);
  const [elekSayacList, setElekSayacList] = useState<string[]>([]);
  const [gazSayacList, setGazSayacList] = useState<string[]>([]);
  const [suSayacList, setSuSayacList] = useState<string[]>([]);
  const [grafikElek, setGrafikElek] = useState<any[]>([]);
  const [grafikGaz, setGrafikGaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  const [kpiData, setKpiData] = useState<any[]>([]);
  const [kpiStartDate, setKpiStartDate] = useState("");
  const [kpiEndDate, setKpiEndDate] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          if (role === "ik") return router.push("/admin/mesai");
          setIsAdmin(true); setUserRole(role); setUserName(userSnap.data().name);
          await fetchInitialData(); fetchRcaData();
        }
      }
      setLoading(false);
    });
  }, [router]);
const formatExTime = (v: any) => {
    if (!v) return "00:00";
    if (typeof v === 'string') { const m = v.match(/(\d{1,2})[:.](\d{1,2})/); return m ? `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}` : "00:00"; }
    if (typeof v === 'number') { const ts = Math.round(v * 86400); return `${String(Math.floor(ts / 3600)).padStart(2, '0')}:${String(Math.floor((ts % 3600) / 60)).padStart(2, '0')}`; }
    return "00:00";
  };
const normA = (s: any) => String(s || "").replace(/[İIı]/g, 'I').replace(/[ŞŞ]/g, 'S').replace(/[ĞĞ]/g, 'G').replace(/[ÜÜ]/g, 'U').replace(/[ÖÖ]/g, 'O').replace(/[ÇÇ]/g, 'C').replace(/\s/g, '').toUpperCase();
  const getCA = (row: any, kw: string) => { const kn = normA(kw); const key = Object.keys(row).find(k => normA(k).includes(kn)); return key ? row[key] : null; };
const handleExcelImport = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const aylar: any = { "OCAK":"01","SUBAT":"02","MART":"03","NISAN":"04","MAYIS":"05","HAZİRAN":"06","TEMMUZ":"07","AGUSTOS":"08","EYLUL":"09","EKIM":"10","KASIM":"11","ARALIK":"12" };
      const mapped = data.map((row: any) => {
        const ayRaw = String(getCA(row, "AY") || "");
        const ay = aylar[normA(ayRaw)] || "01";
        const tarih = `${getCA(row, "YIL")||"2026"}-${ay}-${String(getCA(row, "GUN")||"01").padStart(2, '0')}`;
        const start = formatExTime(getCA(row, "BASLANGIC"));
        const end = formatExTime(getCA(row, "BITIS"));
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let duration = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (duration < 0) duration += 1440;
        const p1 = String(getCA(row, "PERSONEL 1") || "Sistem").trim();
        return {
          hatAdi: String(getCA(row, "HAT") || "").trim(), ekipmanAdi: String(getCA(row, "EKIPMAN") || "").trim(),
          aciklama: String(getCA(row, "IS") || "-"), baslangicSaati: start, bitisSaati: end, 
          baslangicTarihi: tarih, bitisTarihi: tarih, toplamSureDakika: duration,
          vardiya: getCA(row, "VARDIYA") || "08:00 - 16:00", isDuruslu: String(getCA(row, "DURUS") || "").toUpperCase() !== "YOK",
          teknisyen: p1, yardimciTeknisyenler: [getCA(row, "PERSONEL 2"), getCA(row, "PERSONEL 3")].filter(p => p && p !== "-"),
          bildirenKisi: p1, usedMaterials: [], durum: "Kapalı", kayitTarihi: new Date(), isImported: true
        };
      });
      setImportPreview(mapped.filter(i => i.hatAdi)); setShowImportModal(true);
    };
    reader.readAsBinaryString(file);
  };
const confirmImport = async () => {
    if (!window.confirm("Aktarımı başlat?")) return;
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
          const bk = normA(data.bildirenKisi);
          const tk = normA(data.teknisyen);
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
      for (let i = 0; i < logSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        logSnap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      const uniqueMeters: Record<string, string[]> = { "Elektrik": [], "Su": [], "Doğalgaz": [] };
      const allLogs: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const workbook = XLSX.read(await files[i].arrayBuffer());
        const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        let t = files[i].name.toUpperCase().includes("ELEK") ? "Elektrik" : files[i].name.toUpperCase().includes("DOGAL") ? "Doğalgaz" : "Su";
        data.forEach(row => {
          const rawTs = row["Zaman damgası"];
          const dateStr = typeof rawTs === 'number' ? new Date((rawTs - 25569) * 86400 * 1000).toISOString().split('T')[0] : new Date(rawTs).toISOString().split('T')[0];
          Object.keys(row).forEach(key => {
            if (key !== "Zaman damgası" && !isNaN(Number(row[key]))) {
              if (!uniqueMeters[t].includes(key)) uniqueMeters[t].push(key);
              allLogs.push({ sayacAdi: key, deger: Number(row[key]), tarih: dateStr, tip: t, personel: "Sistem", timestamp: serverTimestamp() });
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
        for (const ad of ads) mBatch.set(doc(db, "meters", `${t}_${ad}`.replace(/\s+/g,'_').replace(/\//g, '-')), { adi: ad, tip: t }, { merge: true });
      }
      await mBatch.commit();
      alert("Sayaçlar yüklendi."); window.location.reload();
    } catch (e: any) { alert(e.message); } finally { setIsMeterImporting(false); }
  };
const handleSystemReset = async () => {
    const password = window.prompt("Sistem sıfırlama şifresini giriniz:");

    if (password !== "161004") {
      alert("Yetkisiz işlem: Şifre hatalı.");
      return;
    }

    const confirmed = window.confirm(
      "Bakım kayıtları ve iş emirleri kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const collectionsToReset = ["maintenance_logs", "work_orders"];
      let deletedCount = 0;

      for (const collectionName of collectionsToReset) {
        const snapshot = await getDocs(collection(db, collectionName));

        for (let index = 0; index < snapshot.docs.length; index += 500) {
          const batch = writeBatch(db);
          const documents = snapshot.docs.slice(index, index + 500);

          documents.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
          await batch.commit();
          deletedCount += documents.length;
        }
      }

      alert(`${deletedCount} kayıt silindi. Sistem verileri yenileniyor.`);
      window.location.reload();
    } catch (error) {
      console.error("Sistem sıfırlama hatası:", error);
      alert("Sistem sıfırlama işlemi tamamlanamadı.");
      setLoading(false);
    }
  };

const handleCopyScript = () => {
    const dnaScript = "Get-ChildItem -Recurse -Include *.tsx,*.ts | ForEach-Object { \"--- FILE: $($_.FullName) ---\" + [char]96 + \"n\" | Out-File -Append PROJE_DOKUMU.txt; Get-Content $_.FullName | Out-File -Append PROJE_DOKUMU.txt; [char]96 + \"n\" + [char]96 + \"n\" | Out-File -Append PROJE_DOKUMU.txt }";
    navigator.clipboard.writeText(dnaScript); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 3000);
  };
const downloadFullSnapshotDNA = async () => {
    if (window.prompt("Şifre:") !== "161004") return;
    try {
      const collections = ["maintenance_logs", "work_orders", "spare_parts", "users", "assets", "eked_logs", "meter_logs", "overtime_logs", "kar_arsivi"];
      let dbBackup: any = {};
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        dbBackup[coll] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const payload = { database: dbBackup, dna: "MASTER_V61_FINAL", date: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
      link.download = `DFU_MASTER_DNA.json`; link.click();
    } catch (e) { alert("Hata!"); }
  };
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
      setKpiOnayBekleyen((await getDocs(query(collection(db, "users"), where("isApproved", "==", false)))).size);
    } catch (e) { console.error(e); }
  };
const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Seçiniz");
    await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), { logId: selectedLogForRca.id, ekipman: selectedLogForRca.ekipmanAdi, category: rcaForm.category, why: rcaForm.why, analizEden: userName, tarih: serverTimestamp() }, { merge: true });
    alert("Başarılı!"); setShowRcaModal(false); fetchRcaData();
  };

  const calculateKpis = () => {
    let filtered = [...rawLogs];
    if (kpiStartDate) filtered = filtered.filter((l: any) => l.tarih >= kpiStartDate);
    if (kpiEndDate) filtered = filtered.filter((l: any) => l.tarih <= kpiEndDate);
    const groups = filtered.reduce((acc: any, curr: any) => {
      const date = curr.tarih;
      if (!acc[date]) acc[date] = { date, sure: 0, adet: 0 };
      acc[date].sure += Number(curr.toplamSureDakika) || 0;
      acc[date].adet += 1;
      return acc;
    }, {});
    setKpiData(Object.values(groups).sort((a: any, b: any) => a.date.localeCompare(b.date)));
  };

  const handleMeterImportLocal = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsMeterImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const batch = writeBatch(db);
        data.forEach((row: any) => {
          const ref = doc(collection(db, "meter_logs"));
          batch.set(ref, { ...row, timestamp: serverTimestamp() });
        });
        await batch.commit();
        alert("Sayaçlar yüklendi."); setShowMeterImportModal(false);
      } catch (err) { alert(err); } finally { setIsMeterImporting(false); }
    };
    reader.readAsBinaryString(file);
  };
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
    setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));
    setPersonelPerformans(Object.keys(pD).map(k=>({ isim: k, ...pD[k] })).sort((a,b)=> b.isSayisi - a.isSayisi));
    setEkipmanPerformans(Object.keys(eD).map(k=>({ ekipman: k, ...eD[k] })).sort((a,b)=>b.count-a.count).slice(0, 5));
  }, [rawLogs, filterYil]);
useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const elS = new Set<string>(), gzS = new Set<string>(), suS = new Set<string>();
    const tEl:any = {}, tGz:any = {}, tSu:any = {};
    rawMeterLogs.forEach((l: any) => {
      const t = l.tip || "Elektrik";
      if(t==="Elektrik") elS.add(l.sayacAdi); if(t==="Doğalgaz") gzS.add(l.sayacAdi); if(t==="Su") suS.add(l.sayacAdi);
      const ay = `${l.tarih?.split("-")[1]}. Ay`;
      if(t==="Elektrik" && (!filterElekSayac || l.sayacAdi===filterElekSayac)) tEl[ay] = (tEl[ay]||0) + Number(l.deger || 0);
      if(t==="Doğalgaz" && (!filterGazSayac || l.sayacAdi===filterGazSayac)) tGz[ay] = (tGz[ay]||0) + Number(l.deger || 0);
      if(t==="Su" && (!filterSuSayac || l.sayacAdi===filterSuSayac)) tSu[ay] = (tSu[ay]||0) + Number(l.deger || 0);
    });
    setElekSayacList(Array.from(elS).sort()); setGazSayacList(Array.from(gzS).sort()); setSuSayacList(Array.from(suS).sort());
    setGrafikElek(Object.keys(tEl).map(ay=>({ ay, tuketim: tEl[ay] })));
    setGrafikGaz(Object.keys(tGz).map(ay=>({ ay, tuketim: tGz[ay] })));
    setGrafikSu(Object.keys(tSu).map(ay=>({ ay, tuketim: tSu[ay] })));
  }, [rawMeterLogs, filterElekSayac, filterGazSayac, filterSuSayac]);
  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest text-center">Güvenlik Taraması...</div>;
  if (!isAdmin) return <div className="p-10 text-red-500 font-bold uppercase italic text-center text-white font-black italic uppercase underline text-center">YETKİSİZ ERİŞİM!</div>;


  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden italic font-bold">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5 no-print">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white rounded p-1" /><h1 className="text-2xl font-black uppercase text-indigo-400">Komuta Merkezi</h1></div>
          <div className="flex gap-3 no-print">
             <button onClick={() => setShowKpiModal(true)} className="bg-indigo-500 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-lg">📈 KPI ANALİZ</button>
             <button onClick={() => setShowMeterImportModal(true)} className="bg-emerald-600 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-lg text-center">🔌 SAYAÇ</button>
             <button onClick={handleCopyScript} className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-lg border transition-all ${copySuccess ? 'bg-indigo-500' : 'bg-slate-800'}`}>{copySuccess ? '✓ KOPYALANDI' : '🧬 DNA'}</button>
             <button onClick={downloadFullSnapshotDNA} className="bg-violet-700 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-lg text-white hover:bg-violet-600 transition-all">💾 Tam Yedek</button>
             <Link href="/dashboard" className="bg-indigo-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg">Vardiya Raporu</Link>
             <button onClick={() => clearOldImports()} className="bg-red-900/40 border border-red-500/30 px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-lg hover:bg-red-800 text-center">🗑️ TEMİZLE</button>
             <button onClick={()=>signOut(auth)} className="bg-red-600 px-5 py-2.5 rounded-2xl text-[10px] uppercase shadow-lg">Çıkış</button>
          </div>
        </div>
{/* --- TÜM 23 BUTONLUK NAVİGASYON --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-12 no-print">
          <Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-2xl text-[10px] text-center uppercase shadow-lg">🚨 Yeni İş Emri</Link>
          <Link href="/admin/aktif-isler" className="bg-red-950 border border-red-500 p-3 rounded-2xl text-[10px] text-center uppercase">Aktif Bildirimler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-2xl text-[10px] text-center uppercase">🔐 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📂 EKED Arşivi</Link>
          <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-2xl text-[10px] text-center uppercase relative">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-[8px] px-1 rounded-full animate-pulse">{kpiOnayBekleyen}</span>}</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">🔌 Pano Listesi</Link>
          <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-2xl text-[10px] text-center uppercase border border-gray-600 text-white">📂 Pano Arşivi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">✅ Kontrol Formları</Link>
          <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⚙️ Yedek Parça</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-700 p-3 rounded-2xl text-[10px] text-center uppercase border border-indigo-500">📋 Yapılan İşler</Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⚡ KAR Arşivi</Link>
          <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📅 PM Takvimi</Link>
          <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-2xl text-[10px] text-center text-white uppercase">📂 PM Arşivi</Link>
          <Link href="/dashboard/periyodik-bakim" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase font-black italic">🛠️ Manuel PM</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-2xl text-[10px] text-center uppercase italic">⚡ Sayaç Okuma</Link>
          <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⌛ Mesai Raporları</Link>
          <Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📂 Tamamlanan İşler</Link>
          <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">⚙️ Hat/Makineler</Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-2xl text-[10px] text-center uppercase text-white">📢 İSG Duyuru</Link>
          <Link href="/admin/bakim-ligi" className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-2xl text-[10px] text-center text-yellow-500 uppercase">🏆 Bakım Ligi</Link>
          {userRole === "admin" && <button onClick={handleSystemReset} className="bg-red-950 border border-red-900 p-3 rounded-2xl text-[10px] text-red-500 uppercase font-black shadow-inner">💀 Sistemi Sıfırla</button>}
        </div>

        {/* 3-COLUMN ALARM GRID (EKED, ISG, SAHA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           <div className="bg-slate-900 border-2 border-yellow-600/40 p-7 rounded-[3rem] shadow-2xl relative">
              <h2 className="text-lg font-black text-yellow-500 mb-6 uppercase">🔐 AKTİF EKED</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifEked.map((e, idx) => (<div key={idx} className="bg-slate-950 border border-yellow-600/20 p-5 rounded-3xl flex justify-between items-center hover:bg-yellow-600/10 transition"><div><p className="text-xs text-yellow-500 uppercase font-black">{e.yer}</p><p className="text-gray-100">{e.personel}</p></div><button onClick={() => { setSelectedEked(e); setShowEkedModal(true); }} className="bg-yellow-600 text-black text-[10px] font-black px-4 py-2 rounded-xl transition">Detay</button></div>))}
                {aktifEked.length === 0 && <p className="text-center py-10 text-gray-600 italic">Kilit Yok.</p>}
              </div>
           </div>
           <div className="bg-slate-900 border-2 border-red-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-red-500 mb-6 uppercase italic">🚑 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-slate-950 border border-red-900/30 p-5 rounded-3xl flex justify-between items-center italic font-bold"><div><p className="text-xs text-red-400 uppercase">{a.hatAdi}</p><p className="text-gray-100 uppercase">{a.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition">İncele</button></div>))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase">Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-slate-900 border-2 border-indigo-900/40 p-7 rounded-[3rem] shadow-2xl">
              <h2 className="text-lg font-black text-indigo-400 mb-6 uppercase tracking-widest italic font-black">📡 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                {aktifIsler.map(is => (<div key={is.id} className="bg-slate-950 border border-indigo-900/30 p-5 rounded-3xl flex justify-between items-center transition italic font-black"><div><p className="text-xs text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-gray-100 uppercase">{is.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">Detay</button></div>))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-600 italic uppercase tracking-widest font-black">Saha Bildirimi Yok.</p>}
              </div>
           </div>
        </div>        {/* RCA ANALİZ LİSTESİ */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] mb-12 shadow-2xl italic">
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest italic underline decoration-indigo-500 font-black">🧠 RCA Analizi Bekleyen Duruşlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 6).map((log, idx) => {
              const hasRca = rcaLogs.find(r => r.logId === log.id);
              return (<div key={idx} className="bg-slate-950 p-6 rounded-[30px] border border-slate-800 flex flex-col justify-between h-full hover:border-indigo-500 transition shadow-xl italic font-black"><div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{log.hatAdi}</p><p className="font-bold text-gray-200 uppercase">{log.ekipmanAdi}</p><p className="text-red-400 font-black text-xs mt-1 italic uppercase">{log.toplamSureDakika} dk Kayıp</p></div><button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`w-full py-3 mt-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>{hasRca ? "Girişi Güncelle" : "Analiz Yap"}</button></div>);
            })}
          </div>
        </div>

        {/* KPI KARTLARI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 text-center uppercase italic font-bold">
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl font-black"><p className="text-[10px] text-gray-500">İş Adedi</p><h3 className="text-4xl text-green-400">{kpiTotals.is}</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-slate-800 shadow-xl font-black"><p className="text-[10px] text-gray-500">Müdahale</p><h3 className="text-4xl text-white">{kpiTotals.sure} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-red-900/30 shadow-xl font-black"><p className="text-[10px] text-red-500">Duruş</p><h3 className="text-4xl text-red-400">{kpiTotals.durus} dk</h3></div>
           <div className="bg-slate-900 p-6 rounded-[30px] border border-indigo-900/30 shadow-xl font-black"><p className="text-[10px] text-indigo-400">MTTR</p><h3 className="text-4xl text-indigo-400">{kpiTotals.mttr.toFixed(0)} dk</h3></div>
        </div>

        {/* --- BAĞIMSIZ FİLTRELİ ENERJİ GRAFİKLERİ --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 italic font-bold">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black">
             <h2 className="text-xs font-bold text-yellow-400 mb-4 uppercase underline underline-offset-8">⚡ Elektrik (kWh)</h2>
             <select value={filterElekSayac} onChange={e=>setFilterElekSayac(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner"><option value="">Tüm Sayaçlar</option>{elekSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElek}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px'}}/><Bar dataKey="tuketim" fill="#EAB308" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black">
             <h2 className="text-xs font-bold text-red-400 mb-4 uppercase underline underline-offset-8">🔥 Doğalgaz (m³)</h2>
             <select value={filterGazSayac} onChange={e=>setFilterGazSayac(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner"><option value="">Tüm Sayaçlar</option>{gazSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikGaz}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px'}}/><Bar dataKey="tuketim" fill="#EF4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[30px] shadow-xl font-black">
             <h2 className="text-xs font-bold text-blue-400 mb-4 uppercase underline underline-offset-8">💧 Su (m³)</h2>
             <select value={filterSuSayac} onChange={e=>setFilterSuSayac(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-[10px] mb-4 text-white uppercase italic shadow-inner"><option value="">Tüm Sayaçlar</option>{suSayacList.map(s=><option key={s} value={s}>{s}</option>)}</select>
             <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><XAxis dataKey="ay" tick={{fontSize:10, fill:'#475569'}}/><Tooltip contentStyle={{backgroundColor:'#0f172a', border:'none', borderRadius:'15px'}}/><Bar dataKey="tuketim" fill="#3B82F6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          </div>
        </div>

        {/* --- PERSONEL MTTR MATRİSİ VE RCA PARETO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 italic font-black">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl italic">
            <h2 className="text-lg font-black text-white mb-6 uppercase underline decoration-indigo-500 font-black italic">🏆 Personel Performans Matrisi</h2>
            <div className="overflow-x-auto"><table className="w-full text-left text-[11px] uppercase tracking-tighter italic font-black font-black italic"><thead className="text-gray-500 border-b border-slate-800"><tr><th className="py-4">Personel</th><th className="py-4 text-center">İş Adedi</th><th className="py-4 text-right">Efor (MTTR)</th></tr></thead><tbody className="divide-y divide-slate-800">{personelPerformans.map((p,i)=>(<tr key={i} className="hover:bg-slate-800/30 italic"><td className="py-4 text-gray-200 font-black italic">{p.isim}</td><td className="py-4 text-green-400 text-center font-black italic">{p.isSayisi}</td><td className="py-4 text-indigo-400 text-right font-black italic">{p.eforDk} dk <span className="text-[8px] text-gray-600 italic">ort.</span></td></tr>))}</tbody></table></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[35px] shadow-2xl italic font-black uppercase"><h2 className="text-sm font-black text-indigo-400 mb-6 uppercase text-center tracking-[0.2em]">📊 RCA Pareto Analizi</h2><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c=>({ name:c.label, value: rcaLogs.filter(r=>r.category===c.id).length, color: c.color })).filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>{RCA_CATEGORIES.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></div>
        </div>
      {/* ATLAS MODALS */}
      {/* --- MODALLAR --- */}
        {showEkedModal && selectedEked && (<div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[1000] flex items-center justify-center p-4 italic font-bold text-center"><div className="bg-slate-900 border-2 border-yellow-600/30 w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 relative text-white"><button onClick={() => setShowEkedModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl font-black">✕</button><h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest mb-8 italic">🔐 EKED LOTO BİLGİSİ</h2><div className="space-y-6 italic font-black"><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner uppercase tracking-tighter"><p className="text-xl font-black italic">{selectedEked.yer}</p></div><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner font-black uppercase"><p className="text-xl text-yellow-500 italic font-black">{selectedEked.personel}</p></div><button onClick={() => setShowEkedModal(false)} className="w-full bg-yellow-600 text-black py-5 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all uppercase font-black italic font-black">Bilgileri Onayladım</button></div></div></div>)}
        {showVakaModal && selectedVaka && (<div className="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[1000] p-4 font-bold italic"><div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-2xl shadow-3xl relative overflow-hidden italic"><div className={`absolute top-0 left-0 w-full h-2 ${selectedVaka.ekipmanAdi === "KAR devreye alma" ? "bg-red-600 shadow-xl" : "bg-indigo-600 shadow-xl"}`}></div><h2 className="text-2xl font-black text-white mb-8 uppercase italic tracking-widest">Bildirim Detayı</h2><div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 mb-10 shadow-inner italic font-black uppercase italic font-black font-black uppercase"><p className="text-gray-300 text-sm italic font-black italic">"{selectedVaka.arizaDetayi || selectedVaka.aciklama || "Not yok."}"</p></div><button onClick={()=>setShowVakaModal(false)} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl font-black uppercase text-xs transition shadow-2xl italic font-black uppercase italic uppercase">Kapat</button></div></div>)}
        {showRcaModal && selectedLogForRca && (<div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4 font-bold italic"><div className="bg-slate-900 border border-slate-800 p-10 rounded-[50px] w-full max-w-xl shadow-2xl relative"><h2 className="text-xl font-black text-white mb-8 uppercase text-center tracking-[0.2em]">Root Cause Analysis</h2><div className="space-y-6 italic"><div className="grid grid-cols-3 gap-2 italic">{RCA_CATEGORIES.map(c=>(<button key={c.id} onClick={()=>setRcaForm({...rcaForm, category:c.id})} className={`p-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${rcaForm.category===c.id?'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/30':'bg-slate-950 border-slate-800 text-gray-500 hover:border-indigo-400'}`}>{c.label}</button>))}</div><textarea value={rcaForm.why} onChange={e=>setRcaForm({...rcaForm, why:e.target.value})} placeholder="Duruş nedenini detaylandırın..." className="w-full bg-slate-950 border border-slate-800 rounded-[30px] p-6 text-sm text-white outline-none focus:ring-2 ring-indigo-500 h-40 shadow-inner italic font-black" /><div className="flex gap-4 italic"><button onClick={()=>setShowRcaModal(false)} className="flex-1 bg-slate-800 py-4 rounded-[20px] font-black text-gray-400 text-xs uppercase">Vazgeç</button><button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-[20px] font-black text-white shadow-xl text-xs uppercase transition">Kaydet</button></div></div></div></div>)}
      {/* ATLAS MODALS */}
      {showKpiModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setShowKpiModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-indigo-500/30 w-full max-w-[95%] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col text-white font-black italic uppercase">
            <div className="p-8 border-b border-indigo-500/20 flex justify-between items-center bg-orange-500/5"><div><h2 className="text-xl text-orange-500 tracking-widest uppercase italic font-black">📈 KPI ANALİZ MERKEZİ</h2></div><button onClick={() => setShowKpiModal(false)} className="text-indigo-500/50 hover:text-orange-500 text-3xl">✕</button></div>
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <div className="w-full lg:w-80 bg-black/30 border-r border-slate-800 p-6 space-y-4 overflow-y-auto text-[9px]">
                <h3 className="text-indigo-500 uppercase tracking-widest">Filtreleme</h3>
                <div><label className="text-slate-500 block">YIL</label><select value={kpiFYil} onChange={e=>setKpiFYil(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-black italic uppercase"><option value="">TÜM YILLAR</option>{Array.from(new Set(rawLogs.map((l:any) => String(l.baslangicTarihi || l.tarih || (l.kayitTarihi?.toDate ? l.kayitTarihi.toDate().toISOString().slice(0, 10) : "")).slice(0, 4)))).filter(Boolean).sort().reverse().map(y=><option key={y} value={y}>{y}</option>)}</select></div>
                <div><label className="text-slate-500 block">AY</label><select value={kpiFAy} onChange={e=>setKpiFAy(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-black italic uppercase"><option value="">TÜM AYLAR</option>{["01","02","03","04","05","06","07","08","09","10","11","12"].map(m=><option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="text-slate-500 block">HAT</label><select value={kpiFHat} onChange={e=>setKpiFHat(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-black italic uppercase"><option value="">TÜM HATTAR</option>{Array.from(new Set(rawLogs.map((l:any)=>l.hatAdi))).filter(Boolean).sort().map(h=><option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="text-slate-500 block">PERSONEL</label><select value={kpiFPersonel} onChange={e=>setKpiFPersonel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-black italic uppercase"><option value="">TÜM PERSONEL</option>{Array.from(new Set(rawLogs.map((l:any)=>l.teknisyen))).filter(Boolean).sort().map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-slate-500 block">DURUŞ</label><div className="flex gap-2">{["HEPSİ", "VAR", "YOK"].map(d=><button key={d} onClick={()=>setKpiFDurus(d)} className={`flex-1 py-2 rounded-xl border ${kpiFDurus === d ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{d}</button>)}</div></div>
              </div>
              <div className="flex-1 p-8 overflow-y-auto bg-slate-950/50 text-white">
                <div className="h-[500px] w-full text-white font-black italic uppercase">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={(() => {
                        const filtered = rawLogs.filter((l:any) => {
                          const d = String(
                            l.baslangicTarihi ||
                            l.tarih ||
                            (l.kayitTarihi?.toDate ? l.kayitTarihi.toDate().toISOString().slice(0, 10) : "")
                          );
                          const matchYil = !kpiFYil || d.startsWith(kpiFYil);
                          const matchAy = !kpiFAy || d.split('-')[1] === kpiFAy;
                          const matchHat = !kpiFHat || l.hatAdi === kpiFHat;
                          const matchPers = !kpiFPersonel || l.teknisyen === kpiFPersonel;
                          const matchDurus = kpiFDurus === "HEPSİ" || (kpiFDurus === "VAR" ? l.isDuruslu : !l.isDuruslu);
                          return matchYil && matchAy && matchHat && matchPers && matchDurus;
                        });
                        const groups: any = {};
                        filtered.forEach((f:any) => {
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
        <div className="fixed inset-0 z-[130] flex items-center justify-end p-6 font-black uppercase italic text-white text-xs">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=>setShowKpiDetailWindow(false)}></div>
          <div className="relative bg-slate-900 border-l-4 border-indigo-500 w-full max-w-xl h-full rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right font-black italic uppercase text-white uppercase italic font-black">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 text-white font-black italic uppercase"><h3 className="text-lg tracking-widest uppercase font-black italic">🔍 İş Detay Arşivi</h3><button onClick={()=>setShowKpiDetailWindow(false)} className="text-slate-500 hover:text-white text-2xl">✕</button></div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {selectedKpiLogDetails.map((log:any, i:number) => (
                <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl hover:border-indigo-500/50 transition-all font-black uppercase italic text-white"><div className="flex justify-between text-[9px] font-black text-indigo-400 mb-2"><span>{log.baslangicTarihi}</span><span className="text-emerald-400">{log.toplamSureDakika} DK</span></div><h4 className="text-white text-xs font-black mb-2">{log.hatAdi} - {log.ekipmanAdi}</h4><p className="text-slate-400 text-[11px] font-bold italic leading-relaxed uppercase">"{log.aciklama}"</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-white uppercase font-black italic text-white uppercase italic font-black">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => !isImporting && setShowImportModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-orange-500/30 w-full max-w-6xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col font-black italic text-white">
            <div className="p-8 border-b border-orange-500/10 flex justify-between items-center bg-orange-500/5 uppercase tracking-widest font-black italic text-white uppercase font-black italic"><div><h2 className="text-xl text-orange-500 uppercase italic font-black">📊 EXCEL ÖNİZLEME</h2><p className="text-[10px] text-slate-500 mt-1 uppercase font-bold italic tracking-tighter">Toplam {importPreview.length} kayıt.</p></div><button onClick={() => !isImporting && setShowImportModal(false)} className="text-orange-500/50 hover:text-orange-500 text-2xl">✕</button></div>
            <div className="p-6 overflow-y-auto flex-1 text-white uppercase italic font-black"><table className="w-full text-left text-[10px] uppercase font-bold italic text-white uppercase font-black italic">
                <thead className="sticky top-0 bg-slate-900 text-orange-500/70 border-b border-slate-800 font-black italic"><tr><th className="p-3">Tarih</th><th className="p-3">Zaman</th><th className="p-3">Süre</th><th className="p-3">Hat / Ekipman</th><th className="p-3">SORUMLU</th><th className="p-3">Duruş</th></tr></thead>
                <tbody className="divide-y divide-slate-800 text-white uppercase italic font-black text-white uppercase italic font-black">{importPreview.slice(0, 100).map((row, idx) => (<tr key={idx} className="hover:bg-orange-500/5 text-white uppercase italic font-black text-white uppercase italic font-black"><td className="p-3 text-slate-400 whitespace-nowrap">{row.baslangicTarihi}</td><td className="p-3 text-indigo-400 whitespace-nowrap font-mono">{row.baslangicSaati} - {row.bitisSaati}</td><td className="p-3 text-amber-500 font-black">{row.toplamSureDakika} DK</td><td className="p-3 text-white"><span className="text-emerald-400">{row.hatAdi}</span> / {row.ekipmanAdi}</td><td className="p-3 text-indigo-300 font-black">{row.teknisyen}</td><td className="p-3">{row.isDuruslu ? '🔴 VAR' : '🟢 YOK'}</td></tr>))}</tbody>
              </table></div>
            <div className="p-8 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-4 text-[10px] font-black uppercase text-white font-black italic uppercase text-white"><button onClick={() => setShowImportModal(false)} disabled={isImporting} className="bg-slate-800 px-8 py-3 rounded-xl hover:bg-slate-700 text-white font-black italic uppercase">İPTAL</button><button onClick={confirmImport} disabled={isImporting} className="bg-orange-600 text-white px-10 py-3 rounded-xl shadow-xl hover:bg-orange-500 flex items-center gap-2">
                {isImporting ? '⏳ AKTARILIYOR...' : '🚀 AKTARIMI BAŞLAT'}
              </button></div>
          </div>
        </div>
      )}

      {showMeterImportModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !isMeterImporting && setShowMeterImportModal(false)}></div>
          <div className="relative bg-slate-900 border-2 border-emerald-500/30 w-full max-w-md rounded-[3rem] shadow-2xl p-10 flex flex-col items-center text-center text-white font-black italic uppercase">
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 uppercase italic font-black text-white">Sayaç DNA Aktarımı</h2>
            <p className="text-xs text-slate-400 mb-8 uppercase font-bold italic font-black text-white">Lütfen Elektrik, Su ve Doğalgaz dosyalarını seçin.</p>
            <input type="file" multiple accept=".xlsx, .xls" onChange={(e) => e.target.files && handleMeterDataImport(e.target.files)} disabled={isMeterImporting} className="w-full text-xs text-slate-500 file:bg-emerald-600 file:text-white file:border-0 file:py-3 file:px-6 file:rounded-full file:font-black file:uppercase cursor-pointer font-black italic uppercase text-white" />
            {isMeterImporting && <div className="mt-8 text-[10px] text-emerald-400 font-black animate-pulse uppercase italic font-black">VERİLER YAZILIYOR...</div>}
            {!isMeterImporting && <button onClick={() => setShowMeterImportModal(false)} className="mt-8 text-[10px] text-slate-600 uppercase font-black italic font-black text-white font-black uppercase italic">KAPAT</button>}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
