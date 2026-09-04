"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SayacOkuma() {
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aktifSekme, setAktifSekme] = useState("Elektrik");
  const [sayaclar, setSayaclar] = useState<any[]>([]);
  const [gecmisOkumalar, setGecmisOkumalar] = useState<any[]>([]);
  const [girisDegerleri, setGirisDegerleri] = useState<Record<string, string>>({});
  const [seciliTarih, setSeciliTarih] = useState(new Date().toISOString().split('T')[0]);

  const handleLogout = async () => {
    if (window.confirm("Oturum kapatılacaktır?")) { await signOut(auth); router.push("/"); }
  };

  const handleBack = () => {
    const role = userRole ? userRole.toLowerCase().trim() : "";
    if (role === "admin") router.push("/admin");
    else if (role === "ik") router.push("/admin/mesai");
    else if (role === "depo") router.push("/admin/yedek-parca");
    else if (role === "isg") router.push("/isg");
    else if (role === "uretim") router.push("/admin/tamamlanan-isler");
    else router.push("/dashboard");
  };
const fetchVeriler = async () => {
    try {
      const sayacSnap = await getDocs(collection(db, "meters"));
      setSayaclar(sayacSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const q = query(collection(db, "meter_logs"), orderBy("timestamp", "desc"));
      const logSnap = await getDocs(q);
      setGecmisOkumalar(logSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
          fetchVeriler();
        } else window.location.href = "/";
      } else window.location.href = "/";
    });
    return () => unsubscribe();
  }, []);

  const handleSayacEkle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yeniSayacAdi) return;
    try {
      await addDoc(collection(db, "meters"), { name: yeniSayacAdi, tip: aktifSekme });
      setYeniSayacAdi(""); fetchVeriler();
    } catch (error) { alert("Hata!"); }
  };

  const handleTopluKayit = async () => {
    const doldurulanIdler = Object.keys(girisDegerleri).filter(id => girisDegerleri[id].trim() !== "");
    if (doldurulanIdler.length === 0) return alert("Sisteme işlenecek herhangi bir değer girmediniz!");
    if (!seciliTarih) return alert("Lütfen tarih seçiniz!");

    setIsSubmitting(true);
    try {
      for (const sayacId of doldurulanIdler) {
        const sayacAdi = sayaclar.find(s => s.id === sayacId)?.name || "Bilinmeyen Sayaç";
        await addDoc(collection(db, "meter_logs"), {
          tarih: seciliTarih, sayacAdi: sayacAdi, deger: Number(girisDegerleri[sayacId]), personel: userName, tip: aktifSekme, timestamp: new Date()
        });
      }
      alert("Tüm okumalar işlendi!"); setGirisDegerleri({}); fetchVeriler(); 
    } catch (error) { console.error(error); alert("Kaydedilemedi."); } finally { setIsSubmitting(false); }
  };

  const handleDuzenlemeKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "meter_logs", duzenlenenLog.id), { tarih: duzenlenenLog.tarih, sayacAdi: duzenlenenLog.sayacAdi, deger: Number(duzenlenenLog.deger) });
      alert("Kayıt güncellendi."); setEditModal(false); fetchVeriler();
    } catch (error) { alert("Güncellenemedi!"); }
  };

  const handleSil = async (id: string) => {
    if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
    await deleteDoc(doc(db, "meter_logs", id)); fetchVeriler();
  };

  const filtrelenmisSayaclar = sayaclar.filter(s => s.tip === aktifSekme || (!s.tip && aktifSekme === "Elektrik"));
  const filtrelenmisOkumalar = gecmisOkumalar
    .filter(l => l.tip === aktifSekme || (!l.tip && aktifSekme === "Elektrik"))
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());

  const tema = aktifSekme === "Elektrik" ? "yellow" : aktifSekme === "Doğalgaz" ? "red" : "blue";
  const birim = aktifSekme === "Elektrik" ? "kWh" : aktifSekme === "Doğalgaz" ? "m³" : "Ton";

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
        <img src="/dfulogo.png" className="h-24 w-auto relative z-10 animate-bounce" alt="DFU" />
      </div>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4 shadow-inner">
        <div className="h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
      </div>
      <p className="text-teal-400 font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">{`YÜKLENİYOR...`}</p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      
      {editModal && duzenlenenLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className={`bg-gray-900 border border-${tema}-500 rounded-2xl p-8 max-w-md w-full`}>
            <h2 className={`text-xl font-bold text-${tema}-400 mb-6`}>Okuma Düzenle</h2>
            <form onSubmit={handleDuzenlemeKaydet} className="space-y-4">
              <div><label className="block text-sm mb-1">Tarih</label><input type="date" value={duzenlenenLog.tarih} onChange={e => setDuzenlenenLog({...duzenlenenLog, tarih: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div><label className="block text-sm mb-1">Sayaç Adı</label><input type="text" value={duzenlenenLog.sayacAdi} onChange={e => setDuzenlenenLog({...duzenlenenLog, sayacAdi: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div><label className="block text-sm mb-1">Değer</label><input type="number" value={duzenlenenLog.deger} onChange={e => setDuzenlenenLog({...duzenlenenLog, deger: e.target.value})} className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white" /></div>
              <div className="flex gap-4 pt-4"><button type="submit" className="flex-1 bg-blue-600 py-3 rounded-lg">Kaydet</button><button type="button" onClick={() => setEditModal(false)} className="flex-1 bg-gray-700 py-3 rounded-lg">İptal</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div><h1 className="text-3xl font-bold text-white flex items-center gap-3">Enerji Sayaç Okuma</h1></div>
          
          {/* YENİ: Uretim yetkilisi de Panele dönebilir */}
          <Link href={userRole === "admin" || userRole === "operator" || userRole === "uretim" ? "/admin" : "/dashboard"} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition">← Panele Dön</Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-gray-900 p-2 rounded-xl inline-flex">
          <button onClick={() => setAktifSekme("Elektrik")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Elektrik" ? "bg-yellow-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>⚡ Elektrik</button>
          <button onClick={() => setAktifSekme("Doğalgaz")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Doğalgaz" ? "bg-red-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>🔥 Doğalgaz</button>
          <button onClick={() => setAktifSekme("Su")} className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${aktifSekme === "Su" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>💧 Su</button>
        </div>

        {userRole === "admin" && (
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl mb-8 flex gap-4 items-end">
            <div className="flex-1"><label className={`block text-sm text-${tema}-400 mb-1 font-bold`}>Yeni {aktifSekme} Sayacı Tanımla</label><input type="text" value={yeniSayacAdi} onChange={e => setYeniSayacAdi(e.target.value)} placeholder={`Örn: Ana ${aktifSekme} Panosu`} className="w-full bg-gray-800 rounded-lg p-3" /></div>
            <button onClick={handleSayacEkle} className={`bg-${tema}-600 hover:bg-${tema}-500 px-6 py-3 rounded-lg font-bold`}>Ekle</button>
          </div>
        )}

        <div className={`bg-gray-900 border border-${tema}-600/30 p-6 rounded-xl shadow-lg mb-10`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-white">Toplu Değer Girişi ({aktifSekme})</h2>
            <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg border border-gray-700">
              <span className="text-sm text-gray-400 font-bold pl-2">Okuma Tarihi:</span>
              <input type="date" value={seciliTarih} onChange={(e) => setSeciliTarih(e.target.value)} className={`bg-gray-900 border border-${tema}-500/50 rounded p-2 text-white text-sm outline-none`} />
            </div>
            {filtrelenmisSayaclar.length > 0 && <button onClick={handleTopluKayit} disabled={isSubmitting} className={`bg-${tema}-600 hover:bg-${tema}-500 font-bold px-6 py-2 rounded-lg disabled:opacity-50`}>{isSubmitting ? "İşleniyor..." : "Tüm Endeksleri İşle"}</button>}
          </div>
          
          {filtrelenmisSayaclar.length === 0 ? <div className="text-gray-500 py-4">Kayıtlı sayaç yok.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm mb-4">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 bg-gray-800/50">
                    <th className="p-3 w-1/3">Sayaç Adı</th><th className={`p-3 text-${tema}-400`}>Değer Girin ({birim})</th><th className="p-3 text-right">Kayıt Eden</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmisSayaclar.map(sayac => (
                    <tr key={sayac.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                      <td className="p-3 font-bold text-gray-200">{sayac.name}</td>
                      <td className="p-3">
                        <input type="number" placeholder="Endeks..." value={girisDegerleri[sayac.id] || ""} onChange={(e) => setGirisDegerleri({...girisDegerleri, [sayac.id]: e.target.value})} className={`w-full max-w-[200px] bg-gray-800 border border-${tema}-500/50 rounded-lg p-2 focus:border-${tema}-400`} />
                      </td>
                      <td className="p-3 text-right text-gray-500">{userName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={handleTopluKayit} disabled={isSubmitting} className={`w-full bg-${tema}-600 hover:bg-${tema}-500 font-bold py-4 rounded-xl disabled:opacity-50`}>{isSubmitting ? "Bekleyin..." : "TÜM ENDEKSLERİ İŞLE"}</button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg overflow-x-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-300">Geçmiş {aktifSekme} Okumaları</h2>
          {filtrelenmisOkumalar.length === 0 ? <div className="text-gray-500 py-4">Kayıt yok.</div> : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 px-2">Tarih</th><th className="pb-3 px-2">Sayaç Adı</th><th className={`pb-3 px-2 text-${tema}-400`}>Değer ({birim})</th><th className="pb-3 px-2">Personel</th>
                  {userRole === "admin" && <th className="pb-3 px-2 text-right">Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {filtrelenmisOkumalar.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-2 text-gray-300 font-bold">{log.tarih}</td>
                    <td className="py-3 px-2 font-bold text-gray-200">{log.sayacAdi}</td>
                    <td className={`py-3 px-2 text-${tema}-400 font-bold text-lg`}>{log.deger}</td>
                    <td className="py-3 px-2 text-blue-300">{log.personel}</td>
                    {userRole === "admin" && (
                      <td className="py-3 px-2 text-right space-x-2">
                        <button onClick={() => { setDuzenlenenLog(log); setEditModal(true); }} className="bg-blue-900/50 hover:bg-blue-600 text-blue-400 text-xs px-3 py-1 rounded">Düzenle</button>
                        <button onClick={() => handleSil(log.id)} className="bg-red-900/50 hover:bg-red-600 text-red-400 text-xs px-3 py-1 rounded">Sil</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
