import os

# Boyutu şişiren klasörler ve dosyalar
EXCLUDE_DIRS = {'node_modules', '.next', '.git', 'build', 'dist', '__pycache__', 'public'}
EXCLUDE_FILES = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'}
INCLUDE_EXTENSIONS = {'.ts', '.tsx', '.py', '.css', '.json', '.js', '.html'}

def generate_lean_dump(output_file='PROJE_RAFINE_DOKUM.txt'):
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for root, dirs, files in os.walk('.'):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for file in files:
                if file in EXCLUDE_FILES: continue
                if any(file.endswith(ext) for ext in INCLUDE_EXTENSIONS):
                    file_path = os.path.join(root, file)
                    f_out.write(f"\n{'='*20} DOSYA: {os.path.relpath(file_path, '.')} {'='*20}\n")
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f_in:
                            f_out.write(f_in.read())
                    except:
                        f_out.write("HATA: Okunamadı.")
                    f_out.write("\n\n")
    print(f"İşlem tamam: {output_file}")

if __name__ == "__main__":
    generate_lean_dump()