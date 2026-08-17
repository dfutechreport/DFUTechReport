"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy, writeBatch, setDoc, serverTimestamp, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import * as XLSX from 'xlsx';

export default function YedekParcaYonetimi() {
  const [yedekParcalar, setYedekParcalar] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  
  const [progress, setProgress] = useState(0);
  const [lastUploadTime, setSonYuklemeZamani] = useState<any>(null);
  const [timeLeft, setKalanSure] = useState("");
  const [smartSearchQuery, setSmartSearchQuery] = useState("");
  const [smartSearchResults, setSmartSearchResults] = useState<any[]>([]);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [isFetchingUsage, setIsFetchingUsage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name); setUserRole(userSnap.data().role); }
        await initialSync();
      } else { window.location.href = "/"; }
    });
      const handleExcelIndir = () => {
    try {
      const dataToExport = yedekParcalar
        .filter(p => !p.parcaAdi?.toLowerCase().includes("pasif"))
        .map(p => ({
          "Stok Kodu": p.stokKodu || p.id,
          "Parça Adı": p.parcaAdi || "-",
          "Mevcut Miktar": p.mevcutMiktar || 0,
          "Birim": p.birim || "Adet",
          "Durum": (Number(p.mevcutMiktar) <= 2) ? "KRİTİK" : "NORMAL"
        }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Güncel Stok");
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
  return () => unsubscribe();
  }, []);

  const initialSync = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "spare_parts"));
      const snap = await getDocs(q);
      setYedekParcalar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const sysSnap = await getDoc(doc(db, "system_logs", "excel_upload"));
      if (sysSnap.exists()) { setSonYuklemeZamani(sysSnap.data().lastUpload?.toDate()); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!lastUploadTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const lockTime = new Date(lastUploadTime).getTime() + (24 * 60 * 60 * 1000);
      const diff = lockTime - now;
      if (diff <= 0) { setKalanSure(""); clearInterval(interval); }
      else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setKalanSure(`${h}s ${m}d ${s}sn`);
      }
    }, 1000);
      const handleExcelIndir = () => {
    try {
      const dataToExport = yedekParcalar
        .filter(p => !p.parcaAdi?.toLowerCase().includes("pasif"))
        .map(p => ({
          "Stok Kodu": p.stokKodu || p.id,
          "Parça Adı": p.parcaAdi || "-",
          "Mevcut Miktar": p.mevcutMiktar || 0,
          "Birim": p.birim || "Adet",
          "Durum": (Number(p.mevcutMiktar) <= 2) ? "KRİTİK" : "NORMAL"
        }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Güncel Stok");
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
  return () => clearInterval(interval);
  }, [lastUploadTime]);

  const handleSmartLookup = () => {
    const s = smartSearchQuery.trim().toUpperCase();
    if (!s) return;
    const matches = yedekParcalar.filter(p => 
      String(p.id).toUpperCase().includes(s) || 
      (p.stokKodu && String(p.stokKodu).toUpperCase().includes(s)) ||
      (p.parcaAdi && String(p.parcaAdi).toUpperCase().includes(s))
    );
    setSmartSearchResults(matches);
  };

  const handleExcelUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const total = data.length; let processed = 0; const CHUNK = 400;
      for (let i = 0; i < total; i += CHUNK) {
        const chunk = data.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach((item: any) => {
          const code = item.stokKodu || item.stockCode || item.id;
          if(code) { batch.set(doc(db, "spare_parts", String(code)), item, { merge: true }); }
        });
        await batch.commit(); processed += chunk.length;
        setProgress(Math.floor((processed / total) * 100));
      }
      const now = new Date();
      await setDoc(doc(db, "system_logs", "excel_upload"), { lastUpload: now, uploadedBy: userName });
      setSonYuklemeZamani(now); setProgress(0);
      alert("Master Stok Güncellendi.");
      initialSync();
    };
    reader.readAsBinaryString(file);
  };

  const fetchUsageHistory = async () => {
    setIsFetchingUsage(true);
    try {
      const logsSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"), limit(400)));
      const usageList: any[] = [];
      logsSnap.forEach(d => {
        const data = d.data();
        const common = {
          tarih: data.baslangicTarihi || (data.kayitTarihi ? data.kayitTarihi.toDate().toLocaleDateString('tr-TR') : "-"),
          personel: data.bildirenKisi || "Sistem",
          makine: data.ekipmanAdi || "-"
        };
        if (data.kullanilanMalzemeler && Array.isArray(data.kullanilanMalzemeler)) {
          data.kullanilanMalzemeler.forEach((m: any) => {
            usageList.push({ ...common, stockCode: m.stockCode || m.stokKodu || "-", name: m.name || m.parcaAdi || "-", quantity: m.quantity || m.miktar || 0, unit: m.unit || m.birim || "Adet" });
          });
        }
        if (data.yedekParcaKodu && data.yedekParcaKodu !== "") {
          usageList.push({ ...common, stockCode: data.yedekParcaKodu, name: data.parcaAdi || "Orijinal Kayıt", quantity: data.yedekParcaMiktar || 1, unit: data.birim || "Adet" });
        }
      });
      setUsedMaterials(usageList);
      setIsDataFetched(true);
      if (usageList.length === 0) alert("Sarfiyat kaydı bulunamadı.");
    } catch (e) { console.error(e); alert("Hata oluştu."); }
    setIsFetchingUsage(false);
  };

  const exportUsageExcel = () => {
    let csv = "uFEFF" + "Tarih;Makine;Personel;Kod;Malzeme;Miktar;Birim\n";
    usedMaterials.forEach(m => { csv += `${m.tarih};${m.makine};${m.personel};${m.stockCode};${m.name};${m.quantity};${m.unit}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.body.appendChild(document.createElement("a"));
    link.href = URL.createObjectURL(blob); link.download = "DFU_Sarfiyat_Raporu.csv"; link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex flex-col justify-center items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(30,58,138,0.15),_transparent_70%)]"></div>
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-yellow-500/10 blur-[100px] rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-32 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-80 h-0.5 bg-slate-900 rounded-full overflow-hidden mb-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400 to-transparent w-full animate-[scan_2s_infinite_ease-in-out]"></div>
      </div>
      <p className="text-slate-500 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">{`INVENTORY STREAM ACTIVE...`}</p>
      <style jsx>{` @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } `}</style>
    </div>
  );

    const handleExcelIndir = () => {
    try {
      const dataToExport = yedekParcalar
        .filter(p => !p.parcaAdi?.toLowerCase().includes("pasif"))
        .map(p => ({
          "Stok Kodu": p.stokKodu || p.id,
          "Parça Adı": p.parcaAdi || "-",
          "Mevcut Miktar": p.mevcutMiktar || 0,
          "Birim": p.birim || "Adet",
          "Durum": (Number(p.mevcutMiktar) <= 2) ? "KRİTİK" : "NORMAL"
        }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Güncel Stok");
      XLSX.writeFile(workbook, `DFU_Master_Stok_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("Excel Hatası"); }
  };
  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-6 no-print pt-4"><button onClick={handleExcelIndir} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-5 rounded-[25px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center gap-3 border-2 border-emerald-400/20 active:scale-95"><span className="text-2xl">📊</span> GÜNCEL MASTER STOK LİSTESİNİ İNDİR (EXCEL)</button></div>
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6 no-print">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><h1 className="text-xl font-black uppercase tracking-tighter">Yedek Parça & Depo Denetimi</h1></div>
           <Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition">Geri Dön</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 no-print">
           <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border-2 border-indigo-500/20 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-indigo-400 uppercase tracking-widest">📥 Master Stok Excel Güncelleme</h2>
                {timeLeft && <span className="bg-red-900/30 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black border border-red-900/40 animate-pulse">Kilit: {timeLeft}</span>}
              </div>
              {!timeLeft ? (
                <div className="space-y-4">
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-6 text-sm font-black text-gray-400 cursor-pointer" />
                  {progress > 0 && <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden"><div className="bg-indigo-500 h-full transition-all" style={{width:`${progress}%`}}></div></div>}
                </div>
              ) : (
                <div className="py-10 text-center bg-black/20 rounded-3xl border border-dashed border-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs">Son Yüklemeden Sonra 24 Saat Beklenmelidir.</div>
              )}
           </div>
           <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border-2 border-teal-500/20 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
              <h2 className="text-lg font-black text-teal-400 mb-6 uppercase tracking-widest">🔍 Hızlı Stok Sorgulama</h2>
              <div className="flex gap-2 mb-8">
                <input type="text" placeholder="Kod veya Malzeme Adı..." value={smartSearchQuery} onChange={e=>setSmartSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSmartLookup()} className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl p-5 text-sm font-bold" />
                <button onClick={handleSmartLookup} className="bg-teal-600 hover:bg-teal-500 px-10 rounded-2xl font-black transition">GÖSTER</button>
              </div>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {smartSearchResults.map((p, i) => (
                  <div key={i} className="bg-black/40 border border-gray-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1"><p className="text-[10px] text-gray-500 uppercase font-black">Malzeme:</p><p className="text-sm font-black text-white uppercase">{p.parcaAdi || p.name || "İsimsiz"}</p><p className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">KOD: {p.stokKodu || p.id}</p></div>
                    <div className="bg-amber-600 text-white px-8 py-3 rounded-xl flex flex-col items-center shadow-lg min-w-[140px] border border-amber-400/30"><span className="text-[8px] font-black uppercase tracking-widest">Mevcut Stok</span><span className="text-2xl font-black">{p.mevcutMiktar ?? p.stock ?? 0}</span></div>
                  </div>
                ))}
              </div>
           </div>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 border border-gray-800 rounded-[45px] p-8 shadow-2xl">
           <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">⚙️ Malzeme Sarfiyat Geçmişi</h2>
              <div className="flex gap-2">
                 <button onClick={fetchUsageHistory} disabled={isFetchingUsage} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase transition shadow-lg">{isFetchingUsage ? "YÜKLENİYOR..." : "VERİLERİ GETİR"}</button>
                 <button onClick={exportUsageExcel} disabled={!isDataFetched || usedMaterials.length === 0} className="bg-green-700 hover:bg-green-600 text-white text-[10px] font-black px-6 py-2.5 rounded-xl uppercase transition shadow-lg disabled:opacity-20">EXCEL ÇIKTISI AL</button>
              </div>
           </div>
           <div className="overflow-x-auto max-h-[450px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="text-gray-600 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest">
                  <tr><th className="pb-5 px-2">Tarih</th><th className="pb-5">Makine</th><th className="pb-5">Malzeme</th><th className="pb-5 text-center">Miktar</th><th className="pb-5 text-right px-4">Personel</th></tr>
                </thead>
                <tbody className="text-xs font-bold uppercase">
                  {usedMaterials.map((m, i) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition">
                      <td className="py-4 px-2 text-gray-500">{m.tarih}</td>
                      <td className="py-4 text-teal-400">{m.makine}</td>
                      <td className="py-4 text-gray-200">{(!m.name || m.name.toUpperCase() === "ORIJINAL KAYIT") ? (yedekParcalar.find(p => (p.stokKodu && p.stokKodu === m.stockCode) || p.id === m.stockCode)?.parcaAdi || m.stockCode) : m.name}</td>
                      <td className="py-4 text-center text-white font-black tracking-widest">{m.quantity} {m.unit}</td>
                      <td className="py-4 text-right px-4 text-gray-500 font-normal italic">{m.personel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isDataFetched && <div className="py-20 text-center text-gray-700 font-black uppercase tracking-widest text-[10px]">Görüntülemek için "Verileri Getir" butonuna basın.</div>}
           </div>
        </div>
      </div>
    </div>
  );
}