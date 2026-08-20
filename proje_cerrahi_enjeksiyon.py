
import os
import re

def inject_nexus_modules(file_path):
    if not os.path.exists(file_path):
        print(f"[UYARI] {file_path} bulunamadı, bu dosya atlandı.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Recharts Import Kontrolü
    if "recharts" not in content and "BarChart" not in content:
        import_line = 'import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";\n'
        content = content.replace('import { useEffect', import_line + 'import { useEffect')

    # 2. State Enjeksiyonu
    state_block = """
  // NEXUS V22 STATES
  const [showLeagueInfo, setShowLeagueInfo] = useState(false);
  const [showCorrInfo, setShowCorrInfo] = useState(false);
  const [personelList, setPersonelList] = useState<any[]>([]);
  const [corrData, setCorrData] = useState<any[]>([]);
    """
    if "showLeagueInfo" not in content:
        # İlk useState'den sonraya ekle
        content = re.sub(r'(const \[.*?, set.*?\] = useState\(.*?\);)', r'\1' + state_block, content, count=1)

    # 3. Veri Çekme (Effect) Enjeksiyonu
    effect_block = """
    const fetchNexusData = async () => {
      try {
        const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
        const pQuery = query(collection(db, "personel"), orderBy("xp", "desc"), limit(5));
        const pSnap = await getDocs(pQuery);
        setPersonelList(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const bSnap = await getDocs(collection(db, "bakimlar"));
        const parcaSayac: any = {};
        bSnap.docs.forEach(d => {
          const data = d.data();
          if (data.sarfiyat) {
            data.sarfiyat.forEach((item: any) => {
              const name = item.parcaAdi || item.stokKodu || "Bilinmeyen";
              parcaSayac[name] = (parcaSayac[name] || 0) + 1;
            });
          }
        });
        setCorrData(Object.entries(parcaSayac).map(([part, failure]) => ({ part, failure })).sort((a:any, b:any) => b.failure - a.failure).slice(0, 5));
      } catch (e) { console.error("Nexus Data Error:", e); }
    };
    fetchNexusData();
    """
    if "fetchNexusData" not in content:
        # fetchData(); çağrısını bul ve sonuna ekle
        if "fetchData();" in content:
            content = content.replace('fetchData();', 'fetchData();' + effect_block)
        else:
            # Eğer fetchData yoksa useEffect başlangıcına koy
            content = content.replace('useEffect(() => {', 'useEffect(() => {\n' + effect_block)

    # 4. Arayüz (JSX) Enjeksiyonu
    jsx_block = """
      {/* --- NEXUS V22: BAKIM LİGİ & KORELASYON (YAN YANA) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl relative shadow-lg">
          <button onClick={() => setShowLeagueInfo(true)} className="absolute top-2 right-2 text-indigo-400 text-[10px] uppercase border border-indigo-500/30 px-2 rounded hover:bg-indigo-500/20 transition-all font-bold">Algoritma ?</button>
          <h3 className="text-indigo-400 text-xs font-bold mb-3 italic tracking-widest border-l-2 border-indigo-500 pl-2 uppercase">Bakım Ligi (XP)</h3>
          <div className="space-y-2">
            {personelList.map((p, i) => (
              <div key={i} className="flex justify-between bg-black/30 p-2 rounded text-[11px] border border-white/5 hover:border-indigo-500/30 transition-all">
                <span className="text-gray-300 font-bold">{p.adSoyad || p.name}</span>
                <span className="text-emerald-400 font-mono">{p.xp || 0} XP</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-xl relative shadow-lg">
          <button onClick={() => setShowCorrInfo(true)} className="absolute top-2 right-2 text-emerald-400 text-[10px] uppercase border border-emerald-500/30 px-2 rounded hover:bg-emerald-500/20 transition-all font-bold">Metodoloji ?</button>
          <h3 className="text-emerald-400 text-xs font-bold mb-3 italic tracking-widest border-l-2 border-emerald-500 pl-2 uppercase">Kritik Parça Analizi</h3>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={corrData}><Bar dataKey="failure" fill="#10b981" radius={[2, 2, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- NEXUS ALGORİTMA MODALLARI --- */}
      {showLeagueInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#020617] border-2 border-indigo-500/50 p-8 rounded-3xl max-w-lg w-full">
            <h4 className="text-indigo-400 font-bold mb-6 text-xl italic border-b border-indigo-500/20 pb-2 uppercase">XP & Seviye Sistemi Detayları</h4>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong>1. Arıza Müdahale:</strong> 30 dk altındaki her işlem <strong>+150 XP</strong>.</p>
              <p><strong>2. Planlı Bakım:</strong> Zamanında kapatılan PM formları <strong>+100 XP</strong>.</p>
              <p><strong>3. İSG/EKED:</strong> Tam uyum ve enerji kesme disiplini <strong>+200 XP Bonus</strong>.</p>
              <p><strong>4. Seviye:</strong> Her 1000 XP bir üst seviyeyi (Master Tech) temsil eder.</p>
            </div>
            <button onClick={() => setShowLeagueInfo(false)} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all">ANLAŞILDI</button>
          </div>
        </div>
      )}
      {showCorrInfo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#020617] border-2 border-emerald-500/50 p-8 rounded-3xl max-w-lg w-full">
            <h4 className="text-emerald-400 font-bold mb-6 text-xl italic border-b border-emerald-500/20 pb-2 uppercase">Korelasyon Metodolojisi</h4>
            <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
              <p><strong>Veri Madenciliği:</strong> Bu modül, 'bakimlar' koleksiyonundaki sarfiyat dizilerini gerçek zamanlı tarayarak en yüksek değişim frekansına sahip parçaları bulur.</p>
              <p><strong>Kritiklik:</strong> En yüksek bar, tesisin "Kronik Arıza Kaynağı" olan yedek parçayı ve ekipmanı temsil eder. Stok yönetimi bu veriye göre optimize edilir.</p>
            </div>
            <button onClick={() => setShowCorrInfo(false)} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all">ANLAŞILDI</button>
          </div>
        </div>
      )}
    """
    
    if "NEXUS V22" not in content:
        # Ana dashboard kapsayıcısını bul (Örn: max-w-7xl veya ilk grid)
        # Sizin dökümünüzde genelde "max-w-7xl mx-auto px-4 py-6" veya benzeri bir div var
        content = content.replace('<div className="max-w-7xl mx-auto px-4 py-6">', 
                                  '<div className="max-w-7xl mx-auto px-4 py-6">' + jsx_block)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"[TAMAMLANDI] {file_path} başarıyla enjekte edildi.")

# Operasyon Başlıyor
if __name__ == "__main__":
    print("--- DFU NEXUS CERRAHİ ENJEKSİYON BAŞLATILIYOR ---")
    inject_nexus_modules("app/admin/page.tsx")
    inject_nexus_modules("app/dashboard/page.tsx")
    print("\nİşlem bitti. Mevcut işleyişiniz korundu, yeni modüller eklendi.")
