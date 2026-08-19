import os
import re

def master_rebuild_v48(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı. Lütfen betiği projenin ana dizininde çalıştırın.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    print("--- DFU MASTER V48: REBUILD BAŞLATILDI ---")

    # 1. ESKİ KALINTILARI TEMİZLE (Mükerrer satırları ve modalları süpür)
    code = re.sub(r'\{/\* v(3[89]|4[0-9]).*?\}\)$$\}', '', code, flags=re.DOTALL)
    code = re.sub(r'\{showDowntimeModal && $$.*?$\}', '', code, flags=re.DOTALL)
    code = re.sub(r'<div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">[\s\S]*?</div>', '', code)

    # 2. STATE VE HESAPLAMA MANTIGINI ENJEKTE ET
    if 'bakimLigi' not in code:
        states = """  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [bakimLigi, setBakimLigi] = useState<any[]>([]);
  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);
  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<any[]>([]);"""
        code = code.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n' + states)

    # 3. DURUŞ ORANI (HEADER YANINA - TEKİL)
    downtime_ui = r"""
              {/* v48: TEKİL DURUŞ ORANI */}
              {(() => {
                const totalM = Number(kpiTotals.sure) || 0;
                const downM = Number(kpiTotals.durus) || 0;
                const rat = totalM > 0 ? (downM / totalM) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${rat < 30 ? 'text-green-400' : rat < 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>%{rat.toFixed(1)}</span>
                  </div>
                )
              })()}"""
    if 'v48: TEKİL DURUŞ ORANI' not in code:
        code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + downtime_ui)

    # 4. İSG VE SAHA BİLDİRİMLERİ (EN ÜSTE TAŞIMA)
    top_priority_ui = r"""
        {/* v48: TOP PRIORITY MONITORING (ISG & SAHA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 no-print">
           <div className="bg-red-500/[0.03] backdrop-blur-3xl border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-red-600/10">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">Detay</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic uppercase">Aktif Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3.5rem] shadow-2xl hover:border-indigo-500/30">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-indigo-600/10">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">İncele</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black italic uppercase">Bekleyen İş Yok.</p>}
              </div>
           </div>
        </div>
"""
    # Header sonrasına yerleştir
    if 'v48: TOP PRIORITY' not in code:
        code = code.replace('</div>\n\n        {/* BUTTON GRID', top_priority_ui + '</div>\n\n        {/* BUTTON GRID')

    # 5. LİG VE FİNANS MODALLARI (Popuplar dahil)
    # Bu kısmı dosyanın sonuna, div kapanmadan önce ekliyoruz.
    modals_html = r"""
      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <h2 className="text-xl font-black text-amber-500 mb-6 uppercase tracking-widest">XP Puan Sistemi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm">
              <p>Normal İş: +20 XP | Duruşlu İş: +50 XP</p>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-8 w-full bg-amber-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}
"""
    if 'showScoreInfo' in code and 'XP Puan Sistemi' not in code:
        code = code.replace('    </div>\n  );\n}', modals_html + '\n    </div>\n  );\n}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("[BAŞARILI] Hiyerarşi düzeldi, 84KB miras korundu, v48 yayında!")

master_rebuild_v48("app/admin/page.tsx")