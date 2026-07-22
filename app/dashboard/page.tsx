"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, arrayUnion, query, where, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  aciklama: yup.string().min(10, "Açıklama en az 10 karakter olmalıdır!").required(),
  yedekParcaKodu: yup.string(),
  yedekParcaMiktar: yup.number().transform((value) => (isNaN(value) ? undefined : value)).nullable(),
  yedekParcaBirim: yup.string()
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

  // ALARM STATE'LERİ
  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]); 
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]); // YENİ: PM Mavi Alarmı

  const [isAutoFilled, setIsAutoFilled] = useState(false);

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);

  const searchParams = useSearchParams();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownAcik(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm({
    resolver: yupResolver(arizaSemasi),
    defaultValues: { isDuruslu: false, yedekParcaBirim: "Adet" }
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
    if (assets.length === 0) return; 

    const otoHat = searchParams.get("hat");
    const otoEkipman = searchParams.get("ekipman");
    const otoSorun = searchParams.get("sorun");
    const otoAciklama = searchParams.get("aciklama");
    const otoDurus = searchParams.get("duruslu");

    if (otoHat) {
      setIsAutoFilled(true); 
      setSeciliHat(otoHat);
      setValue("hatAdi", otoHat);
      setValue("sorunTipi", otoSorun || "");
      setValue("isDuruslu", otoDurus === 'true');
      
      setTimeout(() => { setValue("ekipmanAdi", otoEkipman || ""); }, 50);

      if (otoAciklama) {
        setValue("aciklama", `(Üretim Bildirimi Çözüldü: ${otoAciklama})\n- Yapılan Müdahale Özeti: `);
      }
      setBasariMesaji("✅ İlgili üretim bildirimi kapatıldı. Lütfen harcadığınız süreyi ve vardiyanızı girerek performansınıza kaydedin.");
    }
  }, [searchParams, setValue, assets]);

  const fetchAktifAlarmlarVeKPI = async () => {
    const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
    const wSnap = await getDocs(wQ);
    const dataW: any[] = wSnap.docs.map(d => ({ id: d.id, ...d.data(), gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 }));
    
    // İşleri üçe böl (İSG KAR, PM Planlı Bakım, Normal İş)
    const isgAlarmlari = dataW.filter(d => d.ekipmanAdi === "KAR devreye alma");
    const pmAlarmlari = dataW.filter(d => d.sorunTipi === "Planlı Bakım");
    const normalIsler = dataW.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım");

    setAktifIsgAlarmlari(isgAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
    setAktifPmAlarmlari(pmAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
    setAktifIsler(normalIsler.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

    const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
    const eSnap = await getDocs(eQ);
    setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const logsSnap = await getDocs(collection(db, "maintenance_logs"));
    let topDurusDk = 0; let topIs = 0; let topMudahaleDk = 0; let durusIsSayisi = 0;

    logsSnap.forEach((document) => {
      const data = document.data();
      const sure = Number(data.toplamSureDakika) || 0;
      topIs++; topMudahaleDk += sure;
      if (data.isDuruslu) { topDurusDk += sure; durusIsSayisi++; }
    });

    setKpiToplamIs(topIs); setKpiToplamSure(topMudahaleDk); setKpiAylikDurus(topDurusDk); setKpiDurusluIsSayisi(durusIsSayisi);
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

          fetchAktifAlarmlarVeKPI(); 

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

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Onayladıktan sonra süresini girmek için form otomatik olarak açılacaktır.")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      fetchAktifAlarmlarVeKPI();
      setSeciliHat(islem.hatAdi);
      setValue("hatAdi", islem.hatAdi);
      setValue("isDuruslu", islem.isDuruslu);
      setTimeout(() => setValue("ekipmanAdi", islem.ekipmanAdi), 150); 
      setValue("sorunTipi", islem.sorunTipi);
      setValue("aciklama", `(Üretim Bildirimi Çözüldü: ${islem.aciklama})\n- Yapılan Müdahale Özeti: `);
      setIsAutoFilled(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setBasariMesaji("Üretim bildirimi başarıyla kapatıldı! Lütfen harcadığınız süreyi girerek performansınızı kaydedin.");
    } catch (error) { alert("Hata oluştu."); }
  };

  const handlePMBasla = (islem: any) => {
    window.location.href = `/dashboard/periyodik-bakim?makine=${encodeURIComponent(islem.ekipmanAdi)}&pmOrderId=${islem.id}`;
  };

  const benzersizHatlar = Array.from(new Set(assets.map(a => a.hatAdi)));
  const filtrelenmisEkipmanlar = assets.filter(a => a.hatAdi === seciliHat);

    const formKaydet = async (data: any) => {
    if (seciliPersoneller.length === 0) return alert("Lütfen işi yapan en az 1 personel seçin!");
    setIsSubmitting(true); 
    setBasariMesaji("");

    try {
      // --- 1. AŞAMA: YEDEK PARÇA STOK DÜŞÜMÜ VE E-POSTA ALARMI ---
      if (data.yedekParcaKodu && Number(data.yedekParcaMiktar) > 0) {
        // Formda girilen stok kodunu veritabanında arıyoruz
        const stokKodu = String(data.yedekParcaKodu).trim();
        const partRef = doc(db, "spare_parts", stokKodu);
        const partSnap = await getDoc(partRef);

        if (partSnap.exists()) {
          const partData = partSnap.data();
          const dusulecekMiktar = Number(data.yedekParcaMiktar);
          const yeniMiktar = partData.mevcutMiktar - dusulecekMiktar;

          // Stoğu veritabanında güncelliyoruz (Düşüyoruz)
          await updateDoc(partRef, { mevcutMiktar: yeniMiktar });

          // Miktar 2 veya altına düştüyse Mail API'mizi tetikliyoruz
          if (yeniMiktar <= 2) {
            fetch('/api/send-mail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parcaAdi: partData.parcaAdi,
                stokKodu: stokKodu,
                kalanStok: yeniMiktar,
                birim: partData.birim,
                teknisyen: userName,
                hat: data.hatAdi || seciliHat || "-",
                ekipman: data.ekipmanAdi || "-"
              })
            }).catch(err => console.error("Mail API hatası:", err));
          }
        } else {
          // Eğer teknisyen Excel'de olmayan yanlış bir kod girdiyse, sistemi çökertmeyiz
          // Sadece geliştirici konsoluna uyarı düşer, arıza normal kaydedilmeye devam eder.
          console.warn("Girilen yedek parça kodu (", stokKodu, ") ana depoda bulunamadı.");
        }
      }
      // --- STOK VE MAİL İŞLEMİ BİTİŞİ ---

      // --- 2. AŞAMA: NORMAL ARIZA FORMU KAYDI ---
      await addDoc(collection(db, "maintenance_logs"), {
        ...data, 
        isiYapanlar: seciliPersoneller, 
        toplamSureDakika: hesaplananSure, 
        bildirenKisi: userName, 
        kayitTarihi: new Date(), 
        durum: "Kapalı",
        yedekParcaKodu: data.yedekParcaKodu || "", 
        yedekParcaMiktar: Number(data.yedekParcaMiktar) || 0, 
        yedekParcaBirim: data.yedekParcaBirim || "Adet"
      });

      // İşlem başarılı mesajı ve formu sıfırlama
      setBasariMesaji("Kayıt başarıyla işlendi. Süre: " + hesaplananSure + " Dk");
      reset(); 
      setSeciliHat(""); 
      setHesaplananSure(0); 
      setSeciliPersoneller([userName]); 
      setIsAutoFilled(false);
      window.history.replaceState(null, "", "/dashboard");
      window.scrollTo({ top: 0, behavior: "smooth" });
      fetchAktifAlarmlarVeKPI(); 

    } catch (error) { 
      console.error(error);
      alert("Hata oluştu, lütfen tekrar deneyin."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const durusSureYuzde = kpiToplamSure > 0 ? ((kpiAylikDurus / kpiToplamSure) * 100).toFixed(1) : "0";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 relative">
      
      {/* DUYURULAR */}
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
            <h1 className="text-2xl md:text-3xl font-bold">Vardiya Raporu / Arıza Paneli</h1>
            <p className="text-gray-400 mt-1">Hoş geldin, <span className="text-blue-400 font-medium">{userName}</span></p>
          </div>
          <div className="flex gap-3">
            {(userRole === "admin" || userRole === "operator" || userRole === "uretim") && (
              <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition text-sm flex items-center font-semibold text-blue-400">Yönetim Paneline Dön</Link>
            )}
            <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-900/50 hover:bg-red-600 text-red-400 px-4 py-2 rounded-lg border border-red-800/50">Çıkış</button>
          </div>
        </div>

        {/* 4'LÜ KPI KARTLARI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-lg"><p className="text-xs text-gray-400 font-semibold mb-1">Toplam Yapılan İş</p><h3 className="text-2xl font-bold text-green-400">{kpiToplamIs} <span className="text-xs text-gray-500 font-normal">Adet</span></h3><p className="text-[10px] text-gray-500 mt-2 font-medium">Toplam Efor: <span className="text-white">{kpiToplamSure} dk</span></p></div>
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-lg"><p className="text-xs text-gray-400 font-semibold mb-1">Duruşlu İş Sayısı</p><h3 className="text-2xl font-bold text-red-400">{kpiDurusluIsSayisi} <span className="text-xs text-gray-500 font-normal">Adet</span></h3><p className="text-[10px] text-gray-500 mt-2 font-medium">Kritik Duruş: <span className="text-white">{kpiAylikDurus} dk</span></p></div>
          <div className="bg-gray-900 border border-orange-500/30 p-4 rounded-2xl shadow-[0_0_10px_rgba(249,115,22,0.1)] flex flex-col justify-center"><div className="flex justify-between items-center border-b border-gray-700/50 pb-1 mb-1"><span className="text-[10px] text-green-400 font-bold">Çalışma:</span><span className="text-sm font-bold text-white">{kpiToplamSure} <span className="text-[10px] text-gray-400">dk</span></span></div><div className="flex justify-between items-center"><span className="text-[10px] text-red-400 font-bold">Duruş:</span><span className="text-sm font-bold text-white">{kpiAylikDurus} <span className="text-[10px] text-gray-400">dk</span></span></div></div>
          <div className="bg-gray-900 border border-blue-500/30 p-4 rounded-2xl shadow-[0_0_10px_rgba(59,130,246,0.1)] relative overflow-hidden"><p className="text-xs text-blue-300 font-semibold mb-1 relative z-10">Duruş Yüzdesi (Süre)</p><h3 className="text-2xl font-bold text-blue-400 relative z-10">%{durusSureYuzde}</h3><p className="text-[10px] text-gray-400 mt-2 relative z-10">Toplam efora oranı</p></div>
        </div>

        {/* HIZLI ERİŞİM MENÜSÜ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 no-print">
          <Link href="/admin/aktif-isler" className="bg-red-900/60 hover:bg-red-600 border border-red-500/50 text-red-100 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition"><span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>Aktif İşler</Link>
          <Link href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">📋 Yapılan İşler</Link>
          <Link href="/admin/eked" className="bg-yellow-600 hover:bg-yellow-500 text-black p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(202,138,4,0.4)] transition">🔒 EKED Takip</Link>
          <Link href="/admin/eked/arsiv" className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-gray-200 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ EKED Arşivi</Link>
<Link href="/dashboard/periyodik-bakim" className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(13,148,136,0.4)] transition">
  📋 Manuel PM (Checklist)
</Link>
          <Link href="/dashboard/pano-kayit" className="bg-indigo-700 hover:bg-indigo-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(67,56,202,0.4)] transition">🔌 Pano Kayıt</Link>
          <Link href="/dashboard/pano-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🔌 Pano Listesi</Link>
          <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(6,182,212,0.4)] transition">✅ Kontrol Formları</Link>
          <Link href="/dashboard/sayac" className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚡ Sayaç Okuma</Link>
          <Link href="/dashboard/mesai" className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⏰ Fazla Mesai</Link>
        </div>

        {/* ALARMLAR (ISG, PM, NORMAL) */}
        {aktifIsgAlarmlari.length > 0 && (
          <div className="bg-red-900/40 border-[3px] border-red-500 p-6 rounded-2xl mb-10 shadow-[0_0_30px_rgba(239,68,68,0.5)] no-print relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)]"></div>
            <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2 relative z-10"><span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span></span> ACİL İSG ALARMI: KAR DEVRE DIŞI KALMIŞTIR! (Müdahale Bekliyor)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
              {aktifIsgAlarmlari.map(islem => (
                <div key={islem.id} className="bg-gray-900 border border-red-500 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="absolute top-0 left-0 w-2 h-full bg-red-500 animate-pulse"></div>
                  <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p></div>
                  <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg border border-red-400">✅ İşi Tamamla (KAR'ı Devreye Al)</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {aktifPmAlarmlari.length > 0 && (
          <div className="bg-cyan-900/30 border-2 border-cyan-500/50 p-6 rounded-2xl mb-10 shadow-[0_0_20px_rgba(6,182,212,0.3)] no-print relative overflow-hidden">
            <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2 relative z-10"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span></span> Yaklaşan Planlı Bakımlar (Periyodik Bakım Günü Geldi)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
              {aktifPmAlarmlari.map(islem => (
                <div key={islem.id} className="bg-gray-900 border border-cyan-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-cyan-500/80">
                  <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500"></div>
                  <div><p className="text-xs text-gray-400 mb-1">Sistem Otomasyonu | Planlı İş Emri</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-cyan-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p></div>
                  <button onClick={() => handlePMBasla(islem)} className="w-full md:w-auto whitespace-nowrap bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg">✅ PM Formuna Git</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {aktifIsler.length > 0 && (
          <div className="bg-red-900/20 border-2 border-red-500/50 p-6 rounded-2xl mb-10 shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span></span> Üretimden Gelen Aktif Bildirimler (Müdahale Bekliyor)</h2>
            <div className="space-y-4">
              {aktifIsler.map(islem => (
                <div key={islem.id} className={`bg-gray-900 border border-red-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-500/80`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1 line-clamp-2">{islem.aciklama}</p></div>
                  <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-[0_0_15px_rgba(22,163,74,0.4)]">✅ İşi Tamamla</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {aktifEked.length > 0 && (
          <div className="bg-yellow-900/20 border-2 border-yellow-500/50 p-6 rounded-2xl mb-10 shadow-[0_0_20px_rgba(202,138,4,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ca8a04_10px,#ca8a04_20px)]"></div>
            <h2 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2 relative z-10"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span></span> DİKKAT: Sahada Aktif Kilitli (EKED) Alanlar Var!</h2>
            <div className="space-y-3 relative z-10">
              {aktifEked.map(eked => (
                <div key={eked.id} className="bg-gray-900 border border-yellow-700/50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div><p className="text-xs text-yellow-500/80 mb-1">{eked.tarih} | Kilitli Bırakan: {eked.personel}</p><p className="font-bold text-white text-lg">📍 {eked.yer}</p></div>
                  <span className="bg-yellow-600 text-black font-bold text-xs px-3 py-1 rounded animate-pulse">ENERJİ KESİK</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ARIZA FORMU */}
        <div ref={formRef} className={`bg-gray-900 border p-6 md:p-8 rounded-2xl shadow-2xl transition-all ${isAutoFilled ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-gray-800'}`}>
          <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isAutoFilled ? 'text-green-400' : 'text-orange-400'}`}>
            {isAutoFilled ? "✅ Otomatik Dolduruldu (İş Emri Kapatıldı)" : "Yeni Vardiya / Bakım Raporu"}
          </h2>
          
          {basariMesaji && <div className="mb-6 p-4 rounded-lg bg-green-900/30 text-green-400 font-medium border border-green-800/50">{basariMesaji}</div>}

          <form onSubmit={handleSubmit(formKaydet)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
              <div>
                <label className="block text-sm font-bold text-blue-400 mb-2">Çalışılan Vardiya <span className="text-red-500">*</span></label>
                <select {...register("vardiya")} className={`w-full bg-gray-800 border ${errors.vardiya ? 'border-red-500' : 'border-gray-600'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500`}>
                  <option value="">-- Vardiya Seçiniz --</option><option value="08:00 - 16:00">08:00 - 16:00 (Gündüz)</option><option value="16:00 - 24:00">16:00 - 24:00 (Akşam)</option><option value="24:00 - 08:00">24:00 - 08:00 (Gece)</option>
                </select>
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
                <select {...register("hatAdi")} disabled={isAutoFilled} onChange={(e) => { setSeciliHat(e.target.value); setValue("hatAdi", e.target.value); setValue("ekipmanAdi", ""); }} className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 ${isAutoFilled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <option value="">-- Hat Seçiniz --</option>{benzersizHatlar.map(hat => <option key={hat} value={hat}>{hat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Arızalı Ekipman</label>
                <select {...register("ekipmanAdi")} disabled={!seciliHat || isAutoFilled} className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 ${(!seciliHat || isAutoFilled) ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <option value="">{seciliHat ? "-- Ekipman Seçiniz --" : "-- Önce Hat Seçiniz --"}</option>
                  {filtrelenmisEkipmanlar.length > 0 ? (filtrelenmisEkipmanlar.map(ekp => <option key={ekp.id} value={ekp.ekipmanAdi}>{ekp.ekipmanAdi}</option>)) : isAutoFilled ? (<option value={watch("ekipmanAdi")}>{watch("ekipmanAdi")}</option>) : null}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sorun Tipi</label>
                <select {...register("sorunTipi")} disabled={isAutoFilled} className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 ${isAutoFilled ? 'opacity-60 cursor-not-allowed' : ''}`}>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-fuchsia-900/10 p-4 rounded-xl border border-fuchsia-800/30">
              <div className="md:col-span-3 mb-[-10px]"><p className="text-fuchsia-400 font-bold text-sm flex items-center gap-2">⚙️ Kullanılan Yedek Parça <span className="text-gray-500 font-normal text-xs">(Kullanılmadıysa boş bırakın)</span></p></div>
              <div><input type="text" {...register("yedekParcaKodu")} placeholder="Stok Kodu / Adı" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3" /></div>
              <div><input type="number" step="0.01" {...register("yedekParcaMiktar")} placeholder="Miktar" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3" /></div>
              <div><select {...register("yedekParcaBirim")} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3"><option value="Adet">Adet</option><option value="Metre">Metre</option><option value="KG">KG</option><option value="Litre">Litre</option></select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Başlangıç Saati</label><input type="datetime-local" {...register("baslangicSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-400 mb-2">Bitiş Saati</label><input type="datetime-local" {...register("bitisSaati")} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" /></div>
              <div className="md:col-span-2 text-center pt-2"><p className="text-sm text-gray-400">Otomatik Hesaplanan Süre:</p><p className="text-3xl font-bold text-blue-500">{hesaplananSure} <span className="text-lg text-gray-500">Dakika</span></p></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Açıklama / Yapılan İşlem</label>
              <textarea {...register("aciklama")} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500" />
            </div>

            <button type="submit" disabled={isSubmitting || hesaplananSure <= 0} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-4 rounded-xl disabled:opacity-50 transition-all">
              {isSubmitting ? "Kaydediliyor..." : "Performansıma Kaydet ve İşi Bitir"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex justify-center items-center">Yükleniyor...</div>}><DashboardIcerik /></Suspense>;
}