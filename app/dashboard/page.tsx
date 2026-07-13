"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useSearchParams } from "next/navigation";

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

function DashboardIcerik() {
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

  // YENİ: Otomatik Doldurulma ve Kilitleme (Disabled) State'i
  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const searchParams = useSearchParams();
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

  // YENİ VE KESİN: URL'den Okuma ve KİLİTLEME Algoritması
  useEffect(() => {
    if (assets.length === 0) return; // Varlıklar yüklenmeden değer atama

    const otoHat = searchParams.get("hat");
    const otoEkipman = searchParams.get("ekipman");
    const otoSorun = searchParams.get("sorun");
    const otoAciklama = searchParams.get("aciklama");
    const otoDurus = searchParams.get("duruslu");

    if (otoHat) {
      setIsAutoFilled(true); // Sistemi "Otomatik Doldurulmuş (Kilitli)" moduna al
      setSeciliHat(otoHat);
      
      setValue("hatAdi", otoHat);
      setValue("sorunTipi", otoSorun || "");
      setValue("isDuruslu", otoDurus === 'true');
      
      // Ekipman listesinin 'seciliHat' güncellendikten sonra dolabilmesi için zorunlu gecikme
      setTimeout(() => {
        setValue("ekipmanAdi", otoEkipman || "");
      }, 50);

      if (otoAciklama) {
        setValue("aciklama", `(Üretim Bildirimi Çözüldü: ${otoAciklama})\n- Yapılan Müdahale Özeti: `);
      }
      
      setBasariMesaji("✅ İlgili üretim bildirimi kapatıldı. Lütfen harcadığınız süreyi ve vardiyanızı girerek performansınıza kaydedin.");
    }
  }, [searchParams, setValue, assets]);

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
      reset(); setSeciliHat(""); setHesaplananSure(0); setSeciliPersoneller([userName]); setIsAutoFilled(false);
      window.history.replaceState(null, "", "/dashboard");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      
      {/* DUYURU MODALI */}
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
        
        {/* HEADER */}
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

        {/* HIZLI ERİŞİM BUTONLARI */}
         <div className="mb-6 flex flex-wrap justify-center md:justify-end gap-3">
          {/* YENİ EKLENEN: TÜM AKTİF İŞLER BUTONU */}
          <a href="/admin/aktif-isler" className="bg-red-900/60 hover:bg-red-600 text-red-100 border border-red-500/50 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center transition">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
            Tüm Aktif İşleri Gör
          </a>
          
          <a href="/dashboard/sayac" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">⚡ Sayaç Okuma</a>
          <a href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">📋 Yapılan İşler</a>
          <a href="/dashboard/mesai" className="bg-teal-600 hover:bg-teal-500 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center">⏰ Fazla Mesai Girişi Yap</a>
        </div>

        <div className={`bg-gray-900 border p-6 md:p-8 rounded-2xl shadow-2xl transition-all ${isAutoFilled ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-gray-800'}`}>
          <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isAutoFilled ? 'text-green-400' : 'text-orange-400'}`}>
            {isAutoFilled ? "✅ Otomatik Dolduruldu (İş Emri Kapatıldı)" : "Yeni Arıza / Bakım Bildirimi"}
          </h2>
          
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
                {/* YENİ: Otomatik doldurulduysa KİLİTLE (disabled eklendi) */}
                <select 
                  {...register("hatAdi")} 
                  disabled={isAutoFilled}
                  onChange={(e) => { setSeciliHat(e.target.value); setValue("hatAdi", e.target.value); setValue("ekipmanAdi", ""); }} 
                  className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 ${isAutoFilled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">-- Hat Seçiniz --</option>{benzersizHatlar.map(hat => <option key={hat} value={hat}>{hat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Arızalı Ekipman</label>
                <select 
                  {...register("ekipmanAdi")} 
                  disabled={!seciliHat || isAutoFilled} 
                  className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 ${(!seciliHat || isAutoFilled) ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>
                  {filtrelenmisEkipmanlar.length > 0 ? (
                    filtrelenmisEkipmanlar.map(ekp => <option key={ekp.id} value={ekp.ekipmanAdi}>{ekp.ekipmanAdi}</option>)
                  ) : isAutoFilled ? (
                    <option value={watch("ekipmanAdi")}>{watch("ekipmanAdi")}</option>
                  ) : null}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sorun Tipi</label>
                <select 
                  {...register("sorunTipi")} 
                  disabled={isAutoFilled}
                  className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 ${isAutoFilled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="">-- Seçiniz --</option><option value="Mekanik">Mekanik</option><option value="Elektrik">Elektrik</option><option value="Otomasyon">Otomasyon</option><option value="Diğer">Diğer</option>
                </select>
              </div>

              <div className="flex flex-col justify-center">
                <label className="block text-sm font-medium text-gray-400 mb-3">Hat Duruşu Yaşandı mı?</label>
                <Controller name="isDuruslu" control={control} render={({ field: { onChange, value } }) => (
                  <label className={`relative inline-flex items-center ${isAutoFilled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                    <input type="checkbox" className="sr-only peer" checked={value} onChange={onChange} disabled={isAutoFilled} />
                    <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-300">{value ? <span className="text-red-400 font-bold">Evet, Hattı Durdurdu</span> : "Hayır, Hat Çalıştı"}</span>
                  </label>
                )} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Başlangıç Saati</label><input type="datetime-local" {...register("baslangicSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" />{errors.baslangicSaati && <p className="text-red-500 text-xs mt-1">{errors.baslangicSaati.message}</p>}</div>
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Bitiş Saati</label><input type="datetime-local" {...register("bitisSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" />{errors.bitisSaati && <p className="text-red-500 text-xs mt-1">{errors.bitisSaati.message}</p>}</div>
              <div className="md:col-span-2 text-center pt-2"><p className="text-sm text-gray-400">Otomatik Hesaplanan Süre:</p><p className="text-3xl font-bold text-blue-500">{hesaplananSure} <span className="text-lg text-gray-500">Dakika</span></p></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Açıklama / Yapılan İşlem</label>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" />
              {errors.aciklama && <p className="text-red-500 text-xs mt-1">{errors.aciklama.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg disabled:opacity-50">
              {isSubmitting ? "Kaydediliyor..." : "Performansıma Kaydet ve İşi Bitir"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}>
      <DashboardIcerik />
    </Suspense>
  );
}