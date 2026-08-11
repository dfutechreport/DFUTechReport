"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, setDoc, writeBatch, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import * as XLSX from 'xlsx';

export default function YedekParcaYonetimi() {
  // States
  const [yedekParcalar, setYedekParcalar] = useState<any[]>([]);
  const [usedMaterials, setUsedMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [progress, setProgress] = useState(0);
  
  // Search & Filter States
  const [smartSearchQuery, setSmartSearchQuery] = useState("");
  const [smartSearchResult, setSmartSearchResult] = useState<any>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [passiveFilter, setPassiveFilter] = useState("all"); // all, hide, only

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name); setUserRole(userSnap.data().role); }
        fetchAllData();
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Envanteri Çek
      const q = query(collection(db, "spare_parts"), orderBy("parcaAdi", "asc"));
      const snap = await getDocs(q);
      setYedekParcalar(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Kullanılan Malzemeleri Çek (maintenance_logs içerisinden)
      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const usageList: any[] = [];
      logsSnap.forEach(d => {
        const data = d.data();
        if (data.kullanilanMalzemeler && Array.isArray(data.kullanilanMalzemeler)) {
          data.kullanilanMalzemeler.forEach((m: any) => {
            usageList.push({
              ...m,
              tarih: data.baslangicTarihi || "-",
              personel: data.bildirenKisi || "Sistem",
              makine: data.ekipmanAdi || "-"
            });
          });
        }
      });
      setUsedMaterials(usageList.sort((a,b) => b.tarih.localeCompare(a.tarih)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // --- MASTER EXCEL YÜKLEME (400 CHUNKS + PROGRESS) ---
  const handleExcelUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const total = data.length;
      let processed = 0;
      const CHUNK = 400;

      for (let i = 0; i < total; i += CHUNK) {
        const chunk = data.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach((item: any) => {
          if(item.stokKodu) {
            const docRef = doc(db, "spare_parts", String(item.stokKodu));
            batch.set(docRef, item, { merge: true });
          }
        });
        await batch.commit();
        processed += chunk.length;
        setProgress(Math.floor((processed / total) * 100));
      }
      alert("Master Stok başarıyla güncellendi.");
      fetchAllData();
      setProgress(0);
    };
    reader.readAsBinaryString(file);
  };

  // --- SMART LOOKUP (GÖSTER BUTONU) ---
  const handleSmartLookup = () => {
    const s = smartSearchQuery.trim().toUpperCase();
    const found = yedekParcalar.find(p => 
      String(p.id).toUpperCase() === s || 
      (p.stokKodu && String(p.stokKodu).toUpperCase() === s) ||
      (p.parcaAdi && String(p.parcaAdi).toUpperCase().includes(s))
    );
    if (found) {
      setSmartSearchResult({ name: found.parcaAdi, code: found.stokKodu || found.id, stock: found.mevcutMiktar ?? 0, unit: found.birim || "Adet" });
    } else {
      setSmartSearchResult({ name: "Kayıt Bulunamadı", stock: "-", unit: "" });
    }
  };

  // --- SARFİYAT EXCEL RAPORU ---
  const exportUsageToExcel = () => {
    let csv = "uFEFF" + "Tarih;Makine;Personel;Stok Kodu;Parca Adi;Miktar;Birim\n";
    usedMaterials.forEach(m => {
      csv += `${m.tarih};${m.makine};${m.personel};${m.stockCode};${m.name};${m.quantity};${m.unit}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Sarfiyat_Raporu_${new Date().toLocaleDateString()}.csv`);
    link.click();
  };

  // --- ENVANTER FİLTRELEME MANTIĞI ---
  const filteredInventory = yedekParcalar.filter(p => {
    const name = (p.parcaAdi || "").toLowerCase();
    const matchesSearch = name.includes(inventorySearch.toLowerCase()) || (p.stokKodu || "").toLowerCase().includes(inventorySearch.toLowerCase());
    
    let matchesPassive = true;
    if (passiveFilter === "hide") matchesPassive = !name.includes("pasif");
    if (passiveFilter === "only") matchesPassive = name.includes("pasif");
    
    return matchesSearch && matchesPassive;
  });

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">DFU ENVANTER YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6 no-print">
           <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" /><h1 className="text-xl font-black uppercase tracking-tighter">Depo ve Envanter Yönetimi</h1></div>
           <Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700">Admin Panel</Link>
        </div>

        {/* ÜST PANEL: MASTER YÜKLEME VE HIZLI SORGU */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 no-print">
           {/* EXCEL UPLOAD */}
           <div className="bg-gray-900 border-2 border-indigo-500/20 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
              <h2 className="text-lg font-black mb-6 uppercase text-indigo-400 flex items-center gap-3">📥 Master Stok Excel Yükle</h2>
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-xs font-bold text-gray-400" />
              {progress > 0 && (
                <div className="mt-6">
                  <div className="w-full bg-gray-800 rounded-full h-3 mb-2"><div className="bg-indigo-500 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                  <p className="text-right text-[10px] font-black text-indigo-400 uppercase tracking-widest">Yükleniyor: %{progress}</p>
                </div>
              )}
           </div>

           {/* SMART LOOKUP */}
           <div className="bg-gray-900 border-2 border-teal-500/20 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
              <h2 className="text-lg font-black mb-6 uppercase text-teal-400 flex items-center gap-3">🔍 Hızlı Stok Sorgula</h2>
              <div className="flex gap-2">
                <input type="text" placeholder="Kod veya İsim..." value={smartSearchQuery} onChange={e=>setSmartSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSmartLookup()} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm font-bold" />
                <button onClick={handleSmartLookup} className="bg-teal-600 hover:bg-teal-500 px-6 rounded-xl font-black text-xs transition uppercase">GÖSTER</button>
              </div>
              {smartSearchResult && (
                <div className="mt-4 p-4 bg-black/40 border border-gray-800 rounded-2xl flex justify-between items-center">
                  <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Malzeme:</p><p className="text-sm font-black text-white">{smartSearchResult.name}</p></div>
                  <div className="bg-amber-600 px-4 py-2 rounded-xl text-center"><p className="text-[8px] font-black uppercase">Stok</p><p className="text-lg font-black">{smartSearchResult.stock}</p></div>
                </div>
              )}
           </div>
        </div>

        {/* KULLANILAN MALZEMELER LİSTESİ */}
        <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 mb-10 shadow-xl">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">⚙️ Malzeme Sarfiyat Geçmişi</h2>
              <button onClick={exportUsageToExcel} className="bg-green-700 hover:bg-green-600 text-white text-[9px] font-black px-4 py-2 rounded-xl uppercase transition shadow-lg">Sarfiyat Raporu Al</button>
           </div>
           <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="text-gray-600 border-b border-gray-800 text-[10px] uppercase font-black tracking-widest">
                  <tr><th className="pb-4">Tarih</th><th className="pb-4">Makine</th><th className="pb-4">Malzeme</th><th className="pb-4">Miktar</th><th className="pb-4">Personel</th></tr>
                </thead>
                <tbody className="text-xs font-bold uppercase">
                  {usedMaterials.slice(0, 50).map((m, i) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition"><td className="py-3 text-gray-500">{m.tarih}</td><td className="py-3 text-teal-500">{m.makine}</td><td className="py-3 text-gray-200">{m.name}</td><td className="py-3 text-white">{m.quantity} {m.unit}</td><td className="py-3 text-gray-400">{m.personel}</td></tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>

        {/* ANA ENVANTER LİSTESİ VE GELİŞMİŞ FİLTRELER */}
        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-8 shadow-3xl">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">📦 Ambar Envanter Listesi</h2>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                 <select value={passiveFilter} onChange={e=>setPassiveFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-xs font-black text-indigo-400 outline-none">
                    <option value="all">Filtre: Hepsi</option><option value="hide">Pasifleri Yoksay</option><option value="only">Sadece Pasifler</option>
                 </select>
                 <input type="text" placeholder="Envanterde ara..." value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)} className="flex-1 md:w-64 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-xs text-white outline-none focus:ring-1 ring-teal-500" />
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                  <tr><th className="pb-5 px-2">Kod</th><th className="pb-5">Parça Tanımı</th><th className="pb-5 text-right px-4">Stok Miktarı</th></tr>
                </thead>
                <tbody className="text-sm font-bold uppercase">
                  {filteredInventory.slice(0, 100).map((p, i) => (
                    <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                      <td className="py-5 px-2 text-gray-400 text-xs font-black">{p.stokKodu || p.id}</td>
                      <td className={`py-5 ${p.parcaAdi?.toLowerCase().includes('pasif') ? 'text-gray-600 line-through italic' : 'text-gray-100'}`}>{p.parcaAdi}</td>
                      <td className="py-5 text-right px-4"><span className={`px-4 py-1.5 rounded-lg text-xs font-black ${p.mevcutMiktar <= (p.kritikSeviye || 2) ? 'bg-red-900/30 text-red-500 border border-red-500/50' : 'bg-teal-900/20 text-teal-400 border border-teal-500/20'}`}>{p.mevcutMiktar} {p.birim}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInventory.length === 0 && <div className="py-20 text-center text-gray-600 font-bold uppercase tracking-widest italic text-xs">Aranan kriterlere uygun malzeme bulunamadı.</div>}
           </div>
        </div>

      </div>
    </div>
  );
}
