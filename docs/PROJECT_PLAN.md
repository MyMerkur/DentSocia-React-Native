# DENTSOCIA — Proje Uygulama Planı (Claude Code için)

**Amaç:** Bu doküman, PRD (v1.1) ve Teknik Mimari belgesindeki (v1.0) kararları; senin onayladığın altyapı tercihleriyle (Atlas, sıfırdan GitHub, Bare React Native, domain yok) birleştirip, Claude Code'un adım adım takip edebileceği yürütme planına çeviriyor. Mobile-first stratejisiyle **önce backend + mobil uygulama**, web uygulaması ayrı bir faz olarak sona bırakıldı.

Bu dosyayı repo'da `docs/PROJECT_PLAN.md` olarak tutman ve Claude Code'a projeye her oturumda "önce docs/PROJECT_PLAN.md'yi oku, şu an Faz X'teyiz" diyerek başlaman öneriliyor.

---

## 1. Onaylanan Kararlar (Özet)

| Konu | Karar |
|---|---|
| Veritabanı | **MongoDB Atlas** (dev/staging/prod hepsi Atlas; VPS'teki mevcut Mongo kurulumu prod için kullanılmayacak) |
| GitHub | **Sıfırdan** private repo + org kurulacak |
| Mobil | **Bare React Native** (Expo değil) — native build zinciri, Xcode + Android Studio gerekiyor |
| Domain | Şu an yok — ilk aşamada IP/port üzerinden yayın, domain alınınca Nginx + SSL eklenecek |
| Backend hosting | Mevcut VPS, PM2 ile process yönetimi |
| Web | Ayrı, sonraki bir faz (Faz 7) — mobil lansmandan sonra ele alınacak |

### Faz 0 başında netleşmesi gereken açık kararlar
Bunlar planı bloke etmiyor ama Faz 0'ın ilk günlerinde karar verilmeli:
- **Medya depolama:** AWS S3 mi, Cloudflare R2 mi? (Öneri: R2 — egress ücreti yok, S3 API uyumlu, maliyet avantajlı)
- **Ödeme sağlayıcısı önceliği:** Türkiye pazarı için iyzico mu önce, Stripe mu önce? (Faz 3'e kadar karar verilebilir)
- **GitHub org adı** ve **Apple Developer (yıllık $99) / Google Play Console ($25 tek seferlik)** hesapları — Bare RN ile store'a çıkarken zorunlu, Faz 6'ya kadar açılabilir ama hesap onay süreçleri (özellikle Apple) günler sürebildiği için Faz 5 (tasarım) sırasında paralel olarak başvurulması, Faz 6 başında hazır olması tavsiye edilir.
- **Sentry / izleme hesabı** — ücretsiz plan yeterli, Faz 0'da açılabilir.

---

## 2. Monorepo Yapısı

Web şimdilik yok ama paylaşılan paketler ileride web'in de aynı iş mantığını kullanabilmesi için baştan bu şekilde kurulacak:

```
dentsocia/
├── apps/
│   ├── backend/          # Node.js + Express (TypeScript, MVC)
│   └── mobile/            # React Native (Bare, TypeScript)
│   └── web/                # [Faz 7'de eklenecek — şimdilik yok]
├── packages/
│   ├── shared-types/       # Ortak TS tipleri (User, Case, Job, ...)
│   ├── shared-validation/   # Zod şemaları
│   ├── shared-constants/    # Roller, KYC seviyeleri, rozet tipleri
│   ├── api-client/           # Ortak fetch/axios katmanı
│   └── ui-tokens/             # Dark & Gold tema: renk, tipografi, spacing
├── infra/
│   ├── docker/                # docker-compose (Redis, local test ortamı)
│   ├── pm2/                    # ecosystem.config.js (staging/prod)
│   └── github-actions/          # CI/CD workflow dosyaları
├── docs/
│   └── PROJECT_PLAN.md           # Bu dosya
├── package.json
├── turbo.json                      # Turborepo pipeline
└── tsconfig.base.json
```

**Araç seçimi:** pnpm workspaces + Turborepo (tech doc önerisiyle uyumlu, cache'li build/test için hız kazandırır).

---

## 3. GitHub Kurulumu

### 3.1 Organizasyon ve repo
- Yeni bir GitHub **organization** oluştur (kişisel hesap yerine — ileride ekip/collaborator eklemek kolaylaşır).
- İçinde **`dentsocia`** adında **private** repo aç.
- `.gitignore` (node, RN, macOS, .env dosyaları), `LICENSE` (private proje için opsiyonel), `README.md` iskeleti.

### 3.2 Branch stratejisi
- `main` → production (VPS prod'a deploy edilen kod)
- `develop` → staging (VPS staging'e deploy edilen entegrasyon dalı)
- `feature/<faz>-<kisa-aciklama>` → örn. `feature/faz1-auth-kyc`
- `fix/<kisa-aciklama>` → bugfix dalları
- `release/vX.Y` → opsiyonel, store submission öncesi dondurma dalı

Kurallar: `main` ve `develop` doğrudan push'a kapalı (branch protection), her değişiklik PR ile girer, PR'da en az CI (lint+test) yeşil olmalı.

### 3.3 Commit ve PR konvansiyonu
- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` önekleri.
- PR şablonu (`.github/PULL_REQUEST_TEMPLATE.md`): değişiklik özeti, ilgili PRD/Faz referansı, test edildi mi, ekran görüntüsü/GIF (mobil UI değişikliklerinde).
- Issue şablonları: `bug_report.md`, `feature_request.md`.

### 3.4 GitHub Projects (board)
- Tek bir **"DentSocia Roadmap"** projesi (Projects v2, Board görünümü).
- Sütunlar: `Backlog` → `Bu Sprint` → `Devam Ediyor` → `Review/Test` → `Done`.
- Her **Faz** (Faz 0, Faz 1, …) bir **Milestone** olarak repo'da tanımlanır; her görev/issue ilgili milestone'a bağlanır.
- Her Faz'ın sonunda milestone kapatılır, board'da "Done" biriken kartlar arşivlenir — bu senin ilerlemeyi tek bakışta görmeni sağlar.

### 3.5 GitHub Actions (CI/CD)
`infra/github-actions/` altında üç workflow:
1. **`ci.yml`** — her PR'da: lint (ESLint), typecheck (tsc), unit/integration test (Jest+Supertest backend, RN Testing Library mobile).
2. **`deploy-staging.yml`** — `develop`'a push'ta: SSH ile VPS'e bağlan, backend'i build edip PM2 staging process'ini reload et.
3. **`deploy-production.yml`** — `main`'e merge'de: aynı akış, prod PM2 process'i; **GitHub Environments** ile manuel onay (approval) adımı eklenmesi öneriliyor (yanlışlıkla prod'a deploy'u engellemek için).

Not: Mobil tarafta Bare RN olduğu için CI'da native build (özellikle iOS/macOS runner) ayrı ve daha maliyetli bir konu — Faz 0-2'de mobil CI'ı sadece lint/typecheck/JS test ile sınırlı tutup, native build/store dağıtımını Faz 6'da Fastlane ile ele almak öneriliyor.

---

## 4. Ortamlar ve Secrets

| Ortam | Backend | DB | Amaç |
|---|---|---|---|
| **Development** | Yerel makine (localhost) | Atlas `dentsocia-dev` cluster (ücretsiz M0 tier yeterli) | Günlük geliştirme |
| **Staging** | VPS, PM2 process `dentsocia-api-staging`, ayrı port (örn. 4001) | Atlas `dentsocia-staging` cluster/DB | Faz sonu demo, QA |
| **Production** | VPS, PM2 process `dentsocia-api-prod`, port 4000 | Atlas `dentsocia-prod` cluster | Canlı kullanıcılar |

GitHub Secrets (repo/organization settings): `VPS_HOST`, `VPS_SSH_KEY`, `ATLAS_URI_STAGING`, `ATLAS_URI_PROD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `R2_ACCESS_KEY` (veya S3), `SENTRY_DSN`. `.env.example` dosyası repo'da tutulur, gerçek `.env` dosyaları asla commit edilmez.

---

## 5. Backend Mimarisi (Node.js + Express, MVC + Service + Repository)

Teknik mimari belgesindeki yapı aynen korunuyor:

```
apps/backend/src/
├── config/          # db, env, s3/r2, socket, redis bağlantıları
├── models/           # Mongoose şemaları (User, Case, Job, Clinic, ...)
├── controllers/       # HTTP request/response (ince katman)
├── services/            # İş mantığı (KYC doğrulama, feed algoritması, ödeme)
├── repositories/          # Mongoose sorgu katmanı
├── routes/                 # /api/v1/... route tanımları
├── middlewares/              # auth, roleGuard(level), rateLimiter, errorHandler
├── validators/                 # shared-validation (Zod) kullanan istek doğrulama
├── jobs/                          # BullMQ arka plan işleri
├── sockets/                        # Socket.io event handler'ları
├── utils/                            # OCR çağrısı, QR üretimi vb.
└── app.ts
```

Faz 1'de kurulacak ilk modüller: `auth` (kayıt/giriş, JWT), `users/profile` (Vitrin+Kariyer sekmeleri), `kyc` (belge yükleme + OCR onay Level 1-2), `cases` (vaka paylaşım şablonu), `jobs/applications` (temel liste, swipe yok), `notifications` (in-app + e-posta).

---

## 6. Mobil Mimarisi (React Native — Bare Workflow, TypeScript)

```
apps/mobile/src/
├── screens/           # Feed, Hubs, Create, Career, Profile
├── navigation/          # Bottom tab (5'li ana menü) + stack navigator
├── components/            # ui-tokens paketini kullanan paylaşılan bileşenler
├── features/                # Modül bazlı: feed, jobs, messaging, hubs, kyc
├── services/                   # api-client, push (FCM), socket bağlantısı
└── store/                        # Zustand global state
```

**Bare RN olduğu için dikkat edilecekler:**
- Geliştirme makinesinde **Xcode + CocoaPods** (iOS) ve **Android Studio + JDK** (Android) kurulu olmalı; Expo Go ile anlık önizleme yok, simulator/emulator veya fiziksel cihaz + USB debugging ile test edilecek.
- Native modül eklemek gerektiğinde (kamera, push bildirim, OCR için dosya seçici vb.) `pod install` / Gradle sync adımları manuel yürütülecek.
- OTA (over-the-air) güncelleme için Expo Updates gibi hazır bir çözüm yok; küçük JS düzeltmeleri bile yeni build + (Faz 6 sonrası) store submission gerektirebilir. İstenirse ileride `react-native-code-push` benzeri bir çözüm ayrıca değerlendirilebilir — plana şimdilik dahil edilmedi.
- Push bildirim: Firebase Cloud Messaging (FCM) native entegrasyonu (`@react-native-firebase/messaging`).
- State: Zustand (client state) + React Query/TanStack Query (server state/cache).

---

## 7. Paylaşılan Paketler

- **shared-types:** `User`, `Case`, `Job`, `Application`, `Clinic`, `Company`, `Hub`, `Certificate`, `Subscription` gibi tipler.
- **shared-validation:** Zod şemaları — backend'de request validation, mobilde form validation için aynı şema tekrar kullanılır.
- **shared-constants:** KYC seviyeleri (1-4), rozet tipleri, roller (hekim/asistan/teknisyen/klinik/firma/dernek).
- **api-client:** axios tabanlı, JWT refresh interceptor'lı, backend base URL ortam değişkeninden okunan ortak istemci.
- **ui-tokens:** Dark & Gold tema — koyu karbon (#121212) zemin, elektrik mavisi/şampanya altını vurgu, Inter/SF Pro tipografi, glassmorphism (buzlu cam) stil değişkenleri. Bu paket doğrudan RN'de `StyleSheet` değerleri olarak, ileride web'de Tailwind config olarak tüketilecek.

---

## 8. Veritabanı (MongoDB Atlas) — Ana Koleksiyonlar

`users`, `cases`, `jobs`, `applications`, `clinics`/`companies`, `associations`, `hubs`, `certificates`, `subscriptions`, `messages`/`threads`, `notifications`, `credits`, `events`, `reports`/`reviews`.

Detaylı alan bazlı şema Faz 1 başında Mongoose model dosyaları yazılırken netleştirilecek (PRD Bölüm 2-6 referans alınarak). Atlas Search, vaka/etiket bazlı arama için Faz 2'de devreye girecek (Elasticsearch'e gerek yok, maliyet/karmaşıklık avantajı).

---

## 9. API ve Kimlik Doğrulama

- REST, versiyonlu: `/api/v1/...`
- JWT access (kısa ömürlü, örn. 15 dk) + refresh token (uzun ömürlü, secure storage — mobilde `react-native-keychain`).
- `roleGuard(minLevel)` middleware — örn. iş ilanı yayınlama Level 3+, içerik kilitleme Level 4.
- Dosya yükleme: mobil doğrudan S3/R2'ye **pre-signed URL** ile yükler, backend sadece meta veriyi kaydeder (KYC belgeleri, vaka fotoğrafları).
- Socket.io: oda bazlı yayın (kullanıcı odaları, hub odaları) — Smart Inbox ve bildirim rozetleri (Faz 2'den itibaren).

---

## 10. VPS Deployment — Mevcut Durum ve Kurulacaklar

**Mevcut:** Node.js, PM2, MongoDB kurulu.
**Not:** MongoDB Atlas tercih edildiği için VPS'teki Mongo kurulumu prod/staging'de kullanılmayacak (dilersen lokal test/yedek amaçlı dursun, zararı yok).

**Faz 0'da VPS'e eklenecekler:**
1. **Redis** kurulumu (BullMQ kuyruk sistemi ve cache için) — `apt install redis-server`, sadece localhost'a bağlı, şifreli.
2. **Deploy kullanıcısı** ve GitHub Actions için ayrı bir **SSH deploy key** (root ile deploy yapılmayacak).
3. Klasör yapısı: `/var/www/dentsocia/backend` (git ile clone edilecek), `/var/www/dentsocia/shared` (paylaşılan `.env` dosyaları, log klasörleri).
4. **PM2 ecosystem dosyası** (`infra/pm2/ecosystem.config.js`) — `dentsocia-api-staging` (port 4001) ve `dentsocia-api-prod` (port 4000) adında iki ayrı process.
5. **pm2-logrotate** modülü (log dosyalarının şişmesini engellemek için).
6. **Firewall (ufw):** sadece 22 (SSH), 80/443 (domain gelince), backend portları sadece localhost/nginx üzerinden erişilebilir olacak şekilde kapatılacak.
7. **Domain geldiğinde:** Nginx reverse proxy (`api.dentsocia.com` → localhost:4000/4001) + Certbot (Let's Encrypt) ile ücretsiz SSL. Bu adım domain alınana kadar bekletiliyor; o zamana kadar geliştirme/test IP:port üzerinden yürütülecek.

---

## 11. Yol Haritası (Fazlar) — Mobile-First Sıralama

Orijinal teknik dokümandaki 6 fazlık plan, web'in sona alınmasıyla ve Faz 4 sonrasına ayrı bir tasarım fazı eklenmesiyle yeniden sıralandı. Backend her fazda mobil ile birlikte ilerliyor; web tamamen ayrı bir faz (Faz 7).

### Faz 0 — Temel Altyapı *(1-2 hafta)*
- Monorepo kurulumu (pnpm + Turborepo), GitHub org/repo/branch/Projects board kurulumu
- CI pipeline (lint+test), VPS'e Redis kurulumu, deploy user + SSH key, PM2 ecosystem (staging/prod)
- Backend iskeleti (Express + MVC klasörleri), Atlas bağlantısı (dev/staging/prod cluster), temel JWT auth
- React Native (Bare) proje iskeleti, navigation (5'li tab), ui-tokens paketi (Dark & Gold)
- **Definition of Done:** Boş bir "Hello World" ekranı olan mobil app, backend'e login isteği atabiliyor; staging'e otomatik deploy çalışıyor.

### Faz 1 — MVP: Çekirdek Döngü *(6-8 hafta)*
- Kayıt/giriş + Level 1-2 KYC (belge yükleme, OCR onay entegrasyonu — Claude API ile)
- Dinamik profil (Vitrin + Kariyer sekmeleri), mikro-yetkinlik etiketleri
- Vaka paylaşım şablonu (öncesi/orta/sonrası) + temel Ana Akış (Feed)
- İş ilanı oluşturma ve başvuru (liste görünümü, swipe henüz yok)
- Temel bildirimler (in-app + e-posta)
- → PRD Aşamaları: 1, 2, 3 (Level 1-2), 4 (kısmi), 5, 12 (temel)
- **DoD:** Bir kullanıcı uçtan uca kayıt olup, profil oluşturup, vaka paylaşıp, ilana başvurabiliyor; staging'de canlı demo yapılabiliyor.

### Faz 2 — Etkileşim ve Güven Katmanı *(5-7 hafta)*
- Level 3 KYC (klinik/firma onayı), kilitli unvan sistemi
- Smart Inbox (kategorize mesajlaşma) + Socket.io gerçek zamanlı katman
- Klinik/firma kurumsal vitrin sayfaları
- Swipe bazlı kariyer eşleştirmesi, gizli iş arama modu
- Referanslar, klinik yıldızlama
- → PRD Aşamaları: 3 (Level 3), 4, 12, 13, 14

### Faz 3 — Monetizasyon: Eğitmen Ekonomisi *(6-8 hafta)*
- Level 4 (Eğitmen) daveti akışı, Instagram entegrasyonu + AI ile vaka şablonuna dönüştürme
- Teaser Paywall, abonelik altyapısı (Stripe/iyzico — Faz 0'da netleşen önceliğe göre)
- Uçtan uca sertifika/kurs onay sistemi (QR sertifika üretimi)
- Hibrit B2B gelir modeli: alakart ilan + klinik premium abonelik
- → PRD Aşamaları: 6, 8, 15, 16 (kısmi)

### Faz 4 — Topluluk ve Kurumsal Katman *(6-8 hafta)*
- DentSocia Hubs (ücretli/ücretsiz mikro-topluluklar)
- Dernek sayfaları, aidiyet etiketleri, push duyuru, dijital oylama
- Dernek fintech entegrasyonu (otomatik aidat tahsilatı)
- Etkinlik/kongre biletleme modülü
- B2B "Keskin Nişancı" kredi sistemi ve veri odaklı lead satışı
- → PRD Aşamaları: 9, 10, 11, 15 (tamamı)

### Faz 5 — Mobil UX/UI Tasarım *(13-18 hafta)*
Faz 0-4 fonksiyon-öncelikli inşa edildi; `packages/ui-tokens` bare bir token dosyasından (renk/tipografi/spacing/radius) öteye geçmedi, paylaşılan bir bileşen kütüphanesi hiç kurulmadı, boş-durum/animasyon tutarsız, auth sadece giriş ekranından ibaret. Bu faz, mevcut 41 ekran/modalin tamamını profesyonel bir tasarım sistemine taşır — yüzeysel bir "cila" değil, tam bir yeniden inşa. Süreç her adımda **önce Claude Design'da (claude.ai/design) mockup + onay, sonra React Native kodu** şeklinde ilerler.
- Tasarım sistemi temeli: `ui-tokens` v2 (semantic renk/state, gradient/glassmorphism, elevation, tipografi presetleri + gerçek custom font, motion tokenları, ikon kütüphanesi kararı)
- Paylaşılan bileşen kütüphanesi: Button/Card/Input/Badge/Avatar/EmptyState/Skeleton/Modal-shell/BottomSheet
- Navigasyon/modal mimarisi kararı (ADR) ve app-geneli uygulanması
- Mikro-etkileşim ve animasyon katmanı (`react-native-reanimated`)
- Auth/Onboarding akışı + ilk sınıf KYC akışı (issue #11 bu kapsamla birleşir)
- Feed, Profil/Vitrin, İş İlanları/Eşleştirme, Hub/B2B, Mesajlaşma/Bildirim, Etkinlik/Kurs/Dernek/Abonelik ekranlarının tamamının yeni sisteme taşınması
- Ana ekran mimarisi: sidebar (drawer), Ana Sayfa'da bildirim ikonu (okunmamış rozeti) ve mesajlar için tab bar erişimi (#72)
- Dark/Light tema desteği, cihaz temasına göre otomatik geçiş (#73)
- **Non-goals:** özel ikon seti yok, backend değişikliği yok, Fastlane/store/waitlist yok (Faz 6'da), AI Onboarding Asistanı davranışı Faz 6'da kalır — bu fazda sadece standart onboarding UI'ı inşa edilir.

### Faz 6 — Mobil Lansman Hazırlığı *(4-6 hafta)*
- Sinematik waitlist (bu aşamada basit bir statik sayfa/landing yeterli, tam web henüz yok)
- AI Onboarding Asistanı (hekim/klinik/hoca kayıt akışları)
- Apple Developer + Google Play Console hesapları, Fastlane ile store build/submit akışı
- Performans/ölçeklenebilirlik testleri, güvenlik denetimi (KVKK dahil)
- App Store / Play Store yayına alma
- → PRD Aşaması: 16

### Faz 7 — Web Uygulaması *(mobil lansman sonrası, 6-8 hafta, ayrı ekip/zaman dilimi)*
- `apps/web` eklenir (Next.js App Router)
- Herkese açık sayfalar (iş ilanları SEO, klinik/firma vitrinleri, waitlist) — SSR/ISR
- Kullanıcı paneli (CSR) — mobil ile aynı backend API'lerini `api-client` üzerinden tüketir
- Admin paneli (KYC onay, dernek onay, moderasyon)
- Vercel veya aynı VPS üzerinde ayrı PM2 process olarak barındırma kararı bu fazda verilir

**Kümülatif süre (mobil lansmana kadar, Faz 0-6):** yaklaşık 45-58 hafta, tek full-stack geliştirici + gerektiğinde tasarım/QA desteği varsayımıyla. Faz 7 (web) bu sürenin dışında, ayrıca planlanır.

---

## 12. Claude Code Çalışma Prensibi

1. Bu dosyayı repo'ya `docs/PROJECT_PLAN.md` olarak ekle; `CLAUDE.md` içinden referans ver ("Çalışmaya başlamadan önce docs/PROJECT_PLAN.md'yi oku").
2. Her faz için: önce ilgili GitHub Milestone + issue'ları oluştur (Claude Code'a "Faz 1 için issue'ları GitHub'da oluştur" denebilir), sonra `feature/*` branch'lerinde geliştir.
3. Her özellik: kod + test birlikte yazılır (Jest/Supertest backend, RN Testing Library mobil); CI yeşil olmadan PR merge edilmez.
4. Her PR'da Conventional Commits formatı kullanılır; PR açıklamasında ilgili PRD/Faz referansı belirtilir.
5. `develop`'a merge → otomatik staging deploy → sende veya Claude Code'da kısa bir manuel/otomatik smoke test.
6. Faz sonunda `develop` → `main` PR'ı ile prod'a alınır (GitHub Environment approval adımıyla).
7. Faz kapanışında: Milestone kapatılır, board'daki "Done" kartlar arşivlenir, bir sonraki fazın issue'ları açılır.

---

## 13. Güvenlik ve KVKK Notları

Platform kimlik/diploma/vergi levhası gibi hassas belgeler işlediği için:
- Belgeler S3/R2'de şifreli (server-side encryption) saklanır, erişim sadece pre-signed URL ile ve süreli.
- `helmet.js`, rate limiting, girdi doğrulama (Zod) her endpoint'te zorunlu.
- KVKK aydınlatma metni + açık rıza akışı kayıt sırasında (Faz 1'de auth ile birlikte).
- Loglarda kişisel veri/redaction — Winston log formatter'da hassas alanlar maskelenir.
- Sentry hata takibi, düzenli (örn. faz sonu) temel güvenlik gözden geçirmesi.

---

## 14. İlk Adımlar — Hemen Yapılacaklar Checklist

1. [ ] GitHub organization + `dentsocia` private repo oluştur
2. [ ] MongoDB Atlas hesabı + 3 cluster/DB (dev/staging/prod, M0 ücretsiz tier ile başlanabilir)
3. [ ] Depolama kararı: R2 mi S3 mi — hesap aç
4. [ ] VPS'e SSH ile bağlanıp Redis kur, deploy kullanıcısı + SSH key oluştur
5. [ ] Claude Code'u repo'da başlat, bu dosyayı `docs/PROJECT_PLAN.md` olarak ekletip Faz 0'ı başlat
6. [ ] Apple Developer / Google Play hesapları için başvuruyu şimdiden başlat (onay süreleri uzun olabiliyor)

---

*Bu doküman canlı bir çalışma dosyasıdır; fazlar ilerledikçe güncellenmeli. PRD v1.1 ve Teknik Mimari v1.0 ile birlikte okunmalıdır.*
