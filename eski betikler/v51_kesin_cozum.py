import os
import re

def patch_system(path):
    if not os.path.exists(path):
        print(f"HATA: {path} bulunamadı.")
        return
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. TEMİZLİK: Eski versiyon kalıntılarını ve build hatası veren bozuk parantezleri süpür
    code = re.sub(r'\{/\* v(3[89]|4[0-9]|5[0-9]).*?\}\)$$\}', '', code, flags=re.DOTALL)
    code = re.sub(r'\{showDowntimeModal && $$.*?$\}', '', code, flags=re.DOTALL)

    # 2. STATE EKLEME
    if 'showScoreInfo' not in code:
        states = "  const [showScoreInfo, setShowScoreInfo] = useState(false);\n  const [showFinanceInfo, setShowFinanceInfo] = useState(false);\n  const [bakimLigi, setBakimLigi] = useState<any[]>([]);\n  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);"
        code = code.replace('const [loading, setLoading] = useState(true);', 'const [loading, setLoading] = useState(true);\n' + states)

    # 3. DURUŞ ORANI (HEADER YANINA - TEKİL)
    ratio_ui = r"""{/* v51: RATIO */}{(() => { const t = Number(kpiTotals.sure)||0, d = Number(kpiTotals.durus)||0, r = t > 0 ? (d/t)*100 : 0; return ( <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print"> <span className="text-[10px] font-black uppercase text-gray-500">DURUŞ ORANI:</span> <span className={`text-sm font-black ${r < 30 ? 'text-green-400' : 'text-red-400'}`}>%{r.toFixed(1)}</span> </div> ) })()}"""
    if 'v51: RATIO' not in code:
        code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + ratio_ui)

    # 4. HİYERARŞİ: 22 BUTONDAN SONRA İSG/SAHA BİLDİRİMLERİ
    isg_saha_ui = r"""
        {/* v51: SEVİYE 2 - BİLDİRİMLER */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-[3rem] shadow-2xl">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em]">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">{aktifIsgAlarmlari.map(a => (<div key={a.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold">{a.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-4 py-2 rounded-xl">Detay</button></div>))}</div>
           </div>
           <div className="bg-indigo-500/5 border border-indigo-500/20 p-8 rounded-[3rem] shadow-2xl">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em]">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">{aktifIsler.map(is => (<div key={is.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold">{is.ekipmanAdi}</p></div><button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-4 py-2 rounded-xl">İncele</button></div>))}</div>
           </div>
        </div>
"""
    # 5. SEVİYE 3: LİG VE FİNANS (BİLGİ BUTONLU)
    lig_fin_ui = r"""
        {/* v51: SEVİYE 3 - LİG VE FİNANS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-amber-500/5 border border-amber-500/20 p-10 rounded-[3.5rem] shadow-2xl">
              <div className="flex justify-between mb-8"><h2 className="text-sm font-black text-amber-500 uppercase">🏆 BAKIM LİGİ</h2><button onClick={()=>setShowScoreInfo(true)} className="text-[8px] border border-amber-500/20 px-2 py-1 rounded-full text-amber-500">Puanlar nasıl hesaplandı?</button></div>
              <div className="space-y-4">{bakimLigi.map((p,i)=>(<div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl"><span>{i===0?'🥇':i===1?'🥈':'🥉'} {p.isim}</span><span className="text-amber-400 font-black">{p.points} XP</span></div>))}</div>
           </div>
           <div className="bg-emerald-500/5 border border-emerald-500/20 p-10 rounded-[3.5rem] shadow-2xl">
              <div className="flex justify-between mb-8"><h2 className="text-sm font-black text-emerald-400 uppercase">💰 MALİYET ANALİZİ</h2><button onClick={()=>setShowFinanceInfo(true)} className="text-[8px] border border-emerald-500/20 px-2 py-1 rounded-full text-emerald-500">Liste neye göre belirlendi?</button></div>
              <div className="space-y-4">{maliyetAnalizi.map((e,i)=>(<div key={i} className="flex justify-between items-center border-b border-white/5 pb-2"><span>{e.isim}</span><span className="text-emerald-500 font-black">{e.tSure} DK</span></div>))}</div>
           </div>
        </div>
"""
    # Hiyerarşik Montaj (RCA Analizi üstüne ekle)
    if 'v51: SEVİYE 2' not in code:
        code = code.replace('{/* RCA TASK LIST */}', isg_saha_ui + lig_fin_ui + '\n\n        {/* RCA TASK LIST %}')
        code = code.replace('{/* RCA TASK LIST %}', '{/* RCA TASK LIST */}')

    # 6. BİLGİ MODALLARI (Popuplar)
    modals = r"""
      {showScoreInfo && ( <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[1001] p-4"> <div className="bg-slate-900 border border-amber-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center"> <button onClick={()=>setShowScoreInfo(false)} className="absolute top-8 right-8 text-white">✕</button> <h2 className="text-xl font-black text-amber-500 mb-6 uppercase">XP Puanlama Sistemi</h2> <div className="text-left text-sm text-gray-300 space-y-4"> <p>• Normal İş: +20 XP</p> <p>• Duruşlu İş: +50 XP</p> </div> <button onClick={()=>setShowScoreInfo(false)} className="mt-8 w-full bg-amber-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button> </div> </div> )}
      {showFinanceInfo && ( <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[1001] p-4"> <div className="bg-slate-900 border border-emerald-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center"> <button onClick={()=>setShowFinanceInfo(false)} className="absolute top-8 right-8 text-white">✕</button> <h2 className="text-xl font-black text-emerald-400 mb-6 uppercase">Maliyet Analizi</h2> <div className="text-left text-sm text-gray-300 space-y-4"> <p>• Yedek parça sarfiyatı ve bakım süreleri baz alınır.</p> </div> <button onClick={()=>setShowFinanceInfo(false)} className="mt-8 w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button> </div> </div> )}
"""
    if 'XP Puanlama Sistemi' not in code:
        code = code.replace('    </div>\n  );\n}', modals + '\n    </div>\n  );\n}')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} güncellendi.")

# Dosyaları güncelle
patch_system("app/admin/page.tsx")
patch_system("app/dashboard/page.tsx")