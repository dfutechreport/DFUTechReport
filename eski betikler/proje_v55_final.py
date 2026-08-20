
import os
import re

def v55_ultimate_patch(path, is_admin=True):
    if not os.path.exists(path):
        print(f"HATA: {path} bulunamadı.")
        return
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    print(f"--- {path} İşleniyor ---")

    # 1. TEMİZLİK: Eski hatalı hiyerarşileri ve mükerrer satırları SÜPÜR
    code = re.sub(r'\{/\* v(3[89]|4[0-9]|5[0-9]).*?\}\)\(\)\}', '', code, flags=re.DOTALL)
    code = re.sub(r'\{/\* v(3[89]|4[0-9]|5[0-9]).*?\}.*?</div>\s*</div>', '', code, flags=re.DOTALL)
    code = re.sub(r'<div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">[\s\S]*?</div>', '', code)

    # 2. TEKİL DURUŞ ORANI (HEADER YANI)
    ratio_jsx = r'''
              {/* v55: SINGLE RATIO */}
              {(() => {
                const t = Number(kpiTotals.sure) || 0;
                const d = Number(kpiTotals.durus) || 0;
                const r = t > 0 ? (d / t) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black ${r < 30 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>%{r.toFixed(1)}</span>
                  </div>
                )
              })()}'''
    if 'v55: SINGLE RATIO' not in code:
        code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + ratio_jsx)

    # 3. KUSURSUZ HİYERARŞİ: 22 BUTON -> İSG/SAHA BİLDİRİMLERİ (YAN YANA)
    isg_saha_jsx = r'''
        {/* v55: LEVEL 2 - KRİTİK BİLDİRİMLER (YAN YANA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-red-600/10 transition-all border border-white/5">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">Detay</button>
                  </div>
                ))}
                {aktifIsgAlarmlari.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase italic">Aktif Alarm Yok.</p>}
              </div>
           </div>
           <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[3.5rem] shadow-2xl">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center group hover:bg-indigo-600/10 transition-all border border-white/5">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl shadow-lg active:scale-95">İncele</button>
                  </div>
                ))}
                {aktifIsler.length === 0 && <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase italic">Bekleyen İş Yok.</p>}
              </div>
           </div>
        </div>
'''
    if 'v55: LEVEL 2' not in code:
        # RCA TASK LIST'in hemen üzerine (Butonlardan sonraya) enjekte et
        code = code.replace('{/* RCA TASK LIST */}', isg_saha_jsx + '\n\n        {/* RCA TASK LIST %}')
        code = code.replace('{/* RCA TASK LIST %}', '{/* RCA TASK LIST */}')

    # 4. DETAYLI ÖRNEKLİ MODALLAR
    modals_jsx = r'''
      {/* v55: MASTER INFO MODALS */}
      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4 font-sans">
          <div className="bg-slate-900 border border-amber-500/30 p-12 rounded-[3.5rem] max-w-2xl w-full relative shadow-3xl">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition text-2xl">✕</button>
            <h2 className="text-2xl font-black text-amber-500 mb-8 uppercase tracking-widest">XP Puanlama Metodolojisi</h2>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                <ul className="space-y-4">
                  <li className="flex justify-between border-b border-white/5 pb-2"><span>🟢 Normal Arıza Müdahalesi:</span> <span className="text-amber-400 font-black">+20 XP</span></li>
                  <li className="flex justify-between border-b border-white/5 pb-2"><span>🔴 Duruşlu Arıza Müdahalesi:</span> <span className="text-red-400 font-black">+50 XP</span></li>
                  <li className="flex justify-between"><span>⚡ Müdahale Hızı Bonusu (İlk 15 dk):</span> <span className="text-indigo-400 font-black">+15 XP</span></li>
                </ul>
              </div>
              <div className="bg-amber-500/10 p-6 rounded-[2rem] border border-amber-500/20">
                <p className="text-amber-500 font-black mb-2 uppercase text-[10px]">Örnek Hesaplama:</p>
                <p>Bir teknisyen <strong>Duruşlu</strong> bir arızayı <strong>10 dakika</strong> içinde bitirirse:</p>
                <p className="mt-2 text-white font-black">50 (Duruş) + 15 (Hız) = 65 XP Kazanır.</p>
              </div>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-10 w-full bg-amber-600 py-5 rounded-[2rem] font-black uppercase text-xs transition active:scale-95">Anladım, Kapat</button>
          </div>
        </div>
      )}
'''
    if 'v55: MASTER INFO MODALS' not in code:
        code = code.replace('    </div>\n  );\n}', modals_jsx + '\n    </div>\n  );\n}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} hiyerarşi ve örnekli modallar mühürlendi.")

v55_ultimate_patch("app/admin/page.tsx", True)
v55_ultimate_patch("app/dashboard/page.tsx", False)
