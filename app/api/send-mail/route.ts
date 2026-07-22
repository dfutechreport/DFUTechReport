import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    // 1. Formdan gelen verileri (stok kodu, parça adı vb.) yakalıyoruz
    const body = await req.json();
    const { parcaAdi, stokKodu, kalanStok, birim, teknisyen, hat, ekipman } = body;

    // 2. Gmail SMTP Sunucu Bağlantı Ayarları
     const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL/TLS kullanmaya zorluyoruz
      auth: {
        
        user: 'dfuteknik@gmail.com', // Gönderici Gmail adresi
        pass: 'vfqfqwblcgzkztdr' // Gmail'den aldığınız 16 haneli uygulama şifresi (boşluksuz yazın)
      }
    });

    // 3. Gönderilecek Mailin İçeriği ve Alıcıları
    const mailOptions = {
      from: '"DFU Bakım Sistemi" <dfuteknik@gmail.com>', // Gönderen görünen isim
      // LÜTFEN AŞAĞIDAKİ SATIRA MAİLİN GİDECEĞİ KİŞİLERİ YAZIN (Virgülle ayırabilirsiniz)
      to: 'emin.ogul@donukfirincilik.com.tr, ilker.yilmaz@donukfirincilik.com.tr, halil.cakir@donukfirincilik.com.tr', 
      subject: `🚨 KRİTİK STOK UYARISI: ${parcaAdi} Tükendi!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; border: 2px solid #e53e3e; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #e53e3e; border-bottom: 1px solid #ddd; padding-bottom: 10px;">⚠️ Kritik Yedek Parça Alarmı</h2>
          <p style="font-size: 16px;">Sistemde bir yedek parçanın stoğu <strong>2 veya altına</strong> düşmüştür. Lütfen acil satın alma talebi oluşturunuz.</p>
          
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px; text-align: left;">
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 35%; background: #f9fafb;">Stok Kodu</td>
              <td style="padding: 12px; border: 1px solid #ddd; font-family: monospace; font-size: 16px;">${stokKodu}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; background: #f9fafb;">Malzeme Adı</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${parcaAdi}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #e53e3e; background: #f9fafb;">Kalan Stok</td>
              <td style="padding: 12px; border: 1px solid #ddd; color: #e53e3e; font-weight: bold; font-size: 18px;">${kalanStok} ${birim}</td>
            </tr>
          </table>

          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 30px;">
            <h3 style="margin-top: 0; color:#4a5568; font-size: 15px;">🔍 Son Kullanım (Stoğu Düşüren İşlem):</h3>
            <ul style="line-height: 1.8; margin-bottom: 0;">
              <li><strong>Teknisyen:</strong> ${teknisyen}</li>
              <li><strong>Hat / Ekipman:</strong> ${hat} / ${ekipman}</li>
              <li><strong>İşlem Tarihi:</strong> ${new Date().toLocaleString('tr-TR')}</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center;">
            Bu e-posta DFU Bakım Yönetim Sistemi tarafından otomatik oluşturulmuştur. Lütfen yanıtlamayınız.
          </p>
        </div>
      `
    };

    // 4. Maili Gönderme İşlemi
    await transporter.sendMail(mailOptions);
    
    // Başarılı olursa sisteme 200 OK yanıtı dön
    return NextResponse.json({ success: true, message: "Mail başarıyla gönderildi" });

  } catch (error) {
    console.error("Mail Gönderim Hatası:", error);
    // Hata olursa 500 Server Error dön
    return NextResponse.json({ success: false, error: 'E-posta gönderilemedi' }, { status: 500 });
  }
}
