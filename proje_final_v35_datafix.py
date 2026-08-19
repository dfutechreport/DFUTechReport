import os
import re

def fix_data_flow(path):
    if not os.path.exists(path):
        return
    
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()

    # 1. State Kontrolü: rawLogs yoksa ekle
    if 'const [rawLogs' not in code:
        code = code.replace('const [loading, setLoading] = useState(true);', 
                          'const [loading, setLoading] = useState(true);\n  const [rawLogs, setRawLogs] = useState<any[]>([]);')

    # 2. Veri Çekme Katmanı: fetchInitialData veya useEffect içine ekle
    fetch_logic = """
      const logsSnap = await getDocs(query(collection(db, "maintenance_logs"), orderBy("kayitTarihi", "desc"), limit(400)));
      setRawLogs(logsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));"""
    
    if 'maintenance_logs' not in code:
        # Dashboard için özel yerleştirme (onAuthStateChanged sonrası)
        code = code.replace('setLoading(false);', fetch_logic + '\n          setLoading(false);')
    
    # 3. Hesaplama Motorunu useEffect'e mühürle
    calc_engine = """
  useEffect(() => {
    if (rawLogs.length === 0) return;
    const ligaD35: any = {}; const finD35: any = {};
    rawLogs.forEach(l => {
      const crew = Array.isArray(l.isiYapanlar) ? l.isiYapanlar : [l.bildirenKisi];
      crew.forEach((p: string) => { if(p) { if (!ligaD35[p]) ligaD35[p] = { isim: p, is: 0, points: 0 }; ligaD35[p].is++; ligaD35[p].points += l.isDuruslu ? 50 : 20; } });
      if (!finD35[l.ekipmanAdi]) finD35[l.ekipmanAdi] = { isim: l.ekipmanAdi, pSay: 0, tSure: 0 };
      finD35[l.ekipmanAdi].pSay += (l.kullanilanMalzemeler?.length || 0); finD35[l.ekipmanAdi].tSure += Number(l.toplamSureDakika) || 0;
    });
    setBakimLigi(Object.values(ligaD35).sort((a:any, b:any) => b.points - a.points).slice(0, 3));
    setMaliyetAnalizi(Object.values(finD35).sort((a:any, b:any) => b.pSay - a.pSay).slice(0, 5));
  }, [rawLogs]);
"""
    if 'useEffect(() => {' in code and 'ligaD35' not in code:
        # Mevcut useEffect'lerin sonuna ekle
        code = code.replace('return () => unsubscribe();\n  }, []);', 'return () => unsubscribe();\n  }, []);\n' + calc_engine)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"[BAŞARILI] {path} veri akışı mühürlendi.")

# EXECUTE
fix_data_flow("app/admin/page.tsx")
fix_data_flow("app/dashboard/page.tsx")