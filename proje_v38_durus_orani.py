import os
import re

def fix_downtime_duration_ratio(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. ESKİ ADET BAZLI GÖSTERGEYİ TEMİZLE VE SÜRE BAZLIYI EKLE
    # v38_ratio veya v38_live olarak eklenen her türlü göstergeyi bulup güncelliyoruz.
    
    new_indicator_ui = r"""
              {/* v39_duration_ratio: SÜRE BAZLI DURUŞ YOĞUNLUĞU */}
              {(() => {
                // SÜRE BAZLI HESAPLAMA: (Duruş Süresi / Toplam Bakım Süresi)
                const totalMins = Number(kpiTotals.sure) || 0;
                const downtimeMins = Number(kpiTotals.durus) || 0;
                const durationRatio = totalMins > 0 ? (downtimeMins / totalMins) * 100 : 0;
                
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ YOĞUNLUĞU (SÜRE):</span>
                    <span className={`text-sm font-black tracking-tighter ${durationRatio < 30 ? 'text-green-400' : durationRatio < 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>
                      %{durationRatio.toFixed(1)}
                    </span>
                  </div>
                )
              })()}"""

    # Varsa eski v38 göstergelerini temizleyelim
    code = re.sub(r'\{/\* v38_.*?\}\)$$\}', '', code, flags=re.DOTALL)
    
    # Komuta Merkezi h1 etiketinden sonraya yeni süreli göstergeyi yerleştir
    if 'v39_duration_ratio' not in code:
        code = re.sub(r'(Komuta Merkezi</h1>)', r'\1' + new_indicator_ui, code)

    # 2. HESAPLAMA MOTORUNU (useEffect) KESİNLEŞTİR
    # kpiTotals.durus ve kpiTotals.sure'nin rakamsal olduğundan emin olalım
    # Dökümünüzdeki duC ve suC zaten dakika cinsinden sürelerdi.
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} süre bazlı duruş oranıyla güncellendi.")

# ÇALIŞTIR
fix_downtime_duration_ratio("app/admin/page.tsx")