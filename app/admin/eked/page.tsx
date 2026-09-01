"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy, doc, getDoc, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import DashboardReturn from "../../../components/DashboardReturn";

function EkedContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  // EKED Kilit Formu State'leri - Gelişmiş
  const [hatAdi, setHatAdi] = useState("");
  const [ekipmanAdi, setEkipmanAdi] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hatlar = ["ML", "SPL", "BUN", "DİĞER"];

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
        }
        
        // EKED Loglarını dinleme
        const q = query(collection(db, "eked_logs"), orderBy("durum", "desc"), orderBy("kayitTarihi", "desc"));
        const unsubLogs = onSnapshot(q, (snap) => {
          setLogs(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsubLogs();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleEkedEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hatAdi || !ekipmanAdi || !aciklama) return alert("Lütfen tüm alanları doldurun.");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "eked_logs"), {
        hatAdi,
        ekipmanAdi,
        aciklama,
        yer: `${hatAdi} - ${ekipmanAdi}`, // Geriye dönük uyumluluk için
        personel: userName,
        durum: "Açık",
        tarih: new Date().toLocaleDateString("tr-TR"),
        kayitTarihi: serverTimestamp(),
        kapatmaTarihi: null
      });
      setHatAdi("");
      setEkipmanAdi("");
      setAciklama("");
      alert("EKED Kilitleme işlemi başarıyla kaydedildi.");
    } catch (error) {
      alert("Hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKilitAc = async (id: string) => {
    if (!confirm("Bu kilidi açmak ve işlemi tamamlamak istediğinize emin misiniz?")) return;
    try {
      await updateDoc(doc(db, "eked_logs", id), {
        durum: "Kapalı",
        kapatmaTarihi: new Date().toLocaleDateString("tr-TR")
      });
      alert("Kilit başarıyla açıldı.");
    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  if (!mounted || loading) return null;

  return (
    <div className="p-6 bg-[#050505] min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1300px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-yellow-500 uppercase italic">
              🔐 EKED TAKİP SİSTEMİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Enerji Kesme ve Kilitleme Yönetimi</p>
          </div>
          
          <DashboardReturn />
        </div>

        {/* GELİŞMİŞ EKED KİLİTLEME FORMU */}
        <div className="bg-slate-900 border border-yellow-500/20 p-8 rounded-[2.5rem] shadow-xl">
          <h2 className="text-yellow-500 text-sm mb-6 tracking-widest font-black uppercase italic">⚠️ YENİ EKED KİLİTLEME KAYDI</h2>
          <form onSubmit={handleEkedEkle} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-black">HAT SEÇİMİ</label>
                <select 
                  value={hatAdi} 
                  onChange={e => setHatAdi(e.target.value)}
                  className="w-full bg-black border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-yellow-500 transition-all font-black uppercase italic"
                >
                  <option value="">HAT SEÇİNİZ</option>
                  {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-black">KİLİTLENEN EKİPMAN / PANO</label>
                <input 
                  type="text" 
                  placeholder="ÖRN: FIRIN ANA MOTORU" 
                  value={ekipmanAdi} 
                  onChange={e => setEkipmanAdi(e.target.value)}
                  className="w-full bg-black border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-yellow-500 transition-all font-black uppercase italic"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black">KİLİTLEME GEREKÇESİ (AÇIKLAMA)</label>
              <textarea 
                placeholder="LÜTFEN KİLİTLEME SEBEBİNİ DETAYLANDIRIN..." 
                value={aciklama} 
                onChange={e => setAciklama(e.target.value)}
                className="w-full bg-black border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-yellow-500 transition-all font-black uppercase italic h-24"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-black p-5 rounded-2xl font-black transition-all disabled:opacity-50 shadow-lg shadow-yellow-900/20"
            >
              {isSubmitting ? "KAYDEDİLİYOR..." : "KİLİTLEME İŞLEMİNİ BAŞLAT"}
            </button>
          </form>
        </div>

        {/* LİSTE TABLOSU */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-2xl">
          <h2 className="text-white text-sm mb-6 tracking-widest font-black uppercase italic border-b border-slate-800 pb-4">🔐 AKTİF VE GEÇMİŞ KİLİT LİSTESİ</h2>
          {logs.length === 0 ? (
            <div className="text-center py-20 text-slate-600 font-black italic uppercase">
              Aktif EKED işlemi bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-500 text-[10px] tracking-widest uppercase italic font-black">
                    <th className="px-6 py-2">Tarih</th>
                    <th className="px-6 py-2">Hat / Ekipman</th>
                    <th className="px-6 py-2">Gerekçe / Açıklama</th>
                    <th className="px-6 py-2">Sorumlu</th>
                    <th className="px-6 py-2 text-center">Durum</th>
                    <th className="px-6 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="bg-black/40 hover:bg-slate-800/30 transition-all font-black italic">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400 rounded-l-2xl">{log.tarih}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-indigo-400 uppercase">{log.hatAdi}</span>
                          <span className="text-sm text-white uppercase">{log.ekipmanAdi}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-400 normal-case max-w-xs truncate">{log.aciklama}</td>
                      <td className="px-6 py-4 text-xs text-indigo-400 uppercase">{log.personel}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black italic ${log.durum === 'Açık' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                          {log.durum}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right rounded-r-2xl">
                        {log.durum === "Açık" && (
                          <button onClick={() => handleKilitAc(log.id)} className="bg-green-600 text-black px-4 py-1.5 rounded-lg text-[9px] font-black hover:bg-green-500 transition-all shadow-lg">KİLİDİ AÇ</button>
                        )}
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
  );
}

export default function EkedPage() {
  return (
    <Suspense fallback={null}>
      <EkedContent />
    </Suspense>
  );
}
