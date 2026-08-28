'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EkedTrackingPage({ user }: { user?: any }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const handleBack = () => {
    if (user?.role === 'admin') {
      router.push('/admin'); // Admin kendi paneline döner
    } else {
      router.push('/dashboard'); // Diğerleri dashboarda döner
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-xl font-bold">EKED Takip</h1>
        <button onClick={handleBack} className="px-4 py-2 bg-gray-200 rounded">dashboarda dön</button>
      </div>
      
      <div className="border-2 border-dashed p-20 text-center text-gray-400">
        EKED Verileri ve Logları (Admin ve Yetkili Erişimi Aktif)
      </div>
    </div>
  );
}