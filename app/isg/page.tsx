"use client";

import { useEffect, useState, Suspense } from "react";
// Firebase yolu orijinal dashboard dosyanızdaki çalışan yol ile eşitlendi.
import { auth, db } from "../../lib/firebase"; 
import { collection, query, onSnapshot, orderBy, limit, doc, getDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

// --- SAF SVG İKONLAR ---
const ICONS = {
  PANO: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  EKED: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  ARSIV: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  DUYURU: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  KAR: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/><path d="M12 2v10M18 10l-6 6-6-6"/></svg>,
  CIKIS: <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
};

function ISGPageContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [ekedLogs, setEkedLogs] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (!currUser) {
        router.push("/login");
        return;
      }
      const userSnap = await getDoc(doc(db, "users", currUser.uid));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.role !== "isg" && userData.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setUser(userData);
      }
      setLoading(false);
    });

    // Veri Dinleyicileri
    const qEked = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
    const unsubEked = onSnapshot(qEked, (snap) => setEkedLogs(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    const qWork = query(collection(db, "work_orders"), limit(50));
    const unsubWork = onSnapshot(qWork, (snap) => setWorkOrders(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubscribe(); unsubEked(); unsubWork(); };
  }, [router]);

  const handleLogout = async () => {
    if (confirm("Çıkış Yapılsın mı?")) {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      router.push("/login");
    }
  };

  if (!mounted || loading) return <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest text-center">İSG SİSTEMİ YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 font-sans italic font-black uppercase overflow-x-hidden selection:bg-indigo-500">
      <div className="max-w-[1440px] mx-auto space-y-12 animate-in fade-in duration-700">
        
        {/* ÜST BUTON GRUBU */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-8 rounded-[2.5rem] border border-indigo-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl">{ICONS.PANO}<span>Pano Kontrol</span></Link>
          <Link href="/admin/eked" className="bg-yellow-600 p-8 rounded-[2.5rem] border border-yellow-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl text-black">{ICONS.EKED}<span>EKED Takip</span></Link>
          <Link href="/admin/eked/arsiv" className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl">{ICONS.ARSIV}<span>EKED Arşivi</span></Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-8 rounded-[2.5rem] border border-orange-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl animate-pulse">{ICONS.DUYURU}<span>İSG Duyuru</span></Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-8 rounded-[2.5rem] border border-red-700 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl">{ICONS.KAR}<span>KAR Arşivi</span></Link>
          <button onClick={handleLogout} className="bg-red-600 p-8 rounded-[2.5rem] border border-red-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl">{ICONS.CIKIS}<span>Çıkış Yap</span></button>
        </div>

        {/* VERİ MODÜLLERİ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* İSG Alarmları */}
          <div className="bg-neutral-900 border-2 border-red-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-red-500 mb-6 underline decoration-red-600 tracking-widest">🚨 İSG ALARMLARI</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {workOrders.filter(wo => wo.sorunTipi === "İSG" || wo.aciklama?.includes("ALARM")).length === 0 ? <p className="text-gray-600 py-10 text-center">Aktif Alarm Yok</p> : 
                workOrders.filter(wo => wo.sorunTipi === "İSG").map(wo => <div key={wo.id} className="bg-red-950/20 p-5 rounded-3xl border border-red-900/30 text-[10px]">{wo.aciklama}</div>)}
            </div>
          </div>

          {/* Aktif EKED */}
          <div className="bg-neutral-900 border-2 border-yellow-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-yellow-500 mb-6 underline decoration-yellow-600 tracking-widest">🔐 AKTİF EKED</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {ekedLogs.length === 0 ? <p className="text-gray-600 py-10 text-center">Bildirim Yok</p> : 
                ekedLogs.map(log => <div key={log.id} className="bg-yellow-950/20 p-5 rounded-3xl border border-yellow-900/30 text-[10px]">{log.yer}</div>)}
            </div>
          </div>

          {/* Saha Bildirimleri */}
          <div className="bg-neutral-900 border-2 border-indigo-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-indigo-400 mb-6 underline decoration-indigo-600 tracking-widest">📡 SAHA BİLDİRİMLERİ</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {workOrders.filter(wo => wo.durum === "Açık").length === 0 ? <p className="text-gray-600 py-10 text-center">Bildirim Yok</p> : 
                workOrders.filter(wo => wo.durum === "Açık").map(wo => <div key={wo.id} className="bg-indigo-950/20 p-5 rounded-3xl border border-indigo-900/30 text-[10px]">{wo.ekipmanAdi}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ISGPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <ISGPageContent />
    </Suspense>
  );
}