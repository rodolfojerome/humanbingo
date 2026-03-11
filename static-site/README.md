# Human Bingo (Static – GitHub Pages)

Plain HTML, CSS, and JavaScript version of Human Bingo. You can host it on **GitHub Pages** or any static host.

## Setup

1. **Supabase**  
   Use your existing Supabase project (same DB as the Next.js app).

2. **Configure the app**  
   Edit `js/config.js` and set:
   - `window.SUPABASE_URL` – your project URL (e.g. `https://xxxx.supabase.co`)
   - `window.SUPABASE_ANON_KEY` – your project anon/public key  

   Get both from: Supabase Dashboard → Project Settings → API.

3. **Database**  
   Same schema as the Next.js app. Run `scripts/setup-db.sql` in the Supabase SQL editor if you haven’t already.  
   Ensure the default session exists (e.g. code `BINGO`).

4. **Row Level Security (RLS)**  
   For client-only access, the anon key must be allowed to read/write the tables the app uses. In Supabase:

   - **Tables:** `sessions`, `players`, `cards`, `card_marks`, `rounds`, `prompts`
   - Add policies so that the **anon** role can:
     - **SELECT** on all of these
     - **INSERT** on `sessions`, `players`, `cards`, `card_marks`, `rounds`
     - **UPDATE** on `sessions`, `players`, `cards`
     - **DELETE** on `card_marks`

   If you prefer to keep RLS strict, you can restrict by `session_id` or other columns; the app only uses the anon key from the browser.

5. **Realtime**  
   In Supabase Dashboard → Database → Replication, enable replication for `sessions` and `players` so the play and dashboard pages update in real time.

## Host on GitHub Pages

**Option A – Use this folder as the site root**

1. Copy everything inside `static-site/` to the **root** of your repo (so `index.html` is at the root).
2. On GitHub: **Settings → Pages → Source**: “Deploy from a branch”.
3. Branch: `main`, folder: **/ (root)**.
4. Save. The site will be at `https://<username>.github.io/<repo>/`.

**Option B – Keep the repo as-is and use the `docs` folder**

1. Rename `static-site` to `docs`.
2. On GitHub: **Settings → Pages → Source**: “Deploy from a branch”, folder: **/docs**.
3. Site will be at `https://<username>.github.io/<repo>/`.

**Important:** After copying/renaming, edit `js/config.js` in the deployed files and set your real `SUPABASE_URL` and `SUPABASE_ANON_KEY`. If the repo is public, anyone can see the anon key; that’s normal. Use RLS to protect data.

## Pages

- **index.html** – Enter name, join game, go to play.
- **play.html** – Bingo card, current prompt, mark cells, next prompt, confession on BINGO.
- **results.html** – Game over, winners, confessions, all players.
- **my-moments.html** – After BINGO: your confession and list of marked prompts.
- **dashboard.html** – Host: start game, next prompt, end game, players list.

## Local test

Open `index.html` in a browser (or use a simple static server). Set `js/config.js` to your Supabase URL and anon key first.
