# ui-tokens

Dark & Gold tema tokenleri: koyu karbon (#121212) zemin, elektrik mavisi/şampanya altını vurgu renkleri, gerçek Inter tipografisi, glassmorphism stil değişkenleri.

## v2 (Faz 5 — Mobil UX/UI Tasarım)

`src/theme.ts` `colors`, `gradients`, `typography`, `fontFamilies`, `typographyPresets`, `spacing`, `radii`, `elevation`, `motion`, `icon` gruplarını birleştirir. Her grup ayrı bir dosyada:

- `colors.ts` — v1 düz renkler (geriye dönük uyumluluk için korunuyor) + v2 semantic/state varyantları (hover/pressed/disabled) ve `gradients` (goldSheen, glass)
- `typography.ts` — v1 `typography` (fontFamily: "System") korunuyor; v2 `fontFamilies` (Inter-Regular/Medium/SemiBold/Bold) ve `typographyPresets` (display/h1/h2/h3/bodyLarge/body/caption/label)
- `spacing.ts` — `spacing` (xs-xxxl) ve `radii` (sm-xl, pill)
- `elevation.ts` — 3 seviyeli shadow/elevation, her biri `{ ios, android }` platform değerleriyle
- `motion.ts` — `duration` (fast/base/slow) ve `easing` (cubic-bezier kontrol noktaları, `react-native-reanimated`'in `Easing.bezier(...)`'ına verilmek üzere)
- `icons.ts` — ikon kütüphanesi kararı (`lucide-react-native` + `react-native-svg`) ve boyut/stroke sabitleri

**Neden v1 ve v2 bir arada?** 41 ekran/modal henüz yeni sisteme taşınmadı (bkz. docs/PROJECT_PLAN.md, Faz 5 issue kırılımı — #62-#66). v1 anahtarları kaldırılmadan yanında v2 eklenerek geçiş kırılmasız yapılıyor; ekranlar taşındıkça v1-only anahtarlar zamanla terk edilecek.

**Font native linking:** `apps/mobile/assets/fonts/` altındaki Inter TTF dosyaları `react-native-asset` ile iOS (`Info.plist` UIAppFonts + Xcode Resources) ve Android (`assets/fonts`) tarafına zaten bağlandı. Yeni bir font dosyası eklenirse `pnpm --filter @dentsocia/mobile assets:link` çalıştırılıp native proje değişiklikleri commit edilmeli.

Mobilde RN `StyleSheet` değerleri olarak kullanılıyor, ileride web'de Tailwind config olarak tüketilecek.
