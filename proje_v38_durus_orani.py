import os
import re

def simplify_downtime_ratio(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. ESKİ v38 ve v39 GÖSTERGELERİNİ TEMİZLE
    # Her ihtimale karşı tüm v38_ ve v39_ etiketli UI bloklarını temizliyoruz
    code = re.sub(r'\{/\* v3[89]_.*?\}\)$$\}', '', code, flags=re.DOTALL)

    # 2. YENİ YALIN GÖSTERGEYİ EKLE
    new_ui = r"""
              {/* v40_lean_ratio: YALIN DURUŞ ORANI */}
              {(() => {
                const totalMins = Number(kpiTotals.sure) || 0;
                const downtimeMins = Number(kpiTotals.durus) || 0;
                const ratio = totalMins > 0 ? (downtimeMins / totalMins) * 100 : 0;
                return (
                  <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">DURUŞ ORANI:</span>
                    <span className={`text-sm font-black tracking-tighter $${ratio < 30 ? 'text-green-400' : ratio < 60 ? 'text-yellow-400' : 'text-red-400 animate-pulse'}`}>
                      %{ratio.toFixed(1)}
                    </span>
                  </div>
                )
              })()}"""

    if 'v40_lean_ratio' not in code:
        code = re.sub(r'(Komuta Merkezi</h1>)', r'\1' + new_ui, code)

    # 3. MODAL VARSA TEMİZLE (Kalıntı engelleme)
    code = code.replace('showDowntimeModal', 'false /* REMOVED */')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} yalın duruş oranı ile güncellendi.")

# ÇALIŞTIR
simplify_downtime_ratio("app/admin/page.tsx")