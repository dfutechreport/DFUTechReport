import * as yup from "yup";

// Arıza Bildirim Formu için Kesin Kurallar Dizisi
export const arizaBildirimSemasi = yup.object().shape({
  hatId: yup.string()
    .required("Lütfen üretim hattını (Örn: Kruvasan Hattı) seçiniz!"),
    
  ekipmanId: yup.string()
    .required("Lütfen arızalı ekipmanı (Örn: Spiral Mikser) seçiniz!"),
    
  sorunTipi: yup.string()
    .required("Sorun tipini (Mekanik, Elektrik, Otomasyon vb.) belirtmek zorunludur!"),
    
  aciklama: yup.string()
    .min(10, "Açıklama çok kısa. Lütfen arızayı en az 10 karakter ile detaylandırın!")
    .required("Açıklama alanı boş bırakılamaz!"),
    
  durusSuresi: yup.number()
    .typeError("Duruş süresi sadece rakamla girilmelidir!")
    .positive("Duruş süresi 0'dan büyük olmalıdır!")
    .integer("Duruş süresi tam sayı olmalıdır!")
    .required("Duruş süresi (dakika) girilmek zorundadır!")
});