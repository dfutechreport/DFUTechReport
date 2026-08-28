"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx"; // Projenizdeki Excel kütüphanesi kullanıldı

export default function MesaiRaporlari() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [mesaiList, setMesaiList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const router = useRouter();

  // FİLTRE STATE'LERİ
  const [fYil, setFYil] = useState(new Date().getFullYear().toString());
  const [fAy, setFAy] = useState("");
  const [fGun, setFGun] = useState("");
  const [fPersonel, setFPersonel] = useState("");
  const [fTur, setFTur] = useState("");

  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists() && userSnap.data().isApproved) {
          setUserRole(uSnap.data().role);
          fetchMesaiRecords();
        } else router.push("/");
      } else router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMesaiRecords = async () => {
    try {
      const snap = await getDocs(query(collection(db, "overtime_logs"), orderBy("tarih", "desc")));
      const data = snap.docs.map(d => {
        const raw = d.data();
        const dateParts = raw.tarih ? raw.tarih.split("-") : []; // YYYY-MM-DD formatı parçalanır
        return {
          id: d.id,
          ...raw,
          yil: dateParts[0] || "",
          ay: dateParts[1] || "",
          gun: dateParts[2] || "",
          personelIsmi: raw.personel || "Bilinmiyor",
          sureSaat: raw.toplamMesaiDk ? (Number(raw.toplamMesaiDk) / 60).toFixed(1) : "0"
        };
      });
      setMesaiList(data);
      setPersonelHavuzu(Array.from(new Set(data.map(m => m.personelIsmi))).sort());
      setFilteredList(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // FİLTRELEME MOTORU
  useEffect(() => {
    let result = mesaiList.filter(m => {
      const matchYil = !fYil || m.yil === fYil;
      const matchAy = !fAy || m.ay === fAy.padStart(2, '0');
      const matchGun = !fGun || m.gun === fGun.padStart(2, '0');
      const matchPersonel = !fPersonel || m.personelIsmi === fPersonel;
      const matchTur = !fTur || m.mesaiTuru === fTur;
      return matchYil && matchAy && matchGun && matchPersonel && matchTur;
    });
    setFilteredList(result);
  }, [fYil, fAy, fGun, fPersonel, fTur, mesaiList]);

  // EXCEL RAPORLAMA FONKSİYONU
  const exportToExcel = () => {
    const reportData = filteredList.map(m => ({
      "Tarih": m.tarih,
      "Personel": m.personelIsmi,
      "Mesai Türü": m.mesaiTuru,
      "Başlangıç": m.baslangicSaati,
      "Bitiş": m.bitisSaati,
      "Evden Çağırma": m.evdenCagirma,
      "Toplam Süre (Saat)": m.sureSaat,
      "Açıklama": m.aciklama
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mesai Raporu");
    XLSX.writeFile(wb, `DFU_Mesai_Raporu_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white italic">Raporlar Hazırlanıyor...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-10 font-sans italic font-bold">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Üst Navigasyon */}
        <div className="flex justify-between items-center mb-10 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mesai Raporları</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Personel Puantaj ve Verimlilik Takibi</p>
          </div>
          <div className="flex gap-4">
            <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg transition-all">📊 Excel Raporu Al</button>
            {userRole !== "ik" && (
              <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg border border-slate-700">← Geri Dön</button>
            )}
            <button onClick={() => { signOut(auth); router.push("/"); }} className="bg-red-900/20 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-red-900/30">Çıkış</button>
          </div>
        </div>

        {/* Gelişmiş Filtreleme Paneli */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 bg-slate-900/30 p-8 rounded-[3rem] border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Yıl</label>
            <select value={fYil} onChange={e=>setFYil(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic font-bold">
              <option value="">Tümü</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Ay</label>
            <select value={fAy} onChange={e=>setFAy(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic font-bold">
              <option value="">Tümü</option>{[...Array(12)].map((_,i)=><option key={i+1} value={i+1}>{i+1}. Ay</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Gün</label>
            <select value={fGun} onChange={e=>setFGun(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic font-bold">
              <option value="">Tümü</option>{[...Array(31)].map((_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Personel</label>
            <select value={fPersonel} onChange={e=>setFPersonel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic font-bold">
              <option value="">Tüm Personel</option>{personelHavuzu.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase px-2">Mesai Türü</label>
            <select value={fTur} onChange={e=>setFTur(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none italic font-bold">
              <option value="">Tümü</option><option value="Normal Mesai">Normal</option><option value="İzin Mesaisi">Haftalık İzin</option><option value="Resmi Tatil">Resmi Tatil</option>
            </select>
          </div>
        </div>

        {/* Mesai Tablosu */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800 italic">
              <tr>
                <th className="p-6">Personel</th>
                <th className="p-6">Zaman / Detay</th>
                <th className="p-6">Tür</th>
                <th className="p-6">Toplam Süre</th>
                <th className="p-6 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm italic font-bold uppercase">
              {filteredList.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-all group">
                  <td className="p-6">
                    <p className="text-slate-200 font-black group-hover:text-blue-400">{log.personelIsmi}</p>
                    <p className="text-[10px] text-slate-600 font-bold italic">{log.bolum || "Teknik Departman"}</p>
                  </td>
                  <td className="p-6">
                    <p className="text-slate-300">{log.tarih}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{log.baslangicSaati} - {log.bitisSaati}</p>
                  </td>
                  <td className="p-6 text-slate-400 text-xs">
                    {log.mesaiTuru} {log.evdenCagirma === "Var" && <span className="text-[9px] text-orange-500 block">+ Evden Çağırma</span>}
                  </td>
                  <td className="p-6 text-blue-500 font-black text-lg">{log.sureSaat} <span className="text-xs text-slate-600">Saat</span></td>
                  <td className="p-6 text-right">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${log.durum === "Onaylandı" ? "bg-green-900/20 text-green-500 border border-green-900/30" : "bg-blue-900/20 text-blue-500 border border-blue-900/30"}`}>
                      {log.durum || "Beklemede"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredList.length === 0 && <div className="p-20 text-center text-slate-600 font-black uppercase italic">Kriterlere uygun mesai kaydı bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}