'use client';
import { useEffect, useState, Suspense } from "react";
import { auth, db } from "../../lib/firebase"; 
import { collection, query, onSnapshot, limit, doc, getDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SVG = {
  PANO: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  EKED: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  ARSIV: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
  DUYURU: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  KAR: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/><path d="M12 2v10M18 10l-6 6-6-6"/></svg>',
  CIKIS: '<svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
};

function ISGContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ekedLogs, setEkedLogs] = useState<any[]>([]);
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [isgAlarmlari, setIsgAlarmlari] = useState<any[]>([]);
  const [selectedEked, setSelectedEked] = useState<any>(null);
  const [showEkedModal, setShowEkedModal] = useState(false);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [showWorkModal, setShowWorkModal] = useState(false);


  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (!currUser) { window.location.href = "/"; return; }
      const snap = await getDoc(doc(db, "users", currUser.uid));
      if (snap.exists() && (snap.data().role === "isg" || snap.data().role === "admin")) setLoading(false);
      else router.push("/dashboard");
    });

    const qWork = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
    const unsubWork = onSnapshot(qWork, (snap) => {
      const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
      setAktifIsler(data.filter((d: any) => d.ekipmanAdi !== "KAR devreye alma"));
      setIsgAlarmlari(data.filter((d: any) => d.sorunTipi === "Elektrik" && d.ekipmanAdi === "KAR devreye alma"));
    });

    const qEked = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
    const unsubEked = onSnapshot(qEked, (snap) => setEkedLogs(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubscribe(); unsubWork(); unsubEked(); };
  }, [router]);

  const handleLogout = async () => {
    if (confirm("Çıkış Yapılsın mı?")) {
      await signOut(auth); localStorage.clear(); sessionStorage.clear(); window.location.href = "/";
    }
  };

  if (!mounted || loading) return <div className="h-screen bg-black flex items-center justify-center text-white italic font-black uppercase tracking-widest">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 font-sans italic font-black uppercase overflow-x-hidden selection:bg-indigo-500">
      <div className="max-w-[1440px] mx-auto space-y-12 animate-in fade-in duration-700">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 p-8 rounded-[2.5rem] border border-indigo-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl"><div dangerouslySetInnerHTML={{__html: SVG.PANO}} /><span>Pano Kontrol</span></Link>
          <Link href="/admin/eked" className="bg-yellow-600 p-8 rounded-[2.5rem] border border-yellow-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl text-black"><div dangerouslySetInnerHTML={{__html: SVG.EKED}} /><span>EKED Takip</span></Link>
          <Link href="/admin/eked/arsiv" className="bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl"><div dangerouslySetInnerHTML={{__html: SVG.ARSIV}} /><span>EKED Arşivi</span></Link>
          <Link href="/admin/duyurular" className="bg-orange-600 p-8 rounded-[2.5rem] border border-orange-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl animate-pulse"><div dangerouslySetInnerHTML={{__html: SVG.DUYURU}} /><span>İSG Duyuru</span></Link>
          <Link href="/admin/kar-takip" className="bg-red-800 p-8 rounded-[2.5rem] border border-red-700 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl"><div dangerouslySetInnerHTML={{__html: SVG.KAR}} /><span>KAR Arşivi</span></Link>
          <button onClick={handleLogout} className="bg-red-600 p-8 rounded-[2.5rem] border border-red-400/30 flex flex-col items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl font-black uppercase text-[10px] italic tracking-widest"><div dangerouslySetInnerHTML={{__html: SVG.CIKIS}} /><span>Çıkış Yap</span></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-neutral-900 border-2 border-red-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-red-500 mb-6 underline decoration-red-600 tracking-widest">🚨 İSG ALARMLARI</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {isgAlarmlari.length === 0 ? <p className="text-gray-600 py-10 text-center font-black italic">Aktif Alarm Yok</p> : 
                isgAlarmlari.map(wo => <div key={wo.id} onClick={() => { setSelectedWork(wo); setShowWorkModal(true); }} className="bg-red-950/20 p-5 rounded-3xl border border-red-900/30 text-[10px] italic font-black text-red-200 uppercase tracking-tighter cursor-pointer hover:bg-red-900/40 hover:scale-[1.02] transition-all">{wo.aciklama}</div>)}
            </div>
          </div>
          <div className="bg-neutral-900 border-2 border-yellow-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-yellow-500 mb-6 underline decoration-yellow-600 tracking-widest">🔐 AKTİF EKED</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 italic font-black text-yellow-100 uppercase tracking-tighter">
              {ekedLogs.length === 0 ? <p className="text-gray-600 py-10 text-center font-black italic">Bildirim Yok</p> : 
                ekedLogs.map(log => <div key={log.id} onClick={() => { setSelectedEked(log); setShowEkedModal(true); }} className="bg-yellow-950/20 p-5 rounded-3xl border border-yellow-900/30 text-[10px] cursor-pointer hover:bg-yellow-900/40 hover:scale-[1.02] transition-all">{log.yer}</div>)}
            </div>
          </div>
          <div className="bg-neutral-900 border-2 border-indigo-900/40 p-8 rounded-[3.5rem] shadow-2xl">
            <h2 className="text-lg text-indigo-400 mb-6 underline decoration-indigo-600 tracking-widest">📡 SAHA BİLDİRİMLERİ</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 italic font-black text-indigo-100 uppercase tracking-tighter">
              {aktifIsler.length === 0 ? <p className="text-gray-600 py-10 text-center font-black italic">Bildirim Yok</p> : 
                aktifIsler.map(wo => <div key={wo.id} onClick={() => { setSelectedWork(wo); setShowWorkModal(true); }} className="bg-indigo-950/20 p-5 rounded-3xl border border-indigo-900/30 text-[10px] cursor-pointer hover:bg-indigo-900/40 hover:scale-[1.02] transition-all">{wo.ekipmanAdi} - {wo.hatAdi}</div>)}
            </div>
          </div>
        </div>
      </div>

      {/* --- EKED DETAY MODAL --- */}
      {showEkedModal && selectedEked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowEkedModal(false)}></div>
          <div className="relative bg-neutral-900 border-2 border-yellow-900/40 w-full max-w-2xl rounded-[3rem] shadow-[0_0_100px_rgba(234,179,8,0.1)] overflow-hidden flex flex-col">
            <div className="p-8 border-b border-yellow-900/20 flex justify-between items-center">
              <h2 className="text-xl font-black text-yellow-500 uppercase tracking-[0.2em] flex items-center gap-3">
                <span>🔐</span> EKED AKTİF KİLİT DETAYI
              </h2>
              <button onClick={() => setShowEkedModal(false)} className="text-yellow-500/50 hover:text-yellow-500 transition-colors text-2xl">✕</button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] text-yellow-500/50 font-black tracking-widest block mb-2">BÖLGE / YER</label>
                  <div className="bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-2xl text-white font-black uppercase italic">{selectedEked.yer}</div>
                </div>
                <div>
                  <label className="text-[10px] text-yellow-500/50 font-black tracking-widest block mb-2">SORUMLU PERSONEL</label>
                  <div className="bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-2xl text-white font-black uppercase italic">{selectedEked.personel}</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-yellow-500/50 font-black tracking-widest block mb-2">BAŞLANGIÇ ZAMANI</label>
                <div className="bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-2xl text-white font-black uppercase italic tracking-widest">
                  {selectedEked.baslangicTarihi} | {selectedEked.baslangicSaati}
                </div>
              </div>
              {selectedEked.aciklama && (
                <div>
                  <label className="text-[10px] text-yellow-500/50 font-black tracking-widest block mb-2">EK NOTLAR</label>
                  <div className="bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-2xl text-white/70 text-[11px] font-bold italic leading-relaxed">
                    {selectedEked.aciklama}
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-yellow-900/20 bg-yellow-950/10 text-center">
              <p className="text-[9px] text-yellow-500/40 font-black tracking-[0.3em] uppercase animate-pulse">BU EKİPMANIN ENERJİSİ ŞU AN KESİKTİR - MÜDAHALE YASAKTIR</p>
            </div>
          </div>
        </div>
      )}

      {/* --- İSG ALARM / SAHA BİLDİRİM DETAY MODAL --- */}
      {showWorkModal && selectedWork && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowWorkModal(false)}></div>
          <div className={`relative bg-neutral-900 border-2 ${selectedWork.ekipmanAdi === "KAR devreye alma" ? 'border-red-900/40' : 'border-indigo-900/40'} w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col`}>
            <div className={`p-8 border-b ${selectedWork.ekipmanAdi === "KAR devreye alma" ? 'border-red-900/20' : 'border-indigo-900/20'} flex justify-between items-center`}>
              <h2 className={`text-xl font-black ${selectedWork.ekipmanAdi === "KAR devreye alma" ? 'text-red-500' : 'text-indigo-400'} uppercase tracking-[0.2em] flex items-center gap-3`}>
                <span>{selectedWork.ekipmanAdi === "KAR devreye alma" ? '🚨' : '📡'}</span> {selectedWork.ekipmanAdi === "KAR devreye alma" ? 'KRİTİK İSG ALARMI' : 'SAHA BİLDİRİM DETAYI'}
              </h2>
              <button onClick={() => setShowWorkModal(false)} className="text-gray-500 hover:text-white transition-colors text-2xl">✕</button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] text-gray-500 font-black tracking-widest block mb-2">HAT / EKİPMAN</label>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-black uppercase italic">{selectedWork.hatAdi} - {selectedWork.ekipmanAdi}</div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black tracking-widest block mb-2">BİLDİREN KİŞİ</label>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-black uppercase italic">{selectedWork.bildirenKisi}</div>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 font-black tracking-widest block mb-2">DETAYLI AÇIKLAMA</label>
                <div className={`${selectedWork.ekipmanAdi === "KAR devreye alma" ? 'bg-red-950/20 border-red-900/30 text-red-200' : 'bg-indigo-950/20 border-indigo-900/30 text-indigo-100'} border p-6 rounded-3xl text-sm font-black italic leading-relaxed uppercase tracking-tighter`}>
                  {selectedWork.aciklama}
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 opacity-50 text-[10px] font-black uppercase italic tracking-[0.2em]">
                <span>Öncelik: {selectedWork.oncelik}</span>
                <span>Durum: {selectedWork.durum}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ISGPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <ISGContent />
    </Suspense>
  );
}
