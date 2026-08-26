"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function TamamlananIsler() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  
  // Filtreler
  const [fYil, setFYil] = useState(new Date().getFullYear().toString());
  const [fAy, setFAy] = useState("");
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
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          setUserRole(uSnap.data().role);
          fetchOrders();
        }
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Index hatasını önlemek için orderBy'ı buradan kaldırıp aşağıda JS ile yapıyoruz
      const q = query(collection(db, "work_orders"), where("durum", "==", "Kapalı"));
      const snap = await getDocs(q);
      
      const data = snap.docs.map((d): any => {
        const docData = d.data();
        // Tarih alanı kontrolü (tamamlanmaTarihi veya kayitTarihi)
        const tDate = docData.tamamlanmaTarihi?.toDate ? docData.tamamlanmaTarihi.toDate() : new Date();
        return {
          id: d.id,
          ...docData,
          jsDate: tDate,
          dateStr: tDate.toLocaleString('tr-TR')
        };
      });

      // Tarihe göre azalan sıralama (En yeni en üstte)
      const sortedData = data.sort((a, b) => b.jsDate.getTime() - a.jsDate.getTime());

      setRawOrders(sortedData);
      setPersonelHavuzu(Array.from(new Set(sortedData.map((o: any) => o.bildirenKisi))).filter(Boolean).sort() as string[]);
      setHatHavuzu(Array.from(new Set(sortedData.map((o: any) => o.hatAdi))).filter(Boolean).sort() as string[]);
      setFilteredOrders(sortedData);
    } catch (error) { 
      console.error("Veri çekme hatası:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    let result = rawOrders.filter(o => {
      const matchYil = !fYil || o.jsDate.getFullYear().toString() === fYil;
      const matchAy = !fAy || (o.jsDate.getMonth() + 1).toString() === fAy;
      const matchHat = !fHat || o.hatAdi === fHat;
      const matchEkipman = !fEkipman || (o.ekipmanAdi && o.ekipmanAdi.toLowerCase().includes(fEkipman.toLowerCase()));
      const matchPersonel = !fPersonel || o.bildirenKisi === fPersonel;
      const matchDurus = !fDurus || (fDurus === "evet" ? o.isDuruslu === true : o.isDuruslu !== true);
      return matchYil && matchAy && matchHat && matchEkipman && matchPersonel && matchDurus;
    });
    setFilteredOrders(result);
  }, [fYil, fAy, fHat, fEkipman, fPersonel, fDurus, rawOrders]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono italic">DFU ARŞİVİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Üst Navigasyon */}
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">İş Emirleri Arşivi</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Kapatılan Bildirimler</p>
          </div>
          <div className="flex gap-4">
            <Link href={userRole === "admin" ? "/admin" : "/dashboard"} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg border border-slate-700">Geri Dön</Link>
            {userRole === "uretim" && (
              <Link href="/admin/is-emri-ac" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Yeni İş Emri</Link>
            )}
          </div>
        </div>

        {/* Filtreleme Paneli */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8 bg-slate-900/30 p-6 rounded-[2.5rem] border border-slate-800">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Yıl</label>
            <select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic">
              <option value="">Tümü</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Ay</label>
            <select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic">
              <option value="">Tümü</option>{[...Array(12)].map((_,i)=><option key={i+1} value={i+1}>{i+1}. Ay</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Hat</label>
            <select value={fHat} onChange={e=>setFHat(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic">
              <option value="">Tüm Hatlar</option>{hatHavuzu.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Personel</label>
            <select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic">
              <option value="">Tümü</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Duruş</label>
            <select value={fDurus} onChange={e=>setFDurus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic">
              <option value="">Tümü</option><option value="evet">Duruşlu</option><option value="hayir">Normal</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={()=>{setFYil("");setFAy("");setFHat("");setFEkipman("");setFPersonel("");setFDurus("");}} className="w-full bg-red-900/20 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase border border-red-900/30">Temizle</button>
          </div>
        </div>

        {/* Liste */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
              <tr>
                <th className="p-6">Hat / Ekipman</th>
                <th className="p-6">Arıza Detayı</th>
                <th className="p-6">Teknisyen / Sorumlu</th>
                <th className="p-6 text-right">Zaman / Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
  {filteredOrders.map(order => (
    <tr key={order.id} className="hover:bg-slate-800/30 transition-all group">
      <td className="p-6">
        <p className="font-black text-slate-200 uppercase group-hover:text-blue-400">{order.ekipmanAdi}</p>
        <p className="text-[10px] text-slate-500 uppercase">{order.hatAdi}</p>
      </td>
      
      {/* ARIZA DETAYI HÜCRESİ - DÜZELTİLDİ */}
      <td className="p-6 text-slate-400 max-w-sm italic font-medium leading-relaxed">
        {order.arizaDetayi || order.aciklama || order.sorun || order.detay || "Detay belirtilmemiş."}
      </td>

      <td className="p-6 font-bold text-slate-300">{order.bildirenKisi}</td>
      <td className="p-6 text-right font-mono text-xs text-slate-500">{order.dateStr}</td>
    </tr>
  ))}
</tbody>
          </table>
          {filteredOrders.length === 0 && <div className="p-20 text-center text-slate-600 italic">Veri bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}