// Dosya Yolu: app/admin/bakim-ligi/page.tsx

import React from 'react';
import { Trophy, Medal, Star, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

// Mock Veri Yapısı
const leaderboardData = [
  { id: 1, name: "İlker B.", score: 960, jobs: 52, efficiency: 98, downtimeReduction: 15, avatar: "İB" },
  { id: 2, name: "Ahmet Y.", score: 850, jobs: 45, efficiency: 92, downtimeReduction: 12, avatar: "AY" },
  { id: 3, name: "Mehmet K.", score: 780, jobs: 38, efficiency: 88, downtimeReduction: 10, avatar: "MK" },
  { id: 4, name: "Caner S.", score: 690, jobs: 30, efficiency: 85, downtimeReduction: 8, avatar: "CS" },
  { id: 5, name: "Murat T.", score: 620, jobs: 28, efficiency: 80, downtimeReduction: 5, avatar: "MT" },
];

const BakimLigiPage = () => {
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-teal-800 flex items-center gap-2">
            <Trophy className="text-amber-500" size={32} />
            Bakım Ligi & Performans Analizi
          </h1>
          <p className="text-slate-500 mt-1">Ağustos 2026 Dönemi Başarı Tablosu</p>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
          <span className="text-sm font-medium text-slate-600 px-3">Dönem: Ağustos 2026</span>
        </div>
      </div>

      {/* Podyum - Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {leaderboardData.slice(0, 3).map((user, index) => (
          <div key={user.id} className={`relative p-6 rounded-2xl shadow-lg border-2 ${
            index === 0 ? 'bg-gradient-to-br from-teal-700 to-teal-900 border-amber-400 scale-105' : 
            'bg-white border-slate-100'
          }`}>
            {index === 0 && (
              <div className="absolute -top-4 -right-4 bg-amber-400 text-white p-2 rounded-full shadow-lg">
                <Star fill="white" size={24} />
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 ${
                index === 0 ? 'bg-amber-400 text-teal-900' : 'bg-teal-100 text-teal-700'
              }`}>
                {user.avatar}
              </div>
              <h2 className={`text-xl font-bold ${index === 0 ? 'text-white' : 'text-slate-800'}`}>{user.name}</h2>
              <div className={`text-sm mt-1 ${index === 0 ? 'text-teal-100' : 'text-slate-500'}`}>
                {index + 1}. Sırada
              </div>
              <div className="mt-4 text-3xl font-black text-amber-500">{user.score} <span className="text-xs uppercase">Puan</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Detaylı Liste ve Metrikler */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-700">Tüm Teknisyen Performans Detayları</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-medium text-center">Sıra</th>
              <th className="p-4 font-medium text-left">Teknisyen</th>
              <th className="p-4 font-medium text-center">İş Adedi</th>
              <th className="p-4 font-medium text-center">Verimlilik</th>
              <th className="p-4 font-medium text-center">Duruş Azaltma</th>
              <th className="p-4 font-medium text-right">Toplam Puan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaderboardData.map((user, index) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-center font-bold text-slate-400">#{index + 1}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {user.avatar}
                    </div>
                    <span className="font-semibold text-slate-700">{user.name}</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-slate-600">
                    <CheckCircle size={14} className="text-emerald-500" /> {user.jobs}
                  </div>
                </td>
                <td className="p-4 text-center text-slate-600">%{user.efficiency}</td>
                <td className="p-4 text-center text-slate-600 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp size={14} className="text-blue-500" /> {user.downtimeReduction} Saat
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-bold">
                    {user.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Algoritma Bilgilendirme Kartı */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-4 items-start">
        <AlertTriangle className="text-blue-600 flex-shrink-0" size={20} />
        <div>
          <h4 className="text-blue-800 font-bold text-sm">Puanlama Algoritması Hakkında</h4>
          <p className="text-blue-700 text-xs mt-1 leading-relaxed">
            Puanlar şu kritere göre hesaplanmaktadır: <strong>(İş Adedi × 10) + (Verimlilik Katsayısı × 5) + (Duruş Azaltma Süresi × 20)</strong>. 
            Ayın ilk 3 teknisyeni, yönetim tarafından belirlenen performans ödüllerine hak kazanır.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BakimLigiPage;