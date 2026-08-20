import os
import re

def titanium_structure_v51():
    # 1. 84 KB'LIK ORIJINAL TEMIZ KODU DÖKÜMDEN ÇEKELİM (HATA PAYI SIFIR)
    if not os.path.exists('PROJE_DOKUMU.txt'):
        print("PROJE_DOKUMU.txt bulunamadı!")
        return

    with open('PROJE_DOKUMU.txt', 'r', encoding='utf-8') as f:
        dump = f.read()

    target = r"C:\Users\ilker.yilmaz\Documents\AtlasProjeler\bakim-yonetim-app\app\admin\page.tsx"
    marker = f"==================== DOSYA: {target} ===================="
    start = dump.find(marker) + len(marker)
    end = dump.find("==================== DOSYA:", start)
    code = dump[start:end].strip()

    # 2. STATE VE LOGIC GÜNCELLEME (CERRAHİ EKLEME)
    new_states = """  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [bakimLigi, setBakimLigi] = useState<any[]>([]);
  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);
  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);
  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);"""
    
    if 'showScoreInfo' not in code:
        code = code.replace('const [loading, setLoading] = useState(true);', 
                          'const [loading, setLoading] = useState(true);\n' + new_states)

    calc = """
    // --- v51 TITANIUM ANALYTICS ---
    const ligaD51: any = {}; const finD51: any = {}; const grp51: any = {};
    rawLogs.forEach(l => {
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!ligaD51[p]) ligaD51[p] = { isim: p, is: 0, pts: 0 }; ligaD51[p].is++; ligaD51[p].pts += l.isDuruslu ? 50 : 20; } });
      if (!finD51[l.ekipmanAdi]) finD51[l.ekipmanAdi] = { isim: l.ekipmanAdi, pSy: 0, tSr: 0 };
      finD51[l.ekipmanAdi].pSy += (l.kullanilanMalzemeler?.length || 0); finD51[l.ekipmanAdi].tSr += Number(l.toplamSureDakika) || 0;
      if (!grp51[l.ekipmanAdi]) grp51[l.ekipmanAdi] = []; grp51[l.ekipmanAdi].push(l);
    });
    setBakimLigi(Object.values(ligaD51).sort((a:any, b:any) => b.pts - a.pts).slice(0, 3));
    setMaliyetAnalizi(Object.values(finD51).sort((a:any, b:any) => b.pSay - a.pSay).slice(0, 5));
    const m51: any[] = []; const i51: any[] = [];
    Object.keys(grp51).forEach(eq => {
      const lgs = grp51[eq].sort((a:any,b:any)=> (b.kayitTarihi?.toDate?.()||new Date(b.kayitTarihi)).getTime() - (a.kayitTarihi?.toDate?.()||new Date(a.kayitTarihi)).getTime());
      if(lgs.length >= 2) {
        let tt = 0; for(let i=0; i<lgs.length-1; i++) tt += (lgs[i].kayitTarihi?.toDate?.()||new Date(lgs[i].kayitTarihi)).getTime() - (lgs[i+1].kayitTarihi?.toDate?.()||new Date(lgs[i+1].kayitTarihi)).getTime();
        m51.push({ equipment: eq, mtbf: (tt/(lgs.length-1)/86400000).toFixed(1) });
        if(lgs.filter((l:any)=> (l.kayitTarihi?.toDate?.()||new Date(l.kayitTarihi)).getTime() > Date.now()-1296000000).length >= 2) i51.push({ equipment: eq });
      }
    });
    setPredictiveInsights(i51.slice(0,3)); setMtbfMetrics(m51.sort((a,b)=>Number(b.mtbf)-Number(a.mtbf)).slice(0,5));
    """
    code = code.replace('setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));', 
                        'setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));' + calc)

    # 3. HİYERARŞİK DÜZENLEME (ATOMIC RE-ORDER)
    # Header yanına Tekil Duruş Oranı
    downtime_ui = r"""
              {/* v51: TEKİL DURUŞ ORANI */}
              {(() => {
                const totalM = Number(kpiTotals.sure) || 0;
                const downM = Number(kpiTotals.durus) || 0;
                const rat = totalM > 0 ? (downM / totalM) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${rat < 30 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>%{rat.toFixed(1)}</span>
                  </div>
                )
              })()}"""
    code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + downtime_ui)

    # Seviye 2: İSG ve Saha Bildirimleri (Grid)
    level2_ui = r"""
        {/* v51: SEVİYE 2 - İSG VE SAHA BİLDİRİMLERİ (YAN YANA) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 no-print">
           <div className="bg-red-500/[0.03] backdrop-blur-3xl border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold text-gray-200">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">Detay</button>
                  </div>
                ))}
              </div>
           </div>
           <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3.5rem] shadow-2xl">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 border border-white/5 p-5 rounded-[2rem] flex justify-between items-center">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold text-gray-200">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">İncele</button>
                  </div>
                ))}
              </div>
           </div>
        </div>
"""

    # Seviye 3: Lig, Finans ve Analitik
    level3_ui = """
        {/* v51: SEVİYE 3 - LİG, FİNANS VE ANALİTİK */}
        {userRole !== "isg" && (
          <div className="space-y-12 mb-16 no-print">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-amber-500/[0.03] backdrop-blur-3xl border border-amber-500/20 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                   <div className="flex justify-between items-start mb-8">
                      <h2 className="text-sm font-black text-amber-500 uppercase tracking-[0.4em]">🏆 BAKIM YILDIZLARI LİGİ</h2>
                      <button onClick={() => setShowScoreInfo(true)} className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[8px] font-black px-3 py-1 rounded-full border border-amber-500/20 uppercase transition-all">Puanlar nasıl hesaplandı?</button>
                   </div>
                   <div className="space-y-6">
                     {bakimLigi.length > 0 ? bakimLigi.map((p, i) => (
                       <div key={i} className={`flex justify-between items-center p-5 rounded-[2rem] border ${i===0?'border-amber-500/40 bg-amber-500/10':'border-white/5 bg-white/5'}`}>
                         <div className="flex items-center gap-4"><span className="text-2xl">{i===0?'🥇':i===1?'🥈':'🥉'}</span><div><p className="text-xs font-black text-white uppercase">{p.isim}</p><p className="text-[8px] text-gray-500 font-bold uppercase">{p.is} Müdahale</p></div></div>
                         <div className="text-right"><p className="text-sm font-black text-amber-400">{p.pts}</p><p className="text-[8px] text-amber-600 font-black uppercase">XP PUAN</p></div>
                       </div>
                     )) : <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase tracking-widest animate-pulse">Veri Bekleniyor...</p>}
                   </div>
                </div>
                <div className="bg-emerald-500/[0.03] backdrop-blur-3xl border border-emerald-500/20 p-10 rounded-[3.5rem] shadow-2xl">
                   <div className="flex justify-between items-start mb-8">
                      <h2 className="text-sm font-black text-emerald-400 uppercase tracking-[0.4em]">💰 EN MALİYETLİ EKİPMANLAR</h2>
                      <button onClick={() => setShowFinanceInfo(true)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[8px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase transition-all">Liste neye göre belirlendi?</button>
                   </div>
                   <div className="space-y-4">
                     {maliyetAnalizi.length > 0 ? maliyetAnalizi.map((e, i) => (
                       <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                         <div><p className="text-[10px] font-bold text-gray-300 uppercase">{e.isim}</p><p className="text-[8px] text-gray-600 font-black uppercase">{e.pSay} Sarfiyat</p></div>
                         <div className="text-right"><span className="text-sm font-black text-emerald-500">{e.tSr} DK</span><p className="text-[8px] text-emerald-800 font-black uppercase">TOPLAM MALİYET</p></div>
                       </div>
                     )) : <p className="text-center py-10 text-gray-700 text-[10px] font-black uppercase tracking-widest animate-pulse">Analiz Bekleniyor...</p>}
                   </div>
                </div>
             </div>
             <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
                <h2 className="text-sm font-black text-indigo-400 mb-8 uppercase tracking-[0.5em] flex items-center gap-4">🧠 AI KRİTİK ARIZA ÖNGÖRÜSÜ <span className="h-2 w-2 bg-red-500 rounded-full animate-ping"></span></h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {predictiveInsights.length > 0 ? predictiveInsights.map((ins, i) => (
                    <div key={i} className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2.5rem] flex flex-col justify-center items-center text-center animate-pulse">
                      <p className="text-[12px] font-black text-red-400 uppercase mb-2">{ins.equipment}</p>
                      <span className="bg-red-600 text-white text-[9px] font-black px-6 py-2 rounded-full uppercase">Kritik Risk</span>
                    </div>
                  )) : <div className="col-span-3 py-10 text-center text-teal-500 font-black text-[11px] uppercase animate-pulse tracking-[0.4em]">✓ SİSTEM ANALİZİ TAMAMLANDI</div>}
                </div>
             </div>
          </div>
        )}
"""

    # MODAL PENCERELERİ (BİLGİ)
    info_modals = r"""
      {showScoreInfo && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[1001] p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-10 rounded-[3.5rem] max-w-lg w-full relative shadow-3xl text-center">
            <button onClick={() => setShowScoreInfo(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition">✕</button>
            <div className="text-4xl mb-6">🏆</div>
            <h2 className="text-xl font-black text-amber-500 mb-6 uppercase tracking-widest">XP Puan Sistemi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Normal İş Kapatma: +20 XP | Duruşlu İş Kapatma: +50 XP</p>
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
            <h2 className="text-xl font-black text-emerald-400 mb-6 uppercase tracking-widest">Maliyet Analizi</h2>
            <div className="text-left space-y-4 text-gray-300 text-sm leading-relaxed">
              <p>Liste yedek parça sarfiyatı ve toplam müdahale süresi baz alınarak hesaplanır.</p>
            </div>
            <button onClick={() => setShowFinanceInfo(false)} className="mt-8 w-full bg-emerald-600 py-4 rounded-2xl font-black uppercase text-xs">Kapat</button>
          </div>
        </div>
      )}
"""

    # --- HİYERARŞİK MONTAJ ---
    # Seviye 1 (22 Buton) zaten orijinal kodda Header altında.
    # Seviye 2'yi 22 Buton gridinin sonrasına yerleştirelim.
    code = code.replace('{/* RCA TASK LIST */}', level2_ui + level3_ui + '\n\n        {/* RCA TASK LIST %}')
    code = code.replace('{/* RCA TASK LIST %}', '{/* RCA TASK LIST */}')
    
    # Modalları sona ekle
    code = code.replace('    </div>\n  );\n}', info_modals + '\n    </div>\n  );\n}')

    # Tasarım Mühürü
    code = code.replace('bg-gray-950', 'bg-[#020617]').replace('bg-gray-900', 'bg-indigo-500/[0.02] backdrop-blur-3xl border border-indigo-500/10 shadow-2xl').replace('rounded-[40px]', 'rounded-[3.5rem]')

    with open('app/admin/page.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("[BAŞARILI] v51 TITANIUM: Kusursuz Hiyerarşi mühürlendi.")

titanium_structure_v51()