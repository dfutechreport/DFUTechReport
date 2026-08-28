'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EkedTrackingPage({ user }: { user?: any }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !user) return null;

  const handleReturn = () => {
    // Kural: Hangi kullanıcı yetkisi ile girildi ise o dashboarda dön
    if (user.role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">EKED TAKİP VE GÜVENLİK LOGLARI</h1>
      
      <div className="flex-1 bg-white border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 mb-8 italic">
        Burada aktif kilitli ekipmanlar ve İSG logları listelenmektedir.
      </div>

      <div className="flex justify-start">
        <button 
          onClick={handleReturn}
          className="px-8 py-3 bg-gray-900 text-white font-bold rounded shadow-lg hover:bg-black transition"
        >
          dashboarda dön
        </button>
      </div>
    </div>
  );
}