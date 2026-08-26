"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";

export default function IsEmriAc() {
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const router = useRouter();

  // Veri Havuzları
  const [hatlar, setHatlar] = useState<string[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [filteredEkipmanlar, setFilteredEkipmanlar] = useState<string[]>([]);

  // Orijinal Bildirim Saati (Şu anki saat - değiştirilemez)
  const [currentTime, setCurrentTime] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    hatAdi: "",
    ekipmanAdi: "",
    arizaDetayi: "",
    oncelik: "Normal",
    baslangicSaati: "" // Ayarlanabilir Başlangıç Saati
  });

  useEffect(() => {
    // Sayfa açıldığında otomatik saatleri ayarla
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    setCurrentTime(timeStr);
    setFormData(prev => ({ ...prev, baslangicSaati: timeStr })); // Varsayılan olarak başlangıcı da şimdiki zaman yap

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        if (uSnap.exists()) {
          setUserName(uSnap.data().name);
          setUserRole(uSnap.data().role);
          fetchInitialData();
        }
      } else router.push("/");
      setLoading(false);
    });
  }, []);

  const fetchInitialData = async () => {
    try {
      const aSnap = await getDocs(collection(db, "assets"));
      const aData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllAssets(aData);
      const hSet = new Set<string>();
      aData.forEach((item: any) => { if (item.hatAdi) hSet.add(item.hatAdi); });
      setHatlar(Array.from(hSet).sort());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (formData.hatAdi) {
      const filtered = allAssets.filter(a => a.hatAdi === formData.hatAdi).map(a => a.ekipmanAdi).filter(Boolean).sort();
      setFilteredEkipmanlar(Array.from(new Set(filtered)));
    } else { setFilteredEkipmanlar([]); }
  }, [formData.hatAdi, allAssets]);

  const startDictation = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Dikte desteklenmiyor.");
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.onstart = () => setIsDictating(true);
    recognition.onend = () => setIsDictating(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setFormData(prev => ({ ...prev, arizaDetayi: prev.arizaDetayi ? prev.arizaDetayi + " " + transcript : transcript }));
    };
    recognition.start();
  };

  const handleBack = () => {
    if (userRole === "uretim") router.push("/admin/tamamlanan-isler");
    else router.push("/admin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hatAdi || !formData.ekipmanAdi || !formData.arizaDetayi) return alert("Eksik alanları doldurun.");

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "work_orders"), {
        ...formData,
        bildirimSaati: currentTime, // Otomatik kilitli saat
        bildirenKisi: userName,
        durum: "Açık",
        kayitTarihi: serverTimestamp()
      });
      alert("İş Emri Yayınlandı.");
      handleBack();
    } catch (e) { alert("Hata!"); }
    setIsSubmitting(false);
  };

  if (loading) return <div className="p-10 text-white italic text-center">YÜKLENİYOR...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter">ÜRETİM BİLDİRİMİ</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Hızlı Arıza ve Teknik Destek Formu</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 font-bold block uppercase italic">Kayıt Yapan</span>
            <span className="text-blue-500 font-black uppercase">{userName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* KONUM VE EKİPMAN */}
          <div className="bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest italic">1. Hat / Bölge</label>
                <select className="w-full bg-slate-950 border border-slate-800 p-5 rounded-3xl text-white outline-none focus:border-blue-500 shadow-inner" value={formData.hatAdi} onChange={e => setFormData({...formData, hatAdi: e.target.value})} required>
                  <option value="">Seçiniz...</option>
                  {hatlar.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest italic">2. Arızalı Ekipman</label>
                <select className="w-full bg-slate-950 border border-slate-800 p-5 rounded-3xl text-white outline-none focus:border-blue-500 shadow-inner disabled:opacity-30" value={formData.ekipmanAdi} onChange={e => setFormData({...formData, ekipmanAdi: e.target.value})} disabled={!formData.hatAdi} required>
                  <option value="">Ekipman Seçin</option>
                  {filteredEkipmanlar.map(ek => <option key={ek} value={ek}>{ek}</option>)}
                </select>
              </div>
            </div>

            {/* ZAMAN BİLGİLERİ (İSTENEN ÖZELLİK) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800/50">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-blue-500 uppercase px-2 tracking-widest">Bildirim Saati (Kilitli)</label>
                <div className="w-full bg-slate-950/50 border border-slate-800 p-5 rounded-3xl text-slate-400 font-black shadow-inner cursor-not-allowed">
                  {currentTime}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-yellow-500 uppercase px-2 tracking-widest">Arıza Başlangıç Saati</label>
                <input 
                  type="time" 
                  className="w-full bg-slate-950 border border-yellow-500/20 p-5 rounded-3xl text-white outline-none focus:border-yellow-500 shadow-inner font-black"
                  value={formData.baslangicSaati}
                  onChange={e => setFormData({...formData, baslangicSaati: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase px-2 tracking-widest italic">Öncelik Derecesi</label>
              <select className="w-full bg-slate-950 border border-slate-800 p-5 rounded-3xl text-white outline-none focus:border-blue-500 shadow-inner font-bold" value={formData.oncelik} onChange={e => setFormData({...formData, oncelik: e.target.value})}>
                <option value="Normal">Normal</option>
                <option value="Yüksek">Yüksek (Acil)</option>
                <option value="Kritik">Kritik (Duruş Var)</option>
              </select>
            </div>
          </div>

          {/* ARIZA DETAYI */}
          <div className="relative group">
            <label className="text-[10px] font-bold text-slate-500 block mb-2 uppercase tracking-widest px-2 italic">Arıza / İş Emri Detaylı Açıklama</label>
            <textarea className="w-full bg-slate-900 border border-slate-800 p-8 rounded-[3rem] text-white text-sm outline-none focus:border-blue-500 h-52 resize-none shadow-2xl shadow-inner italic" placeholder="Arıza detaylarını anlatın..." value={formData.arizaDetayi} onChange={e => setFormData({...formData, arizaDetayi: e.target.value})} required />
            <button type="button" onClick={startDictation} className={`absolute bottom-8 right-8 p-6 rounded-full shadow-2xl transition-all ${isDictating ? 'bg-red-600 animate-pulse text-white' : 'bg-blue-600 text-white hover:scale-110 active:scale-95 shadow-blue-900/20'}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          </div>

          {/* BUTONLAR */}
          <div className="grid grid-cols-2 gap-6 pt-4">
            <button type="button" onClick={handleBack} className="bg-slate-800 hover:bg-slate-700 text-slate-400 py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-widest transition-all">Vazgeç</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase text-[10px] tracking-[0.2em] italic">{isSubmitting ? "Yayınlanıyor..." : "Bildirimi Gönder"}</button>
          </div>

        </form>
      </div>
    </div>
  );
}