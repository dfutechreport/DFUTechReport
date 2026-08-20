import os
import re

def absolute_surgical_wipe(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı. Lütfen betiği projenin ana dizininde çalıştırın.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. TÜM ESKİ v38-v42 BLOKLARINI KOMPLE TEMİZLE
    code = re.sub(r'\{/\* v(3[89]|4[0-9]).*?\}\)$$\}', '', code, flags=re.DOTALL)
    
    # 2. AYRICA EĞER MODAL OLARAK KALDIYSA ONLARI DA TEMİZLE
    code = re.sub(r'\{showDowntimeModal && $$.*?$\}', '', code, flags=re.DOTALL)
    
    # 3. TEKRARLAYAN DIV KALINTILARINI TEMİZLE
    code = re.sub(r'<div className="flex items-center gap-3 ml-6 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md no-print">[\s\S]*?</div>', '', code)

    # 4. TEK VE KESİN GÖSTERGEYİ YERLEŞTİR
    final_ui = r"""
              {/* v43_final: TEKİL DURUŞ ORANI */}
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

    # Başlığın yanına sadece bir tane ekle
    if 'v43_final' not in code:
        code = code.replace('Komuta Merkezi</h1>', 'Komuta Merkezi</h1>' + final_ui)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print("[BAŞARILI] Tüm kalabalık temizlendi. Sadece tek satır Duruş Oranı bırakıldı.")

# ÇALIŞTIR
absolute_surgical_wipe("app/admin/page.tsx")