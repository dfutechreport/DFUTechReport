"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); 
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");

  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [globalMTBF, setGlobalMTBF] = useState("0");
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // Bad Actors State'leri
  const [filterEqYil, setFilterEqYil] = useState("");
  const [filterEqAy, setFilterEqAy] = useState("");
  const [filterEqHat, setFilterEqHat] = useState("");
  const [filterEqLimit, setFilterEqLimit] = useState("5"); 
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || ""); 
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          if (role === "admin" || role === "operator" || role === "uretim" || role === "isg") {
            setIsAdmin(true); 
            fetchIlkVeriler(); 
          } else {
            window.location.href = "/dashboard";
          }
        }
      } else {
        window.location.href = "/";
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchIlkVeriler = async () => {
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData: any[] = wSnap.docs.map(d => ({ id: d.id, ...d.data(), gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 }));
      
      const isgAlarmlari = wData.filter(d => d.ekipmanAdi === "KAR devreye alma");
      const pmAlarmlari = wData.filter(d => d.sorunTipi === "Planlı Bakım");
      const normalIsler = wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım");

      setAktifIsgAlarmlari(isgAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifPmAlarmlari(pmAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifIsler(normalIsler.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const eSnap = await getDocs(eQ);
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => doc.data());
      setRawLogs(logs);

      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      const meterSnap = await getDocs(qMeter);
      setRawMeterLogs(meterSnap.docs.map(d => d.data()));

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      
      logs.forEach(data => {
        if (data.hatAdi) hatlar.add(data.hatAdi);
        let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
        if (tarihObj) yillar.add(tarihObj.getFullYear().toString());
      });

      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());
    } catch (error) { console.error(error); }
  };

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.reload();
    } catch (error) { alert("Hata oluştu."); }
  };

  const handleFactoryReset = async () => {
    if (userEmail !== "dfutechreport@gmail.com" && userEmail !== "ilker.yilmaz@donukfirincilik.com.tr") return alert("Yetkisiz!");
    if (window.confirm("SİSTEM SIFIRLANSIN MI?") && window.prompt("SİL yazın") === "SİL") {
      setLoading(true);
      const cols = ["work_orders", "maintenance_logs", "meter_logs", "eked_logs"];
      for (const col of cols) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      window.location.reload();
    }
  };

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const initAylar = (): Record<string, number> => ({ "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0, "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0 });
    const tuketimElektrik = initAylar(); const tuketimDogalgaz = initAylar(); const tuketimSu = initAylar();
    rawMeterLogs.forEach(log => {
      // Orijinal Sayaç Mantığı...
    });
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    // Orijinal KPI ve Grafik Hesaplama Mantığı...
  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white font-bold tracking-widest uppercase">Yükleniyor...</div>;
  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center font-bold">YETKİSİZ ERİŞİM!</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-5">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-12 bg-white p-1 rounded" /><h1 className="text-2xl font-bold uppercase tracking-tighter">DFU Yönetici Paneli</h1></div>
          <button onClick={()=>auth.signOut()} className="bg-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-red-500 transition-all">GÜVENLİ ÇIKIŞ</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
          {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 p-3 rounded-xl font-bold text-xs text-center shadow-lg hover:bg-red-500 transition">🚨 Yeni İş Emri</Link>)}
          {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-900/60 border border-red-500/50 p-3 rounded-xl font-bold text-xs text-center hover:bg-red-600 transition">Aktif İşler</Link>)}
          {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 p-3 rounded-xl font-semibold text-xs text-center hover:bg-gray-600 transition">🗄️ Tamamlanan İşler</Link>)}
          {(userRole === "admin" || userRole === "isg") && (
            <>
              <Link href="/admin/eked" className="bg-yellow-600 text-black p-3 rounded-xl font-bold text-xs text-center hover:bg-yellow-500 transition">🔒 EKED Takip</Link>
              <Link href="/admin/eked/arsiv" className="bg-gray-700 p-3 rounded-xl font-bold text-xs text-center hover:bg-gray-600 transition">🗄️ EKED Arşivi</Link>
              <Link href="/admin/duyurular" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-orange-500 transition">📢 İSG Duyuru</Link>
              <Link href="/admin/kar-takip" className="bg-red-800 p-3 rounded-xl font-bold text-xs text-center hover:bg-red-700 transition">⚡ KAR Arşivi</Link>
            </>
          )}
          {userRole === "admin" && (
            <>
              <Link href="/admin/ekipmanlar" className="bg-blue-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-blue-500 transition">⚙️ Hat/Ekipman</Link>
              <Link href="/admin/personel" className="bg-purple-600 p-3 rounded-xl font-semibold text-xs text-center relative hover:bg-purple-500 transition">👤 Personel Onay {kpiOnayBekleyen > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{kpiOnayBekleyen}</span>}</Link>
            </>
          )}
          {userRole !== "uretim" && userRole !== "isg" && (
            <>
              <Link href="/dashboard/pano-kayit" className="bg-indigo-700 p-3 rounded-xl font-semibold text-xs text-center hover:bg-indigo-600 transition">🔌 Pano Kayıt</Link>
              <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-indigo-500 transition">🔌 Pano Listesi</Link>
              <Link href="/admin/pano-takip" className="bg-gray-800 p-3 rounded-xl font-semibold text-xs text-center hover:bg-gray-700 transition">🗄️ Pano Arşivi</Link>
              <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 p-3 rounded-xl font-bold text-xs text-center hover:bg-cyan-500 transition">✅ Kontrol Formları</Link>
              <Link href="/admin/pm-takvim" className="bg-teal-700 p-3 rounded-xl font-bold text-xs text-center hover:bg-teal-600 transition">📅 PM Takvimi</Link>
              <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 p-3 rounded-xl font-bold text-xs text-center hover:bg-teal-700 transition">🗄️ PM Arşivi</Link>
              <Link href="/admin/yedek-parca" className="bg-fuchsia-700 p-3 rounded-xl font-semibold text-xs text-center hover:bg-fuchsia-600 transition">⚙️ Yedek Parça</Link>
              <Link href="/admin/is-listesi" className="bg-indigo-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-indigo-500 transition">📋 Yapılan İşler</Link>
              <Link href="/dashboard/sayac" className="bg-emerald-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-emerald-500 transition">⚡ Sayaç Okuma</Link>
              <Link href="/admin/mesai" className="bg-teal-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-teal-500 transition">⏰ Mesai Raporları</Link>
              <Link href="/dashboard" className="bg-orange-600 p-3 rounded-xl font-semibold text-xs text-center hover:bg-orange-500 transition shadow-xl">🛠️ Vardiya Raporu</Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Toplam İş</p><h3 className="text-3xl font-black text-green-400">{kpiToplamIs}</h3></div>
          <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-xl"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duruş Sayısı</p><h3 className="text-3xl font-black text-red-400">{kpiDurusluIsSayisi}</h3></div>
          <div className="bg-gray-900 p-6 rounded-3xl border border-indigo-900/30 shadow-xl"><p className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Kayıp Süre</p><h3 className="text-3xl font-black text-indigo-400">{kpiAylikDurus} dk</h3></div>
          <div className="bg-gray-900 p-6 rounded-3xl border border-purple-900/30 shadow-xl"><p className="text-[10px] text-purple-400 uppercase font-bold mb-1">MTTR (Ort)</p><h3 className="text-3xl font-black text-purple-400">{(kpiToplamSure/kpiToplamIs || 0).toFixed(0)} dk</h3></div>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl">
          <h2 className="text-sm font-bold text-teal-400 mb-8 uppercase tracking-widest">⚡ Hat Bazlı İş Dağılımı</h2>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi}><XAxis dataKey="isim" tick={{fontSize:10, fill:'#6B7280'}} /><Tooltip /><Bar dataKey="adet" fill="#10B981" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
}
