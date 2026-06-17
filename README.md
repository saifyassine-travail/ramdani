# MediAssist

Medical practice management app.

- **Frontend/** — Next.js 15 (React, Tailwind) — runs on http://localhost:3000
- **Backend/MediAssist/** — Laravel 12 API — runs on http://127.0.0.1:8000
- **Database** — PostgreSQL (database `mediassist`, port **5433**)
- **LandingPage/** — placeholder (not set up yet)

---

## Prerequisites

- **Node.js** 18+
- **PHP 8.4** + Composer
- **PostgreSQL** (running, port 5433)
- For the fast backend (recommended on Windows): **WSL2 (Ubuntu)** — see [Fast backend setup](#one-time-fast-backend-setup-wind--wsl2--octane)

---

## Pull the latest code

```bash
git pull
```

If you have local changes that block the pull, commit or stash them first
(see [Push your changes](#push-your-changes)).

---

## First-time setup (after a fresh clone)

**Backend**
```bash
cd Backend/MediAssist
composer install
cp .env.example .env        # then set the PostgreSQL credentials
php artisan key:generate
php artisan migrate
```

**Frontend**
```bash
cd Frontend
npm install
```

The frontend talks to the API at `http://127.0.0.1:8000/api` by default
(override with `NEXT_PUBLIC_API_URL` in `Frontend/.env.local`).

---

## Run it

### Option A — Standard (works on any OS)

```bash
# Terminal 1 — backend
cd Backend/MediAssist
php artisan serve

# Terminal 2 — frontend
cd Frontend
npm run dev
```

Open http://localhost:3000.

> Note: with `php artisan serve` each API request takes ~0.5 s (framework
> bootstrap on every request). Use Option B for fast responses.

### Option B — Fast (Windows + WSL2 + Octane) — recommended

The backend runs via **Laravel Octane (RoadRunner) inside WSL2**, keeping the app
in memory → API responses drop to **~12–40 ms**. The **database stays on Windows**
(single Postgres, reached from WSL via mirrored networking — no data copy).

```powershell
# Terminal 1 — backend (from repo root)
.\fast-backend.ps1                 # syncs code into WSL, then starts Octane on :8000

# Terminal 2 — frontend
cd Frontend
npm run build ; npm start          # production build = instant page navigation
```

Open http://localhost:3000.

- First request after start is ~400 ms (workers booting), then everything is fast.
- The backend runs from a **WSL copy** at `~/mediassist`; `fast-backend.ps1` keeps it
  in sync with your Windows source.

---

## Day-to-day commands

| Task | Command |
|------|---------|
| Start fast backend | `.\fast-backend.ps1` |
| **After editing backend PHP** | `.\fast-backend.ps1 -Reload` (sync + reload Octane workers) |
| Start frontend (using the app) | `cd Frontend ; npm run build ; npm start` |
| Start frontend (editing UI) | `cd Frontend ; npm run dev` |
| "Port 8000 already in use" | `wsl -d Ubuntu -- bash -lc "pkill -9 -x rr; pkill -9 php"` |
| Backend deps changed | `wsl -d Ubuntu -- bash -lc "cd ~/mediassist && composer install"` |
| Edited backend `.env` | `wsl -d Ubuntu -- bash -lc "cd ~/mediassist && php artisan optimize:clear"` then `.\fast-backend.ps1 -Reload` |

> **Octane keeps code in memory.** Backend code edits only take effect after a
> `-Reload` (or restart). The frontend in `npm run dev` hot-reloads automatically;
> in `npm start` you must rebuild (`npm run build`).

---

## Push your changes

```bash
git add -A
git commit -m "describe what you changed"
git push
```

Do **not** commit generated/large files (already ignored): `vendor/`,
`node_modules/`, the RoadRunner binary (`rr` / `rr.exe`), and `.env`.

---

## One-time fast-backend setup (Win + WSL2 + Octane)

Only needed once per machine to enable Option B.

1. **WSL2 + Ubuntu** (Windows 11):
   ```powershell
   wsl --install            # if not already installed (reboot if prompted)
   ```
2. **Mirrored networking** — create `C:\Users\<you>\.wslconfig`:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```
   then `wsl --shutdown` (so WSL can reach Windows Postgres on `localhost:5433`).
3. **PHP 8.4 + Composer + tools** in Ubuntu:
   ```bash
   sudo add-apt-repository -y ppa:ondrej/php && sudo apt update
   sudo apt install -y php8.4-cli php8.4-pgsql php8.4-mbstring php8.4-xml \
     php8.4-curl php8.4-zip php8.4-bcmath php8.4-intl composer rsync unzip
   ```
4. **Create the WSL copy + install** (the `fast-backend.ps1` sync target):
   ```bash
   mkdir -p ~/mediassist
   rsync -a --exclude vendor --exclude node_modules --exclude .git \
     /mnt/c/Users/<you>/Desktop/ramdani/ramdani/Backend/MediAssist/ ~/mediassist/
   cd ~/mediassist && composer install
   php artisan octane:install --server=roadrunner    # downloads the Linux rr binary
   ```
5. Run `.\fast-backend.ps1` from the repo root.

> **Why WSL?** Laravel Octane requires the Unix `pcntl` extension (not available
> on native Windows), and RoadRunner needs a real Linux filesystem (the `/mnt/c`
> mount is too slow). So the code runs in WSL while the database stays on Windows.
