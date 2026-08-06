"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, writeBatch, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import Link from "next/link";
import { useForm } from "react-hook-form";

function DashboardIcerik() {
  // --- MEVCUT FORM VE DURUM STATE'LERİ ---
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm();
  const [userName, setUserName] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [hesaplananSure, setHesaplananSure] = useState(0);

  // --- YENİ EKLENEN: HİBRİT STOK SORGU STATE'LERİ ---
  const [manualStockSearch, setManualStockSearch] = useState("");
  const handleManualStockSearch = () => {
    if (!manualStockSearch.trim()) return;
    window.location.href = `/admin/yedek-parca?q=${encodeURIComponent(manualStockSearch)}`;
  };

  // --- MEVCUT FONKSİYONLARINIZ (Özetlenmiş/Korunmuş) ---
  const sesliYazimBaslat = () => {
    // Mevcut sesli yazım mantığınız buradadır
    setIsDictating(!isDictating);
  };

  const onSubmit = async (data: any) => {
    // Mevcut kayıt mantığınız buradadır
    console.log("Kaydediliyor...", data);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 md:p-10 shadow-2xl">
          <h1 className="text-2xl font-black mb-8 border-b border-gray-800 pb-5 text-teal-400">Vardiya / İş Bitirme Raporu</h1>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* ... Diğer form alanlarınız (Hat, Ekipman vb.) buradadır ... */}

            {/* SESLİ YAZDIRMA DESTEKLİ AÇIKLAMA KUTUSU */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-medium text-gray-400">Açıklama / Yapılan İşlem</label>
                <button 
                  type="button" 
                  onClick={sesliYazimBaslat}
                  className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md ${isDictating ? 'bg-red-600 animate-pulse text-white' : 'bg-gray-800 hover:bg-gray-700 text-teal-400 border border-gray-600'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  {isDictating ? "Sizi Dinliyor..." : "Sesle Yazdır"}
                </button>
              </div>
              <textarea 
                {...register("aciklama")} 
                rows={4} 
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-teal-500" 
                placeholder="Açıklamayı klavyeyle yazabilir veya mikrofon butonuna basarak söyleyebilirsiniz..." 
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-4 rounded-xl disabled:opacity-50 transition-all">
              {isSubmitting ? "Kaydediliyor..." : "Performansıma Kaydet ve İşi Bitir"}
            </button>
          </form>
        </div>
      </div>

      {/* --- YÜZER HİBRİT STOK SORGU PANELİ --- */}
      <div className="fixed bottom-6 right-6 z-[900] flex flex-col items-end gap-3 no-print">
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.6)] flex items-center gap-4 transition-all border border-indigo-400/30">
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Stok Sorgula</span>
          
          <div className="flex items-center bg-black/20 rounded-xl px-3 border border-white/10">
            <input 
              type="text" 
              value={manualStockSearch} 
              onChange={(e) => setManualStockSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualStockSearch()}
              placeholder="Parça adı/kod..." 
              className="bg-transparent text-[10px] text-white w-28 sm:w-44 py-2 outline-none placeholder-indigo-300"
            />
            <button onClick={handleManualStockSearch} className="ml-2 text-indigo-200 hover:text-white transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </button>
          </div>

          <Link href="/admin/yedek-parca/sesli" className="p-2 hover:bg-indigo-500 rounded-full transition-all border border-transparent hover:border-white/20 relative group">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            <div className="absolute bottom-12 right-0 bg-black/90 text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">Sesli Sorgu</div>
          </Link>
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
