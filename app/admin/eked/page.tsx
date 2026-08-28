'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  role: 'admin' | 'teknisyen' | 'isg';
}

export default function EkedTrackingPage({ user }: { user?: User }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !user) {
    return <div className="p-10 text-center">Yükleniyor...</div>;
  }

  const handleDashboardReturn = () => {
    if (user?.role === 'admin') {
      router.push('/admin/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex flex-col p-6 space-y-6">
      <header className="flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-bold">EKED Takip Sistemi</h1>
      </header>

      <div className="min-h-[500px] border-dashed border-2 rounded-lg flex items-center justify-center text-gray-400 italic">
        EKED Kayıtları ve Log Listesi Burada Görüntülenir
      </div>

      <div className="flex justify-start">
        <button 
          onClick={handleDashboardReturn}
          className="px-8 py-3 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 transition shadow-md"
        >
          dashboarda dön
        </button>
      </div>
    </div>
  );
}