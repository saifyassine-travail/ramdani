# MediAssist — Client Delivery Guide

How to hand this product off to a clinic/doctor as a finished, working product — not just source code.

## 1. Recommended delivery model

**On-premise, single-machine install at the clinic**, not a cloud/SaaS deployment. This matches how the app is already built and is the right call for a medical-records product:

- Patient data (CIN numbers, medical history, photos) stays physically at the clinic — no data-residency, hosting, or breach-liability questions for you as the vendor.
- No recurring server/domain cost to pass on to the client.
- The mobile app already talks to the backend over the clinic's own LAN (`192.168.x.x`), which only works if the backend lives on-site.


Cloud hosting (a VPS with a domain, HTTPS, and remote access) is a valid *upsell* for a client who wants multi-site or remote access, but it's a different, bigger product — reverse proxy, TLS, hardened Postgres, off-site backups — and shouldn't be the default. Don't build it speculatively; offer it only if a client asks.

## 2. What "done" looks like for a delivery

A delivery is not "I copied the folder onto their PC." It's:

1. App installed and running as Windows services that survive a reboot.
2. A real `admin` account exists (today, **neither existing account in this codebase is admin** — see §6).
3. Doctor can log in, see their own name/logo on documents, and every staff account has the right sidebar permissions.
4. Backups run automatically and you've proven a restore works.
5. The doctor has clicked through the core flows once with you watching, not just been handed a manual.

## 3. Pre-delivery checklist (do this before you go on-site)

- [ ] `git status` clean — no uncommitted work left behind that only exists on your dev machine (see current repo state: Stock feature, chat feature, and error-message cleanup are still uncommitted as of this session).
- [ ] Tag a release commit (`git tag v1.0.0`) so you can always identify exactly what you shipped.
- [ ] Decide and document the DB story for the target machine — **this project currently expects a native PostgreSQL 16 install on the host** (`docker-compose.yml` → `DB_HOST: host.docker.internal`), not a Dockerized `db` service. Don't discover this on-site like we did this session.
- [ ] Fill in real secrets in a `.env.production` template (see §5) — never ship your dev `.env` with your personal API keys.

- [ ] Build and smoke-test the production Docker images once, end to end, before packing them up (`docker compose build && docker compose up -d`, then click through login → add patient → create appointment → complete it).
- [ ] Remove/rotate any test data you don't want the client to see (this session left ~40 simulated patients tagged `[SIMULATION]` in the dev DB — don't ship a dev DB, ship a clean one).

## 4. What to physically deliver

Package these as one folder / one zip, not scattered files:

```
mediassist-delivery/
├── app/                      # the repo at the tagged release commit
├── INSTALL.md                # step-by-step for whoever runs the install (§5)
├── QUICKSTART_FR.md           # 1-page French cheat-sheet for the doctor (§8)
├── .env.production.example    # every required var, real values blanked out
└── scripts/
    ├── install.ps1            # see §5
    ├── backup.ps1              # wraps the existing /api/backup endpoints
    └── update.ps1              # git pull + rebuild, see §9
```

Don't make the client clone from your personal GitHub — either give them a zip of the tagged release, or set them up with their own private repo they control. If you keep hosting the repo, that's a support dependency you're signing up for indefinitely.

## 5. Installation (what `install.ps1` should automate)

Target machine: Windows 10/11 Pro, 8GB+ RAM, 20GB+ free disk, Docker Desktop support (WSL2 backend).

