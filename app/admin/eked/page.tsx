"use client";
import { Zap, ShieldAlert, ClipboardList, AlertTriangle, LogOut } from 'lucide-react';


import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function EkedTakip() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const router = useRouter();

  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [yer, setYer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          fetchEked();
        } else router.push("/");
      } else router.push("/");
    });
    return () => unsubscribe();
  }, [router]);

  const fetchEked = async () => {
    try {
      const q = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const snap = await getDocs(q);
      const data = snap.docs.map(document => ({
        id: document.id, ...document.data(),
        gercekZaman: document.data().kayitTarihi ? document.data().kayitTarihi.toDate().getTime() : 0
      }));
      setLogs(data.sort((a, b) => b.gercekZaman - a.gercekZaman));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleEkedEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yer) return alert("Lütfen uygulama yapılan yeri giriniz.");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "eked_logs"), {
        tarih: tarih,
        personel: userName,
        yer: yer,
        durum: "Açık",
        kayitTarihi: new Date(),
        kapatmaTarihi: null
      });
      alert("EKED Başlatıldı.");
      setYer(""); fetchEked();
    } catch (error) { alert("Hata!"); } finally { setIsSubmitting(false); }
  };

  const handleEkedKaldir = async (id: string) => {
    if (!window.confirm("Enerji kilidinin kaldırıldığını onaylıyor musunuz?")) return;
    try {
      await updateDoc(doc(db, "eked_logs", id), { durum: "Kapalı", kapatmaTarihi: new Date() });
      fetchEked();
    } catch (error) { alert("Hata!"); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    try { await deleteDoc(doc(db, "eked_logs", id)); fetchEked(); } catch (error) { alert("Hata!"); }
  };

  // ROL BAZLI DİNAMİK LİNK
  const getDashboardLink = () => {
    if (userRole === "admin") return "/admin";
    if (userRole === "uretim") return "/admin/tamamlanan-isler";
    if (userRole === "ik") return "/admin/mesai";
    return "/dashboard";
  };

  if (loading) return <div className="p-10 text-white italic text-center uppercase tracking-widest bg-slate-950 min-h-screen flex items-center justify-center">EKED Sistemleri Hazırlanıyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative italic font-bold">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER VE DİNAMİK BUTON */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-yellow-500 flex items-center gap-3 uppercase tracking-tighter">
              🔐 EKED - LOTO Takip Merkezi
            </h1>
            <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">Enerji Kilitleme ve Etiketleme Arşivi</p>
          </div>
          <Link 
            href={getDashboardLink()} 
            className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-lg border border-gray-700"
          >
            ← Dashboarda Dön
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* YENİ EKED FORMU */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border-2 border-yellow-600/30 p-8 rounded-[2.5rem] shadow-2xl">
              <h2 className="text-xl font-black mb-8 text-yellow-500 uppercase italic underline decoration-yellow-900/50">Yeni Kilitleme Başlat</h2>
              <form onSubmit={handleEkedEkle} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest">Uygulama Tarihi</label>
                  <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-yellow-500 outline-none transition-all italic" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest">Sorumlu Personel</label>
                  <input type="text" value={userName} disabled className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-gray-600 cursor-not-allowed font-black" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase tracking-widest">Kilitlenen Ekipman / Pano</label>
                  <textarea value={yer} onChange={e => setYer(e.target.value)} placeholder="Örn: 4 Nolu Fırın Ana Şalteri" rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-yellow-500 outline-none transition-all italic" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-black py-5 rounded-2xl shadow-xl disabled:opacity-50 transition-all uppercase tracking-widest text-xs">
                  {isSubmitting ? "İşleniyor..." : "Sistemi Kilitle (EKED)"}
                </button>
              </form>
            </div>
          </div>

          {/* AKTİF EKED LİSTESİ */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden italic">
              <h2 className="text-xl font-black mb-6 text-white uppercase italic">Sahadaki Aktif Kilitler</h2>
              {logs.length === 0 ? <div className="text-center py-20 text-gray-600 font-bold uppercase tracking-widest">Şu an sahada kilitli bir sistem bulunmuyor.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="text-gray-500 border-b border-gray-800 uppercase text-[10px] font-black">
                      <tr>
                        <th className="pb-5 px-2">Tarih</th>
                        <th className="pb-5">Personel</th>
                        <th className="pb-5">Uygulama Yeri</th>
                        <th className="pb-5 text-center">Durum</th>
                        <th className="pb-5 text-right">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody className="font-bold">
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-gray-800/50 hover:bg-white/5 transition italic">
                          <td className="py-5 px-2 text-slate-400 font-black text-xs">{log.tarih}</td>
                          <td className="py-5 text-blue-400 uppercase text-xs">{log.personel}</td>
                          <td className="py-5 text-slate-200 uppercase text-xs truncate max-w-[200px]">{log.yer}</td>
                          <td className="py-5 text-center">
                            <span className="bg-yellow-900/30 text-yellow-500 text-[9px] px-2 py-1 rounded-full border border-yellow-700/50 animate-pulse font-black uppercase">🔐 Kilitli</span>
                          </td>
                          <td className="py-5 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleEkedKaldir(log.id)} className="bg-green-900/40 text-green-500 text-[9px] px-3 py-1.5 rounded-lg border border-green-800/50 font-black hover:bg-green-600 hover:text-white transition-all uppercase">Kilidi Aç</button>
                              {userRole === "admin" && <button onClick={() => handleSil(log.id)} className="bg-red-900/40 text-red-500 text-[9px] px-3 py-1.5 rounded-lg border border-red-800/50 font-black hover:bg-red-600 hover:text-white transition-all">Sil</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
