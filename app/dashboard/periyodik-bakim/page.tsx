"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function PeriyodikBakimFormu() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [makineListesi, setMakineListesi] = useState<any[]>([]);
  const [seciliMakine, setSeciliMakine] = useState<any>(null);
  const [seciliMakineId, setSeciliMakineId] = useState("");
  const [yanitlar, setYanitlar] = useState<Record<number, string>>({});
  
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [vardiya, setVardiya] = useState("");
  const [aciklama, setAciklama] = useState("");

  // YENİ: PM İŞ EMRİ ID Sİ (Alarmdan gelirse formu doldurup iş emrini kapatacak)
  const searchParams = useSearchParams();
  const pmWorkOrderId = searchParams.get("pmOrderId");
  const pmMakineKodu = searchParams.get("makine");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchMakineListesi();
        } else window.location.href = "/";
      } else window.location.href = "/";
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchMakineListesi = async () => {
    const snap = await getDocs(collection(db, "pm_master_plan"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const list = data.filter((d: any) => d.aktif).sort((a, b) => a.id.localeCompare(b.id));
    setMakineListesi(list);

    // EĞER URL'DEN MAVİ ALARM İLE GELDİYSE OTOMATİK SEÇ
    if (pmMakineKodu) {
      setSeciliMakineId(pmMakineKodu);
      const secilen = list.find(m => m.id === pmMakineKodu);
      if (secilen) setSeciliMakine(secilen);
    }
  };

  const handleMakineSecimi = (makineId: string) => {
    setSeciliMakineId(makineId);
    const secilen = makineListesi.find(m => m.id === makineId);
    setSeciliMakine(secilen);
    setYanitlar({}); 
  };

  const handleYanit = (index: number, durum: string) => {
    setYanitlar(prev => ({ ...prev, [index]: durum }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vardiya) return alert("Vardiya seçimi zorunludur!");
    if (!seciliMakine) return alert("Lütfen bir makine seçiniz!");
    
    const eksikVarMi = seciliMakine.maddeler.some((_: any, index: number) => !yanitlar[index]);
    if (eksikVarMi) return alert("Lütfen tüm maddeleri işaretleyiniz.");

    setIsSubmitting(true);
    try {
      const hataliMaddeler = seciliMakine.maddeler.filter((madde: string, index: number) => yanitlar[index] === "Hatalı");

      // PM Arşivine Kaydet
      await addDoc(collection(db, "pm_logs"), {
        makineKodu: seciliMakine.id, hatAdi: seciliMakine.hatAdi, ekipmanAdi: seciliMakine.ekipmanAdi,
        bakimPeriyodu: seciliMakine.siklik, tarih, vardiya, personel: userName, yanitlar: yanitlar, 
        hataliMaddeSayisi: hataliMaddeler.length,
        aciklama: aciklama || (hataliMaddeler.length > 0 ? "Kritik maddelerde sorun var." : "Tüm sistem sorunsuz."),
        kayitTarihi: new Date()
      });

      // EĞER ALARMDAN GELDİYSE İŞ EMRİNİ DE KAPAT
      if (pmWorkOrderId) {
        await updateDoc(doc(db, "work_orders", pmWorkOrderId), {
          durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date()
        });
      }

      alert("Periyodik Bakım (PM) formu başarıyla mühürlendi!");
      window.location.href = "/dashboard"; 
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-gray-900 border border-teal-500/50 rounded-2xl shadow-[0_0_20px_rgba(20,184,166,0.15)] p-6 md:p-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-teal-400 flex items-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            Dinamik Periyodik Bakım (PM) Formu
          </h1>
          <Link href={userRole === "admin" || userRole === "operator" ? "/admin" : "/dashboard"} className="bg-gray-800 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        {pmWorkOrderId && (
          <div className="bg-teal-900/30 border border-teal-500/50 text-teal-400 p-4 rounded-xl mb-6 font-bold flex items-center gap-2">
            ✅ Alarmdan Gönlendirildi: Makine otomatik seçildi. Formu kaydettiğinizde Planlı Bakım İş Emri sistemden silinecektir.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-5 rounded-xl border border-gray-700">
            <div><label className="block text-sm text-gray-400 mb-1">Tarih</label><input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="w-full bg-gray-900 border-gray-600 rounded-lg p-3 text-white focus:border-teal-500" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vardiya</label>
              <select value={vardiya} onChange={e => setVardiya(e.target.value)} className="w-full bg-gray-900 border-gray-600 rounded-lg p-3 text-white focus:border-teal-500">
                <option value="">-- Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-teal-400 font-bold mb-1">Bakım Yapılacak Makine</label>
              <select value={seciliMakineId} disabled={!!pmWorkOrderId} onChange={e => handleMakineSecimi(e.target.value)} className="w-full bg-gray-900 border-2 border-teal-800/50 rounded-lg p-4 text-white focus:border-teal-500 outline-none font-bold text-lg disabled:opacity-60">
                <option value="">-- Makine Seçiniz --</option>{makineListesi.map(m => <option key={m.id} value={m.id}>{m.id} (Periyot: {m.siklik})</option>)}
              </select>
            </div>
          </div>

          {seciliMakine && (
            <div className="bg-gray-800/50 p-6 rounded-xl border-2 border-teal-700/50 shadow-lg animate-fade-in">
              <div className="mb-6 border-b border-gray-700 pb-4">
                <h3 className="text-xl font-bold text-white mb-2">Makine Checklist: <span className="text-teal-400">{seciliMakine.ekipmanAdi}</span></h3>
              </div>
              <div className="space-y-4">
                {seciliMakine.maddeler.map((madde: string, index: number) => (
                  <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-900 border border-gray-700 p-4 rounded-lg gap-4">
                    <p className="flex-1 text-sm md:text-base text-gray-200"><span className="text-teal-500 font-bold mr-2">{index + 1}.</span> {madde}</p>
                    <div className="flex gap-2 min-w-[200px] justify-end">
                      <button type="button" onClick={() => handleYanit(index, "Sorunsuz")} className={`flex-1 px-4 py-2 text-xs font-bold rounded border ${yanitlar[index] === "Sorunsuz" ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>✅ Sorunsuz</button>
                      <button type="button" onClick={() => handleYanit(index, "Hatalı")} className={`flex-1 px-4 py-2 text-xs font-bold rounded border ${yanitlar[index] === "Hatalı" ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>❌ Hatalı</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seciliMakine && (
            <div className="animate-fade-in space-y-6">
              <div><textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3} placeholder="Hatalı maddeler için detaylı açıklama yazın..." className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:border-teal-500" /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
                {isSubmitting ? "Sisteme Mühürleniyor..." : "Periyodik Bakım Formunu Gönder"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}>
      <PeriyodikBakimIcerik />
    </Suspense>
  );
}