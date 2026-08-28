'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TechnicianDashboard({ user }: { user?: any }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Admin veya kullanıcı verisi gelene kadar bekle, admin her türlü girebilir
  if (!mounted) return <div className="p-10 text-center">Yükleniyor...</div>;

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isTech = role === 'teknisyen';
  const isISG = role === 'isg';

  // Admin ve Teknisyenin gördüğü ortak alanlar
  const showFullAccess = isAdmin || isTech;

  return (
    <div className="flex flex-col min-h-screen p-4 bg-gray-50">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        
        {/* Admin veya Teknisyen ise görünecek butonlar */}
        {showFullAccess && (
          <>
            <button onClick={() => router.push('/kontrol-formlari')} className="p-4 bg-white shadow rounded">kontrol formları</button>
            <button onClick={() => router.push('/periyodik-bakim')} className="p-4 bg-white shadow rounded">periyodik bakım</button>
            <button onClick={() => router.push('/manuel-pm')} className="p-4 bg-white shadow rounded">manuel pm</button>
            <button onClick={() => router.push('/sayac-okuma')} className="p-4 bg-white shadow rounded">sayaç okuma</button>
            <button onClick={() => router.push('/mesai-girisi')} className="p-4 bg-white shadow rounded">mesai girişi</button>
            <button onClick={() => router.push('/mesailerim')} className="p-4 bg-white shadow rounded">mesailerim</button>
            <button onClick={() => router.push('/yapilan-isler')} className="p-4 bg-white shadow rounded">yapılan işler</button>
            <button onClick={() => router.push('/bakim-ligi')} className="p-4 bg-white shadow rounded">bakım ligi</button>
          </>
        )}

        {/* Admin, Teknisyen veya İSG ise görünecek butonlar */}
        <button onClick={() => router.push('/pano-temizligi')} className="p-4 bg-white shadow rounded">pano temizliği</button>
        <button onClick={() => router.push('/eked-takip')} className="p-4 bg-white shadow rounded">eked takip</button>

        {/* İSG veya Admin ise ek butonlar görünür */}
        {(isISG || isAdmin) && (
          <>
            <button onClick={() => router.push('/kar-arsivi')} className="p-4 bg-blue-50 border border-blue-200 shadow rounded">kar arşivi</button>
            <button onClick={() => router.push('/isg-duyuru')} className="p-4 bg-blue-50 border border-blue-200 shadow rounded">İSG duyuru</button>
          </>
        )}
      </div>

      <div className="flex flex-col space-y-4">
        {/* Admin veya Teknisyen bölümleri */}
        {showFullAccess && (
          <>
            <div className="p-4 border rounded bg-white shadow-sm">saha bildirimleri</div>
            <div className="p-4 border rounded bg-white shadow-sm">rapor girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm">yedek parça sarf malzeme kullanımı</div>
            <div className="p-4 border rounded bg-white shadow-sm">zaman girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm">açıklama</div>
          </>
        )}

        {/* Herkesin gördüğü kritik alarmlar */}
        <div className="p-4 border border-red-200 rounded bg-red-50 text-red-700 font-bold">kritik isg alarmları</div>
        <div className="p-4 border border-yellow-200 rounded bg-yellow-50 text-yellow-700 font-bold">aktif eked bildirimleri</div>
      </div>
    </div>
  );
}