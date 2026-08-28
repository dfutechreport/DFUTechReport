'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

// Not: 'user' bilgisinin projenizdeki global state (AuthContext vb.) 
// üzerinden geldiği varsayılmıştır.
interface User {
  name: string;
  role: 'admin' | 'teknisyen' | 'isg';
}

export default function TechnicianDashboard({ user }: { user: User }) {
  const router = useRouter();
  
  // Yetki Kontrolleri
  const isISG = user.role === 'isg';
  const isAdminOrTech = user.role === 'admin' || user.role === 'teknisyen';

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-50">
      {/* ÜST BUTON GRUBU - Grid yapısı korunmuştur */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        
        {/* İSG Yetkisinde GİZLENEN Butonlar */}
        {isAdminOrTech && (
          <>
            <button onClick={() => router.push('/kontrol-formlari')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">kontrol formları</button>
            <button onClick={() => router.push('/periyodik-bakim')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">periyodik bakım</button>
            <button onClick={() => router.push('/manuel-pm')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">manuel pm</button>
            <button onClick={() => router.push('/sayac-okuma')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">sayaç okuma</button>
            <button onClick={() => router.push('/mesai-girisi')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">mesai girişi</button>
            <button onClick={() => router.push('/mesailerim')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">mesailerim</button>
            <button onClick={() => router.push('/yapilan-isler')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">yapılan işler</button>
            <button onClick={() => router.push('/bakim-ligi')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">bakım ligi</button>
          </>
        )}

        {/* HER ZAMAN GÖRÜNEN Butonlar */}
        <button onClick={() => router.push('/pano-temizligi')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">pano temizliği</button>
        <button onClick={() => router.push('/eked-takip')} className="p-4 bg-white shadow rounded hover:bg-gray-100 transition">eked takip</button>

        {/* SADECE İSG YETKİSİ İLE AKTİF OLANLAR */}
        {isISG && (
          <>
            <button onClick={() => router.push('/kar-arsivi')} className="p-4 bg-blue-50 border border-blue-200 shadow rounded hover:bg-blue-100 transition">kar arşivi</button>
            <button onClick={() => router.push('/isg-duyuru')} className="p-4 bg-blue-50 border border-blue-200 shadow rounded hover:bg-blue-100 transition">İSG duyuru</button>
          </>
        )}
      </div>

      {/* SAYFA ALTI BÖLÜMLERİ */}
      <div className="flex flex-col space-y-4">
        
        {/* İSG Yetkisinde GİZLENEN Bölümler */}
        {isAdminOrTech && (
          <>
            <div className="p-4 border rounded bg-white shadow-sm" id="saha-bildirimleri">saha bildirimleri</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="rapor-girisi">rapor girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="yedek-parca">yedek parça sarf malzeme kullanımı</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="zaman-girisi">zaman girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="aciklama">açıklama</div>
          </>
        )}

        {/* İSG VE TEKNİSYEN İÇİN HER ZAMAN AKTİF OLANLAR */}
        <div className="p-4 border border-red-200 rounded bg-red-50 shadow-sm font-bold text-red-700" id="kritik-isg-alarmlari">kritik isg alarmları</div>
        <div className="p-4 border border-yellow-200 rounded bg-yellow-50 shadow-sm font-bold text-yellow-700" id="aktif-eked-bildirimleri">aktif eked bildirimleri</div>
      </div>
    </div>
  );
}