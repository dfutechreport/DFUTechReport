import os

# Analiz dışı bırakılacak klasörler (Gereksiz yükü önler)
EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'build', 'dist', '__pycache__', 'venv'}
# Sadece bu uzantılara sahip dosyaları oku
INCLUDE_EXTENSIONS = {'.ts', '.tsx', '.py', '.css', '.json', '.js', '.html'}

def generate_dna_dump(output_file='PROJE_GUNCEL_KOD_DOKUMU.txt'):
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for root, dirs, files in os.walk('.'):
            # Gereksiz klasörleri atla
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if any(file.endswith(ext) for ext in INCLUDE_EXTENSIONS):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, '.')
                    
                    f_out.write(f"\n{'='*20} DOSYA: {relative_path} {'='*20}\n")
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f_in:
                            f_out.write(f_in.read())
                    except Exception as e:
                        f_out.write(f"HATA: Dosya okunamadı. ({str(e)})")
                    f_out.write(f"\n\n")

    print(f"İşlem tamam! {output_file} oluşturuldu.")

if __name__ == "__main__":
    generate_dna_dump()