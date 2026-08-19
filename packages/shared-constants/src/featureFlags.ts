// Dentsocia PRD v3 (Ağustos 2026) ile mevcut kod tabanı arasındaki kapsam farkını yönetir.
// Kod hiçbir zaman silinmiyor — PRD'nin MVP dışına aldığı her modül burada bir flag'e bağlı,
// route/ekran flag kapalıyken mount edilmiyor/gösterilmiyor ama olduğu gibi duruyor. Flag açılırsa
// özellik hiçbir kod değişikliği gerekmeden geri gelir. Referans PRD satırı köşeli parantezde.
export const FEATURE_FLAGS = {
  socialFeed: false, // [Faz 2 kapsam: "Ana akış (feed)"] — GET /cases (feed listesi) + FeedScreen
  candidatePoolSearch: false, // [Faz 2 kapsam: "aday havuzunda arama (ücretli)"] — Sniper arama/unlock
  instructorEconomy: false, // [Faz 3 kapsam: "Eğitmen (KOL)... kilitli premium içerik, abonelik, sertifika doğrulama ağı"]
  communityHubs: false, // [Faz 3 kapsam: "kapalı topluluklar (Hub)"]
  associationTools: false, // [Faz 3 kapsam: "dernek ve kurum sayfaları"] — duyuru/oylama/aidiyet
  associationDues: false, // [Faz 4 kapsam: "dernek aidat tahsilatı"]
  eventTicketing: false, // [Faz 4 kapsam: "kongre biletleme"]
  payments: false, // [§5.2: "Faz 1'de kimseden para alınmıyor"] — tüm iyzico akışları, master gate
  orgReviews: false, // [§5.2: "İşveren puanlama/yorum ... Planlanmıyor"]
  // PRD'de (ne MVP ne sonraki fazlarda) hiç bahsi geçmiyor — eski plandan kalma, varsayılan açık.
  references: true,
  swipeMatching: true,
  instagramImport: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
