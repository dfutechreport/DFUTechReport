import os
import re

def absolute_rebuild_v49():
    # 1. 84 KB'lık ORIJINAL TEMIZ KODU DÖKÜMDEN ÇEKELİM (HATA PAYI SIFIR)
    if not os.path.exists('PROJE_DOKUMU.txt'):
        print("PROJE_DOKUMU.txt bulunamadı!")
        return

    with open('PROJE_DOKUMU.txt', 'r', encoding='utf-8') as f:
        dump = f.read()

    target = r"C:\Users\ilker.yilmaz\Documents\AtlasProjeler\bakim-yonetim-app\app\admin\page.tsx"
    marker = f"==================== DOSYA: {target} ===================="
    start = dump.find(marker) + len(marker)
    end = dump.find("==================== DOSYA:", start)
    original_admin = dump[start:end].strip()

    # 2. ANALİTİK VE HİYERARŞİ ENJEKSİYONU (TERTEMİZ BİR BAŞLANGIÇ)
    # State'leri ekleyelim
    code = original_admin.replace('const [loading, setLoading] = useState(true);', 
        'const [loading, setLoading] = useState(true);\n  const [showScoreInfo, setShowScoreInfo] = useState(false);\n  const [showFinanceInfo, setShowFinanceInfo] = useState(false);\n  const [bakimLigi, setBakimLigi] = useState<any[]>([]);\n  const [maliyetAnalizi, setMaliyetAnalizi] = useState<any[]>([]);\n  const [predictiveInsights, setPredictiveInsights] = useState<any[]>([]);\n  const [mtbfMetrics, setMtbfMetrics] = useState<any[]>([]);\n  const [rawLogs, setRawLogs] = useState<any[]>([]);')

    # Hesaplama Motoru (useEffect)
    calc = """
    const ligaD49: any = {}; const finD49: any = {}; const grp49: any = {};
    rawLogs.forEach(l => {
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!ligaD49[p]) ligaD49[p] = { isim: p, is: 0, pts: 0 }; ligaD49[p].is++; ligaD49[p].pts += l.isDuruslu ? 50 : 20; } });
      if (!finD49[l.ekipmanAdi]) finD49[l.ekipmanAdi] = { isim: l.ekipmanAdi, pSy: 0, tSr: 0 };
      finD49[l.ekipmanAdi].pSy += (l.kullanilanMalzemeler?.length || 0); finD49[l.ekipmanAdi].tSr += Number(l.toplamSureDakika) || 0;
      if (!grp49[l.ekipmanAdi]) grp49[l.ekipmanAdi] = []; grp49[l.ekipmanAdi].push(l);
    });
    setBakimLigi(Object.values(ligaD49).sort((a:any, b:any) => b.pts - a.pts).slice(0, 3));
    setMaliyetAnalizi(Object.values(finD49).sort((a:any, b:any) => b.pSy - a.pSy).slice(0, 5));
    const m49: any[] = []; const i49: any[] = [];
    Object.keys(grp49).forEach(eq => {
      const lgs = grp49[eq].sort((a:any,b:any)=> (b.kayitTarihi?.toDate?.()||new Date(b.kayitTarihi)).getTime() - (a.kayitTarihi?.toDate?.()||new Date(a.kayitTarihi)).getTime());
      if(lgs.length >= 2) {
        let tt = 0; for(let i=0; i<lgs.length-1; i++) tt += (lgs[i].kayitTarihi?.toDate?.()||new Date(lgs[i].kayitTarihi)).getTime() - (lgs[i+1].kayitTarihi?.toDate?.()||new Date(lgs[i+1].kayitTarihi)).getTime();
        m49.push({ equipment: eq, mtbf: (tt/(lgs.length-1)/86400000).toFixed(1) });
        if(lgs.filter((l:any)=> (l.kayitTarihi?.toDate?.()||new Date(l.kayitTarihi)).getTime() > Date.now()-1296000000).length >= 2) i49.push({ equipment: eq });
      }
    });
    setPredictiveInsights(i49.slice(0,3)); setMtbfMetrics(m49.sort((a,b)=>Number(b.mtbf)-Number(a.mtbf)).slice(0,5));
    """
    code = code.replace('setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));', 'setGrafikIsHatti(Object.keys(hD).map(k=>({ isim: k, adet: hD[k] })));' + calc)

    # UI Restorasyonu (Hiyerarşi)
    # Header'ın yanına Tekil Duruş Oranı
    downtime_ui = r"""
              {/* DURUŞ ORANI */}
              {(() => {
                const totalM = Number(kpiTotals.sure) || 0;
                const downM = Number(kpiTotals.durus) || 0;
                const rat = totalM > 0 ? (downM / totalM) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${rat < 30 ? 'text-green-400' : 'text-red-400'}`}>%{rat.toFixed(1)}</span>
                  </div>
                )
              })()}"""
    code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + downtime_ui)

    # İSG ve Saha (En Üstte)
    top_ui = r"""
        {/* v49: TOP PRIORITY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
           <div className="bg-red-500/[0.03] backdrop-blur-3xl border border-red-500/20 p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
              <h2 className="text-sm font-black text-red-500 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">🚒 İSG ALARMLARI</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {aktifIsgAlarmlari.map(a => (
                  <div key={a.id} className="bg-white/5 p-5 rounded-[2rem] flex justify-between items-center">
                    <div><p className="text-[9px] font-black text-red-400 uppercase">{a.hatAdi}</p><p className="text-xs font-bold">{a.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(a); setShowVakaModal(true);}} className="bg-red-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">Detay</button>
                  </div>
                ))}
              </div>
           </div>
           <div className="bg-indigo-500/[0.03] backdrop-blur-3xl border border-indigo-500/10 p-8 rounded-[3.5rem] shadow-2xl">
              <h2 className="text-sm font-black text-indigo-400 mb-6 uppercase tracking-[0.4em] flex items-center gap-3">📢 SAHA BİLDİRİMLERİ</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {aktifIsler.map(is => (
                  <div key={is.id} className="bg-white/5 p-5 rounded-[2rem] flex justify-between items-center">
                    <div><p className="text-[9px] font-black text-indigo-400 uppercase">{is.hatAdi}</p><p className="text-xs font-bold">{is.ekipmanAdi}</p></div>
                    <button onClick={()=> {setSelectedVaka(is); setShowVakaModal(true);}} className="bg-indigo-600 text-white text-[9px] font-black px-5 py-2 rounded-xl">İncele</button>
                  </div>
                ))}
              </div>
           </div>
        </div>
"""
    code = code.replace('</div>\n\n        {/* 22 BUTTON GRID', top_ui + '</div>\n\n        {/* 22 BUTTON GRID')

    # Dosyayı yaz
    with open('app/admin/page.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("[BAŞARILI] app/admin/page.tsx tertemiz ve mükemmel hiyerarşiyle yenilendi.")

absolute_rebuild_v49()