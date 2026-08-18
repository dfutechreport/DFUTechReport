import os
import re

def update_file(path, new_states, calc_logic, ui_injections, modal_injections):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. State Injection
    if 'showScoreInfo' not in code:
        code = code.replace('const [loading, setLoading] = useState(true);', 
                          'const [loading, setLoading] = useState(true);\n' + new_states)

    # 2. Logic Injection (useEffect)
    if 'AI CORE ELITE' not in code:
        anchor = 'setGrafikIsHatti'
        if anchor in code:
            # Bulunduğu satırı bul ve altına ekle
            code = re.sub(r'(setGrafikIsHatti$.*?$;)', r'\1' + calc_logic, code)

    # 3. UI Injections (Notification Move & New Panels)
    if 'v34_ui' not in code:
        # İSG ve Saha bildirimlerini en üste taşı (Header altına)
        header_end = code.find('</div>\n\n        {/* BUTTON GRID')
        if header_end != -1:
             top_ui = """
        {/* v34_ui: TOP PRIORITY MONITORING */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 no-print">
           <div className="bg-red-500/[0.03] backdrop-blur-3xl border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-red-600/10 transition-all">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">Detay</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic uppercase">Aktif Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3.5rem] shadow-2xl hover:border-indigo-500/30 transition-all">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-indigo-600/10 transition-all">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">İncele</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic uppercase">Bekleyen İş Yok.</p>}
              </div>
           </div>
        </div>
"""
             code = code[:header_end+7] + top_ui + code[header_end+7:]

        # Lig ve Finans Panellerini Ekle
        code = code.replace('{/* RCA TASK LIST */}', ui_injections + '\n\n        {/* RCA TASK LIST %}')
        code = code.replace('{/* RCA TASK LIST %}', '{/* RCA TASK LIST */}')

    # 4. Modal Injections
    if 'showScoreInfo' in code and 'XP Puan Sistemi' not in code:
        code = code.replace('    </div>\n  );\n}', modal_injections + '\n    </div>\n  );\n}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} güncellendi.")

# --- DATA & UI PACKS ---
STATES = """  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [bakimLigi, setBakimLigi] = useState<any[]>([]);
  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);
  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);"""

CALC = """
    // --- AI CORE ELITE ANALYTICS ENGINE (v34) ---
    const ligaD34: any = {}; const finD34: any = {}; const groups34: any = {};
    rawLogs.forEach(l => {
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!ligaD34[p]) ligaD34[p] = { isim: p, is: 0, points: 0 }; ligaD34[p].is++; ligaD34[p].points += l.isDuruslu ? 50 : 20; } });
      if (!finD34[l.ekipmanAdi]) finD34[l.ekipmanAdi] = { isim: l.ekipmanAdi, pSay: 0, tSure: 0 };
      finD34[l.ekipmanAdi].pSay += (l.kullanilanMalzemeler?.length || 0); finD34[l.ekipmanAdi].tSure += Number(l.toplamSureDakika) || 0;
      if (!groups34[l.ekipmanAdi]) groups34[l.ekipmanAdi] = []; groups34[l.ekipmanAdi].push(l);
    });
    setBakimLigi(Object.values(ligaD34).sort((a:any, b:any) => b.points - a.points).slice(0, 3));
    setMaliyetAnalizi(Object.values(finD34).sort((a:any, b:any) => b.pSay - a.pSay).slice(0, 5));
"""

UI = """
        {/* v34: PERFORMANCE & FINANCE ANALYTICS */}
        {(userRole === "admin" || userRole === "teknisyen" || userRole === "operator") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 no-print">
             <div className="bg-amber-500/[0.03] backdrop-blur-3xl border border-amber-500/20 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-8">
                  <h2 className="text-sm font-black text-amber-500 uppercase tracking-[0.4em]">🏆 BAKIM YILDIZLARI LİGİ</h2>
                  <button onClick={() => setShowScoreInfo(true)} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[8px] font-black px-3 py-1 rounded-full border border-amber-500/20 transition-all uppercase">Puanlar nasıl hesaplandı?</button>
                </div>
                <div className="space-y-6">
                  {bakimLigi.map((p, i) => (
                    <div key={i} className={`flex justify-between items-center p-5 rounded-[2rem] border ${i===0?'border-amber-500/40 bg-amber-500/10 shadow-lg':'border-white/5 bg-white/5'}`}>
                      <div className="flex items-center gap-4"><span className="text-2xl">{i===0?'🥇':i===1?'🥈':'🥉'}</span><div><p className="text-xs font-black text-white uppercase">{p.isim}</p><p className="text-[8px] text-gray-500 font-bold uppercase">{p.is} Müdahale</p></div></div>
                      <div className="text-right"><p className="text-sm font-black text-amber-400">{p.points}</p><p className="text-[8px] text-amber-600 font-black uppercase">XP PUAN</p></div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="bg-emerald-500/[0.03] backdrop-blur-3xl border border-emerald-500/20 p-10 rounded-[3.5rem] shadow-2xl">
                <div className="flex justify-between items-start mb-8">
                  <h2 className="text-sm font-black text-emerald-400 uppercase tracking-[0.4em]">💰 EN MALİYETLİ EKİPMANLAR</h2>
                  <button onClick={() => setShowFinanceInfo(true)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[8px] font-black px-3 py-1 rounded-full border border-emerald-500/20 transition-all uppercase">Liste neye göre belirlendi?</button>
                </div>
                <div className="space-y-4">
                  {maliyetAnalizi.map((e, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                      <div><p className="text-[10px] font-bold text-gray-300 uppercase">{e.isim}</p><p className="text-[8px] text-gray-600 font-black uppercase">{e.pSay} Sarfiyat</p></div>
                      <div className="text-right"><span className="text-sm font-black text-emerald-500">{e.tSure} DK</span><p className="text-[8px] text-emerald-800 font-black uppercase">BAKIM YÜKÜ</p></div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}
"""

MODALS = """
      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <div className="text-4xl mb-6">🏆</div>
            <h2 className="text-xl font-black text-amber-500 mb-6 uppercase tracking-widest">XP Puan Sistemi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Sıralamanız performans verileriyle anlık hesaplanır:</p>
              <ul className="space-y-3 bg-white/5 p-5 rounded-3xl">
                <li>🟢 <strong>Normal İş:</strong> +20 XP</li>
                <li>🔴 <strong>Duruşlu İş:</strong> +50 XP</li>
                <li>⚡ <strong>Hız Bonusu:</strong> MTTR başarısı etkilidir.</li>
              </ul>
              <p className="text-[10px] italic text-gray-500">İSG kuralları lig puanlamasında gizli çarpandır.</p>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-8 w-full bg-amber-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}
      {showFinanceInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-emerald-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowFinanceInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <div className="text-4xl mb-6">💰</div>
            <h2 className="text-xl font-black text-emerald-400 mb-6 uppercase tracking-widest">Maliyet Analiz Metodu</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Maliyet listesi, ekipmanın tesis üzerindeki toplam yükünü temsil eder:</p>
              <ul className="space-y-3 bg-white/5 p-5 rounded-3xl">
                <li>🛠️ <strong>Yedek Parça:</strong> Kullanılan parçaların adedi.</li>
                <li>⏰ <strong>Bakım Süresi:</strong> Müdahale için harcanan her dakika.</li>
              </ul>
            </div>
            <button onClick={() => setShowFinanceInfo(false)} className="mt-8 w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}
"""

# EXECUTE
update_file("app/admin/page.tsx", STATES, CALC, UI, MODALS)
update_file("app/dashboard/page.tsx", STATES, CALC, UI, MODALS)