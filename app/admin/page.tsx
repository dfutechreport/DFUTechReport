"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList, PieChart, Pie, Cell } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(""); 
  const [userName, setUserName] = useState(""); 
  const [userEmail, setUserEmail] = useState(""); // Süper Admin kontrolü için
  const [loading, setLoading] = useState(true);
  
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [kpiOnayBekleyen, setKpiOnayBekleyen] = useState(0);

  const [aktifIsler, setAktifIsler] = useState<any[]>([]);
  const [aktifEked, setAktifEked] = useState<any[]>([]); 
  const [aktifIsgAlarmlari, setAktifIsgAlarmlari] = useState<any[]>([]);
  const [aktifPmAlarmlari, setAktifPmAlarmlari] = useState<any[]>([]);

  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");

  const [yilListesi, setYilListesi] = useState<string[]>([]);
  const [hatListesi, setHatListesi] = useState<string[]>([]);
  const [ekipmanListesi, setEkipmanListesi] = useState<string[]>([]);
  
  const [filterElektrikSayac, setFilterElektrikSayac] = useState("");
  const [filterDogalgazSayac, setFilterDogalgazSayac] = useState("");
  const [filterSuSayac, setFilterSuSayac] = useState("");

  const [elektrikSayacListesi, setElektrikSayacListesi] = useState<string[]>([]);
  const [dogalgazSayacListesi, setDogalgazSayacListesi] = useState<string[]>([]);
  const [suSayacListesi, setSuSayacListesi] = useState<string[]>([]);
  const [rawMeterLogs, setRawMeterLogs] = useState<any[]>([]); 

  const [filterPerfYil, setFilterPerfYil] = useState("");
  const [filterPerfAy, setFilterPerfAy] = useState("");
  const [filterPerfVardiya, setFilterPerfVardiya] = useState("");
  const [filterPerfPersonel, setFilterPerfPersonel] = useState("");
  const [filterPerfDurus, setFilterPerfDurus] = useState(""); 
  const [filterPerfSiralama, setFilterPerfSiralama] = useState("is"); 
  const [personelHavuzu, setPersonelHavuzu] = useState<string[]>([]); 

  
  // --- SAĞLIK HARİTASI VE RCA MANTIK ---
  const [rcaLogs, setRcaLogs] = useState<any[]>([]);
  const [activeFloor, setActiveFloor] = useState(1);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [selectedLogForRca, setSelectedLogForRca] = useState<any>(null);
  const [rcaForm, setRcaForm] = useState({ category: "", why: "" });

  const RCA_CATEGORIES = [
    { id: "insan", label: "İnsan", color: "#3B82F6" },
    { id: "makine", label: "Makine", color: "#EF4444" },
    { id: "malzeme", label: "Malzeme", color: "#10B981" },
    { id: "metot", label: "Metot", color: "#F59E0B" },
    { id: "ortam", label: "Ortam", color: "#8B5CF6" }
  ];

  const EQUIPMENT_LOCATIONS = [
    { id: "kek-hatti", name: "KEK HATTI", floor: 1, x: "65%", y: "48%" },
    { id: "baget-hatti", name: "BAGET HATTI", floor: 1, x: "78%", y: "35%" },
    { id: "silo-grubu", name: "SILO GRUBU", floor: 0, x: "85%", y: "22%" },
    { id: "hamurhane", name: "HAMURHANE", floor: 0, x: "55%", y: "40%" },
    { id: "su-deposu", name: "SU DEPOSU", floor: -1, x: "20%", y: "60%" },
    { id: "pogaca-hatti", name: "PASTRY POĞAÇA HATTI", floor: 2, x: "70%", y: "28%" }
  ];

  const fetchRcaData = async () => {
    try {
      const snap = await getDocs(collection(db, "root_cause_analysis"));
      setRcaLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (e) { console.error("RCA Veri Çekme Hatası:", e); }
  };

  const handleSaveRca = async () => {
    if (!rcaForm.category) return alert("Kategori seçin.");
    try {
      await setDoc(doc(db, "root_cause_analysis", String(selectedLogForRca.id)), {
        logId: selectedLogForRca.id,
        ekipman: selectedLogForRca.ekipmanAdi,
        category: rcaForm.category,
        why: rcaForm.why,
        analizEden: userName,
        tarih: serverTimestamp()
      }, { merge: true });
      alert("Analiz kaydedildi.");
      setShowRcaModal(false);
      fetchRcaData();
    } catch (e) { alert("Kaydedilemedi."); }
  };

  const getHealthStatus = (ekipmanAdi: string) => {
    const isArıza = aktifIsler.some((is: any) => is.ekipmanAdi === ekipmanAdi && is.isDuruslu);
    if (isArıza) return "bg-red-500 animate-ping";
    const hasRca = rcaLogs.find((r: any) => r.ekipman === ekipmanAdi);
    if (hasRca && !hasRca.category) return "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]";
    return "bg-green-500";
  };

  const [kpiToplamIs, setKpiToplamIs] = useState(0);
  const [kpiToplamSure, setKpiToplamSure] = useState(0);
  const [kpiAylikDurus, setKpiAylikDurus] = useState(0);
  const [kpiDurusluIsSayisi, setKpiDurusluIsSayisi] = useState(0);
  const [globalMTBF, setGlobalMTBF] = useState("0");
  
  const [grafikDurusVerisi, setGrafikDurusVerisi] = useState<any[]>([]);
  const [grafikTumIslerVerisi, setGrafikTumIslerVerisi] = useState<any[]>([]);
  const [personelPerformans, setPersonelPerformans] = useState<any[]>([]);
  
  const [grafikElektrik, setGrafikElektrik] = useState<any[]>([]);
  const [grafikDogalgaz, setGrafikDogalgaz] = useState<any[]>([]);
  const [grafikSu, setGrafikSu] = useState<any[]>([]);

  // Bad Actors State'leri
  const [filterEqYil, setFilterEqYil] = useState("");
  const [filterEqAy, setFilterEqAy] = useState("");
  const [filterEqHat, setFilterEqHat] = useState("");
  const [filterEqLimit, setFilterEqLimit] = useState("5"); 
  const [ekipmanPerformans, setEkipmanPerformans] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || ""); 
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().isApproved) {
          const data = userSnap.data();
          const role = data.role;
          setUserRole(role);
          setUserName(data.name);
          if (role === "admin" || role === "operator" || role === "uretim" || role === "isg") {
            setIsAdmin(true); 
            fetchIlkVeriler();
            fetchRcaData();
          } else {
            window.location.href = "/dashboard";
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchIlkVeriler = async () => {
    try {
      const userQ = query(collection(db, "users"), where("isApproved", "==", false));
      setKpiOnayBekleyen((await getDocs(userQ)).size);

      const wQ = query(collection(db, "work_orders"), where("durum", "==", "Açık"));
      const wSnap = await getDocs(wQ);
      const wData: any[] = wSnap.docs.map(d => ({ id: d.id, ...d.data(), gercekZaman: d.data().kayitTarihi ? d.data().kayitTarihi.toDate().getTime() : 0 }));
      
      const isgAlarmlari = wData.filter(d => d.ekipmanAdi === "KAR devreye alma");
      const pmAlarmlari = wData.filter(d => d.sorunTipi === "Planlı Bakım");
      const normalIsler = wData.filter(d => d.ekipmanAdi !== "KAR devreye alma" && d.sorunTipi !== "Planlı Bakım");

      setAktifIsgAlarmlari(isgAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifPmAlarmlari(pmAlarmlari.sort((a, b) => b.gercekZaman - a.gercekZaman));
      setAktifIsler(normalIsler.sort((a, b) => b.gercekZaman - a.gercekZaman).slice(0, 5));

      const eQ = query(collection(db, "eked_logs"), where("durum", "==", "Açık"));
      const eSnap = await getDocs(eQ);
      setAktifEked(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const logs = (await getDocs(collection(db, "maintenance_logs"))).docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRawLogs(logs); fetchRcaData();

      const qMeter = query(collection(db, "meter_logs"), orderBy("tarih", "asc"));
      const meterSnap = await getDocs(qMeter);
      setRawMeterLogs(meterSnap.docs.map(d => d.data()));

      const yillar = new Set<string>();
      const hatlar = new Set<string>();
      
      logs.forEach(data => {
        if (data.hatAdi) hatlar.add(data.hatAdi);
        let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
        if (tarihObj) yillar.add(tarihObj.getFullYear().toString());
      });

      setYilListesi(Array.from(yillar).sort((a, b) => Number(b) - Number(a)));
      setHatListesi(Array.from(hatlar).sort());
    } catch (error) { console.error(error); }
  };

  const handleIsiTamamla = async (islem: any) => {
    if (!window.confirm("Bu işi bitirdiğinizi onaylıyor musunuz? Form otomatik açılacaktır.")) return;
    try {
      await updateDoc(doc(db, "work_orders", islem.id), { durum: "Kapalı", tamamlayanKisi: userName, tamamlanmaTarihi: new Date() });
      window.location.href = `/dashboard?hat=${encodeURIComponent(islem.hatAdi)}&ekipman=${encodeURIComponent(islem.ekipmanAdi)}&sorun=${encodeURIComponent(islem.sorunTipi)}&duruslu=${islem.isDuruslu ? 'true' : 'false'}&aciklama=${encodeURIComponent(islem.aciklama)}`;
    } catch (error) { alert("Hata oluştu."); }
  };

  const handlePMBasla = (islem: any) => {
    window.location.href = `/dashboard/periyodik-bakim?makine=${encodeURIComponent(islem.ekipmanAdi)}&pmOrderId=${islem.id}`;
  };

  // YENİ: SÜPER ADMİN - SİSTEMİ SIFIRLAMA FONKSİYONU
  const handleFactoryReset = async () => {
    // Sadece izin verilen iki maile yetki verilir
    if (userEmail !== "dfutechreport@gmail.com" && userEmail !== "ilker.yilmaz@donukfirincilik.com.tr") {
      return alert("Yetkisiz işlem! Bu alanı sadece Sistem Kurucuları kullanabilir.");
    }

    const onay1 = window.confirm("🚨 1. UYARI: Sistemdeki tüm operasyonel dataları (Arıza, EKED, PM, Sayaç, Mesai, Pano ve Stok/Sarfiyat) KALICI olarak silmek üzeresiniz. Bu işlem asla geri alınamaz. Devam etmek istiyor musunuz?");
    if (!onay1) return;

    const onay2 = window.confirm("⚠️ 2. SON UYARI: Sadece kullanıcıların oluşturduğu günlük veriler silinecektir. Altyapı verileri (Kullanıcılar, Makine Listesi, PM Master Plan) KORUNACAKTIR. İşlemi kesin olarak onaylıyor musunuz?");
    if (!onay2) return;

    const onay3 = window.prompt("🛑 GÜVENLİK KİLİDİ: İşlemi tetiklemek için aşağıdaki kutucuğa büyük harflerle SİL yazın.");
    if (onay3 !== "SİL") {
      return alert("Güvenlik kelimesi hatalı girildi. Sistem sıfırlama işlemi iptal edildi.");
    }

    setLoading(true);
    try {
      const collectionsToWipe = [
        "work_orders", "maintenance_logs", "meter_logs", "eked_logs", 
        "pm_logs", "panel_logs", "mesai_logs", "overtime_logs", 
        "kar_logs", "spare_parts", "system_logs"
      ];

      for (const colName of collectionsToWipe) {
        const q = query(collection(db, colName));
        const snap = await getDocs(q);
        const docsArr = snap.docs;
        
        for (let i = 0; i < docsArr.length; i += 400) {
          const chunk = docsArr.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      alert("✅ SİSTEM BAŞARIYLA SIFIRLANDI! Tüm operasyonel veriler silindi, altyapı korundu.");
      window.location.reload(); 

    } catch (error) {
      console.error("Sıfırlama hatası:", error);
      alert("Sıfırlama işlemi sırasında sunucu kaynaklı bir hata oluştu.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (rawMeterLogs.length === 0) return;
    const sayacGruplari: Record<string, any[]> = {};
    const elekSet = new Set<string>(); const dogSet = new Set<string>(); const suSet = new Set<string>();
    rawMeterLogs.forEach(log => {
      const tip = log.tip || "Elektrik";
      if (tip === "Elektrik" && log.sayacAdi) elekSet.add(log.sayacAdi);
      if (tip === "Doğalgaz" && log.sayacAdi) dogSet.add(log.sayacAdi);
      if (tip === "Su" && log.sayacAdi) suSet.add(log.sayacAdi);
      if (tip === "Elektrik" && filterElektrikSayac && log.sayacAdi !== filterElektrikSayac) return;
      if (tip === "Doğalgaz" && filterDogalgazSayac && log.sayacAdi !== filterDogalgazSayac) return;
      if (tip === "Su" && filterSuSayac && log.sayacAdi !== filterSuSayac) return;
      if (!sayacGruplari[log.sayacAdi]) sayacGruplari[log.sayacAdi] = [];
      sayacGruplari[log.sayacAdi].push(log);
    });
    setElektrikSayacListesi(Array.from(elekSet).sort()); setDogalgazSayacListesi(Array.from(dogSet).sort()); setSuSayacListesi(Array.from(suSet).sort());

    const initAylar = (): Record<string, number> => ({ "01. Ay": 0, "02. Ay": 0, "03. Ay": 0, "04. Ay": 0, "05. Ay": 0, "06. Ay": 0, "07. Ay": 0, "08. Ay": 0, "09. Ay": 0, "10. Ay": 0, "11. Ay": 0, "12. Ay": 0 });
    const tuketimElektrik = initAylar(); const tuketimDogalgaz = initAylar(); const tuketimSu = initAylar();

    Object.keys(sayacGruplari).forEach(sayacAdi => {
      const okumalar = sayacGruplari[sayacAdi];
      const tip = okumalar[0].tip || "Elektrik"; 
      for (let i = 1; i < okumalar.length; i++) {
        const tuketimFarki = Math.max(0, Number(okumalar[i].deger) - Number(okumalar[i - 1].deger)); 
        const ayAnahtari = `${okumalar[i].tarih.split("-")[1]}. Ay`;
        if (tip === "Elektrik" && tuketimElektrik[ayAnahtari] !== undefined) tuketimElektrik[ayAnahtari] += tuketimFarki;
        else if (tip === "Doğalgaz" && tuketimDogalgaz[ayAnahtari] !== undefined) tuketimDogalgaz[ayAnahtari] += tuketimFarki;
        else if (tip === "Su" && tuketimSu[ayAnahtari] !== undefined) tuketimSu[ayAnahtari] += tuketimFarki;
      }
    });
    const formatData = (dataObj: any) => Object.keys(dataObj).map(ay => ({ ay, tuketim: dataObj[ay] })).filter(a => a.tuketim > 0);
    setGrafikElektrik(formatData(tuketimElektrik)); setGrafikDogalgaz(formatData(tuketimDogalgaz)); setGrafikSu(formatData(tuketimSu));
  }, [rawMeterLogs, filterElektrikSayac, filterDogalgazSayac, filterSuSayac]);

  useEffect(() => {
    if (rawLogs.length === 0) return;
    let topDurusDk = 0; let topIsAdedi = 0; let topMudahaleDk = 0; let durusluIsAdedi = 0;
    const tumIslerData: Record<string, { adet: number, dakika: number }> = {};
    const durusluIslerData: Record<string, { adet: number, dakika: number }> = {};
    const personelAnaliz: Record<string, { isSayisi: number, eforDk: number }> = {};
    const aktifEkipmanlar = new Set<string>(); const tumPersoneller = new Set<string>(); 
    const eqData: Record<string, { hat: string, count: number, sure: number }> = {};

    rawLogs.forEach((data) => {
      let tarihObj = data.baslangicSaati ? new Date(data.baslangicSaati) : (data.kayitTarihi ? data.kayitTarihi.toDate() : null);
      const yil = tarihObj ? tarihObj.getFullYear().toString() : "";
      const ay = tarihObj ? (tarihObj.getMonth() + 1).toString() : ""; 
      
      if (data.isDuruslu && data.ekipmanAdi) {
        let eqPass = true;
        if (filterEqYil && yil !== filterEqYil) eqPass = false;
        if (filterEqAy && ay !== filterEqAy) eqPass = false;
        if (filterEqHat && data.hatAdi !== filterEqHat) eqPass = false;
        
        if (eqPass) {
          const ekipman = data.ekipmanAdi;
          if (!eqData[ekipman]) eqData[ekipman] = { hat: data.hatAdi || "-", count: 0, sure: 0 };
          eqData[ekipman].count += 1;
          eqData[ekipman].sure += (Number(data.toplamSureDakika) || 0);
        }
      }

      let grafikPass = true;
      if (filterYil && yil !== filterYil) grafikPass = false;
      if (filterAy && ay !== filterAy) grafikPass = false;
      if (filterHat && data.hatAdi !== filterHat) grafikPass = false;
      if (filterEkipman && data.ekipmanAdi !== filterEkipman) grafikPass = false;

      const sure = Number(data.toplamSureDakika) || 0;
      const isEkibi = Array.isArray(data.isiYapanlar) && data.isiYapanlar.length > 0 ? data.isiYapanlar : [data.bildirenKisi || "Bilinmiyor"];
      isEkibi.forEach((p: string) => tumPersoneller.add(p)); 

      if (grafikPass) {
        if (data.ekipmanAdi) aktifEkipmanlar.add(data.ekipmanAdi);
        const groupKey = filterHat ? (data.ekipmanAdi || "Belirsiz") : (data.hatAdi || "Belirsiz");
        topIsAdedi++; topMudahaleDk += sure;
        if (!tumIslerData[groupKey]) tumIslerData[groupKey] = { adet: 0, dakika: 0 };
        tumIslerData[groupKey].adet += 1; tumIslerData[groupKey].dakika += sure;
        if (data.isDuruslu) {
          topDurusDk += sure; durusluIsAdedi++;
          if (!durusluIslerData[groupKey]) durusluIslerData[groupKey] = { adet: 0, dakika: 0 };
          durusluIslerData[groupKey].adet += 1; durusluIslerData[groupKey].dakika += sure;
        }
      }

      let perfPass = true;
      if (filterPerfYil && yil !== filterPerfYil) perfPass = false;
      if (filterPerfAy && ay !== filterPerfAy) perfPass = false;
      if (filterPerfVardiya && data.vardiya !== filterPerfVardiya) perfPass = false;
      if (filterPerfDurus === "duruslu" && data.isDuruslu !== true) perfPass = false;
      if (filterPerfDurus === "durussuz" && data.isDuruslu !== false) perfPass = false;
      if (perfPass) {
        isEkibi.forEach((personelIsmi: string) => {
          if (filterPerfPersonel && personelIsmi !== filterPerfPersonel) return;
          if (!personelAnaliz[personelIsmi]) personelAnaliz[personelIsmi] = { isSayisi: 0, eforDk: 0 };
          personelAnaliz[personelIsmi].isSayisi += 1; personelAnaliz[personelIsmi].eforDk += sure;
        });
      }
    });

    const ekipmanArizalari: Record<string, number[]> = {};
    rawLogs.forEach((data: any) => {
      if (data.isDuruslu === true) {
        let t = 0;
        if (data.baslangicSaati) {
          t = new Date(data.baslangicSaati).getTime();
        } else if (data.kayitTarihi) {
          t = data.kayitTarihi.toDate().getTime();
        }
        if (t > 0 && data.ekipmanAdi) {
          const ekipmanStr = String(data.ekipmanAdi);
          if (!ekipmanArizalari[ekipmanStr]) {
            ekipmanArizalari[ekipmanStr] = [];
          }
          ekipmanArizalari[ekipmanStr].push(t);
        }
      }
    });

    let totalMtbfMs = 0; 
    let mtbfCount = 0;
    const cihazAdlari = Object.keys(ekipmanArizalari);
    
    cihazAdlari.forEach((cihazAdi) => {
      const zamanlar = ekipmanArizalari[cihazAdi];
      if (zamanlar && zamanlar.length > 1) {
        zamanlar.sort((a: number, b: number) => Number(a) - Number(b)); 
        for (let i = 1; i < zamanlar.length; i++) {
          const fark = Number(zamanlar[i]) - Number(zamanlar[i - 1]);
          if (fark > 0) {
            totalMtbfMs += fark;
            mtbfCount++;
          }
        }
      }
    });

    const hesaplananMTBF = mtbfCount > 0 ? (totalMtbfMs / mtbfCount / (1000 * 60 * 60)).toFixed(1) : "Veri Yetersiz";
    setGlobalMTBF(hesaplananMTBF); 

    let arrEq = Object.keys(eqData).map(k => ({ ekipman: k, ...eqData[k] }));
    arrEq.sort((a, b) => b.count - a.count || b.sure - a.sure); 
    if (filterEqLimit !== "all") {
      arrEq = arrEq.slice(0, Number(filterEqLimit)); 
    }
    setEkipmanPerformans(arrEq);

    setEkipmanListesi(Array.from(aktifEkipmanlar).sort()); setPersonelHavuzu(Array.from(tumPersoneller).sort());
    setKpiAylikDurus(topDurusDk); setKpiToplamIs(topIsAdedi); setKpiToplamSure(topMudahaleDk); setKpiDurusluIsSayisi(durusluIsAdedi);
    setGrafikTumIslerVerisi(Object.keys(tumIslerData).map(k => ({ isim: k, ...tumIslerData[k] })).sort((a, b) => b.adet - a.adet));
    setGrafikDurusVerisi(Object.keys(durusluIslerData).map(k => ({ isim: k, ...durusluIslerData[k] })).sort((a, b) => b.dakika - a.dakika));
    const formatliPersonel = Object.keys(personelAnaliz).map(k => ({ isim: k, ...personelAnaliz[k] }));
    if (filterPerfSiralama === "efor") formatliPersonel.sort((a, b) => b.eforDk - a.eforDk);
    else formatliPersonel.sort((a, b) => b.isSayisi - a.isSayisi); 
    setPersonelPerformans(formatliPersonel);
  }, [rawLogs, filterYil, filterAy, filterHat, filterEkipman, filterPerfYil, filterPerfAy, filterPerfVardiya, filterPerfPersonel, filterPerfDurus, filterPerfSiralama, filterEqYil, filterEqAy, filterEqHat, filterEqLimit]);

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Tarih;Vardiya;Hat;Ekipman;Sorun Tipi;Duruslu Mu;Sure(Dk);Personel;Aciklama\n";
    rawLogs.forEach(row => {
      const tarih = row.baslangicSaati || (row.kayitTarihi ? row.kayitTarihi.toDate().toLocaleString('tr-TR') : "-");
      const vardiya = row.vardiya || "-";
      const hat = row.hatAdi || "-";
      const ekipman = row.ekipmanAdi || "-";
      const sorun = row.sorunTipi || "-";
      const durus = row.isDuruslu ? "Evet" : "Hayir";
      const sure = row.toplamSureDakika || 0;
      const personel = Array.isArray(row.isiYapanlar) ? row.isiYapanlar.join(" & ") : (row.bildirenKisi || "-");
      const aciklama = row.aciklama ? row.aciklama.replace(/;/g, ",").replace(/\n/g, " ") : "-";
      csvContent += `${tarih};${vardiya};${hat};${ekipman};${sorun};${durus};${sure};${personel};${aciklama}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Tum_Bakim_Verileri_${new Date().toLocaleDateString('tr-TR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Sistem yükleniyor...</div>;
  if (!loading && !isAdmin) return <div className="min-h-screen bg-gray-950 text-red-500 flex justify-center items-center">Giriş yetkiniz kontrol ediliyor... Lütfen bekleyin.</div>;

  const OzelTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-2xl z-50">
          <p className="font-bold text-white mb-2">{label}</p>
          {payload.map((p: any, i: number) => (<p key={i} style={{color: p.color}} className="text-sm">{p.name}: <b>{p.value}</b></p>))}
        </div>
      );
    } return null;
  };
  
  const durusSureYuzde = kpiToplamSure > 0 ? ((kpiAylikDurus / kpiToplamSure) * 100).toFixed(1) : "0";
const globalMTTR = kpiToplamIs > 0 ? (kpiToplamSure / kpiToplamIs).toFixed(1) : "0";
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } .print-break { page-break-before: always; } .bg-gray-950, .bg-gray-900 { background: white !important; } .text-white, .text-gray-400 { color: black !important; } .border-gray-800, .border-gray-700 { border-color: #ddd !important; } .shadow-lg { box-shadow: none !important; } .perf-row { display: none !important; } .perf-row:nth-child(-n+5) { display: table-row !important; } .pdf-top5-mesaj { display: block !important; color: #EF4444 !important; font-size: 12px; font-weight: bold; margin-top: 8px;} }`}} />

      <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-800 pb-5 gap-4">
            <div className="flex items-center gap-4">
              <img src="/dfulogo.png" alt="Logo" className="h-12 w-auto object-contain bg-white rounded-lg p-1" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{userRole === "admin" ? "Yönetici Paneli" : userRole === "isg" ? "İSG (Güvenlik) Paneli" : userRole === "uretim" ? "Üretim İzleme Paneli" : "Operatör İzleme Paneli"}</h1>
                <p className="text-gray-400 mt-1 text-sm md:text-base"><span className="font-bold text-gray-300">DFU Donuk Fırıncılık Ürünleri A.Ş.</span> | İş Zekası (BI)</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 no-print">
              {(userEmail === "dfutechreport@gmail.com" || userEmail === "ilker.yilmaz@donukfirincilik.com.tr") && (
                <button onClick={handleFactoryReset} className="bg-red-900 hover:bg-red-800 text-white font-bold px-4 py-2 rounded-lg shadow-lg transition text-sm flex items-center gap-2 border border-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Sistemi Sıfırla (Reset)
                </button>
              )}
              {(userRole === "admin" || userRole === "operator" || userRole === "isg") && (
                <button onClick={exportToCSV} className="bg-green-700 text-white font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-green-600 transition text-sm flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> 
                  Tüm Verileri Excel'e Aktar
                </button>
              )}
              {(userRole === "admin" || userRole === "isg") && (
                <button onClick={() => window.print()} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-gray-200 transition text-sm flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg> PDF Çıktısı Al</button>
              )}
              <button onClick={() => { auth.signOut(); window.location.href="/"; }} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">Çıkış</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 no-print">
            {(userRole === "admin" || userRole === "uretim") && (<Link href="/admin/is-emri-ac" className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(220,38,38,0.5)] transition">🚨 Yeni İş Emri</Link>)}
            {userRole !== "isg" && (<Link href="/admin/aktif-isler" className="bg-red-900/60 hover:bg-red-600 border border-red-500/50 text-red-100 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition"><span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>Aktif İş Emirleri</Link>)}
            {userRole !== "isg" && (<Link href="/admin/tamamlanan-isler" className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ Tamamlanan İş Emirleri</Link>)}
            {(userRole === "admin" || userRole === "isg") && (
              <>
                <Link href="/admin/eked" className="bg-yellow-600 hover:bg-yellow-500 text-black p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(202,138,4,0.4)] transition">🔒 EKED Takip</Link>
                <Link href="/admin/eked/arsiv" className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-gray-200 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ EKED Arşivi</Link>
                <Link href="/admin/duyurular" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">📢 İSG Duyuru</Link>
                <Link href="/admin/kar-takip" className="bg-red-800 hover:bg-red-700 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚡ KAR İhlal Arşivi</Link>
              </>
            )}
            {userRole === "admin" && (
              <>
                <Link href="/admin/ekipmanlar" className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚙️ Hat / Ekipman</Link>
                <Link href="/admin/personel" className="relative bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">
                  👤 Personel Onay
                  {kpiOnayBekleyen > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-gray-950 animate-bounce">
                      {kpiOnayBekleyen}
                    </span>
                  )}
                </Link>
              </>
            )}
            {(userRole === "admin" || userRole === "operator" || userRole === "teknisyen") && (<Link href="/dashboard/pano-kayit" className="bg-indigo-700 hover:bg-indigo-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(67,56,202,0.4)] transition">🔌 Pano Kayıt</Link>)}
            {(userRole === "admin" || userRole === "operator" || userRole === "isg" || userRole === "teknisyen") && (
              <>
                <Link href="/dashboard/pano-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🔌 Pano Listesi</Link>
                <Link href="/admin/pano-takip" className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ Pano Takip Arşivi</Link>
              </>
            )}
            {userRole !== "uretim" && userRole !== "isg" && (
              <>
                <Link href="/dashboard/kontrol-formlari" className="bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(6,182,212,0.4)] transition">✅ Kontrol Formları</Link>
                <Link href="/admin/pm-takvim" className="bg-teal-700 hover:bg-teal-600 text-white p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(15,118,110,0.5)] transition">📅 Yıllık PM Takvimi</Link>
                <Link href="/admin/periyodik-bakim-arsiv" className="bg-teal-800 hover:bg-teal-700 text-teal-100 p-3 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🗄️ PM Arşivi</Link>
                <Link href="/admin/yedek-parca" className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-[0_0_15px_rgba(192,38,211,0.4)] transition">⚙️ Yedek Parça</Link>
                <Link href="/admin/is-listesi" className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">📋 Yapılan İşler</Link>
                <Link href="/dashboard/sayac" className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⚡ Sayaç Okuma</Link>
                <Link href="/admin/mesai" className="bg-teal-600 hover:bg-teal-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">⏰ Mesai Raporları</Link>
                <Link href="/dashboard" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center text-center shadow-lg transition">🛠️ Vardiya Raporu</Link>
              </>
            )}
          </div>


          {/* HARİTA VE ANALİZ PANELİ */}
          {(userRole === "admin" || userRole === "operator" || userRole === "teknisyen") && (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-[40px] p-6 md:p-8 mb-8 shadow-2xl no-print relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tighter">📍 Tesis Sağlık Haritası</h2>
                  <div className="flex bg-gray-800 p-1.5 rounded-2xl border border-gray-700">
                    {[-1, 0, 1, 2].map(f => (
                      <button key={f} onClick={() => setActiveFloor(f)} className={`px-4 py-1.5 rounded-xl text-[10px] font-bold ${activeFloor === f ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500'}`}>KAT {f===0?"ZEMİN":f}</button>
                    ))}
                  </div>
                </div>
                <div className="relative w-full aspect-[21/9] bg-black/40 rounded-3xl overflow-hidden border border-gray-800/50">
                  <img src={`/map/floor${activeFloor}.png`} className="w-full h-full object-contain opacity-60" onError={(e) => {(e.target as HTMLImageElement).src = 'https://placehold.co/1200x500/111827/4F46E5?text=Plan+Yuklenemedi';}} />
                  {EQUIPMENT_LOCATIONS.filter(eq => eq.floor === activeFloor).map(m => (
                    <div key={m.id} className="absolute group cursor-pointer p-2 -m-2 z-10" style={{ top: m.y, left: m.x }}>
                      <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-white/40 ${getHealthStatus(m.name)}`}></div>
                      <div className="block md:hidden absolute top-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] text-white font-bold border border-white/10 whitespace-nowrap">{m.name}</div>
                      <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-gray-800 p-2 rounded-xl text-[9px] z-50 whitespace-nowrap">{m.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {userRole === "admin" && (
                <div className="bg-gray-900 border-2 border-indigo-500/20 p-6 rounded-3xl mb-8 shadow-xl">
                  <h2 className="text-lg font-bold text-indigo-400 mb-4 flex items-center gap-2">🧠 RCA Bekleyen Duruşlar</h2>
                  <div className="space-y-3">
                    {rawLogs.filter((l: any) => l.isDuruslu).slice(0, 5).map((log, idx) => {
                      const hasRca = rcaLogs.find(r => r.logId === log.id);
                      return (
                        <div key={idx} className="bg-gray-800/40 p-4 rounded-2xl flex items-center justify-between border border-gray-700/50 hover:border-indigo-500/50 transition">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-[10px] text-gray-500 uppercase">{log.hatAdi}</p>
                            <p className="font-bold text-gray-200 text-sm truncate">{log.ekipmanAdi} <span className="text-red-400 ml-2">{log.toplamSureDakika} dk</span></p>
                          </div>
                          <button onClick={() => { setSelectedLogForRca(log); setShowRcaModal(true); setRcaForm({ category: hasRca?.category || "", why: hasRca?.why || "" }); }} className={`px-5 py-2 rounded-xl text-[10px] font-bold ${hasRca ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-indigo-600 text-white shadow-lg'}`}>
                            {hasRca ? "Güncellendi" : "Analiz"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}


          {(userRole === "admin" || userRole === "operator" || userRole === "teknisyen") && aktifPmAlarmlari.length > 0 && (
            <div className="bg-cyan-900/30 border-2 border-cyan-500/50 p-6 rounded-2xl mb-10 shadow-[0_0_20px_rgba(6,182,212,0.3)] no-print relative overflow-hidden">
              <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2 relative z-10">
                <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span></span>
                Yaklaşan Planlı Bakımlar (Periyodik Bakım Günü Geldi)
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
                {aktifPmAlarmlari.map(islem => (
                  <div key={islem.id} className="bg-gray-900 border border-cyan-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-cyan-500/80">
                    <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500"></div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Sistem Otomasyonu | Planlı İş Emri</p>
                      <p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-cyan-400 font-medium text-sm">({islem.ekipmanAdi})</span></p>
                      <p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p>
                    </div>
                    {userRole !== "operator" && (
                      <button onClick={() => handlePMBasla(islem)} className="w-full md:w-auto whitespace-nowrap bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg">
                        ✅ PM Formuna Git
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(userRole === "admin" || userRole === "operator" || userRole === "teknisyen" || userRole === "isg") && aktifIsgAlarmlari.length > 0 && (
            <div className="bg-red-900/40 border-[3px] border-red-500 p-6 rounded-2xl mb-10 shadow-[0_0_30px_rgba(239,68,68,0.5)] no-print relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)]"></div>
              <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2 relative z-10"><span className="relative flex h-5 w-5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span></span> ACİL İSG ALARMI: KAR DEVRE DIŞI KALMIŞTIR! (Müdahale Bekliyor)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
                {aktifIsgAlarmlari.map(islem => (
                  <div key={islem.id} className="bg-gray-900 border border-red-500 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="absolute top-0 left-0 w-2 h-full bg-red-500 animate-pulse"></div>
                    <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1">{islem.aciklama}</p></div>
                    {userRole !== "isg" && <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg border border-red-400">✅ İşi Tamamla (KAR'ı Devreye Al)</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {userRole !== "isg" && aktifIsler.length > 0 && (
            <div className="bg-red-900/20 border-2 border-red-500/50 p-6 rounded-2xl mb-10 shadow-2xl no-print">
              <h2 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2"><span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span></span> Üretimden Gelen Aktif Bildirimler (Müdahale Bekleyen İş Emirleri)</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {aktifIsler.map(islem => (
                  <div key={islem.id} className={`bg-gray-900 border border-red-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-500/80`}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div><p className="text-xs text-gray-400 mb-1">{islem.kayitTarihi?.toDate().toLocaleString('tr-TR')} | Bildiren: {islem.bildirenKisi}</p><p className="font-bold text-white text-lg">{islem.hatAdi} <span className="text-red-400 font-medium text-sm">({islem.ekipmanAdi})</span></p><p className="text-gray-300 text-sm mt-1 line-clamp-2">{islem.aciklama}</p></div>
                    {userRole !== "uretim" && <button onClick={() => handleIsiTamamla(islem)} className="w-full md:w-auto whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition shadow-[0_0_15px_rgba(22,163,74,0.4)]">✅ İşi Tamamla</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(userRole === "admin" || userRole === "operator" || userRole === "isg" || userRole === "teknisyen") && aktifEked.length > 0 && (
            <div className="bg-yellow-900/20 border-2 border-yellow-500/50 p-6 rounded-2xl mb-10 shadow-[0_0_20px_rgba(202,138,4,0.15)] relative overflow-hidden no-print">
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

          {userRole !== "uretim" && userRole !== "isg" && (
            <>
              <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                <h2 className="text-2xl font-bold text-black">Bakım Yönetim Sistemi Özet Raporu</h2>
                <p className="text-gray-600">Rapor Kapsamı: {filterYil || "Tüm Yıllar"} - {filterAy ? `${filterAy}. Ay` : "Tüm Aylar"} | Hat: {filterHat || "Tümü"}</p>
                <p className="text-sm text-gray-500 mt-1">Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-5 rounded-2xl shadow-lg"><p className="text-xs md:text-sm text-gray-400 font-semibold mb-1">Toplam Yapılan İş</p><h3 className="text-2xl md:text-3xl font-bold text-green-400">{kpiToplamIs} <span className="text-sm text-gray-500 font-normal">Adet</span></h3><p className="text-xs text-gray-500 mt-2 font-medium">Toplam Efor: <span className="text-white">{kpiToplamSure} dk</span></p></div>
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-5 rounded-2xl shadow-lg"><p className="text-xs md:text-sm text-gray-400 font-semibold mb-1">Duruşlu İş Sayısı</p><h3 className="text-2xl md:text-3xl font-bold text-red-400">{kpiDurusluIsSayisi} <span className="text-sm text-gray-500 font-normal">Adet</span></h3><p className="text-xs text-gray-500 mt-2 font-medium">Kritik Duruş: <span className="text-white">{kpiAylikDurus} dk</span></p></div>
                <div className="bg-gray-900 border border-orange-500/30 p-4 md:p-5 rounded-2xl shadow-[0_0_15px_rgba(249,115,22,0.1)] relative overflow-hidden flex flex-col justify-center"><div className="flex justify-between items-center border-b border-gray-700/50 pb-2 mb-2"><span className="text-xs md:text-sm text-green-400 font-bold">Toplam Çalışma:</span><span className="text-lg md:text-xl font-bold text-white">{kpiToplamSure} <span className="text-xs text-gray-400">dk</span></span></div><div className="flex justify-between items-center"><span className="text-xs md:text-sm text-red-400 font-bold">Toplam Duruş:</span><span className="text-lg md:text-xl font-bold text-white">{kpiAylikDurus} <span className="text-xs text-gray-400">dk</span></span></div></div>
                <div className="bg-gray-900 border border-blue-500/30 p-4 md:p-5 rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.1)] relative overflow-hidden"><p className="text-xs md:text-sm text-blue-300 font-semibold mb-1 relative z-10">Duruş Yüzdesi (Süre)</p><h3 className="text-2xl md:text-3xl font-bold text-blue-400 relative z-10">%{durusSureYuzde}</h3><p className="text-xs text-gray-400 mt-2 relative z-10">Toplam efora oranı</p></div>
                <div className="bg-gray-900 border border-purple-500/30 p-4 md:p-5 rounded-2xl shadow-[0_0_15px_rgba(168,85,247,0.1)] relative overflow-hidden col-span-2 md:col-span-1 lg:col-span-1">
                  <p className="text-xs md:text-sm text-purple-300 font-semibold mb-1 relative z-10">Tesis Geneli MTTR</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-purple-400 relative z-10">{globalMTTR} <span className="text-sm text-gray-500 font-normal">dk / İş</span></h3>
                  <p className="text-xs text-gray-400 mt-2 relative z-10">Ort. Müdahale Süresi</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-gray-900 border border-yellow-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-yellow-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-yellow-400 print:text-black flex items-center gap-2">⚡ Elektrik Tüketimi (kWh)</h2></div><select value={filterElektrikSayac} onChange={(e) => setFilterElektrikSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-yellow-500"><option value="">Tüm Elektrik Sayaçları</option>{elektrikSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikElektrik.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikElektrik}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#EAB308" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#EAB308" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
                <div className="bg-gray-900 border border-red-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-red-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-red-400 print:text-black flex items-center gap-2">🔥 Doğalgaz Tüketimi (m³)</h2></div><select value={filterDogalgazSayac} onChange={(e) => setFilterDogalgazSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-red-500"><option value="">Tüm Doğalgaz Sayaçları</option>{dogalgazSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikDogalgaz.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDogalgaz}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#EF4444" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#EF4444" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
                <div className="bg-gray-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg border-t-4 border-t-blue-500"><div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2"><h2 className="text-sm font-bold text-blue-400 print:text-black flex items-center gap-2">💧 Su Tüketimi (Ton)</h2></div><select value={filterSuSayac} onChange={(e) => setFilterSuSayac(e.target.value)} className="w-full bg-gray-800 border-gray-700 text-gray-300 rounded-lg p-2 text-xs mb-4 no-print focus:border-blue-500"><option value="">Tüm Su Sayaçları</option>{suSayacListesi.map(s => <option key={s} value={s}>{s}</option>)}</select>{grafikSu.length === 0 ? <div className="h-40 flex justify-center items-center text-gray-500 text-xs border border-dashed border-gray-800 rounded-lg">Veri yok</div> : (<div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikSu}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="ay" tick={{fontSize: 10, fill: '#9CA3AF'}} /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} width={35} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} /><Bar name="Tüketim" dataKey="tuketim" fill="#3B82F6" maxBarSize={40}><LabelList dataKey="tuketim" position="top" fill="#3B82F6" fontSize={10} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>)}</div>
                            </div>

              {/* YENİ EKLENEN: EN SIK DURUŞ YAPAN EKİPMANLAR (BAD ACTORS) */}
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 print-break">
                <h2 className="text-xl font-bold mb-6 text-red-400 print:text-black flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  En Sık Duruş Yapan Ekipmanlar (Bad Actors Matrisi)
                </h2>
                
                {/* Ekipman Filtreleri */}
                <div className="bg-gray-800 border-gray-700 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end no-print">
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-400 mb-1">Yıl</label>
                    <select value={filterEqYil} onChange={(e) => setFilterEqYil(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm">
                      <option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-400 mb-1">Ay</label>
                    <select value={filterEqAy} onChange={(e) => setFilterEqAy(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm">
                      <option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option>
                      <option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option>
                      <option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option>
                      <option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
                    <select value={filterEqHat} onChange={(e) => setFilterEqHat(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm">
                      <option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-xs text-red-400 mb-1 font-bold">Listeleme</label>
                    <select value={filterEqLimit} onChange={(e) => setFilterEqLimit(e.target.value)} className="w-full bg-red-900/30 text-red-400 rounded-lg p-2 text-sm font-bold border border-red-800/50">
                      <option value="5">İlk 5 (Top 5)</option>
                      <option value="10">İlk 10 (Top 10)</option>
                      <option value="all">Tümünü Göster</option>
                    </select>
                  </div>
                  <button onClick={() => { setFilterEqYil(""); setFilterEqAy(""); setFilterEqHat(""); setFilterEqLimit("5"); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm md:text-base">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                        <th className="pb-3 px-2 md:px-4">#</th>
                        <th className="pb-3 px-2 md:px-4">Ekipman Adı</th>
                        <th className="pb-3 px-2 md:px-4">Bulunduğu Hat</th>
                        <th className="pb-3 px-2 md:px-4">Duruş Sayısı</th>
                        <th className="pb-3 px-2">Top. Duruş Süresi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ekipmanPerformans.length > 0 ? ekipmanPerformans.map((eq, index) => (
                        <tr key={index} className="border-b border-gray-800 print:border-gray-300 hover:bg-gray-800/50 transition">
                          <td className="py-4 px-2 md:px-4 font-bold text-gray-500 print:text-black">{index + 1}</td>
                          <td className="py-4 px-2 md:px-4 font-bold text-red-400 print:text-black">{eq.ekipman}</td>
                          <td className="py-4 px-2 md:px-4 text-gray-300 print:text-black">{eq.hat}</td>
                          <td className="py-4 px-2 md:px-4 font-bold text-white print:text-black">{eq.count} <span className="text-xs text-gray-500 font-normal">Kez</span></td>
                          <td className="py-4 px-2 md:px-4 text-orange-400 print:text-black">{eq.sure} dk</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="py-8 text-center text-gray-500">Seçili filtrelere uygun duruşlu arıza kaydı bulunamadı.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-900 border border-blue-700/50 p-5 rounded-2xl mb-6 flex flex-wrap gap-4 items-end no-print shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <div className="w-full mb-1 border-b border-gray-800 pb-2"><h3 className="text-blue-500 font-bold flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg> Arıza ve Bakım Filtreleri</h3></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Yıl</label><select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ay</label><select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label><select value={filterHat} onChange={(e) => { setFilterHat(e.target.value); setFilterEkipman(""); }} className="w-full bg-gray-800 rounded-lg p-2 text-sm"><option value="">Tümü</option>{hatListesi.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ekipman</label><select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="w-full bg-gray-800 rounded-lg p-2 text-sm disabled:opacity-50"><option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{ekipmanListesi.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                <button onClick={() => {setFilterYil(""); setFilterAy(""); setFilterHat(""); setFilterEkipman("");}} className="bg-red-900/40 text-red-400 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
              </div>

              
              <div className="bg-gray-900 border border-gray-800 p-6 rounded-3xl mb-8 shadow-lg">
                <h2 className="text-lg font-bold text-indigo-400 mb-6 flex items-center gap-2">📊 Kök Neden Dağılımı (5M)</h2>
                {rcaLogs.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={RCA_CATEGORIES.map(c => ({ name: c.label, value: rcaLogs.filter(r => r.category === c.id).length, color: c.color })).filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value">{RCA_CATEGORIES.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                    <div className="space-y-2">{RCA_CATEGORIES.map(c => { const count = rcaLogs.filter(r => r.category === c.id).length; if(count === 0) return null; return ( <div key={c.id} className="flex justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50"><span className="text-[10px] text-gray-400 font-bold uppercase">{c.label}</span><span className="text-xs font-black text-white">{count} Vaka</span></div>); })}</div>
                  </div>
                ) : <div className="py-12 text-center text-gray-600 text-xs italic">Analiz bekleniyor...</div>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl"><h2 className="text-lg font-bold mb-6 text-green-400 print:text-black">Yapılan İşler</h2>{grafikTumIslerVerisi.length > 0 ? (<div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikTumIslerVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" /><Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} /><Bar name="İş Adedi" dataKey="adet" fill="#10B981" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#10B981" fontSize={11} fontWeight="bold" /></Bar><Bar name="Süre (Dk)" dataKey="dakika" fill="#3B82F6" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#3B82F6" fontSize={11} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>) : <div className="h-48 flex justify-center items-center text-gray-500 border border-dashed border-gray-800 rounded-xl">Veri yok</div>}</div>
                <div className="bg-gray-900 border border-gray-800 p-4 md:p-6 rounded-2xl"><h2 className="text-lg font-bold mb-6 text-red-400 print:text-black">Sadece Duruşlu Arızalar</h2>{grafikDurusVerisi.length > 0 ? (<div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafikDurusVerisi} margin={{ top: 25, right: 5, left: -25, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="isim" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0} angle={-15} textAnchor="end" /><YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} /><Tooltip content={<OzelTooltip />} cursor={{fill: '#374151', opacity: 0.3}} trigger="hover" /><Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} /><Bar name="Duruş Adedi" dataKey="adet" fill="#F59E0B" maxBarSize={40}><LabelList dataKey="adet" position="top" fill="#F59E0B" fontSize={11} fontWeight="bold" /></Bar><Bar name="Süre (Dk)" dataKey="dakika" fill="#EF4444" maxBarSize={40}><LabelList dataKey="dakika" position="top" fill="#EF4444" fontSize={11} fontWeight="bold" /></Bar></BarChart></ResponsiveContainer></div>) : <div className="h-48 flex justify-center items-center text-gray-500 border border-dashed border-gray-800 rounded-xl">Veri yok</div>}</div>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl print-break">
                <h2 className="text-xl font-bold mb-6 text-blue-400 print:text-black">Personel Performans Matrisi</h2>
                <div className="bg-gray-800 border-gray-700 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end no-print">
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Yıl</label><select value={filterPerfYil} onChange={(e) => setFilterPerfYil(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option>{yilListesi.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Ay</label><select value={filterPerfAy} onChange={(e) => setFilterPerfAy(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option><option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option><option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option><option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Vardiya</label><select value={filterPerfVardiya} onChange={(e) => setFilterPerfVardiya(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="08:00 - 16:00">08:00 - 16:00</option><option value="16:00 - 24:00">16:00 - 24:00</option><option value="24:00 - 08:00">24:00 - 08:00</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Personel Seçimi</label><select value={filterPerfPersonel} onChange={(e) => setFilterPerfPersonel(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tüm Ekipler</option>{personelHavuzu.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-gray-400 mb-1">Arıza Tipi</label><select value={filterPerfDurus} onChange={(e) => setFilterPerfDurus(e.target.value)} className="w-full bg-gray-900 rounded-lg p-2 text-sm"><option value="">Tümü</option><option value="duruslu">Duruşlu</option><option value="durussuz">Duruşsuz</option></select></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs text-blue-400 mb-1 font-bold">Sıralama</label><select value={filterPerfSiralama} onChange={(e) => setFilterPerfSiralama(e.target.value)} className="w-full bg-blue-900/30 text-blue-400 rounded-lg p-2 text-sm font-bold"><option value="is">En Çok İş</option><option value="efor">En Çok Efor</option></select></div>
                  <button onClick={() => { setFilterPerfYil(""); setFilterPerfAy(""); setFilterPerfVardiya(""); setFilterPerfPersonel(""); setFilterPerfDurus(""); setFilterPerfSiralama("is"); }} className="bg-gray-700 px-4 py-2 rounded-lg text-sm h-9">Sıfırla</button>
                </div>
                <p className="hidden print:block pdf-top5-mesaj mb-2">* Bu rapor otomatik olarak en yüksek performans gösteren ilk 5 personeli listelemektedir.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm md:text-base">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 print:text-black">
                        <th className="pb-3 px-2 md:px-4">Teknisyen Adı</th><th className="pb-3 px-2 md:px-4">Toplam İş</th><th className="pb-3 px-2 md:px-4">Toplam Efor</th><th className="pb-3 px-2">MTTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personelPerformans.map((p, index) => {
                        const ortalama = p.isSayisi > 0 ? (p.eforDk / p.isSayisi).toFixed(1) : "0";
                        return (
                          <tr key={index} className="border-b border-gray-800 print:border-gray-300 perf-row hover:bg-gray-800/50 transition">
                            <td className="py-4 px-2 md:px-4 font-medium text-blue-300 print:text-black">{index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : ""}{p.isim}</td>
                            <td className="py-4 px-2 md:px-4 text-green-400 print:text-black">{p.isSayisi} Adet</td>
                            <td className="py-4 px-2 md:px-4 text-gray-300 print:text-black">{p.eforDk} Dakika</td>
                            <td className="py-4 px-2 md:px-4 text-orange-400 print:text-black">~ {ortalama} dk / İş</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {showRcaModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex justify-center items-center z-[999] p-4">
          <div className="bg-gray-900 border border-indigo-500/30 p-8 rounded-[40px] w-full max-w-xl shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-1 uppercase tracking-tighter">Kök Neden Raporu</h2>
            <p className="text-[10px] text-gray-500 mb-6 uppercase tracking-widest">{selectedLogForRca?.ekipmanAdi} | {selectedLogForRca?.toplamSureDakika} dk Duruş</p>
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">{RCA_CATEGORIES.map(c => ( <button key={c.id} onClick={() => setRcaForm({...rcaForm, category: c.id})} className={`p-2.5 rounded-xl text-[9px] font-bold border transition ${rcaForm.category === c.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-indigo-500'}`}>{c.label}</button> ))}</div>
              <textarea value={rcaForm.why} onChange={e => setRcaForm({...rcaForm, why: e.target.value})} placeholder="Arıza nedenini ve aksiyon planını girin..." className="w-full bg-gray-800 border-gray-700 rounded-2xl p-4 text-xs h-40 text-white outline-none focus:ring-1 ring-indigo-500" />
              <div className="flex gap-4">
                <button onClick={() => setShowRcaModal(false)} className="flex-1 bg-gray-800 py-4 rounded-2xl font-bold text-xs text-gray-400 transition">Vazgeç</button>
                <button onClick={handleSaveRca} className="flex-1 bg-indigo-600 py-4 rounded-2xl font-bold text-xs text-white">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
