import re
import os

def restore():
    # Döküm dosyasını oku
    dump_filename = 'PROJE_GUNCEL_KOD_DOKUMU.txt'
    
    if not os.path.exists(dump_filename):
        print(f"HATA: {dump_filename} bulunamadı. Lütfen döküm dosyasının betikle aynı klasörde olduğundan emin olun.")
        return

    with open(dump_filename, 'r', encoding='utf-8') as f:
        data = f.read()
    
    # Dosya yollarını ve içeriklerini ayıkla
    # Pattern: ==================== DOSYA: path ====================
    files = re.findall(r"==================== DOSYA: (.*?) ====================\n(.*?)(?=\n==================== DOSYA:|$)", data, re.DOTALL)
    
    print(f"Toplam {len(files)} dosya işleniyor...\n")

    for path, content in files:
        path = path.strip()
        
        # Betik dosyalarını ve gereksiz boşlukları atla
        if not path or path.endswith('.py') or '{target}' in path:
            continue

        # Windows/Linux yol ayracı uyumluluğu
        path = path.replace('\\', os.sep).replace('/', os.sep)
        
        # Klasör dizinini kontrol et
        directory = os.path.dirname(path)
        
        try:
            # Sadece bir alt dizin varsa klasör oluştur
            if directory:
                os.makedirs(directory, exist_ok=True)
            
            # Dosyayı yaz
            with open(path, 'w', encoding='utf-8') as f_out:
                f_out.write(content.strip())
            print(f"[BAŞARILI] Kurtarıldı: {path}")
        except Exception as e:
            print(f"[HATA] {path} yazılırken sorun oluştu: {e}")

if __name__ == "__main__":
    restore()
    print("\nSistem restorasyonu tamamlandı. Şimdi Vercel'e push edebilirsiniz.")