"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, writeBatch, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";

export default function YedekParcaYonetimi() {
  // --- EXISTING STATES ---
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

  // --- KRİTİK: SMART SEARCH LOGIC (V84) ---
  const handleSmartSearch = () => {
    const searchStr = smartSearchQuery.trim().toUpperCase();
    if (!searchStr) return;

    // Hem stok kodu hem de parça adı içinde arama yapar
    const found = yedekParcalar.find(p => 
      String(p.id).toUpperCase() === searchStr || 
      (p.stokKodu && String(p.stokKodu).toUpperCase() === searchStr) ||
      (p.parcaAdi && String(p.parcaAdi).toUpperCase().includes(searchStr))
    );

    if (found) {
      setSmartSearchResult({
        name: found.parcaAdi || "İsimsiz",
        code: found.stokKodu || found.id,
        stock: found.mevcutMiktar ?? 0,
        unit: found.birim || "Adet"
      });
    } else {
      setSmartSearchResult({ name: "Kayıt Bulunamadı", code: searchStr, stock: "-", unit: "" });
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcaAdi || !stokKodu) return alert("Lütfen isim ve kod girin!");
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "spare_parts", stokKodu), { parcaAdi, stokKodu, mevcutMiktar, birim, kritikSeviye, sonGuncelleme: new Date() });
      alert("Parça kaydedildi."); setParcaAdi(""); setStokKodu(""); fetchYedekParcalar();
    } catch (e) { alert("Hata!"); }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Silmek istiyor musunuz?")) return;
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
            <h1 className="text-2xl font-black uppercase tracking-tighter">Yedek Parça & Depo Yönetimi</h1>
          </div>
          <Link href="/admin" className="bg-gray-800 text-[10px] font-black px-5 py-3 rounded-2xl border border-gray-700 hover:bg-gray-700 transition">Geri Dön</Link>
        </div>

        {/* --- YENİ: AKILLI STOK SORGULAMA PANELİ (V84) --- */}
        <div className="bg-gray-900 border-2 border-indigo-500/20 p-8 rounded-[40px] mb-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
          <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-3">
             <span className="text-indigo-400">🔍</span> Hızlı Stok Sorgulama (Kod veya İsim)
          </h2>
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <input 
              type="text" 
              placeholder="Stok Kodu veya Malzeme Adı Yazın..." 
              value={smartSearchQuery}
              onChange={(e) => setSmartSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:ring-2 ring-indigo-500"
            />
            <button 
              onClick={handleSmartSearch}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs"
            >
              SORGULA
            </button>
          </div>

          {smartSearchResult && (
            <div className="animate-fadeIn bg-black/40 border border-gray-800 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Bulunan Malzeme:</p>
                <h3 className={`text-xl font-black ${smartSearchResult.name === "Kayıt Bulunamadı" ? "text-red-500" : "text-teal-400"} uppercase`}>
                  {smartSearchResult.name}
                </h3>
                {smartSearchResult.unit && <p className="text-[10px] text-gray-500 font-bold mt-1">Kod: {smartSearchResult.code}</p>}
              </div>
              {smartSearchResult.stock !== "-" && (
                <div className="bg-amber-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex flex-col items-center border border-amber-400/30">
                  <span className="text-[10px] font-black uppercase tracking-widest">Ambar Stoğu</span>
                  <span className="text-3xl font-black">{smartSearchResult.stock} <span className="text-sm font-normal uppercase">{smartSearchResult.unit}</span></span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MANUEL EKLEME FORMU - EXISTING */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-[40px] shadow-xl">
              <h2 className="text-lg font-black mb-6 uppercase text-gray-300">Yeni Parça Tanımla</h2>
              <form onSubmit={handleManualAdd} className="space-y-4">
                <input type="text" placeholder="Parça Adı" value={parcaAdi} onChange={e=>setParcaAdi(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-sm" />
                <input type="text" placeholder="Stok Kodu" value={stokKodu} onChange={e=>setStokKodu(e.target.value)} className="w-full bg-gray-800 border-gray-700 rounded-xl p-4 text-sm uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Miktar" value={mevcutMiktar} onChange={e=>setMevcutMiktar(Number(e.target.value))} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm" />
                  <select value={birim} onChange={e=>setBirim(e.target.value)} className="bg-gray-800 border-gray-700 rounded-xl p-4 text-sm"><option value="Adet">Adet</option><option value="Litre">Litre</option><option value="Kg">Kg</option><option value="Metre">Metre</option></select>
                </div>
                <button disabled={isSubmitting} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Sisteme Kaydet</button>
              </form>
            </div>
          </div>

          {/* TABLO LİSTESİ - EXISTING */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-8 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-gray-500 border-b border-gray-800 text-[10px] uppercase font-black">
                    <tr><th className="pb-4">Kod</th><th className="pb-4">Parça Adı</th><th className="pb-4">Stok</th><th className="pb-4">İşlem</th></tr>
                  </thead>
                  <tbody className="text-sm font-bold uppercase">
                    {yedekParcalar.slice(0, 50).map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/40 hover:bg-white/5 transition">
                        <td className="py-4 text-gray-400 text-xs">{p.stokKodu || p.id}</td>
                        <td className="py-4 text-gray-200">{p.parcaAdi}</td>
                        <td className={`py-4 ${p.mevcutMiktar <= p.kritikSeviye ? 'text-red-500' : 'text-teal-400'}`}>{p.mevcutMiktar} {p.birim}</td>
                        <td className="py-4"><button onClick={()=>handleDelete(p.id)} className="text-gray-600 hover:text-red-500">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
