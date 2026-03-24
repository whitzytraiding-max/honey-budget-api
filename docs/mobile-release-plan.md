# Honey Budget Mobile Release Plan

## Base Version

The app is set up as:

- a React/Vite web app in `frontend/`
- a Node/Express + Prisma API in the project root
- a Capacitor shell for native iPhone and Android builds
- a simple localization layer in `frontend/src/i18n/`

## Current Localization Base

Current supported locales:

- English (`en`)
- Spanish (`es`)

To add another language:

1. Add a new locale key to `frontend/src/i18n/translations.js`
2. Add the locale code to `SUPPORTED_LOCALES` in `frontend/src/i18n/LanguageProvider.jsx`
3. Add the user-facing language label in `frontend/src/components/pages/SettingsPage.jsx`
4. Rebuild the frontend

## iPhone Test Setup

For a real iPhone test, the app cannot use relative `/api` URLs. Set the API URL to either:

- a hosted backend URL, or
- your Mac's local network IP

Example:

```bash
cd frontend
cp .env.example .env
```

Then change:

```bash
VITE_API_BASE_URL=http://YOUR_MAC_IP:4000
```

To find your Mac IP:

```bash
ipconfig getifaddr en0
```

Also start the backend so your phone can reach it:

```bash
npm run start:lan
```

To test immediately in Safari on your iPhone before using Xcode:

```bash
cd frontend
npm run dev:host
```

Then open this on your iPhone while both devices are on the same Wi-Fi:

```text
http://YOUR_MAC_IP:5173
```

For this machine right now, that IP is:

```text
http://192.168.0.103:5173
```

## Native Build Flow

From `frontend/`:

```bash
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

To open iOS in Xcode:

```bash
npx cap open ios
```

Then in Xcode:

1. Select the `App` target
2. Set a unique Bundle Identifier
3. Choose your Apple Team
4. Connect your iPhone
5. Trust the developer profile on the device if prompted
6. Press Run

Note: full native iPhone testing requires the full Xcode app, not just Command Line Tools.

## Store Prep Checklist

Before App Store / Play Store submission, you will still want:

- production backend hosting with HTTPS
- production Postgres hosting
- real PNG app icons for all required sizes
- launch screens / splash assets
- privacy policy URL
- support URL
- Terms of Use if you plan subscriptions later
- App Store screenshots
- Google Play screenshots
- app metadata in each language you plan to ship
