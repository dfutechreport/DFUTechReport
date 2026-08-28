'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// JSON verisindeki role yapısına uygun tip tanımlaması
interface User {
  name: string;
  role: 'admin' | 'teknisyen' | 'isg';
}

export default function DashboardPage({ user }: { user?: User }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydration hatasını önlemek için güvenli çıkış
  if (!mounted || !user) {
    return <div className="flex h-screen items-center justify-center font-sans">Yükleniyor...</div>;
  }

  const isAdmin = user.role === 'admin';
  const isTech = user.role === 'teknisyen';
  const isISG = user.role === 'isg';

  // Admin veya Teknisyen girişi yapıldığında eski halini (tam erişim) korur
  const hasFullAccess = isAdmin || isTech;

  return (
    <div className="flex flex-col min-h-screen p-6 bg-gray-50 font-sans text-gray-900">
      <header className="mb-8 border-b-2 border-gray-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-gray-700">
          Kullanıcı: {user.name} | Yetki: {user.role.toUpperCase()}
        </h1>
      </header>

      {/* BUTONLAR PANELİ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-10">
        
        {/* İSG Yetkisinde GİZLENEN Bölüm */}
        {hasFullAccess && (
          <>
            <button onClick={() => router.push('/kontrol-formlari')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">kontrol formları</button>
            <button onClick={() => router.push('/periyodik-bakim')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">periyodik bakım</button>
            <button onClick={() => router.push('/manuel-pm')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">manuel pm</button>
            <button onClick={() => router.push('/sayac-okuma')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">sayaç okuma</button>
            <button onClick={() => router.push('/mesai-girisi')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">mesai girişi</button>
            <button onClick={() => router.push('/mesailerim')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">mesailerim</button>
            <button onClick={() => router.push('/yapilan-isler')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">yapılan işler</button>
            <button onClick={() => router.push('/bakim-ligi')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">bakım ligi</button>
          </>
        )}

        {/* HER ROLDE GÖRÜNECEK BUTONLAR */}
        <button onClick={() => router.push('/pano-temizligi')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">pano temizliği</button>
        <button onClick={() => router.push('/eked-takip')} className="p-4 bg-white border rounded shadow hover:bg-gray-50">eked takip</button>

        {/* SADECE İSG VE ADMIN İÇİN EK BUTONLAR */}
        {(isISG || isAdmin) && (
          <>
            <button onClick={() => router.push('/kar-arsivi')} className="p-4 bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-medium">kar arşivi</button>
            <button onClick={() => router.push('/isg-duyuru')} className="p-4 bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-medium">İSG duyuru</button>
          </>
        )}
      </div>

      {/* ALT BİLGİ BÖLÜMLERİ */}
      <div className="flex flex-col space-y-3">
        {/* İSG Yetkisinde GİZLENEN Alt Bölümler */}
        {hasFullAccess && (
          <>
            <div className="p-4 border rounded bg-white shadow-sm" id="saha-bildirimleri">saha bildirimleri</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="rapor-girisi">rapor girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="yedek-parca">yedek parça sarf malzeme kullanımı</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="zaman-girisi">zaman girişi</div>
            <div className="p-4 border rounded bg-white shadow-sm" id="aciklama">açıklama</div>
          </>
        )}

        {/* HERKESİN GÖRDÜĞÜ / SADECE İSG'DE AKTİF OLANLAR */}
        <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-700 font-bold uppercase shadow-sm" id="kritik-isg-alarmlari">kritik isg alarmları</div>
        <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 text-yellow-700 font-bold uppercase shadow-sm" id="aktif-eked-bildirimleri">aktif eked bildirimleri</div>
      </div>
    </div>
  );
}