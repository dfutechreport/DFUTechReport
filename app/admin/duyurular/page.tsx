"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy, doc, getDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import DashboardReturn from "../../../components/DashboardReturn";

function DuyurularContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [duyurular, setDuyurular] = useState<any[]>([]);

  // Form State
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        
        const q = query(collection(db, "duyurular"), orderBy("createdAt", "desc"));
        const unsubDuyurular = onSnapshot(q, (snap) => {
          setDuyurular(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsubDuyurular();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleDuyuruEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baslik || !icerik) return alert("Lütfen tüm alanları doldurun.");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "duyurular"), {
        baslik,
        icerik,
        tarih: new Date().toLocaleString("tr-TR"),
        ekleyen: userName,
        role: userRole,
        createdAt: serverTimestamp()
      });
      setBaslik("");
      setIcerik("");
      alert("Duyuru başarıyla yayınlandı.");
    } catch (error) {
      alert("Hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSil = async (id: string) => {
    if (!confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "duyurular", id));
    } catch (e) { alert("Hata oluştu."); }
  };

  if (!mounted || loading) return null;

  // Yetki Kontrolü: Admin ve ISG yayınlayabilir
  const canPublish = userRole === "admin" || userRole === "isg";

  return (
    <div className="p-6 bg-[#050505] min-h-screen text-slate-200 font-sans italic font-black uppercase overflow-x-hidden">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-orange-500 uppercase italic">
              📢 İSG DUYURU MERKEZİ
            </h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Güvenlik Bildirimleri Paneli</p>
          </div>
          
          <DashboardReturn />
        </div>

        {/* DUYURU EKLEME FORMU (Admin ve ISG Görür) */}
        {canPublish && (
          <div className="bg-slate-900 border border-orange-500/20 p-8 rounded-[2.5rem] shadow-xl">
            <h2 className="text-orange-400 text-sm mb-6 tracking-widest font-black uppercase italic">YENİ GÜVENLİK DUYURUSU OLUŞTUR</h2>
            <form onSubmit={handleDuyuruEkle} className="space-y-4">
              <input 
                type="text" 
                placeholder="DUYURU BAŞLIĞI" 
                value={baslik} 
                onChange={e => setBaslik(e.target.value)}
                className="w-full bg-black border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-orange-500 transition-all font-black uppercase italic"
              />
              <textarea 
                placeholder="MESAJINIZ..." 
                value={icerik} 
                onChange={e => setIcerik(e.target.value)}
                className="w-full bg-black border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-orange-500 h-32 transition-all font-black uppercase italic"
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 p-5 rounded-2xl text-white font-black transition-all disabled:opacity-50 shadow-lg shadow-orange-900/20"
              >
                {isSubmitting ? "YAYINLANIYOR..." : "DUYURUYU ŞİMDİ PAYLAŞ"}
              </button>
            </form>
          </div>
        )}

        {/* DUYURU LİSTESİ */}
        <div className="space-y-6">
          {duyurular.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-20 rounded-[3rem] text-center text-slate-600 font-black italic uppercase">
              Yayınlanmış duyuru bulunamadı.
            </div>
          ) : (
            duyurular.map(duyuru => (
              <div key={duyuru.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group hover:border-orange-500/40 transition-all">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] bg-orange-600/20 text-orange-400 px-4 py-1.5 rounded-full border border-orange-600/30 font-bold italic">
                      {duyuru.tarih}
                    </span>
                    <span className="text-[9px] text-slate-500 font-black uppercase">By {duyuru.ekleyen} ({duyuru.role || "yetkili"})</span>
                  </div>
                  {canPublish && (
                    <button onClick={() => handleSil(duyuru.id)} className="text-red-500 text-[10px] font-black hover:bg-red-500/10 px-3 py-1 rounded-lg transition-all">SİL</button>
                  )}
                </div>
                <h3 className="text-xl text-white mb-3 tracking-tight italic font-black uppercase underline decoration-orange-500/30">{duyuru.baslik}</h3>
                <p className="text-slate-400 text-sm normal-case font-normal leading-relaxed italic">{duyuru.icerik}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DuyurularPage() {
  return (
    <Suspense fallback={null}>
      <DuyurularContent />
    </Suspense>
  );
}
