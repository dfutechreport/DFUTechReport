
import os
import re

def v52_final_polish(path):
    if not os.path.exists(path):
        print(f"HATA: {path} bulunamadı.")
        return
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    print(f"--- {path} İşleniyor ---")

    # 1. TEMİZLİK: Tüm mükerrer (tekrarlayan) v38-v51 bloklarını ve kalıntıları SÜPÜR
    # Bu regex her türlü versiyon etiketli bloğumuzu temizler
    code = re.sub(r'\{/\* v(3[89]|4[0-9]|5[0-9]).*?\}\)\(\)\}', '', code, flags=re.DOTALL)
    code = re.sub(r'\{/\* v(3[89]|4[0-9]|5[0-9]).*?\}.*?</div>\s*</div>', '', code, flags=re.DOTALL)
    
    # Duruş oranı mükerrerliğini temizle
    code = re.sub(r'<div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">[\s\S]*?</div>', '', code)

    # 2. TEKİL VE KESİN DURUŞ ORANI (Header Yanı)
    ratio_ui = r'''
              {/* v52: SINGLE RATIO */}
              {(() => {
                const t = Number(kpiTotals.sure) || 0;
                const d = Number(kpiTotals.durus) || 0;
                const r = t > 0 ? (d / t) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${r < 30 ? 'text-green-400' : r < 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>
                      %{r.toFixed(1)}
                    </span>
                  </div>
                )
              })()}'''
    if 'v52: SINGLE RATIO' not in code:
        code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + ratio_ui)

    # 3. HİYERARŞİK DÜZEN: 22 Buton -> İSG/Saha -> Lig/Finans
    # İSG ve Saha Bildirimleri (Geniş ve Detaylı)
    isg_saha_ui = r'''
        {/* v52: LEVEL 2 - BİLDİRİMLER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
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
           <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[3rem] shadow-2xl">
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
'''

    # Lig ve Finans (v52 - Detaylı Butonlar)
    lig_fin_ui = r'''
        {/* v52: LEVEL 3 - LİG VE FİNANS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 no-print">
           <div className="bg-amber-500/[0.03] backdrop-blur-3xl border border-amber-500/20 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-sm font-black text-amber-500 uppercase tracking-[0.4em]">🏆 BAKIM YILDIZLARI LİGİ</h2>
                <button onClick={() => setShowScoreInfo(true)} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[8px] font-black px-3 py-1 rounded-full border border-amber-500/20 transition-all uppercase">Puanlama Metolojisi</button>
              </div>
              <div className="space-y-6">
                {bakimLigi.map((p, i) => (
                  <div key={i} className={`flex justify-between items-center p-5 rounded-[2rem] border ${i===0?'border-amber-500/40 bg-amber-500/10 shadow-lg shadow-amber-500/10':'border-white/5 bg-white/5'}`}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{i===0?'🥇':i===1?'🥈':'🥉'}</span>
                      <div><p className="text-xs font-black text-white uppercase">{p.isim}</p><p className="text-[8px] text-gray-500 font-bold uppercase">{p.is} Müdahale</p></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-black text-amber-400">{p.points}</p><p className="text-[8px] text-amber-600 font-black uppercase">XP PUAN</p></div>
                  </div>
                ))}
              </div>
           </div>
           <div className="bg-emerald-500/[0.03] backdrop-blur-3xl border border-emerald-500/20 p-10 rounded-[3.5rem] shadow-2xl">
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-sm font-black text-emerald-400 uppercase tracking-[0.4em]">💰 EN MALİYETLİ EKİPMANLAR</h2>
                <button onClick={() => setShowFinanceInfo(true)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[8px] font-black px-3 py-1 rounded-full border border-emerald-500/20 transition-all uppercase">Maliyet Analiz Detayı</button>
              </div>
              <div className="space-y-4">
                {maliyetAnalizi.map((e, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                    <div><p className="text-[10px] font-bold text-gray-300 uppercase">{e.isim}</p><p className="text-[8px] text-gray-600 font-black uppercase">{e.pSay} Yedek Parça Sarfiyatı</p></div>
                    <div className="text-right"><span className="text-sm font-black text-emerald-500">{e.tSure} DK</span><p className="text-[8px] text-emerald-800 font-black uppercase">BAKIM YÜKÜ</p></div>
                  </div>
                ))}
              </div>
           </div>
        </div>
'''

    # Montaj: RCA TASK LIST önüne enjekte et
    if 'v52: LEVEL 2' not in code:
        code = code.replace('{/* RCA TASK LIST */}', isg_saha_ui + lig_fin_ui + '\n\n        {/* RCA TASK LIST %}')
        code = code.replace('{/* RCA TASK LIST %}', '{/* RCA TASK LIST */}')

    # 4. DETAYLI BİLGİ MODALLARI (Popuplar)
    info_modals = r'''
      {/* DETAYLI PUANLAMA MODALI */}
      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-12 rounded-[3.5rem] max-w-2xl w-full relative shadow-3xl">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition text-2xl">✕</button>
            <div className="flex items-center gap-5 mb-10">
              <div className="bg-amber-500/20 p-5 rounded-3xl text-3xl">🏆</div>
              <div>
                <h2 className="text-2xl font-black text-amber-500 uppercase tracking-widest">XP Puanlama Metodolojisi</h2>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">Teknik Performans Değerlendirme Algoritması</p>
              </div>
            </div>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                <h3 className="text-white font-black mb-4 uppercase text-xs">Puanlama Kriterleri:</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between border-b border-white/5 pb-2"><span>🟢 <strong>Normal Arıza Müdahalesi:</strong> (Ekipman çalışırken yapılan işler)</span> <span className="text-amber-400 font-black">+20 XP</span></li>
                  <li className="flex justify-between border-b border-white/5 pb-2"><span>🔴 <strong>Duruşlu Arıza Müdahalesi:</strong> (Üretimi durduran kritik işler)</span> <span className="text-red-400 font-black">+50 XP</span></li>
                  <li className="flex justify-between border-b border-white/5 pb-2"><span>⚡ <strong>Müdahale Hızı (MTTR):</strong> (Arıza bildiriminden itibaren ilk 15 dk)</span> <span className="text-indigo-400 font-black">+15 XP Bonus</span></li>
                  <li className="flex justify-between"><span>📋 <strong>Periyodik Bakım (PM):</strong> (Takvimdeki işin tam zamanında bitirilmesi)</span> <span className="text-green-400 font-black">+30 XP</span></li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 bg-black/20 p-4 rounded-2xl italic">"Bu puanlama sistemi, teknisyenlerimizin iş zorluğunu ve sahadaki çevikliğini objektif olarak ölçmek, başarılı personeli onurlandırmak amacıyla kurgulanmıştır."</p>
            </div>
            <button onClick={() => setShowScoreInfo(false)} className="mt-10 w-full bg-amber-600 hover:bg-amber-500 py-5 rounded-[2rem] font-black uppercase text-xs transition shadow-xl">Anladım, Kapat</button>
          </div>
        </div>
      )}

      {/* DETAYLI MALİYET ANALİZ MODALI */}
      {showFinanceInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-emerald-500/30 p-12 rounded-[3.5rem] max-w-2xl w-full relative shadow-3xl">
            <button onClick={() => setShowFinanceInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition text-2xl">✕</button>
            <div className="flex items-center gap-5 mb-10">
              <div className="bg-emerald-500/20 p-5 rounded-3xl text-3xl">💰</div>
              <div>
                <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-widest">Maliyet ve TCO Raporu</h2>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter">Ekipman Bazlı Toplam Sahiplik Maliyeti</p>
              </div>
            </div>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                <h3 className="text-white font-black mb-4 uppercase text-xs">Sıralama Nasıl Belirlenir?</h3>
                <p className="mb-4">Ekipmanlar, tesise verdikleri toplam finansal yük üzerinden en yüksekten en düşüğe doğru sıralanır:</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3"><span>1.</span> <strong>Yedek Parça Yoğunluğu:</strong> Makine üzerinde kullanılan her bir parçanın sıklığı, maliyet puanını %60 oranında etkiler.</li>
                  <li className="flex items-start gap-3"><span>2.</span> <strong>İşçilik ve Zaman Kaybı:</strong> Arıza onarımı için harcanan her dakika, üretim kaybı olarak maliyet hanesine eklenir.</li>
                  <li className="flex items-start gap-3"><span>3.</span> <strong>Kronikleşme Katsayısı:</strong> Kısa aralıklarla tekrarlayan arızalar, makinenin "Riskli" kategorisine girmesine neden olur.</li>
                </ul>
              </div>
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-l-4">
                <p className="text-[11px] text-emerald-600 font-bold uppercase italic">"Listenin ilk 3 sırasında yer alan ekipmanlar için CapEx (Yenileme Yatırımı) yapılması, onarım maliyetlerinden tasarruf edilmesini sağlar."</p>
              </div>
            </div>
            <button onClick={() => setShowFinanceInfo(false)} className="mt-10 w-full bg-emerald-600 hover:bg-emerald-500 py-5 rounded-[2rem] font-black uppercase text-xs transition shadow-xl">Pencereyi Kapat</button>
          </div>
        </div>
      )}
'''
    if 'PUANLAMA METODOLOJİSİ' not in code:
        code = code.replace('    </div>\n  );\n}', info_modals + '\n    </div>\n  );\n}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} mükerrerlikten arındırıldı ve detaylı modallar eklendi.")

# ÇALIŞTIR
v52_final_polish("app/admin/page.tsx")
v52_final_polish("app/dashboard/page.tsx")
