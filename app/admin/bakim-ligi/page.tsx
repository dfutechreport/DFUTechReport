"use client"; // Etkileşimli filtreler için gerekli

import React, { useState } from 'react';
import Link from 'next/link';

const BakimLigiPage = () => {
  // Filtre durumları (State)
  const [seciliYil, setSeciliYil] = useState("2026");
  const [seciliAy, setSeciliAy] = useState("Ağustos");

  // Mock Veri Yapısı
  const leaderboardData = [
    { id: 1, name: "İlker B.", score: 960, jobs: 52, efficiency: 98, downtime: 15, avatar: "İB" },
    { id: 2, name: "Ahmet Y.", score: 850, jobs: 45, efficiency: 92, downtime: 12, avatar: "AY" },
    { id: 3, name: "Mehmet K.", score: 780, jobs: 38, efficiency: 88, downtime: 10, avatar: "MK" },
    { id: 4, name: "Caner S.", score: 690, jobs: 30, efficiency: 85, downtime: 8, avatar: "CS" },
    { id: 5, name: "Murat T.", score: 620, jobs: 28, efficiency: 80, downtime: 5, avatar: "MT" },
  ];

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
      
      {/* Üst Navigasyon ve Başlık */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Link href="/admin">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm text-sm font-bold mb-4">
              ⬅️ Dashboard'a Dön
            </button>
          </Link>
          <h1 className="text-3xl font-black text-teal-800 flex items-center gap-3 uppercase tracking-tighter">
            🏆 Bakım Ligi & Performans
          </h1>
          <p className="text-slate-500 text-sm font-medium">Teknisyen Başarı ve Verimlilik Analizi</p>
        </div>

        {/* Filtreleme Paneli */}
        <div className="flex gap-2 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">YIL</label>
            <select 
              value={seciliYil}
              onChange={(e) => setSeciliYil(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer px-1"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <div className="w-[1px] bg-slate-100 mx-2"></div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">AY</label>
            <select 
              value={seciliAy}
              onChange={(e) => setSeciliAy(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer px-1"
            >
              <option value="Haziran">Haziran</option>
              <option value="Temmuz">Temmuz</option>
              <option value="Ağustos">Ağustos</option>
              <option value="Eylül">Eylül</option>
            </select>
          </div>
          <button className="ml-2 bg-teal-600 text-white p-2 rounded-lg hover:bg-teal-700 transition-colors">
            🔍
          </button>
        </div>
      </div>

      {/* Podyum - İlk 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {leaderboardData.slice(0, 3).map((user, index) => (
          <div key={user.id} className={`relative p-6 rounded-3xl shadow-lg border-2 transition-all ${
            index === 0 ? 'bg-teal-800 border-amber-400 scale-105 z-10' : 'bg-white border-slate-50'
          }`}>
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black mb-4 ${
                index === 0 ? 'bg-amber-400 text-teal-900' : 'bg-slate-100 text-slate-600'
              }`}>
                {user.avatar}
              </div>
              <h2 className={`text-xl font-bold uppercase tracking-tight ${index === 0 ? 'text-white' : 'text-slate-800'}`}>
                {user.name}
              </h2>
              <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase mt-2 ${
                index === 0 ? 'bg-teal-700 text-teal-100' : 'bg-slate-50 text-slate-400'
              }`}>
                {index === 0 ? '🥇 Ayın Teknisyeni' : index === 1 ? '🥈 Gümüş Derece' : '🥉 Bronz Derece'}
              </div>
              <div className="mt-6 text-4xl font-black text-amber-500 tracking-tighter">
                {user.score} <span className="text-xs text-slate-400 uppercase">Puan</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste Görünümü */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-black text-slate-700 uppercase text-sm tracking-widest flex items-center gap-2">
            📊 Detaylı Başarı Sıralaması ({seciliAy} {seciliYil})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="p-6 text-center">Sıra</th>
                <th className="p-6">Teknisyen</th>
                <th className="p-6 text-center">İş (Adet)</th>
                <th className="p-6 text-center">Verimlilik</th>
                <th className="p-6 text-center">Duruş Kazancı</th>
                <th className="p-6 text-right">Puan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaderboardData.map((user, index) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="p-6 text-center font-black text-slate-300 group-hover:text-teal-600 transition-colors">
                    #{index + 1}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                        {user.avatar}
                      </div>
                      <span className="font-bold text-slate-700 tracking-tight">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-6 text-center font-bold text-slate-600 italic">✅ {user.jobs}</td>
                  <td className="p-6 text-center font-bold text-slate-600">%{user.efficiency}</td>
                  <td className="p-6 text-center font-bold text-blue-600">🚀 {user.downtime} Sa</td>
                  <td className="p-6 text-right">
                    <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-sm">
                      {user.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BakimLigiPage;