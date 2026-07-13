"use client";

import { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, query, where, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const arizaSemasi = yup.object().shape({
  vardiya: yup.string().required("Vardiya seçimi zorunludur!"),
  hatAdi: yup.string().required("Lütfen üretim hattını seçin!"),
  ekipmanAdi: yup.string().required("Lütfen arızalı ekipmanı seçin!"),
  sorunTipi: yup.string().required("Sorun tipini belirtin!"),
  isDuruslu: yup.boolean().required(),
  baslangicSaati: yup.string().required("Arıza başlangıç saati zorunludur!"),
  bitisSaati: yup.string().required("Müdahale bitiş saati zorunludur!").test('is-greater', 'Bitiş saati, başlangıçtan önce olamaz!', function(value) {
    const { baslangicSaati } = this.parent;
    if (!baslangicSaati || !value) return true;
    return new Date(value) >= new Date(baslangicSaati);
  }),
  aciklama: yup.string().min(10, "Açıklama en az 10 karakter olmalıdır!").required()
});

type FormData = yup.InferType<typeof arizaSemasi>;
type Asset = { id: string; hatAdi: string; ekipmanAdi: string };
type UserInfo = { id: string; name: string };

export default function PersonelDashboard() {
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [personelListesi, setPersonelListesi] = useState<UserInfo[]>([]);
  const [seciliPersoneller, setSeciliPersoneller] = useState<string[]>([]);
  const [dropdownAcik, setDropdownAcik] = useState(false); 

  const [seciliHat, setSeciliHat] = useState("");
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basariMesaji, setBasariMesaji] = useState("");

  const [okunmayanDuyurular, setOkunmayanDuyurular] = useState<any[]>([]);
  const [showDuyuruModal, setShowDuyuruModal] = useState(false);

  // AKTİF İŞ EMİRLERİ STATE'İ
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const formRef = useRef<HTMLDivElement>(null); 

  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownAcik(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm<FormData>({
    resolver: yupResolver(arizaSemasi),
    defaultValues: { isDuruslu: false }
  });

  const watchBaslangic = watch("baslangicSaati");
  const watchBitis = watch("bitisSaati");

  useEffect(() => {
    if (watchBaslangic && watchBitis) {
      const baslangic = new Date(watchBaslangic).getTime();
      const bitis = new Date(watchBitis).getTime();
      setHesaplananSure(Math.max(0, Math.floor((bitis - baslangic) / 60000)));
    } else setHesaplananSure(0);
  }, [watchBaslangic, watchBitis]);

  // YENİ: Aktif İş Emirlerini Veritabanından Çek
  const fetchAktifIsler = async () => {
    const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
    const wSnap = await getDocs(wQ);
    const data = wSnap.docs.map(d => ({ 
      id: d.id, ...d.data(), 
      gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 
    }));
    setAktifIsler(data.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5)); // Sadece 5 tane
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().isApproved) {
          const data = userSnap.data();
          setUserRole(data.role);
          setUserName(data.name);
          setSeciliPersoneller([data.name]);

          fetchAktifIsler(); // İş emirlerini sayfa yüklenince çek

          const okunanDuyuruIDleri = data.okunanDuyurular || []; 
          const duyuruSnap = await getDocs(collection(db, "announcements"));
          const tumDuyurular = duyuruSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const okunmamis = tumDuyurular.filter(d => !okunanDuyuruIDleri.includes(d.id));
          if (okunmamis.length > 0) {
            setOkunmayanDuyurular(okunmamis);
            setShowDuyuruModal(true);
          }
        } else window.location.href = "/";
      } else window.location.href = "/";
    });

    const fetchGerekliVeriler = async () => {
      const snap = await getDocs(collection(db, "assets"));
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset)));
      const pQuery = query(collection(db, "users"), where("isApproved", "==", true));
      const pSnap = await getDocs(pQuery);
      setPersonelListesi(pSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    };
    fetchGerekliVeriler();
    return () => unsubscribe();
  }, []);

  const handleDuyuruOkudum = async (duyuruId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { okunanDuyurular: arrayUnion(duyuruId) });
      const kalanDuyurular = okunmayanDuyurular.filter(d => d.id !== duyuruId);
      setOkunmayanDuyurular(kalanDuyurular);
      if (kalanDuyurular.length === 0) setShowDuyuruModal(false);
    } catch (error) { console.error(error); }
  };

  const handlePersonelSecim = (isim: string) => {
    setSeciliPersoneller(prev => prev.includes(isim) ? prev.filter(p => p !== isim) : [...prev, isim]);
  };

  // YENİ: İŞ EMRİNİ TAMAMLAMA VE FORMU OTOMATİK DOLDURMA
  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Onayladıktan sonra süresini girmek için form otomatik olarak açılacaktır.")) return;

    try {
      await updateDoc(doc(db, "work_orders", islem.id), {
        durum: "Kapalı",
        tamamlayanKisi: userName,
        tamamlanmaTarihi: new Date()
      });

      fetchAktifIsler();

      setSeciliHat(islem.hatAdi);
      setValue("hatAdi", islem.hatAdi);
      setTimeout(() => setValue("ekipmanAdi", islem.ekipmanAdi), 150); 
      setValue("sorunTipi", islem.sorunTipi);
      setValue("aciklama", `(Üretim Bildirimi Çözüldü: ${islem.aciklama})\n- Müdahale Özeti: `);
      
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setBasariMesaji("Üretim bildirimi başarıyla kapatıldı! Lütfen harcadığınız süreyi girerek performansınızı kaydedin.");

    } catch (error) {
      alert("Hata oluştu.");
    }
  };

  const benzersizHatlar = Array.from(new Set(assets.map(a => a.hatAdi)));
  const filtrelenmisEkipmanlar = assets.filter(a => a.hatAdi === seciliHat);

  const formKaydet = async (data: FormData) => {
    if (seciliPersoneller.length === 0) return alert("Lütfen işi yapan en az 1 personel seçin!");
    setIsSubmitting(true); setBasariMesaji("");
    try {
      await addDoc(collection(db, "maintenance_logs"), {
        ...data, isiYapanlar: seciliPersoneller, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: new Date(), durum: "Kapalı"
      });
      setBasariMesaji("Kayıt başarıyla işlendi. Süre: " + hesaplananSure + " Dk");
      reset(); setSeciliHat(""); setHesaplananSure(0); setSeciliPersoneller([userName]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      
      {showDuyuruModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-yellow-500 mb-6">Okunmamış Yeni Duyurularınız Var!</h2>
            <div className="space-y-6">
              {okunmayanDuyurular.map((duyuru) => (
                <div key={duyuru.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-2">{duyuru.baslik}</h3>
                  <p className="text-gray-300 mb-6 whitespace-pre-wrap">{duyuru.icerik}</p>
                  <button onClick={() => handleDuyuruOkudum(duyuru.id)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition">Okudum, Onaylıyorum</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-4xl mx-auto ${showDuyuruModal ? 'opacity-20 pointer-events-none' : ''}`}>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-5 gap-4">
          <div>
            <p className="text-sm font-bold text-blue-500 mb-1 tracking-wider uppercase">DFU DONUK FIRINCILIK ÜRÜNLERİ A.Ş.</p>
            <h1 className="text-2xl md:text-3xl font-bold">Arıza Bildirim Paneli</h1>
            <p className="text-gray-400 mt-1">Hoş geldin, <span className="text-blue-400 font-medium">{userName}</span></p>
          </div>
          <div className="flex gap-3">
            {(userRole === "admin" || userRole === "operator" || userRole === "uretim") && (
              <a href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition text-sm flex items-center font-semibold text-blue-400">
                {userRole === "admin" ? "Yönetim Paneline Dön" : "İzleme Paneline Dön"}
              </a>
            )}
            <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-4 py-2 rounded-lg border border-red-800/50">Çıkış</button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap justify-center md:justify-end gap-3">
          <a href="/dashboard/sayac" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">⚡ Elektrik Sayaç Okuma</a>
          <a href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">📋 Yapılan İşler</a>
          <a href="/dashboard/mesai" className="bg-teal-600 hover:bg-teal-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">⏰ Fazla Mesai Girişi Yap</a>
        </div>

        {/* EKSİK OLAN VE GERİ EKLENEN: AKTİF BEKLEYEN İŞLER (ALARM LİSTESİ) */}
        {aktifIsler.length > 0 && (
          <div className="bg-red-900/20 border-2 border-red-500/50 p-6 rounded-2xl mb-10 shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
              </span>
              Üretimden Gelen Aktif Bildirimler (Müdahale Bekliyor)
            </h2>
            <div className="space-y-4">
              {aktifIsler.map(islem => (
                <div key={islem.id} className="bg-gray-900 border border-red-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-500/80">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p>
                    <p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p>
                    <p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p>
                  </div>
                  
                  {/* TEKNİSYEN İŞİ BİTİRİNCE BU BUTONA BASAR */}
                  <button 
                    onClick={() => handleIsiTamamla(islem)} 
                    className="w-full md:w-auto whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-[0_0_15px_rgba(22,163,74,0.4)]"
                  >
                    ✅ İşi Tamamla
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* AKTİF İŞLER BİTİŞ */}

        <div ref={formRef} className="bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-2xl shadow-2xl transition-all">
          <h2 className="text-xl font-bold mb-6 text-orange-400">Yeni Arıza / Bakım Bildirimi</h2>
          {basariMesaji && <div className="mb-6 p-4 rounded-lg bg-green-900/30 text-green-400 font-medium border border-green-800/50">{basariMesaji}</div>}

          <form onSubmit={handleSubmit(formKaydet)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
              <div>
                <label className="block text-sm font-bold text-blue-400 mb-2">Çalışılan Vardiya <span className="text-red-500">*</span></label>
                <select {...register("vardiya")} className={`w-full bg-gray-800 border ${errors.vardiya ? 'border-red-500' : 'border-gray-600'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500`}>
                  <option value="">-- Vardiya Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00 (Gündüz)</option><option value="16:00 - 24:00">16:00 - 24:00 (Akşam)</option><option value="24:00 - 08:00">24:00 - 08:00 (Gece)</option>
                </select>
                {errors.vardiya && <p className="text-red-500 text-xs mt-1">{errors.vardiya.message}</p>}
              </div>

              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-bold text-blue-400 mb-2">İşi Yapan Ekip Üyeleri <span className="text-red-500">*</span></label>
                <div onClick={() => setDropdownAcik(!dropdownAcik)} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white cursor-pointer flex justify-between items-center">
                  <span className="truncate pr-2">{seciliPersoneller.length > 0 ? seciliPersoneller.join(", ") : "Personel Seçiniz..."}</span>
                  <svg className={`w-4 h-4 transition-transform ${dropdownAcik ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                {dropdownAcik && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {personelListesi.map(p => (
                      <label key={p.id} className="flex items-center px-4 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700/50 last:border-0">
                        <input type="checkbox" checked={seciliPersoneller.includes(p.name)} onChange={() => handlePersonelSecim(p.name)} className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-600 rounded" />
                        <span className="ml-3 text-sm text-gray-200">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Üretim Hattı</label>
                <select {...register("hatAdi")} onChange={(e) => { setSeciliHat(e.target.value); setValue("hatAdi", e.target.value); setValue("ekipmanAdi", ""); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500">
                  <option value="">-- Hat Seçiniz --</option>{benzersizHatlar.map(hat => <option key={hat} value={hat}>{hat}</option>)}
                </select>
                {errors.hatAdi && <p className="text-red-500 text-xs mt-1">{errors.hatAdi.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Arızalı Ekipman</label>
                <select {...register("ekipmanAdi")} disabled={!seciliHat} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 disabled:opacity-50">
                  <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>{filtrelenmisEkipmanlar.map(ekp => <option key={ekp.id} value={ekp.ekipmanAdi}>{ekp.ekipmanAdi}</option>)}
                </select>
                {errors.ekipmanAdi && <p className="text-red-500 text-xs mt-1">{errors.ekipmanAdi.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sorun Tipi</label>
                <select {...register("sorunTipi")} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                  <option value="">-- Seçiniz --</option><option value="Mekanik">Mekanik</option><option value="Elektrik">Elektrik</option><option value="Otomasyon">Otomasyon</option><option value="Diğer">Diğer</option>
                </select>
                {errors.sorunTipi && <p className="text-red-500 text-xs mt-1">{errors.sorunTipi.message}</p>}
              </div>

              <div className="flex flex-col justify-center">
                <label className="block text-sm font-medium text-gray-400 mb-3">Hat Duruşu Yaşandı mı?</label>
                <Controller name="isDuruslu" control={control} render={({ field: { onChange, value } }) => (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={value} onChange={onChange} />
                    <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-300">{value ? <span className="text-red-400 font-bold">Evet, Hattı Durdurdu</span> : "Hayır, Hat Çalıştı"}</span>
                  </label>
                )} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Başlangıç Saati</label><input type="datetime-local" {...register("baslangicSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" />{errors.baslangicSaati && <p className="text-red-500 text-xs mt-1">{errors.baslangicSaati.message}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Bitiş Saati</label><input type="datetime-local" {...register("bitisSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" />{errors.bitisSaati && <p className="text-red-500 text-xs mt-1">{errors.bitisSaati.message}</p>}</div>
              <div className="md:col-span-2 text-center pt-2"><p className="text-sm text-gray-400">Otomatik Hesaplanan Süre:</p><p className="text-3xl font-bold text-blue-500">{hesaplananSure} <span className="text-lg text-gray-500">Dakika</span></p></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Açıklama / Yapılan İşlem</label>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3" />
              {errors.aciklama && <p className="text-red-500 text-xs mt-1">{errors.aciklama.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-4 rounded-xl disabled:opacity-50">
              {isSubmitting ? "Kaydediliyor..." : "Arızayı Sisteme Kaydet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}