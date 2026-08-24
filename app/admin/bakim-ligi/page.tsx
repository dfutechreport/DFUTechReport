"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Not: Gerçek sisteminizde kullanıcı rolünü Firebase Auth veya bir Context üzerinden almalısınız.
// Şimdilik test için manuel bir role değişkeni tanımlıyoruz.
const USER_ROLE = "technician"; // "admin" veya "technician" olarak değişebilir

const BakimLigiPage = () => {
  const [seciliYil, setSeciliYil] = useState("2026");
  const [seciliAy, setSeciliAy] = useState("Ağustos");

  // Rol bazlı yönlendirme mantığı
  const dashboardLink = USER_ROLE === "admin" ? "/admin" : "/dashboard";

  const leaderboardData = [
    { id: 1, name: "İlker B.", score: 960, jobs: 52, efficiency: 98, downtime: 15, avatar: "İB" },
    { id: 2, name: "Ahmet Y.", score: 850, jobs: 45, efficiency: 92, downtime: 12, avatar: "AY" },
    { id: 3, name: "Mehmet K.", score: 780, jobs: 38, efficiency: 88, downtime: 10, avatar: "MK" },
    { id: 4, name: "Caner S.", score: 690, jobs: 30, efficiency: 85, downtime: 8, avatar: "CS" },
    { id: 5, name: "Murat T.", score: 620, jobs: 28, efficiency: 80, downtime: 5, avatar: "MT" },
  ];

  return (
    <div className="p-4 md:p-8 bg-[#0f172a] min-h-screen font-sans text-slate-100">
      
      {/* Üst Navigasyon ve Başlık */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <Link href={dashboardLink}>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-700 transition-all shadow-lg text-sm font-bold mb-4">
              ⬅️ Dashboard'a Dön
            </button>
          </Link>
          <h1 className="text-3xl font-black text-teal-400 flex items-center gap-3 uppercase tracking-tighter">
            🏆 Bakım Ligi & Performans
          </h1>
          <p className="text-slate-400 text-sm font-medium">Saha Operasyon Başarı Analizi</p>
        </div>

        {/* Filtreleme Paneli - Dark */}
        <div className="flex gap-2 bg-slate-900 p-3 rounded-2xl shadow-2xl border border-slate-800">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">YIL</label>
            <select 
              value={seciliYil}
              onChange={(e) => setSeciliYil(e.target.value)}
              className="bg-transparent text-sm font-bold text-teal-400 outline-none cursor-pointer px-1"
            >
              <option className="bg-slate-900" value="2024">2024</option>
              <option className="bg-slate-900" value="2025">2025</option>
              <option className="bg-slate-900" value="2026">2026</option>
            </select>
          </div>
          <div className="w-[1px] bg-slate-800 mx-2"></div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">AY</label>
            <select 
              value={seciliAy}
              onChange={(e) => setSeciliAy(e.target.value)}
              className="bg-transparent text-sm font-bold text-teal-400 outline-none cursor-pointer px-1"
            >
              <option className="bg-slate-900" value="Haziran">Haziran</option>
              <option className="bg-slate-900" value="Temmuz">Temmuz</option>
              <option className="bg-slate-900" value="Ağustos">Ağustos</option>
              <option className="bg-slate-900" value="Eylül">Eylül</option>
            </select>
          </div>
        </div>
      </div>

      {/* Podyum - İlk 3 (Dark Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {leaderboardData.slice(0, 3).map((user, index) => (
          <div key={user.id} className={`relative p-8 rounded-3xl shadow-2xl border-2 transition-all ${
            index === 0 ? 'bg-slate-800 border-amber-500 scale-105 z-10' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black mb-4 ${
                index === 0 ? 'bg-amber-500 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'bg-slate-800 text-slate-400'
              }`}>
                {user.avatar}
              </div>
              <h2 className={`text-xl font-bold uppercase tracking-tight ${index === 0 ? 'text-white' : 'text-slate-300'}`}>
                {user.name}
              </h2>
              <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase mt-2 ${
                index === 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-500'
              }`}>
                {index === 0 ? '🥇 Ayın Teknisyeni' : index === 1 ? '🥈 Gümüş Derece' : '🥉 Bronz Derece'}
              </div>
              <div className="mt-6 text-4xl font-black text-teal-400 tracking-tighter">
                {user.score} <span className="text-xs text-slate-500 uppercase">Puan</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste Görünümü - Dark */}
      <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <h3 className="font-black text-slate-400 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
            📊 PERFORMANS SIRALAMASI // {seciliAy} {seciliYil}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="p-6 text-center">Sıra</th>
                <th className="p-6">Teknisyen</th>
                <th className="p-6 text-center">İş Adedi</th>
                <th className="p-6 text-center">Verimlilik</th>
                <th className="p-6 text-center">Duruş Kazancı</th>
                <th className="p-6 text-right">Puan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leaderboardData.map((user, index) => (
                <tr key={user.id} className="hover:bg-slate-800/50 transition-all group">
                  <td className="p-6 text-center font-black text-slate-700 group-hover:text-teal-400 transition-colors">
                    #{index + 1}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-700">
                        {user.avatar}
                      </div>
                      <span className="font-bold text-slate-300 tracking-tight">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-6 text-center font-bold text-slate-400 font-mono">
                    <span className="text-teal-500/50 mr-1">✓</span>{user.jobs}
                  </td>
                  <td className="p-6 text-center font-bold text-slate-400 font-mono">%{user.efficiency}</td>
                  <td className="p-6 text-center font-bold text-blue-400 font-mono">+{user.downtime}h</td>
                  <td className="p-6 text-right">
                    <span className="bg-slate-800 text-teal-400 px-4 py-2 rounded-xl font-black text-sm border border-slate-700">
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