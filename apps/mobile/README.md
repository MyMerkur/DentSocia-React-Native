# apps/mobile

Bare React Native (TypeScript) mobil uygulaması. Expo kullanılmıyor — native modüllere doğrudan erişim gerektiği için (kamera, OCR dosya seçici, push bildirim) bare workflow tercih edildi.

## Şu an neler var

- Kimlik doğrulama olmadan önce `LoginScreen` gösteriliyor; başarılı giriş/kayıt sonrası 5'li tab navigasyona (`Feed`, `Hubs`, `Create`, `Career`, `Profile`) geçiliyor — hepsi henüz placeholder.
- `@dentsocia/api-client` üzerinden backend'in `/api/v1/auth/*` uçlarına gerçek istek atılıyor, oturum `zustand` (`useAuthStore`) ile tutuluyor.
- `@dentsocia/ui-tokens` paketindeki Dark & Gold tema (koyu karbon zemin, elektrik mavisi + şampanya altını vurgu) kullanılıyor.

## Çalıştırma

Önce kök dizinde `pnpm install` yapılmış ve backend ayakta olmalı (`pnpm --filter @dentsocia/server dev`, varsayılan `http://localhost:4000`).

```bash
# iOS (Xcode + CocoaPods gerekir)
cd ios && bundle exec pod install && cd ..
pnpm --filter @dentsocia/mobile ios

# Android (Android Studio + SDK gerekir — bu iskelette henüz kurulmadı)
pnpm --filter @dentsocia/mobile android
```

Diğer komutlar:

```bash
pnpm --filter @dentsocia/mobile typecheck
pnpm --filter @dentsocia/mobile lint
pnpm --filter @dentsocia/mobile test
```

## Bilinen sınırlamalar

- Bu ortamda sadece iOS simulator üzerinden derleme/çalıştırma doğrulandı. Android SDK kurulu değil, `android/` klasörü RN CLI ile geldi ama build edilmedi.
- `api-client`'ın base URL'i şimdilik `apps/mobile/src/services/authApi.ts` içinde sabit (`http://localhost:4000`) — ortam bazlı (dev/staging/prod) yapılandırma ileride eklenecek.
- Metro, pnpm workspace kökünü görebilmesi için `metro.config.js`'de `watchFolders` ile monorepo kökünü izliyor; yeni bir paylaşılan paket eklerken bu ayarın bozulmadığından emin olun.
