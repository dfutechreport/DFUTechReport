"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase"; 
import Link from "next/link";

export default function PeriyodikBakimTakvimi() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [takvimVerisi, setTakvimVerisi] = useState<any[]>([]);
  const [gosterilenVeri, setGosterilenVeri] = useState<any[]>([]);
  
  const [seciliAy, setSeciliAy] = useState("");
  const [seciliHat, setSeciliHat] = useState("");
  const [seciliDurum, setSeciliDurum] = useState("");

  const [hatListesi, setHatListesi] = useState<string[]>([]);

  // Excel'den yapay zeka ile çıkartılan, orijinal 165 satırlık KESİN 2026 BAKIM TARİHLERİ
  const excelMasterData = [
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "König Şekillendirme" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "König Şekillendirme" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Fermantasyon" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Fermantasyon" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Kesme" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Kesme" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Fırın" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Fırın" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Soğutma" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Soğutma" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Şoklama" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Şoklama" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Depanner" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Depanner" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-02-15", "hat": "SMALL PIECES", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-08-16", "hat": "SMALL PIECES", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Trivi İşleme" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Trivi İşleme" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Rademaker İşleme" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Rademaker İşleme" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "König porsiyonlama" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Fermantasyon" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Fermantasyon" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Fırın" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Fırın" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Dekorlama" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Dekorlama" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Şoklama" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Şoklama" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-01-18", "hat": "PASTRY", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-09-13", "hat": "PASTRY", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Kestart" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Fırın" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Soğutma" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Şoklama" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-02-01", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-08-02", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-12-20", "hat": "SERBEST EKMEK - STRESS FREE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Kestart" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Kestart" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Ara Dinlendirme" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Şekillendirme" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Şekillendirme" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Fermantasyon" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Fermantasyon" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Fırın" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Fırın" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Soğutma" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Soğutma" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Şoklama" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Şoklama" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-08", "hat": "SİMİT  HATTI", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-10-11", "hat": "SİMİT  HATTI", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Mikser" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Mikser" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Rheon" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Rheon" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Anko" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Anko" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Fırın" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Fırın" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "U Dönüş Modüler Bant" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "U Dönüş Modüler Bant" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Freezer" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Freezer" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Freezer Çıkış Palent Bant" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Freezer Çıkış Palent Bant" },
    { "tarih": "2026-05-03", "hat": "KURABİYE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-11-01", "hat": "KURABİYE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Mikser ve Asansör" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Kestart" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Konik Çevirme" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Şekillendirme" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Dinlendirme" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Fermantasyon" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Kesme" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Fırın" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Soğutma" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Şoklama" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Depanner" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Konveyörler" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Tava Kurutma" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Metal Dedektör" },
    { "tarih": "2026-03-22", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-07-19", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-11-29", "hat": "MULTILINE", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-01-04", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-05-17", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-12-27", "hat": "KEK", "ekipman": "Mikser" },
    { "tarih": "2026-01-04", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-05-17", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-12-27", "hat": "KEK", "ekipman": "Depozitör" },
    { "tarih": "2026-01-04", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-05-17", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-12-27", "hat": "KEK", "ekipman": "Fırın" },
    { "tarih": "2026-01-04", "hat": "KEK", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-05-17", "hat": "KEK", "ekipman": "Paketleme Makinaları" },
    { "tarih": "2026-12-27", "hat": "KEK", "ekipman": "Paketleme Makinaları" }
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAdmin(true); 
        loadExcelData();
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const loadExcelData = () => {
    setLoading(true);
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0); 

    const hatlar = new Set<string>();

    const islenmisVeri = excelMasterData.map(item => {
      hatlar.add(item.hat);
      
      const planTarihi = new Date(item.tarih);
      const ayStr = (planTarihi.getMonth() + 1).toString();
      
      // Eğer planlanan tarih bugünden önceyse, bu iş YAPILMIŞ (Tamamlanmış) sayılır.
      const isTamamlandi = planTarihi < bugun;

      return {
        ...item,
        tarihObj: planTarihi,
        tarihStr: planTarihi.toLocaleDateString('tr-TR'),
        ay: ayStr,
        durum: isTamamlandi ? "Tamamlandı" : "Bekliyor"
      };
    });

    islenmisVeri.sort((a, b) => a.tarihObj.getTime() - b.tarihObj.getTime());

    setHatListesi(Array.from(hatlar).sort());
    setTakvimVerisi(islenmisVeri);
    setGosterilenVeri(islenmisVeri);
    setLoading(false);
  };

  useEffect(() => {
    let filtrelenmis = takvimVerisi;
    if (seciliAy) {
      filtrelenmis = filtrelenmis.filter(v => v.ay === seciliAy);
    }
    if (seciliHat) {
      filtrelenmis = filtrelenmis.filter(v => v.hat === seciliHat);
    }
    if (seciliDurum) {
      filtrelenmis = filtrelenmis.filter(v => v.durum === seciliDurum);
    }
    setGosterilenVeri(filtrelenmis);
  }, [seciliAy, seciliHat, seciliDurum, takvimVerisi]);

  const exportToExcel = () => {
    if (gosterilenVeri.length === 0) return alert("Dışa aktarılacak veri bulunamadı.");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Planlanan Tarih;Durum;Üretim Hatti;Ekipman Adi\n";

    gosterilenVeri.forEach(row => {
      csvContent += `${row.tarihStr};${row.durum};${row.hat};${row.ekipman}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Yillik_Bakim_Plani_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Yıllık Excel Verisi Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-gray-900 border border-teal-500/50 rounded-2xl shadow-2xl p-6 md:p-10">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6 gap-4">
          <div>
            <p className="text-teal-500 font-bold mb-1 text-sm tracking-wider uppercase">Excel Master Data Entegrasyonu</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              Yıllık Planlı Bakım Takvimi (2026)
            </h1>
            <p className="text-gray-400 mt-2 text-sm">Gerçekleşen (Geçmiş) ve Bekleyen (Gelecek) bakım durumlarının otomatik renkli haritası.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={exportToExcel} className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Excel (CSV) İndir
            </button>
            <Link href="/admin" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition flex items-center">← Panele Dön</Link>
          </div>
        </div>

        {/* Filtreleme Alanı */}
        <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-xl mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Ay Filtresi</label>
            <select value={seciliAy} onChange={(e) => setSeciliAy(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tüm Yıl</option>
              <option value="1">Ocak</option><option value="2">Şubat</option><option value="3">Mart</option>
              <option value="4">Nisan</option><option value="5">Mayıs</option><option value="6">Haziran</option>
              <option value="7">Temmuz</option><option value="8">Ağustos</option><option value="9">Eylül</option>
              <option value="10">Ekim</option><option value="11">Kasım</option><option value="12">Aralık</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Üretim Hattı</label>
            <select value={seciliHat} onChange={(e) => setSeciliHat(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tüm Hatlar</option>
              {hatListesi.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 mb-1">Durum</label>
            <select value={seciliDurum} onChange={(e) => setSeciliDurum(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm focus:border-teal-500">
              <option value="">Tümü</option>
              <option value="Tamamlandı">✅ Yapılmış (Geçmiş)</option>
              <option value="Bekliyor">⏳ Bekleyen (Gelecek)</option>
            </select>
          </div>
          <button onClick={() => { setSeciliAy(""); setSeciliHat(""); setSeciliDurum(""); }} className="bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold hover:bg-gray-600 transition">Sıfırla</button>
        </div>

        {/* Takvim Tablosu */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold text-white">Listelenen Bakım Adedi: <span className="text-teal-400">{gosterilenVeri.length} İşlem</span></h3>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-800 shadow-md z-10">
                <tr className="text-gray-400">
                  <th className="py-4 px-4 border-b border-gray-700">Planlanan Tarih</th>
                  <th className="py-4 px-4 border-b border-gray-700">Sistem Durumu</th>
                  <th className="py-4 px-4 border-b border-gray-700">Üretim Hattı</th>
                  <th className="py-4 px-4 border-b border-gray-700">Ekipman</th>
                </tr>
              </thead>
              <tbody>
                {gosterilenVeri.length > 0 ? gosterilenVeri.map((row, index) => (
                  <tr key={index} className={`border-b border-gray-800 transition hover:bg-gray-800/80 ${row.durum === 'Tamamlandı' ? 'bg-green-900/10' : 'bg-orange-900/10'}`}>
                    <td className="py-4 px-4 font-bold text-white whitespace-nowrap">📅 {row.tarihStr}</td>
                    <td className="py-4 px-4">
                      {row.durum === "Tamamlandı" ? (
                        <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-800/50 flex items-center w-max gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Yapıldı
                        </span>
                      ) : (
                        <span className="bg-orange-900/40 text-orange-400 px-3 py-1 rounded-full text-xs font-bold border border-orange-800/50 flex items-center w-max gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Bekliyor
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-300 font-medium">{row.hat}</td>
                    <td className="py-4 px-4 font-bold text-teal-300">{row.ekipman}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500">Seçili filtrelere uygun planlı bakım bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}