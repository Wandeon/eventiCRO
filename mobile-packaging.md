# Mobile Packaging (v1) — Android TWA & iOS Capacitor

> **Scope:** Guidance for wrapping the EventiCRO PWA as a trusted web activity on Android and a Capacitor shell on iOS. Covers minimum OS support, required permissions with store copy, and a submission checklist for Google Play and App Store review.
>
> **References:**
> - [project baseline index](project-baseline-index.md)
> - [frontend UI & PWA spec](frontend-ui-pwa.md)

---

## 0) Minimum OS versions

- **Android:** API 29 (Android 10) or later. Requires Chrome 96+ for full TWA support.
- **iOS:** iOS 15 or later. Built with the current major Capacitor version.

---

## 1) Permissions & user-facing copy

Only request what the PWA actually uses. Provide clear copy for store listings and runtime prompts.

| Permission | Platform | Purpose & copy |
| ---------- | -------- | -------------- |
| Location | Android & iOS | "Allow EventiCRO to access your location to show nearby events." |
| Camera | Android & iOS | "Needed to scan QR codes and attach photos when submitting events." |
| Notifications | Android & iOS | "Get reminders for saved events and updates." |
| Storage (optional) | Android | "Used for caching images and offline data." |

---

## 2) Store submission checklist

- App name, icon (512×512), feature graphic.
- Screenshots: phone + tablet (Android), 6.7"/5.5" (iOS).
- Privacy policy URL and in-app link.
- Digital Asset Links statement (Android TWA) hosted at `https://app.example.com/.well-known/assetlinks.json`.
- Bundle identifiers: `cro.eventi.app` (Android) / `hr.eventi.app` (iOS).
- Provide demo credentials for review: `reviewer@example.com` / `password123`.
- Fill in permission usage descriptions (Info.plist / Play Console declarations).
- Test release build on physical devices covering min OS versions.
- Ensure web content passes Core Web Vitals and serves over HTTPS.
- Final run of `npm run build && npm run preview` before packaging.

---

## 3) After approval

- Monitor crashes/analytics via self-hosted Sentry.
- Schedule regular updates (monthly) even if web app is updated more frequently.

