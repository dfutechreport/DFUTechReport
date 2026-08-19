import os
import re

def full_clean_header(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. TÜM ESKİ KALINTILARI TEMİZLE (v38, v39, v40 bloklarını siler)
    code = re.sub(r'\{/\* v3[89]_.*?\}\)$$\}', '', code, flags=re.DOTALL)
    code = re.sub(r'\{/\* v40_.*?\}\)$$$\}', '', code, flags=re.DOTALL)
    
    # 2. TEK VE KESİN GÖSTERGEYİ EKLE
    single_ui = r"""
              {/* v41_final_ratio: KESİN DURUŞ ORANI */}
              {(() => {
                const totalMins = Number(kpiTotals.sure) || 0;
                const downtimeMins = Number(kpiTotals.durus) || 0;
                const ratio = totalMins > 0 ? (downtimeMins / totalMins) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter ${ratio < 30 ? 'text-green-400' : ratio < 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>
                      %{ratio.toFixed(1)}
                    </span>
                  </div>
                )
              })()}"""

    if 'v41_final_ratio' not in code:
        # Başlığın hemen yanına sadece 1 adet ekle
        code = re.sub(r'(Komuta Merkezi</h1>)', r'\1' + single_ui, code)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} temizlendi. Mükerrer satırlar kaldırıldı.")

# ÇALIŞTIR
full_clean_header("app/admin/page.tsx")