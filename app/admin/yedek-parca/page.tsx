"use client";

import { useState, useEffect } from "react";
import { collection, writeBatch, doc, getDocs, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase"; 
import * as XLSX from "xlsx";
import Link from "next/link";

export default function YedekParcaYoneticisi() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  const [isAdminOrDepo, setIsAdminOrDepo] = useState(false);

  // Veri Listeleri
  const [kullanilanMalzemeler, setKullanilanMalzemeler] = useState<any[]>([]);
  const [gosterilenMalzemeler, setGosterilenMalzemeler] = useState<any[]>([]);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);

  // Geri Sayım State'leri
  const [sonYuklemeZamani, setSonYuklemeZamani] = useState<Date | null>(null);
  const [beklemeSuresiVar, setBeklemeSuresiVar] = useState(false);
  const [kalanZamanMetni, setKalanZamanMetni] = useState("");

  // YENİ EKLENEN: Filtre State'leri
  const [searchStokKodu, setSearchStokKodu] = useState("");
  const [filterYil, setFilterYil] = useState("");
  const [filterAy, setFilterAy] = useState("");
  const [filterGun, setFilterGun] = useState("");
  const [filterHat, setFilterHat] = useState("");
  const [filterEkipman, setFilterEkipman] = useState("");
  const [filterPersonel, setFilterPersonel] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().isApproved) {
          const role = userSnap.data().role;
          setUserRole(role);
          setUserName(userSnap.data().name);
          if (role === "admin" || role === "depo") {
            setIsAdminOrDepo(true);
            checkLastUploadTime(); 
          } else {
            window.location.href = "/dashboard";
          }
        }
      } else {
        window.location.href = "/";
      }
    });
    return () => unsubscribe();
  }, []);

  const checkLastUploadTime = async () => {
    try {
      const uploadLogRef = doc(db, "system_logs", "excel_upload");
      const uploadLogSnap = await getDoc(uploadLogRef);
      if (uploadLogSnap.exists() && uploadLogSnap.data().lastUpload) {
        setSonYuklemeZamani(uploadLogSnap.data().lastUpload.toDate());
      }
    } catch (error) {
      console.error("Zaman kontrol hatası:", error);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const zamaniHesapla = () => {
      if (!sonYuklemeZamani) return;
      const simdikiZaman = new Date().getTime();
      const bitisZamani = sonYuklemeZamani.getTime() + (24 * 60 * 60 * 1000); 
      const kalanFarkMs = bitisZamani - simdikiZaman;

      if (kalanFarkMs > 0) {
        setBeklemeSuresiVar(true);
        const saat = Math.floor((kalanFarkMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const dakika = Math.floor((kalanFarkMs % (1000 * 60 * 60)) / (1000 * 60));
        const saniye = Math.floor((kalanFarkMs % (1000 * 60)) / 1000);
        setKalanZamanMetni(`${saat.toString().padStart(2, '0')}:${dakika.toString().padStart(2, '0')}:${saniye.toString().padStart(2, '0')}`);
      } else {
        setBeklemeSuresiVar(false);
        setKalanZamanMetni("");
      }
    };
    if (sonYuklemeZamani) {
      zamaniHesapla(); 
      timer = setInterval(zamaniHesapla, 1000); 
    }
    return () => clearInterval(timer);
  }, [sonYuklemeZamani]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (beklemeSuresiVar) {
      alert("Hata: 24 saatlik süre henüz dolmadı!");
      e.target.value = '';
      return;
    }

    if (!window.confirm("Bu işlem Excel'deki tüm stokları veritabanına yazacak/güncelleyecektir. Emin misiniz?")) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const islenecekData = jsonData.map((row: any) => ({
        stokKodu: String(row["Malzeme"]).trim(),
        parcaAdi: row["Malzeme kısa metni"] || "Bilinmeyen Parça",
        mevcutMiktar: Number(row["Tahditsiz klnb."]) || 0,
        birim: row["Temel ölçü birimi"] || "Adet",
        kritikSeviye: 2 
      })).filter((d: any) => d.stokKodu !== "undefined" && d.stokKodu !== "");

      const toplam = islenecekData.length;
      let islenen = 0;
      const CHUNK_SIZE = 250; 

      for (let i = 0; i < toplam; i += CHUNK_SIZE) {
        const chunk = islenecekData.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(collection(db, "spare_parts"), item.stokKodu);
          batch.set(docRef, item, { merge: true });
        });
        await batch.commit();
        islenen += chunk.length;
        setProgress(Math.floor((islenen / toplam) * 100));
        await new Promise((resolve) => setTimeout(resolve, 500)); 
      }

      const simdi = new Date();
      await setDoc(doc(db, "system_logs", "excel_upload"), { lastUpload: simdi, uploadedBy: userName, role: userRole });
      setSonYuklemeZamani(simdi); 

      alert(`✅ BAŞARILI! Toplam ${toplam} adet yedek parça stoğu sisteme aktarıldı.`);
      e.target.value = ''; 

    } catch (error) {
      console.error(error);
      alert("Yükleme sırasında hata oluştu!");
    }
    setLoading(false);
  };

  const fetchKullanilanMalzemeler = async () => {
    setListeYukleniyor(true);
    try {
      const partsSnap = await getDocs(collection(db, "spare_parts"));
      const partsMap: Record<string, string> = {};
      partsSnap.forEach(d => { partsMap[d.id] = d.data().parcaAdi; });

      const logsSnap = await getDocs(collection(db, "maintenance_logs"));
      const usedPartsList: any[] = [];

      logsSnap.forEach(d => {
        const data = d.data();
        if (data.yedekParcaKodu && Number(data.yedekParcaMiktar) > 0) {
          const tObj = data.kayitTarihi ? data.kayitTarihi.toDate() : new Date();
          usedPartsList.push({
            id: d.id,
            tarihObj: tObj,
            tarihStr: tObj.toLocaleString('tr-TR'),
            stokKodu: String(data.yedekParcaKodu),
            parcaAdi: partsMap[data.yedekParcaKodu] || "İsimsiz Parça",
            miktar: Number(data.yedekParcaMiktar),
            birim: data.yedekParcaBirim || "Adet",
            hat: data.hatAdi || "-",
            ekipman: data.ekipmanAdi || "-",
            personel: Array.isArray(data.isiYapanlar) ? data.isiYapanlar.join(", ") : (data.bildirenKisi || "-")
          });
        }
      });

      usedPartsList.sort((a, b) => b.tarihObj.getTime() - a.tarihObj.getTime());
      setKullanilanMalzemeler(usedPartsList);
      setGosterilenMalzemeler(usedPartsList);

    } catch (error) {
      console.error("Malzemeler çekilirken hata:", error);
    }
    setListeYukleniyor(false);
  };

  // YENİ EKLENEN: Filtreleme Algoritması
  useEffect(() => {
    let filtrelenmis = kullanilanMalzemeler;

    if (searchStokKodu) {
      filtrelenmis = filtrelenmis.filter(v => v.stokKodu.toLowerCase().includes(searchStokKodu.toLowerCase()) || v.parcaAdi.toLowerCase().includes(searchStokKodu.toLowerCase()));
    }
    if (filterYil) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && v.tarihObj.getFullYear().toString() === filterYil);
    }
    if (filterAy) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && (v.tarihObj.getMonth() + 1).toString() === filterAy);
    }
    if (filterGun) {
      filtrelenmis = filtrelenmis.filter(v => v.tarihObj && v.tarihObj.getDate().toString() === filterGun);
    }
    if (filterHat) {
      filtrelenmis = filtrelenmis.filter(v => v.hat === filterHat);
    }
    if (filterEkipman) {
      filtrelenmis = filtrelenmis.filter(v => v.ekipman === filterEkipman);
    }
    if (filterPersonel) {
      filtrelenmis = filtrelenmis.filter(v => v.personel.includes(filterPersonel));
    }

    setGosterilenMalzemeler(filtrelenmis);
  }, [searchStokKodu, filterYil, filterAy, filterGun, filterHat, filterEkipman, filterPersonel, kullanilanMalzemeler]);

  const resetFilters = () => {
    setSearchStokKodu(""); setFilterYil(""); setFilterAy(""); setFilterGun(""); setFilterHat(""); setFilterEkipman(""); setFilterPersonel("");
  };

  const exportKullanilanMalzemelerToXLSX = () => {
    if (gosterilenMalzemeler.length === 0) return alert("Dışa aktarılacak veri bulunamadı.");

    const excelData = gosterilenMalzemeler.map(p => ({
      "Kullanım Tarihi": p.tarihStr,
      "Stok Kodu": p.stokKodu,
      "Yedek Parça Adı": p.parcaAdi,
      "Miktar": p.miktar,
      "Birim": p.birim,
      "Kullanıldığı Hat": p.hat,
      "Kullanıldığı Ekipman": p.ekipman,
      "Kullanan Personel": p.personel
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kullanilan_Malzemeler");
    XLSX.writeFile(workbook, `Kullanilan_Yedek_Parcalar_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
  };

  // Dinamik Dropdown Listeleri
  const uniqueYillar = Array.from(new Set(kullanilanMalzemeler.map(i => i.tarihObj?.getFullYear().toString()).filter(Boolean))).sort();
  const uniqueHatlar = Array.from(new Set(kullanilanMalzemeler.map(i => i.hat))).filter(h => h !== "-").sort();
  const uniqueEkipmanlar = Array.from(new Set(kullanilanMalzemeler.filter(i => !filterHat || i.hat === filterHat).map(i => i.ekipman))).filter(e => e !== "-").sort();
  const uniquePersonel = Array.from(new Set(kullanilanMalzemeler.map(i => i.personel))).filter(p => p !== "-").sort();

  if (!isAdminOrDepo) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-white">Erişim Kontrolü...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <div className="bg-gray-900 border border-fuchsia-500/50 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-fuchsia-400 font-bold mb-1 text-sm tracking-wider uppercase">Tedarik Zinciri ve Envanter</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Yedek Parça & Depo Yönetimi</h1>
            <p className="text-gray-400 mt-2 text-sm">Hoş geldin <span className="text-fuchsia-300 font-bold">{userName}</span> (Yetki: {userRole.toUpperCase()})</p>
          </div>
          <Link href={userRole === "depo" ? "/depo" : "/admin"} className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg text-sm font-bold transition flex items-center shadow-lg">← Panele Dön</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* SOL PANEL (Çeyrek Ekran): EXCEL YÜKLEME */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-700 p-6 rounded-2xl shadow-xl flex flex-col justify-start items-center text-center">
            <div className="bg-fuchsia-900/20 p-4 rounded-full mb-4 mt-2">
              <svg className="w-10 h-10 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
            <h2 className="text-lg text-white font-bold mb-2">Master Stok Yükle</h2>
            
            {beklemeSuresiVar ? (
              <div className="w-full mt-4 p-4 bg-red-900/20 border border-red-800/50 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.15)]">
                <p className="text-red-400 text-xs font-bold mb-2">YENİ YÜKLEME İÇİN KALAN SÜRE</p>
                <div className="text-3xl font-black text-red-500 tracking-wider font-mono animate-pulse">
                  {kalanZamanMetni}
                </div>
                <p className="text-gray-500 text-[10px] mt-2">24 saat kuralı gereği buton kilitlidir.</p>
              </div>
            ) : (
              <div className="w-full mt-2">
                <p className="text-xs text-green-400 font-bold mb-4 border border-green-900/50 bg-green-900/10 p-2 rounded">
                  ✅ Yükleme işlemine izin verildi.
                </p>
                <label className="w-full cursor-pointer bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-lg block">
                  {loading ? `Yükleniyor... (%${progress})` : "Excel (.xlsx) Seç ve Yükle"}
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={loading} />
                </label>
              </div>
            )}
            
            {loading && (
              <div className="w-full bg-gray-800 rounded-full h-2 mt-4 overflow-hidden">
                <div className="bg-fuchsia-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}
          </div>

          {/* SAĞ PANEL (3 Çeyrek Ekran): KULLANILAN MALZEMELER VE FİLTRELER */}
          <div className="lg:col-span-3 bg-gray-900 border border-gray-700 p-6 rounded-2xl shadow-xl flex flex-col">
            
            {/* Üst Kısım: Başlık ve Ana Butonlar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                Kullanılan Malzemeler Dökümü
              </h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={fetchKullanilanMalzemeler} disabled={listeYukleniyor} className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-gray-600">
                  {listeYukleniyor ? "Veri Çekiliyor..." : "Veritabanından Listeyi Getir"}
                </button>
                <button onClick={exportKullanilanMalzemelerToXLSX} className="flex-1 sm:flex-none bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  XLSX İndir
                </button>
              </div>
            </div>

            {/* YENİ EKLENEN: Gelişmiş Filtreleme Bloğu */}
            {kullanilanMalzemeler.length > 0 && (
              <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-xl mb-4">
                <div className="mb-3">
                  <input 
                    type="text" 
                    placeholder="🔍 Stok Kodu veya Parça Adı ile ara..." 
                    value={searchStokKodu} 
                    onChange={(e) => setSearchStokKodu(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-sm text-white focus:border-fuchsia-500"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <select value={filterYil} onChange={(e) => setFilterYil(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs focus:border-fuchsia-500">
                    <option value="">Tüm Yıllar</option>{uniqueYillar.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select value={filterAy} onChange={(e) => setFilterAy(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs focus:border-fuchsia-500">
                    <option value="">Tüm Aylar</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}. Ay</option>)}
                  </select>
                  <select value={filterGun} onChange={(e) => setFilterGun(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs focus:border-fuchsia-500">
                    <option value="">Tüm Günler</option>
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={filterHat} onChange={(e) => {setFilterHat(e.target.value); setFilterEkipman("");}} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs focus:border-fuchsia-500">
                    <option value="">Tüm Hatlar</option>{uniqueHatlar.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select value={filterEkipman} onChange={(e) => setFilterEkipman(e.target.value)} disabled={!filterHat} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs disabled:opacity-50 focus:border-fuchsia-500">
                    <option value="">{filterHat ? "Tüm Ekipmanlar" : "Önce Hat Seçin"}</option>{uniqueEkipmanlar.map(ek => <option key={ek} value={ek}>{ek}</option>)}
                  </select>
                  <select value={filterPersonel} onChange={(e) => setFilterPersonel(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs focus:border-fuchsia-500">
                    <option value="">Tüm Personel</option>{uniquePersonel.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-xs text-fuchsia-400 font-bold">Bulunan Kayıt: {gosterilenMalzemeler.length}</span>
                  <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-white underline">Filtreleri Temizle</button>
                </div>
              </div>
            )}

            {/* Tablo Alanı */}
            <div className="flex-1 overflow-auto bg-gray-800/50 rounded-xl border border-gray-800 max-h-[450px]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-gray-800 shadow-md">
                  <tr className="text-gray-400">
                    <th className="py-3 px-4 border-b border-gray-700">Tarih</th>
                    <th className="py-3 px-4 border-b border-gray-700">Stok Kodu / Parça Adı</th>
                    <th className="py-3 px-4 border-b border-gray-700">Miktar</th>
                    <th className="py-3 px-4 border-b border-gray-700">Kullanıldığı Yer</th>
                    <th className="py-3 px-4 border-b border-gray-700">Kullanan</th>
                  </tr>
                </thead>
                <tbody>
                  {gosterilenMalzemeler.length > 0 ? gosterilenMalzemeler.map((row, index) => (
                    <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/80 transition">
                      <td className="py-3 px-4 text-gray-300 whitespace-nowrap">{row.tarihStr}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-fuchsia-300">{row.stokKodu}</div>
                        <div className="text-xs text-gray-400">{row.parcaAdi}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-red-400">{row.miktar} <span className="text-xs font-normal text-gray-500">{row.birim}</span></td>
                      <td className="py-3 px-4">
                        <div className="text-gray-200">{row.hat}</div>
                        <div className="text-xs text-teal-400">{row.ekipman}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{row.personel}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        {kullanilanMalzemeler.length === 0 ? "Görmek için 'Listeyi Getir' butonuna basınız." : "Filtrelere uygun kayıt bulunamadı."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}