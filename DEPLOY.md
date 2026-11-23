# Putting HAJZI online

> **Current live setup (23 Nov 2026):**
> - **Site:** https://hajzi-one.vercel.app, Vercel project `hajzi` (team `touchline10`, region Frankfurt).
> - **Database:** Supabase `hajzi-db`, added through Vercel's Supabase integration. Vercel sets `POSTGRES_URL` automatically.
> - **No secrets were pasted:**
>   - The app creates its own tables and loads the fields on first start.
>   - It derives its internal secret from the database connection.
>   - The first admin was created with a one-time code read from the Vercel logs.
>
> **To publish code changes:** run `npx vercel --prod` in this folder. Data stays in Supabase.
>
> The manual steps below are an alternative way to set up a new copy.

This guide takes HAJZI from your computer to a public link like `https://hajzi.vercel.app`, and later your own domain such as `hajzi.jo`.

You need two free accounts:

| Service | What it does | Cost |
| --- | --- | --- |
| **Supabase** (supabase.com) | The database: fields, bookings, accounts, photos | Free plan |
| **Vercel** (vercel.com) | Runs the website | Free (Hobby) plan* |

\* Vercel's free Hobby plan is for non-commercial projects. Once HAJZI takes real customers, Vercel's terms require the Pro plan (about $20/month).

It takes about 20 minutes. Every command below is typed in a terminal **inside the project folder** (`HAJZI website`).

---

## Step 1: Create the database (Supabase)

1. Go to **supabase.com** → **Start your project** → sign up.
2. Click **New project**:
   - **Name:** `hajzi`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe**. You need it in a minute.
   - **Region:** **Central EU (Frankfurt)**, the closest to Jordan.
   - Click **Create new project** and wait about 2 minutes.
3. At the top of the project page, click **Connect**.
4. Choose **Transaction pooler** and copy the connection string. It looks like:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
5. Replace `[YOUR-PASSWORD]` with the password from step 2, brackets included.

   This full line is your **DATABASE_URL**. Treat it like a password.

## Step 2: Prepare the database

Run:

```bash
npm run db:setup
```

1. Paste your DATABASE_URL when it asks. It stays hidden and isn't saved.
2. You should see:

```
✔ Database tables, double-booking protection and security rules are in place
✔ Loaded 25 fields
Done. The database is ready.
```

You can run it again at any time; it never deletes or overwrites anything.

## Step 3: Make your secret values

Run:

```bash
npm run deploy:secrets
```

It prints an **AUTH_SECRET** and an **ADMIN_SETUP_CODE**. Keep this window open for Step 4.

## Step 4: Put the website on Vercel

1. Go to **vercel.com** → **Sign up** (email or GitHub).
2. In the terminal, run:

```bash
npx vercel
```

3. Answer the questions:
   - **Log in?** It opens your browser. Approve it.
   - **Set up and deploy?** → `Y`
   - **Which scope?** → your account
   - **Link to existing project?** → `N`
   - **Project name?** → `hajzi`
   - **In which directory is your code located?** → just press Enter
   - **Want to modify these settings?** → `N`
4. When it finishes, it prints a link such as `https://hajzi-xxxx.vercel.app`. The site isn't ready yet: it still needs the settings below.
5. Open **vercel.com** → your **hajzi** project → **Settings** → **Environment Variables**, and add these four. Tick **Production** for each.

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the line from Step 1 |
   | `AUTH_SECRET` | from Step 3 |
   | `ADMIN_SETUP_CODE` | from Step 3 |
   | `NEXT_PUBLIC_SITE_URL` | `https://hajzi.vercel.app` (your project's main address: **Settings → Domains**) |

6. Back in the terminal, publish the real version:

```bash
npx vercel --prod
```

**Your public link is the one in Settings → Domains,** for example `https://hajzi.vercel.app`.

## Step 5: Create your admin account

1. Open `https://YOUR-SITE/admin/setup`.
2. Enter your email, a strong password (12+ characters) and the **ADMIN_SETUP_CODE**.
3. Sign in at `https://YOUR-SITE/admin/login`, then turn on two-factor login under **Account**.
4. The setup code works only once. You can now delete `ADMIN_SETUP_CODE` in Vercel.

## Step 6: Check it works

- [ ] The home page and **All fields** show the 25 fields
- [ ] Create a customer account, book a slot, and see it under **My bookings**
- [ ] The booking appears in **Admin → Bookings**
- [ ] Cancel that test booking in Admin
- [ ] Optional: scan your headers at securityheaders.com (it should get an A)

---

## Recommended next steps

**Bot protection (free).** Without it, bots could create fake bookings.
1. Go to **dash.cloudflare.com** → **Turnstile** → **Add site**, and enter your domain.
2. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel.
3. Run `npx vercel --prod`.

**Your own domain (`hajzi.jo` or `.com`).**
1. Buy it from a registrar. For `.jo`, use a Jordanian registrar; for `.com`, Namecheap or Cloudflare, for example.
2. In Vercel, go to **Settings → Domains → Add** and follow the DNS instructions.
3. Change `NEXT_PUBLIC_SITE_URL` to the new address and run `npx vercel --prod`.

**Real business details.** Your phone, WhatsApp, email and address are still placeholders in `src/config/business.ts`. After changing them, run `npx vercel --prod`.

**Fields.** Every booking shows in **Admin → Bookings**. Your team passes each one to the field until that field becomes a partner. You can update prices, photos and opening times in **Admin → Fields**.

## Updating the site later

After any change to the code, run:

```bash
npx vercel --prod
```

Your data is safe in Supabase and isn't affected by updates.

## Backups

Supabase's free plan keeps daily backups for 7 days (**Database → Backups**). Paid plans keep more.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Site shows an error after deploying | Vercel → project → **Logs**. Usually `DATABASE_URL` or `AUTH_SECRET` is missing or mistyped. |
| `db:setup` says "password authentication failed" | The password in DATABASE_URL is wrong. Reset it in Supabase → **Project Settings → Database**. |
| Locked out of admin | `npm run user:create -- --unlock you@email.com` (with `DATABASE_URL` set). |
| Forgot the admin password | `npm run user:create -- --reset-password you@email.com` (with `DATABASE_URL` set). |

To run those two commands against the live database, first run `$env:DATABASE_URL="..."` in PowerShell, using your DATABASE_URL.
