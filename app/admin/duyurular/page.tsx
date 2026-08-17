"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";

export default function DuyuruYonetimi() {
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [duyurular, setDuyurular] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDuyurular = async () => {
    const q = query(collection(db, "announcements"), orderBy("tarih", "desc"));
    const snap = await getDocs(q);
    setDuyurular(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchDuyurular(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baslik || !icerik) return alert("Lütfen başlık ve içerik girin.");
    setLoading(true);
    try {
      await addDoc(collection(db, "announcements"), {
        baslik,
        icerik,
        tarih: new Date(),
      });
      setBaslik(""); setIcerik("");
      fetchDuyurular();
      alert("Duyuru başarıyla yayınlandı. Personel giriş yaptığında ekranına düşecek.");
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) return;
    await deleteDoc(doc(db, "announcements", id));
    fetchDuyurular();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-4"><img src="/dfulogo.png" className="h-10 md:h-12 bg-white p-1 rounded shadow-sm" alt="DFU" /><h1 className="text-3xl font-bold text-yellow-500">Duyuru Yönetimi</h1></div>
          <Link href="/admin" className="bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition">← Dashboard</Link>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl mb-8">
          <h2 className="text-xl font-bold mb-4">Yeni Duyuru Yayınla</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" placeholder="Duyuru Başlığı (Örn: İş Güvenliği Uyarısı)" value={baslik} onChange={e => setBaslik(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            <textarea placeholder="Duyuru Detayı..." value={icerik} onChange={e => setIcerik(e.target.value)} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white" />
            <button type="submit" disabled={loading} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg w-full">{loading ? "Yayınlanıyor..." : "Tüm Tesise Duyur"}</button>
          </form>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-4">Aktif Duyurular</h2>
          {duyurular.length === 0 ? <p className="text-gray-500">Yayında duyuru yok.</p> : (
            <div className="space-y-4">
              {duyurular.map(d => (
                <div key={d.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-yellow-400 text-lg">{d.baslik}</h3>
                    <p className="text-gray-300 mt-2 text-sm">{d.icerik}</p>
                  </div>
                  <button onClick={() => handleSil(d.id)} className="bg-red-900/50 text-red-400 text-xs px-3 py-1 rounded hover:bg-red-600 hover:text-white transition">Sil</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}