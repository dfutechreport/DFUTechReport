"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, writeBatch, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import * as XLSX from 'xlsx';

export default function YedekParcaYonetimi() {
  const [parcaAdi, setParcaAdi] = useState("");
  const [stokKodu, setStokKodu] = useState("");
  const [mevcutMiktar, setMevcutMiktar] = useState(0);
  const [birim, setBirim] = useState("Adet");
  const [kritikSeviye, setKritikSeviye] = useState(2);
  const [yedekParcalar, setYedekParcalar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [progress, setProgress] = useState(0);
  const [sonYuklemeZamani, setSonYuklemeZamani] = useState<any>(null);

  // --- NEW SMART SEARCH STATES ---
  const [smartSearchQuery, setSmartSearchQuery] = useState("");
  const [smartSearchResult, setSmartSearchResult] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) { setUserName(userSnap.data().name); setUserRole(userSnap.data().role); }
        fetchYedekParcalar();
      } else { window.location.href = "/"; }
    });
    return () => unsubscribe();
  }, []);

  const fetchYedekParcalar = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "spare_parts"), orderBy("parcaAdi", "asc"));
      const snap = await getDocs(q);
      setYedekParcalar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // --- SMART SEARCH LOGIC (V85) ---
  const handleSmartSearch = () => {
    const s = smartSearchQuery.trim().toUpperCase();
    if (!s) return;
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

  // --- EXCEL UPLOAD ENGINE (ORIJINAL) ---
  const handleExcelYukle = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const toplam = data.length;
      let islenen = 0;
      const CHUNK_SIZE = 400;

      for (let i = 0; i < toplam; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item: any) => {
          const docRef = doc(collection(db, "spare_parts"), String(item.stokKodu));
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
        islenen += chunk.length;
        setProgress(Math.floor((islenen / toplam) * 100));
      }
      alert(`✅ Başarılı! ${toplam} parça aktarıldı.`);
      fetchYedekParcalar();
    };
    reader.readAsBinaryString(file);
  };

  const handleManualAdd = async (e: any) => {
    e.preventDefault();
    if (!parcaAdi || !stokKodu) return alert("Eksik bilgi!");
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "spare_parts", stokKodu), { parcaAdi, stokKodu, mevcutMiktar, birim, kritikSeviye, sonGuncelleme: new Date() });
      alert("Kaydedildi."); setParcaAdi(""); setStokKodu(""); fetchYedekParcalar();
    } catch (e) { alert("Hata!"); }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Silinsin mi?")) return;
    await deleteDoc(doc(db, "spare_parts", id));
    fetchYedekParcalar();
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-teal-400 font-black animate-pulse">ENVANTER YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6 no-print">
          <div className="flex items-center gap-4">
            <img src="/dfulogo.png" className="h-10 bg-white p-1 rounded" />
            <h1 className="text-xl font-black uppercase tracking-tighter">Yedek Parça Yönetimi</h1>
          </div>
          <Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700">Geri Dön</Link>
        </div>

        {/* --- YENİ MODÜL: AKILLI SORGULAMA --- */}
        <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 md:p-8 rounded-[40px] mb-10 shadow-2xl relative overflow-hidden no-print">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
          <h2 className="text-lg font-black text-white mb-6 uppercase tracking-widest flex items-center gap-3">🔍 Hızlı Envanter Sorgu (Kod/İsim)</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input type="text" placeholder="Stok kodu veya parça adının bir kısmını yazın..." value={smartSearchQuery} onChange={e=>setSmartSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSmartSearch()} className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 ring-indigo-500" />
            <button onClick={handleSmartSearch} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest">GÖSTER</button>
          </div>
          {smartSearchResult && (
            <div className="animate-fadeIn bg-black/40 border border-gray-800 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Arama Sonucu:</p>
                <h3 className={`text-xl font-black ${smartSearchResult.name === "Kayıt Bulunamadı" ? "text-red-500" : "text-teal-400"} uppercase`}>{smartSearchResult.name}</h3>
                {smartSearchResult.code && <p className="text-[9px] text-gray-500 font-bold mt-1 tracking-widest">SİSTEM KODU: {smartSearchResult.code}</p>}
              </div>
              {smartSearchResult.stock !== "-" && (
                <div className="bg-amber-600 text-white px-10 py-4 rounded-2xl shadow-2xl flex flex-col items-center border border-amber-400/30">
                  <span className="text-[10px] font-black uppercase tracking-widest">Mevcut Stok</span>
                  <span className="text-3xl font-black">{smartSearchResult.stock} <span className="text-sm font-normal uppercase">{smartSearchResult.unit}</span></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- EXCEL VE MANUEL FORMLAR --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 no-print">
           <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] shadow-xl">
              <h2 className="text-lg font-black mb-6 uppercase text-indigo-400 tracking-tighter">Excel'den Toplu Güncelleme (13k+)</h2>
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelYukle} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs font-bold text-gray-400 mb-4" />
              {progress > 0 && <div className="w-full bg-gray-800 rounded-full h-2 mb-2"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>}
              {progress > 0 && <p className="text-[10px] text-indigo-400 font-black">Yükleniyor: %{progress}</p>}
           </div>

           <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] shadow-xl">
              <h2 className="text-lg font-black mb-6 uppercase text-teal-400 tracking-tighter">Yeni Parça Tanımla</h2>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <input type="text" placeholder="Parça Adı" value={parcaAdi} onChange={e=>setParcaAdi(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm font-bold" />
                <input type="text" placeholder="Stok Kodu" value={stokKodu} onChange={e=>setStokKodu(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm font-bold uppercase" />
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" placeholder="Miktar" value={mevcutMiktar} onChange={e=>setMevcutMiktar(Number(e.target.value))} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm font-bold" />
                   <select value={birim} onChange={e=>setBirim(e.target.value)} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm font-bold"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                </div>
                <button disabled={isSubmitting} className="w-full bg-teal-600 hover:bg-teal-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-lg">Sisteme Kaydet</button>
              </form>
           </div>
        </div>

        {/* --- TAM LİSTE TABLOSU --- */}
        <div className="bg-gray-900 border border-gray-800 rounded-[45px] p-10 shadow-3xl">
           <h2 className="text-sm font-black text-gray-500 uppercase tracking-[0.3em] mb-8">Ambar Envanter Listesi</h2>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black tracking-widest">
                 <tr><th className="pb-5 px-2">Kod</th><th className="pb-5">Parça Tanımı</th><th className="pb-5">Mevcut Stok</th><th className="pb-5 text-right">İşlem</th></tr>
               </thead>
               <tbody className="text-sm font-bold uppercase">
                 {yedekParcalar.slice(0, 50).map((p, i) => (
                   <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition group">
                     <td className="py-5 px-2 text-gray-400 text-xs font-black">{p.stokKodu || p.id}</td>
                     <td className="py-5 text-gray-100 font-black">{p.parcaAdi}</td>
                     <td className={`py-5 ${p.mevcutMiktar <= p.kritikSeviye ? 'text-red-500' : 'text-teal-400'}`}>{p.mevcutMiktar} {p.birim}</td>
                     <td className="py-5 text-right"><button onClick={()=>handleDelete(p.id)} className="text-gray-700 hover:text-red-500 font-black transition">SİL</button></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

      </div>
    </div>
  );
}
