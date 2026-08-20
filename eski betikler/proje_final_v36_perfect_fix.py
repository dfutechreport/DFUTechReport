import os
import re

def power_fix(path):
    if not os.path.exists(path):
        print(f"[HATA] {path} bulunamadı.")
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    print(f"--- {path} Analiz Ediliyor ---")

    # 1. State Enjeksiyonu (Eğer yoksa)
    if 'const [rawLogs' not in code:
        code = re.sub(r'(const\s*$$1$$\s*=\s*useState$true$;)', 
                      r'\1\n  const [rawLogs, setRawLogs] = useState<any[]>([]);', code)

    # 2. Veri Çekme Katmanı (Firebase'den logları çekme)
    fetch_logic = """
      const logsSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"), limit(400)));
      setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));"""
    
    if 'maintenance_logs' not in code:
        # setLoading(false) satırının hemen üstüne veriyi çekme komutunu ekle
        code = re.sub(r'(setLoading$false$;)', fetch_logic + r'\n          \1', code)

    # 3. Hesaplama Motoru (useEffect)
    calc_engine = """
  useEffect(() => {
    if (rawLogs.length === 0) return;
    const ligaD36: any = {}; const finD36: any = {};
    rawLogs.forEach(l => {
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!ligaD36[p]) ligaD36[p] = { isim: p, is: 0, points: 0 }; ligaD36[p].is++; ligaD36[p].points += l.isDuruslu ? 50 : 20; } });
      if (!finD36[l.ekipmanAdi]) finD36[l.ekipmanAdi] = { isim: l.ekipmanAdi, pSay: 0, tSure: 0 };
      finD36[l.ekipmanAdi].pSay += (l.kullanilanMalzemeler?.length || 0); finD36[l.ekipmanAdi].tSure += Number(l.toplamSureDakika) || 0;
    });
    setBakimLigi(Object.values(ligaD36).sort((a:any, b:any) => b.points - a.points).slice(0, 3));
    setMaliyetAnalizi(Object.values(finD36).sort((a:any, b:any) => b.pSay - a.pSay).slice(0, 5));
  }, [rawLogs]);
"""
    if 'ligaD36' not in code:
        # İlk useEffect'in bitiş parantezini bul ve sonrasına yeni useEffect'i ekle
        code = re.sub(r'(return\s*$$\s*=>\s*unsubscribe$$$;\s*\}\s*,\s*$$1$$\s*\);)', r'\1\n' + calc_engine, code)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} güncellendi.")

# ÇALIŞTIR
power_fix("app/admin/page.tsx")
power_fix("app/dashboard/page.tsx")

print("\nŞimdi şu komutları sırayla çalıştırın:")
print("1. git add .")
print("2. git commit -m 'fix: visual data flow secured v36'")
print("3. git push")