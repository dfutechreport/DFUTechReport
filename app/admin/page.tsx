
"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase"; 
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import Link from "next/link";

export default function AdminDashboard() {
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState([
    { name: "Ahmet Usta", xp: 1250, level: 12, performance: 95 },
    { name: "Mehmet Teknik", xp: 980, level: 9, performance: 88 },
    { name: "Caner Elektrik", xp: 1100, level: 11, performance: 92 }
  ]);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-mono">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-indigo-500/30 pb-4">
        <h1 className="text-2xl font-bold text-indigo-400 uppercase tracking-tighter italic">AI CORE // NEXUS v21 DASHBOARD</h1>
        <Link href="/" className="bg-white/5 px-4 py-2 rounded border border-white/10 text-xs">ANA MENÜ</Link>
      </div>

      {/* YAN YANA MODÜLLER (GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* MODÜL 1: BAKIM LİGİ */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2">
            <button onClick={() => setShowLeagueInfo(true)} className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs hover:bg-indigo-500 transition-colors">?</button>
          </div>
          <h2 className="text-indigo-400 font-bold mb-4 flex items-center">
            <span className="w-2 h-2 bg-indigo-500 mr-2 animate-pulse"></span> BAKIM LİGİ (XP & SEVİYE)
          </h2>
          <div className="space-y-4">
            {personelList.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                <div>
                  <div className="text-sm font-bold">{p.name} <span className="text-indigo-400 ml-2">Lvl {p.level}</span></div>
                  <div className="w-32 h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(p.xp % 100)}%` }}></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">TOPLAM XP</div>
                  <div className="text-sm font-mono text-emerald-400">{p.xp} pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MODÜL 2: KRİTİK PARÇA - ARIZA KORELASYONU */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2">
            <button onClick={() => setShowCorrInfo(true)} className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs hover:bg-emerald-500 transition-colors">?</button>
          </div>
          <h2 className="text-emerald-400 font-bold mb-4 flex items-center">
            <span className="w-2 h-2 bg-emerald-500 mr-2 animate-pulse"></span> PARÇA-ARIZA KORELASYONU
          </h2>
          <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { part: "Rulman 6204", failure: 15 },
                  { part: "Kontaktör", failure: 8 },
                  { part: "Sensör PNP", failure: 12 },
                  { part: "V-Kayış", failure: 6 }
                ]}>
                  <XAxis dataKey="part" stroke="#4b5563" fontSize={10} />
                  <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #1e293b'}} />
                  <Bar dataKey="failure" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 italic text-center uppercase tracking-widest">En Yüksek Risk: Rulman Grubu (Aşınma Bazlı)</div>
        </div>

      </div>

      {/* MODAL: BAKIM LİGİ BİLGİ */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-indigo-500/50 p-8 rounded-2xl max-w-2xl w-full shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <h3 className="text-2xl font-bold text-indigo-400 mb-6 border-b border-indigo-500/20 pb-2 uppercase">Bakım Ligi Algoritma Detayları</h3>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong className="text-white">1. Acil Arıza Müdahalesi (50 XP):</strong> 30 dk altındaki müdahalelerde tam puan, gecikmelerde her 10 dk için -5 XP.</p>
              <p><strong className="text-white">2. Planlı Bakım (30 XP):</strong> Eksiksiz ve zamanında kapatılan iş emirleri.</p>
              <p><strong className="text-white">3. İSG Bonusu (100 XP):</strong> Ay boyu "Sıfır İSG İhlali" ve EKED kullanımı.</p>
              <p><strong className="text-white">4. Seviye Sistemi:</strong> Her 1000 XP bir seviyeyi temsil eder. Seviye arttıkça "Master Technician" ünvanı kazanılır.</p>
            </div>
            <button onClick={() => setShowLeagueInfo(false)} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl transition-all font-bold">ANLAŞILDI</button>
          </div>
        </div>
      )}

      {/* MODAL: KORELASYON BİLGİ */}
      {showCorrInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-emerald-500/50 p-8 rounded-2xl max-w-2xl w-full shadow-[0_0_50px_rgba(16,185,129,0.2)]">
            <h3 className="text-2xl font-bold text-emerald-400 mb-6 border-b border-emerald-500/20 pb-2 uppercase">Korelasyon Hesaplama Metodolojisi</h3>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong className="text-white">Analiz Yöntemi:</strong> Stok kayıtları ile Arıza Bildirimleri arasındaki StockID ve EquipmentID anahtarları üzerinden "Inner Join" analizi yapılır.</p>
              <p><strong className="text-white">Hesaplama:</strong> Belirli bir ekipman tipinde (örn: Hidrofor), bir parçanın (örn: Mekanik Salmastra) değiştirilme sıklığı, o ekipmanın arıza duruş süresiyle çarpılarak "Kritiklik Katsayısı" oluşturulur.</p>
              <p><strong className="text-white">Amaç:</strong> Kök neden analizinde (RCA) hangi parçaların kronik zayıf nokta olduğunu tespit ederek "Önleyici Bakım" periyotlarını optimize etmek.</p>
            </div>
            <button onClick={() => setShowCorrInfo(false)} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl transition-all font-bold">ANLAŞILDI</button>
          </div>
        </div>
      )}

    </div>
  );
}
