"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function TamamlananIsler() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  
  // Filtre State'leri
  const [fYil, setFYil] = useState(new Date().getFullYear().toString());
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fHat, setFHat] = useState("");
  const [fEkipman, setFEkipman] = useState("");
  const [fPersonel, setFPersonel] = useState("");
  const [fDurus, setFDurus] = useState("");

  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]);
  const [hatHavuzu, setHatHavuzu] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
if (uSnap.exists()) {
  setUserRole(uSnap.data().role);
  fetchOrders();
}
      } else router.push("/");
    });
    return () => unsubscribe();
  }, []);

  const fetchOrders = async () => {
  try {
    const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"), orderBy("tamamlanmaTarihi", "desc"));
    const snap = await getDocs(q);
    
    // BURASI DÜZELTİLDİ: 'any' eklenerek tip hatası giderildi
    const data = snap.docs.map((d): any => {
      const docData = d.data();
      const date = docData.tamamlanmaTarihi?.toDate() || new Date();
      return {
        id: d.id,
        ...docData,
        jsDate: date,
        dateStr: date.toLocaleString('tr-TR')
      };
    });

    setRawOrders(data);
    
    // Dinamik Filtre Havuzları
    setPersonelHavuzu(Array.from(new Set(data.map((o: any) => o.bildirenKisi))).filter(Boolean).sort());
    setHatHavuzu(Array.from(new Set(data.map((o: any) => o.hatAdi))).filter(Boolean).sort());
    
    setFilteredOrders(data);
  } catch (error) { console.error(error); } finally { setLoading(false); }
};

  // Filtreleme Motoru
  useEffect(() => {
    let result = rawOrders.filter(o => {
      const matchYil = !fYil || o.jsDate.getFullYear().toString() === fYil;
      const matchAy = !fAy || (o.jsDate.getMonth() + 1).toString() === fAy;
      const matchGun = !fGun || o.jsDate.getDate().toString() === fGun;
      const matchHat = !fHat || o.hatAdi === fHat;
      const matchEkipman = !fEkipman || o.ekipmanAdi.toLowerCase().includes(fEkipman.toLowerCase());
      const matchPersonel = !fPersonel || o.bildirenKisi === fPersonel;
      const matchDurus = !fDurus || (fDurus === "evet" ? o.isDuruslu : !o.isDuruslu);
      return matchYil && matchAy && matchGun && matchHat && matchEkipman && matchPersonel && matchDurus;
    });
    setFilteredOrders(result);
  }, [fYil, fAy, fGun, fHat, fEkipman, fPersonel, fDurus, rawOrders]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">Veriler Hazırlanıyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Üst Navigasyon */}
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">İş Emirleri Arşivi</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Kapatılan Bildirimler ve Detaylı Takip</p>
          </div>
          <div className="flex gap-4">
            <Link href={userRole === "admin" ? "/admin" : "/dashboard"} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg border border-slate-700">Dashboard'a Dön</Link>
            {userRole === "uretim" && (
              <Link href="/admin/is-emri-ac" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-blue-900/20 shadow-xl">+ Yeni İş Emri</Link>
            )}
          </div>
        </div>

        {/* Gelişmiş Filtreleme Paneli */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8 bg-slate-900/30 p-6 rounded-[2.5rem] border border-slate-800">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Yıl</label>
            <select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none">
              <option value="">Tümü</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Ay</label>
            <select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none">
              <option value="">Tümü</option>{[...Array(12)].map((_,i)=><option key={i+1} value={i+1}>{i+1}. Ay</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Hat</label>
            <select value={fHat} onChange={e=>setFHat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none">
              <option value="">Tüm Hatlar</option>{hatHavuzu.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Ekipman</label>
            <input type="text" placeholder="Arayın..." value={fEkipman} onChange={e=>setFEkipman(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Personel</label>
            <select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none">
              <option value="">Tümü</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Duruş</label>
            <select value={fDurus} onChange={e=>setFDurus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none">
              <option value="">Tümü</option><option value="evet">Duruşlu</option><option value="hayir">Normal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={()=>{setFYil("");setFAy("");setFGun("");setFHat("");setFEkipman("");setFPersonel("");setFDurus("");}} className="w-full bg-red-900/20 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-900/40 border border-red-900/30">Filtre Sıfırla</button>
          </div>
        </div>

        {/* Veri Tablosu */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
              <tr>
                <th className="p-6">Hat / Ekipman</th>
                <th className="p-6">Arıza & Müdahale Detayı</th>
                <th className="p-6">Bildiren / Teknisyen</th>
                <th className="p-6 text-right">Zaman Çizelgesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-800/30 transition-all group">
                  <td className="p-6 align-top">
                    <div className="flex items-center gap-3 mb-1">
                      {order.isDuruslu && <span className="bg-red-600 w-2 h-2 rounded-full animate-pulse"></span>}
                      <p className="font-black text-slate-200 uppercase group-hover:text-blue-400">{order.ekipmanAdi}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{order.hatAdi}</p>
                  </td>
                  <td className="p-6 align-top max-w-md">
                    <p className="text-slate-300 font-bold text-xs mb-2">Arıza: <span className="text-slate-500 font-medium italic">{order.arizaDetayi}</span></p>
                    {order.aciklama && (
                      <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-indigo-400 font-black uppercase mb-1">Çözüm:</p>
                        <p className="text-xs text-slate-400 leading-relaxed italic">{order.aciklama}</p>
                      </div>
                    )}
                  </td>
                  <td className="p-6 align-top">
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-600 font-bold uppercase">Sorumlu</p>
                      <p className="font-black text-blue-500 text-xs">{order.bildirenKisi}</p>
                    </div>
                  </td>
                  <td className="p-6 text-right align-top">
                    <p className="font-mono text-[10px] text-slate-500 mb-1">{order.dateStr}</p>
                    <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase ${order.oncelik === "Kritik" ? "bg-red-900/30 text-red-500 border border-red-500/20" : "bg-slate-800 text-slate-400"}`}>
                      {order.oncelik || "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && <div className="p-20 text-center text-slate-600 italic font-bold">Aradığınız kriterlere uygun sonuç bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}