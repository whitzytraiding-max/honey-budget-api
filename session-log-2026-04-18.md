# Honey Budget — Session Log 2026-04-18

## What we built / fixed today

### 1. Google Sign-In
- Added `@react-oauth/google` to frontend
- Custom dark-styled Google button (replaced white Google iframe widget)
- Flow: implicit OAuth → `access_token` → backend userinfo fetch → JWT
- Backend: `/api/auth/google` in `src/routes/auth.js`
- New Google users (salary = 0) routed to Settings; `budget_solo_mode` cleared
- Prisma schema: `passwordHash` nullable, `googleId` unique
- Migration `20260417120000_add_google_auth` — idempotent SQL (Render free tier, no shell access)
- `package.json` start script auto-resolves failed migrations before deploying
- `VITE_GOOGLE_CLIENT_ID` in both `.env` files

### 2. MoneyCat AI Advisor — HomePage redesign
- Replaced old homepage layout with cat-first design
- `CatChat` component: speech bubble, tap-toggle voice, suggestion chips
- `MoneyCat.jsx`: PNG mascot (`/icons/money-cat.png`) with mood-driven CSS filters
  - happy ≥50%: float animation
  - worried 15–49%: pulse + warm filter
  - panic <15%: shake + red filter
- New mascot image: brown cartoon cat 1024×1536 RGBA PNG

### 3. Mobile voice fix — tap-toggle
- Old: press-and-hold (`onPointerDown/Up`) → iOS triggered image save menu
- New: tap once to start, tap again to stop and send (`onClick` toggle)
- `WebkitTouchCallout: none`, `onContextMenu preventDefault` on cat button

### 4. Mobile voice fix — retry after error
- Root cause: `recognitionRef.current` held dead instance after error → new `.start()` failed silently
- Fixes:
  - Null `recognitionRef` in both `onerror` and `onend`
  - `try-catch` around `rec.start()`
  - Specific message for `not-allowed` (microphone permission denied)
  - Read `releasedRef`/`capturedRef` before nulling in `onend` to avoid race

### 5. Voice output (TTS) — discussed, not built
- Option A: Web Speech API `SpeechSynthesis` — free, ~10 lines, robotic
- Option B: ElevenLabs — paid, much better, needs backend proxy
- Agreed to come back to this next session

---

## Commits pushed today
- `fix: tap-toggle voice recording on mobile to prevent image save menu`
- `fix: clear recognition ref on error/end to unblock mobile retries`

## Reminder
- Rotate the GitHub token that was shared in chat earlier today (github.com/settings/tokens)
