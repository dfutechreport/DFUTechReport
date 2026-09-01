"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, query, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
// Firebase yolu, üst klasör seviyesine göre garantiye alındı
import { auth, db } from "../../../../lib/firebase"; 
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
// Import yolu garantiye alındı
import DashboardReturn from "../../../../components/DashboardReturn";

function EkedArsivContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        const q = query(collection(db, "eked_logs"), orderBy("tarih", "desc"));
        const unsub = onSnapshot(q, (snap) => {
          setLogs(snap.docs.map(d => ({id: d.id, ...d.data()})));
          setLoading(false);
        });
        return () => unsub();
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Sayfa yüklenmeden (hydration) önce render etmeyi engelle
  if (!mounted || loading) return null;

  return (
    <div className="p-8 bg-black min-h-screen text-white uppercase italic font-black">
      <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-5">
        <h1 className="text-2xl text-indigo-400 tracking-tighter">📂 EKED İŞLEM ARŞİVİ</h1>
        <DashboardReturn />
      </div>

      <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800">
        {logs.length === 0 ? (
          <p className="text-slate-600 text-center">Kayıtlı arşiv bulunmuyor.</p>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="p-5 border-b border-slate-800 flex justify-between">
                <span>{log.yer}</span>
                <span className="text-indigo-500">{log.durum}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EkedArsivPage() {
  return (
    <Suspense fallback={null}>
      <EkedArsivContent />
    </Suspense>
  );
}