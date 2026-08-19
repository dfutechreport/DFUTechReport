import os
import re

def inject_downtime_ratio(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. KPI State Güncelleme (durusCount ekleme)
    if 'durusCount: 0' not in code:
        code = code.replace('is: 0, sure: 0, durus: 0, mttr: 0', 'is: 0, sure: 0, durus: 0, mttr: 0, durusCount: 0')

    # 2. Hesaplama Motoru (useEffect) Güncelleme
    # durusCount değişkenini tanımla ve her duruşlu işte artır
    if 'durusCount: duCount' not in code:
        code = code.replace('let isC=0, suC=0, duC=0;', 'let isC=0, suC=0, duC=0, duCount=0;')
        # Her duruşlu işte sayacı artır
        code = code.replace('if(l.isDuruslu) {', 'if(l.isDuruslu) {\n           duCount++;')
        # State'e gönder
        code = code.replace('mttr: isC > 0 ? (suC/isC) : 0', 'mttr: isC > 0 ? (suC/isC) : 0, durusCount: duCount')

    # 3. UI Enjeksiyonu (Komuta Merkezi yanına)
    if 'DURUŞ ORANI' not in code:
        indicator_html = r"""
              {/* v38_ratio: DURUŞ YOĞUNLUK GÖSTERGESİ */}
              {(() => {
                const ratio = kpiTotals.is > 0 ? (kpiTotals.durusCount / kpiTotals.is) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${ratio < 20 ? 'text-green-400' : ratio < 40 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>
                      %{ratio.toFixed(1)}
                    </span>
                  </div>
                )
              })()}"""
        
        # 'Komuta Merkezi' h1 etiketinden sonraya yerleştir
        code = re.sub(r'(Komuta Merkezi</h1>)', r'\1' + indicator_html, code)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} duruş oranı analitiği ile mühürlendi.")

# ÇALIŞTIR
inject_downtime_ratio("app/admin/page.tsx")