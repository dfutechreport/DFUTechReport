"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const arizaSemasi = yup.object().shape({
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

export default function PersonelDashboard() {
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [seciliHat, setSeciliHat] = useState("");
  const [hesaplananSure, setHesaplananSure] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basariMesaji, setBasariMesaji] = useState("");

  // YENİ: DUYURU SİSTEMİ STATE'LERİ
  const [okunmayanDuyurular, setOkunmayanDuyurular] = useState<any[]>([]);
  const [showDuyuruModal, setShowDuyuruModal] = useState(false);

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

          // 1. ZORUNLU DUYURU KONTROLÜ
          const okunanDuyuruIDleri = data.okunanDuyurular || []; 
          const duyuruSnap = await getDocs(collection(db, "announcements"));
          const tumDuyurular = duyuruSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Sadece kullanıcının henüz okumadıklarını filtrele
          const okunmamis = tumDuyurular.filter(d => !okunanDuyuruIDleri.includes(d.id));
          
          if (okunmamis.length > 0) {
            setOkunmayanDuyurular(okunmamis);
            setShowDuyuruModal(true); // Modalı Zorla Aç
          }

        } else window.location.href = "/";
      } else window.location.href = "/";
    });

    const fetchAssets = async () => {
      const snap = await getDocs(collection(db, "assets"));
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset)));
    };

    fetchAssets();
    return () => unsubscribe();
  }, []);

  // DUYURUYU OKUDUM OLARAK İŞARETLE
  const handleDuyuruOkudum = async (duyuruId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      // Firebase'e bu duyuruyu okuduğunu kaydet (arrayUnion dizinin içine ekler)
      await updateDoc(userRef, {
        okunanDuyurular: arrayUnion(duyuruId)
      });

      // Ekranda kalan okunmamışları filtrele
      const kalanDuyurular = okunmayanDuyurular.filter(d => d.id !== duyuruId);
      setOkunmayanDuyurular(kalanDuyurular);

      // Eğer okunmamış duyuru kalmadıysa pencereyi kapat
      if (kalanDuyurular.length === 0) {
        setShowDuyuruModal(false);
      }
    } catch (error) {
      console.error("Okundu onayı alınamadı:", error);
    }
  };

  const benzersizHatlar = Array.from(new Set(assets.map(a => a.hatAdi)));
  const filtrelenmisEkipmanlar = assets.filter(a => a.hatAdi === seciliHat);

  const formKaydet = async (data: FormData) => {
    setIsSubmitting(true); setBasariMesaji("");
    try {
      await addDoc(collection(db, "maintenance_logs"), {
        ...data, toplamSureDakika: hesaplananSure, bildirenKisi: userName, kayitTarihi: new Date(), durum: "Kapalı"
      });
      setBasariMesaji("Kayıt başarıyla işlendi. Süre: " + hesaplananSure + " Dk");
      reset(); setSeciliHat(""); setHesaplananSure(0);
    } catch (error) { alert("Hata oluştu."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 relative">
      
      {/* ZORUNLU DUYURU MODALI (AÇILIR PENCERE) */}
      {showDuyuruModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border-2 border-yellow-500 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative">
            
            <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              <h2 className="text-2xl font-bold text-yellow-500">Okunmamış Yeni Duyurularınız Var!</h2>
            </div>
            
            <p className="text-gray-300 mb-6">Sisteme devam edebilmek için aşağıdaki duyuruları okuyup onaylamanız gerekmektedir.</p>

            <div className="space-y-6">
              {okunmayanDuyurular.map((duyuru) => (
                <div key={duyuru.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-2">{duyuru.baslik}</h3>
                  <p className="text-gray-300 mb-6 whitespace-pre-wrap leading-relaxed">{duyuru.icerik}</p>
                  <button 
                    onClick={() => handleDuyuruOkudum(duyuru.id)}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Okudum, Onaylıyorum
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* MODAL BİTİŞ */}


      {/* Normal Dashboard Ekranı */}
      <div className={`max-w-4xl mx-auto ${showDuyuruModal ? 'opacity-20 pointer-events-none' : ''}`}>
        
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-5">
          <div>
            <p className="text-sm font-bold text-blue-500 mb-1 tracking-wider uppercase">DFU DONUK FIRINCILIK ÜRÜNLERİ A.Ş.</p>
            <h1 className="text-3xl font-bold">Arıza Bildirim Paneli</h1>
            <p className="text-gray-400 mt-1">Hoş geldin, <span className="text-blue-400 font-medium">{userName}</span></p>
          </div>
          <div className="flex gap-4">
            {userRole === "admin" && <a href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition text-sm flex items-center">Admin Panel</a>}
            <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg border border-red-800/50">Çıkış</button>
          </div>
        </div>

                <div className="mb-6 flex justify-end gap-4">
          <a href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
            📋 Geçmiş İşler (Seyir Defteri)
          </a>
          <a href="/dashboard/mesai" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
            ⏰ Fazla Mesai Girişi Yap
          </a>
        </div>

        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-orange-400">Yeni Arıza / Bakım Bildirimi</h2>

          {basariMesaji && <div className="mb-6 p-4 rounded-lg bg-green-900/30 text-green-400 font-medium border border-green-800/50">{basariMesaji}</div>}

          <form onSubmit={handleSubmit(formKaydet)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Üretim Hattı</label>
                <select {...register("hatAdi")} onChange={(e) => { setSeciliHat(e.target.value); setValue("hatAdi", e.target.value); setValue("ekipmanAdi", ""); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500">
                  <option value="">-- Hat Seçiniz --</option>
                  {benzersizHatlar.map(hat => <option key={hat} value={hat}>{hat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Arızalı Ekipman</label>
                <select {...register("ekipmanAdi")} disabled={!seciliHat} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 disabled:opacity-50">
                  <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>
                  {filtrelenmisEkipmanlar.map(ekp => <option key={ekp.id} value={ekp.ekipmanAdi}>{ekp.ekipmanAdi}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sorun Tipi</label>
                <select {...register("sorunTipi")} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                  <option value="">-- Seçiniz --</option><option value="Mekanik">Mekanik</option><option value="Elektrik">Elektrik</option><option value="Otomasyon">Otomasyon / Yazılım</option>
                </select>
              </div>

              <div className="flex flex-col justify-center">
                <label className="block text-sm font-medium text-gray-400 mb-3">Hat Duruşu Yaşandı mı?</label>
                <Controller
                  name="isDuruslu" control={control}
                  render={({ field: { onChange, value } }) => (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={value} onChange={onChange} />
                      <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-300">{value ? <span className="text-red-400 font-bold">Evet, Hattı Durdurdu</span> : "Hayır, Hat Çalışmaya Devam Etti"}</span>
                    </label>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Arıza Başlangıç Saati</label>
                <input type="datetime-local" {...register("baslangicSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Müdahale Bitiş Saati</label>
                <input type="datetime-local" {...register("bitisSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3" />
              </div>
              
              <div className="md:col-span-2 text-center pt-2">
                <p className="text-sm text-gray-400">Otomatik Hesaplanan Süre:</p>
                <p className="text-3xl font-bold text-blue-500">{hesaplananSure} <span className="text-lg text-gray-500">Dakika</span></p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Arıza Detayı ve Yapılan İşlem</label>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3" />
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-4 rounded-xl transition shadow-lg disabled:opacity-50">
              {isSubmitting ? "Kaydediliyor..." : "Arızayı Sisteme Kaydet"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}