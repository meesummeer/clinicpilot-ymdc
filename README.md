# ClinicPilot — YMDC

Appointment + billing tracker for Yaseen Medical & Diagnostic Centre.
Color-coded doctor appointments, billing filtered by doctor and date, three login tiers (admin / CSR / CEO read-only).

## Stack
- **Frontend:** React + Vite, hosted on GitHub Pages
- **Backend:** Supabase (Postgres + Auth), already provisioned
- **Auto-deploy:** GitHub Actions — every push to `main` rebuilds and republishes automatically. No manual redeploy step, ever.

---

## One-time setup (do this once)

### 1. Push this code to your repo
```
git init
git add .
git commit -m "Initial ClinicPilot scaffold"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Add your Supabase keys as GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**, add both:
- `VITE_SUPABASE_URL` → `https://risgijyhedkeziywlrye.supabase.co`
- `VITE_SUPABASE_ANON_KEY` → the anon public key you already have

*(These get baked into the build by GitHub Actions — you never put real secrets in the repo itself.)*

### 3. Enable GitHub Pages via Actions
Repo → **Settings → Pages** → under "Build and deployment", set **Source: GitHub Actions**.

### 4. Point admin.ymdc.pk at it
In Cloudflare DNS (same place ymdc.pk is managed):
- Add a **CNAME** record: `admin` → `<your-github-username>.github.io`
- In the repo → **Settings → Pages**, under "Custom domain", enter `admin.ymdc.pk` and save (the `public/CNAME` file already in this repo handles the GitHub side automatically).

### 5. Create staff logins
Supabase Dashboard → **Authentication → Users → Add User** — create one login per person (you, CSR, Hina) with their email + a password.

Then, in **SQL Editor**, add each person to `staff_profiles` so the app knows their role (replace the UUID with the user's ID shown in the Authentication tab):
```sql
insert into staff_profiles (id, full_name, role) values
  ('paste-user-uuid-here', 'Dr. Meesum Mir', 'admin'),
  ('paste-user-uuid-here', 'CSR Name', 'csr'),
  ('paste-user-uuid-here', 'Hina Hussain', 'ceo');
```

That's it — push to `main` and the Actions tab will show the build running. First deploy takes a couple minutes; after that, `admin.ymdc.pk` is live.

---

## Local development (optional)
```
npm install
cp .env.example .env   # already has your Supabase URL + anon key
npm run dev
```

## Editing doctors or colors later
Supabase Dashboard → Table Editor → `doctors` — add, deactivate, or recolor doctors directly. No code change or redeploy needed; the app reads this table live.
