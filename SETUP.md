# Alexon Fleet — Setup guide (Release 1)

About 45–60 minutes. No Docker, no command-line database tools.

---

## 1. Put the code on GitHub
1. Create a new **private** repo on GitHub, e.g. `alexon-fleet-assets`.
2. Unzip this folder, then from inside it:
   ```bash
   git init
   git add .
   git commit -m "Release 1"
   git branch -M main
   git remote add origin https://github.com/<you>/alexon-fleet-assets.git
   git push -u origin main
   ```

## 2. Create the Supabase project
1. supabase.com → **New project** → name `alexon-fleet`, choose a strong DB password, pick the region closest to Kenya.
2. **Authentication → Sign In / Providers → Email**: turn **OFF** "Allow new users to sign up". Leave Email provider enabled.
3. **SQL Editor → New query** → paste all of `supabase/01_schema.sql` → **Run**. It should say "Success. No rows returned".
4. **New query** again → paste `supabase/02_seed_assets_from_excel.sql` → **Run**. This loads the 12 assets from your Excel file.

## 3. Create your admin account
1. **Authentication → Users → Add user → Create new user**: your email + a strong password, tick **Auto Confirm User**.
2. **SQL Editor → New query**, change the email and name, then Run:
   ```sql
   update profiles
   set role = 'admin', is_active = true, full_name = 'Edwin Wango'
   where email = 'your.email@alexongroupltd.co.ke';
   ```
   (Accounts created this way start inactive until this step — a safety measure.)
3. Everyone else: add them later from the app's **Users** page.

## 4. Deploy on Vercel
1. vercel.com → **Add New → Project** → import the GitHub repo. Framework: Next.js (auto).
2. **Environment Variables** (from Supabase → Project Settings → API / API Keys):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key — **keep private** |
   | `NEXT_PUBLIC_APP_URL` | your Vercel address, e.g. `https://alexon-fleet-assets.vercel.app` |
   | `CRON_SECRET` | any long random string (30+ characters) |
   | `RESEND_API_KEY` | leave empty for now (step 6) |
   | `EMAIL_FROM` | leave empty for now (step 6) |

3. **Deploy**. When done, open the URL and sign in with your admin account.
4. Back in Supabase → **Authentication → URL Configuration**: set **Site URL** to your Vercel address.

## 5. First things to do in the app
1. **Settings**: check the warning levels (defaults: 3,000 / 1,000 / 250 km and 50 / 20 / 5 hours).
2. **Users**: add the Fleet team and Management. Give each person their temporary password privately; they change it under **My account**.
3. **Fleet**: open each asset marked *Needs setup* or *CONFIRM* in its notes and fix the values once the review sheet is answered.
4. **Take fresh readings for every vehicle and machine.** The Excel readings had no dates, so the dashboard asks for new ones.
5. **Compliance**: add insurance, inspection and licences with expiry dates.

## 6. Daily email (can be done later)
The system emails Admin, Fleet and Management users at **7:00 am** when something is critical or important.
1. resend.com → sign up → **Domains → Add** `alexongroupltd.co.ke` → add the DNS records it shows at your DNS host (HostPinnacle / wherever the domain is managed) → wait for "Verified".
2. **API Keys → Create** → copy it.
3. Vercel → Project → Settings → Environment Variables: set `RESEND_API_KEY` and `EMAIL_FROM` = `Alexon Fleet <fleet@alexongroupltd.co.ke>` → **Redeploy**.
4. Test it now (replace values):
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/daily-digest
   ```
   It returns JSON saying whether an email was sent. Vercel runs it automatically every day (see `vercel.json`).

---

## Troubleshooting
| Problem | Fix |
|---|---|
| "Wrong email or password" for the admin | Check the user exists in Supabase Auth and step 3.2 was run for that exact email |
| "Your account is not active" | Run step 3.2, or activate the user on the Users page |
| Pages show "Something went wrong" | Check the Vercel env vars are set exactly, then Redeploy |
| Adding a user fails | `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong |
| File upload fails | Files must be PDF/JPG/PNG/WEBP under 4 MB |

## Local development (optional)
```bash
cp .env.example .env.local   # fill in the same values
npm install
npm run dev                  # http://localhost:3000
```