1. **Install Docker Desktop** (winget: `Docker.DockerDesktop`) — needs a reboot + WSL2 enabled.
2. **Install PostgreSQL 16 natively** (winget: `PostgreSQL.PostgreSQL.16`) — this is the real database, not the Docker container. Set the `postgres` user password to match `DB_PASSWORD` in the backend `.env`. Create the `mediassist` database.
3. **Copy the app folder** to `C:\MediAssist` (or wherever) and drop in the real `.env` files (backend + extraction service) with production secrets filled in.
4. **Build and start**: `docker compose build && docker compose up -d`.
5. **Run migrations**: `docker exec laravel_app php artisan migrate`.
6. **Create the first admin user** (don't skip this — see §6):
   ```
   docker exec laravel_app php artisan tinker --execute="
     App\Models\User::create(['name'=>'Dr. X','email'=>'doctor@clinic.com','password'=>bcrypt('CHANGE_ME'),'role'=>'admin']);
   "
   ```
7. **Verify**: `http://localhost:8000/api/patients` returns `200`, `http://localhost:3000/login` loads.
8. **Configure Windows Firewall** to allow inbound on port 3000 (and 8000) from the LAN subnet only, so the mobile app / other clinic PCs can reach it — not from the public internet.
9. **Set the machine to auto-login or run Docker Desktop at startup**, and confirm `docker compose up -d` survives a full reboot (containers have `restart: unless-stopped`, but Docker Desktop itself must be running).

## 6. First-run configuration (do this together with the client)

- Log in as the admin account you just created, change the password immediately.
- **Settings → Documents**: set practice name, city, upload letterhead/logo, configure the ordonnance/facture/certificate layouts with the clinic's actual paper if they print on pre-printed letterhead.
- **Settings → Users**: create one account per staff member (nurse/secretary), grant only the sidebar permissions they need — don't give everyone `admin`.
- **Settings → Backup**: connect Google Drive if the client wants off-site sync (needs `GOOGLE_CLIENT_ID`/`SECRET` configured — see §7), otherwise rely on local `.db`/`.csv` export.
- Seed the Médicaments/Analyses catalog with what this clinic actually prescribes (don't ship the generic 15-item test catalog as if it were curated).
- Add 2–3 real patients together with the doctor as a live test, not fake ones.

## 7. Required secrets (fill in before delivery, never commit these)

| Variable | Where | Purpose | Breaks silently if missing? |
|---|---|---|---|
| `APP_KEY` | `Backend/MediAssist/.env` | Laravel encryption key | Yes — generate with `php artisan key:generate` |
| `DB_PASSWORD` | `Backend/MediAssist/.env` | Must match the native Postgres `postgres` user password | No — fails loudly |
| `GEMINI_API_KEY` | `Backend/extraction-service/.env` | CIN card scanning | **Yes** — scan button just fails with a generic error |
| `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` | `Backend/MediAssist/.env` | Google Drive backup sync | Only breaks that one optional feature |

Keep a password manager entry per client with all of these — you will need them again for support calls.

## 8. Training & handoff

A README nobody reads is not training. Budget a real session:

- **30–45 min live walkthrough** with the doctor at their desk: add a patient, book an appointment, run it through waiting → consultation → completed, write a prescription, print it, generate a certificate, check the stock section, use the chat with a staff member.
- Leave a **1-page French quick-start** (`QUICKSTART_FR.md`) — not the full technical docs — covering only: how to log in, how to add a patient/appointment, who to call if something breaks. This is what actually gets used three months later.
- Get an explicit sign-off (even just a WhatsApp message: "tested and working") before you consider the delivery closed. This is your evidence if a dispute comes up later about what was delivered and when.

## 9. Update & support plan

Decide this *before* delivery, not when the first bug report comes in:

- **How updates ship**: `scripts/update.ps1` should do `git pull` (or unzip a new release), `docker compose build`, `docker compose up -d`, and `php artisan migrate`. Test this path yourself once before relying on it under pressure.
- **Who can push updates**: if you keep remote access (TeamViewer/AnyDesk), say so explicitly and get the client's consent — it's their machine with their patients' data on it.
- **Response time commitment**: even an informal "I respond within 24h on WhatsApp" beats an undefined expectation.
- **What's covered vs. billable**: bug fixes in what you delivered vs. new feature requests should be a clear line, agreed in writing (even a short email), before you start doing free work indefinitely.

## 10. Backup & disaster recovery

The app already has backup endpoints (`/api/backup/*`) and a local `.db`/`.csv` export — use them, don't invent a new backup story:

- Schedule `scripts/backup.ps1` via Windows Task Scheduler (daily, off business hours) to hit the export endpoint and copy the result to a second physical location (external drive, or Google Drive if configured).
- **Prove the restore works** before delivery — a backup nobody has ever restored from is not a backup, it's a hope.
- Native Postgres data lives in the default Postgres data directory on that machine — make sure whatever backs up the "app folder" also captures the actual DB (`pg_dump`), since the app folder alone won't include patient data with this architecture.

## 11. Security baseline (this is medical data)

- Full-disk encryption (BitLocker) on the clinic machine.
- A real Windows account password, not an auto-login guest account with wide-open file sharing.
- Firewall rules scoped to the clinic's LAN subnet, not `0.0.0.0/0`.
- Don't expose port 8000/3000 to the public internet without a reverse proxy + HTTPS + auth in front — if the client later wants remote access, that's the cloud-deployment upsell from §1, not a firewall port-forward hack.
- Rotate the default `postgres`/`root` credentials used in local dev to something clinic-specific before go-live.

## 12. Post-delivery sign-off checklist

- [ ] Admin account created, password changed by the client, not left as default.
- [ ] All staff accounts created with correct permissions.
- [ ] Practice settings (name, logo, document layouts) configured with real clinic info.
- [ ] Live walkthrough completed with the doctor.
- [ ] Backup scheduled and one restore tested.
- [ ] Update procedure documented and tested once.
- [ ] Support terms agreed (response time, what's covered).
- [ ] Client has explicitly confirmed the app works for their real workflow.

