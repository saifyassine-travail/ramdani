# MediAssist Mobile

React Native (Expo) app for MediAssist staff. V1 covers login and the patient
workflow only (list/search, detail, add/edit including CIN card scanning) —
see the rest of the monorepo (`Backend/`, `Frontend/`) for appointments,
scheduling, and admin features, which aren't in this app yet.

## Setup

```bash
cd Mobile
npm install
cp .env.example .env   # then point EXPO_PUBLIC_API_BASE_URL at your backend
npx expo start
```

## Connecting to the backend

The Laravel API is served by `nginx` at `:8000` (see the root
`docker-compose.yml`) — this is the **only** host the app talks to, including
CIN OCR (proxied through `POST /api/extract-cin`, see
`Backend/MediAssist/app/Http/Controllers/CinExtractionController.php`).

Set `EXPO_PUBLIC_API_BASE_URL` in `Mobile/.env` depending on how you're running the app:

| Target | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Physical device (Expo Go), same Wi-Fi as the dev machine | `http://<dev-machine-LAN-IP>:8000/api` |
| Android emulator | `http://10.0.2.2:8000/api` (maps to the host's `localhost`) |
| iOS simulator | `http://localhost:8000/api` |

A physical device on your LAN needs the dev machine's Windows Firewall to
allow inbound connections on port 8000.

If the var is unset, the app falls back to a platform-based default (see
`src/utils/apiBaseUrl.ts`) — but an explicit LAN IP in `.env` is the most
reliable option for real-device testing.

## Auth

Sanctum bearer tokens, stored in `expo-secure-store`. Each login names its
token after the device (`device_name`), so a mobile session and a web session
for the same user can be active at once — see the multi-device fix in
`Backend/MediAssist/app/Http/Controllers/AuthController.php`.

## Project layout

```
app/                    Expo Router routes
  (auth)/login.tsx
  (app)/patients/        list, new, [id]/index (detail), [id]/edit
src/
  api/                   client.ts (fetch wrapper), auth.ts, patients.ts, cin.ts
  auth/                  AuthContext, SecureStore token/user persistence
  components/            PatientForm (shared add/edit + CIN scan), PatientListItem
  types/                 Patient/PatientInput/etc., matching Backend/MediAssist's API shapes
```
