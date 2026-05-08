# Connect personal Gmail (philippelobokung@gmail.com) to triage

The code already supports both accounts — `src/lib/gmail.ts` reads `GMAIL_REFRESH_TOKEN_PERSONAL` if present and tags those emails as `source: 'gmail_personal'` in `triage_items`. **No code change required.** Two steps:

## 1 · Mint the refresh token (5 min, one time)

### a. Pre-flight — Google Cloud Console

OAuth client: `111380151572-pslt7mo9bsv74gg2i1uru5ms6n278s0p` in project `gen-lang-client-0970726892` (nano banan).

1. https://console.cloud.google.com/apis/credentials → click the OAuth 2.0 Client ID above.
2. Under **Authorised redirect URIs**, make sure `http://localhost:9877` is listed. If it isn't, add it and Save. (`:9876` was added for the work account.)
3. Go to **OAuth consent screen**. If publishing status is **Testing**, click **+ ADD USERS** under Test users and add `philippelobokung@gmail.com`. If status is **In production**, skip this.

### b. Run the helper

```powershell
cd C:\Users\phili\Documents\Claude\Projects\PhilippeBot\triage-dashboard
python get-refresh-token-personal.py
```

Browser opens. **Sign in with `philippelobokung@gmail.com`** — not the work account. Approve the `gmail.modify` scope. The terminal prints:

```
GMAIL_REFRESH_TOKEN_PERSONAL=1//03A...
```

The script also appends the var to `.env.local` automatically (so local `npm run dev` can read it).

## 2 · Add the env var to Vercel

1. https://vercel.com → DatakultDashboard project → **Settings** → **Environment Variables**.
2. Click **Add new**.
   - **Name:** `GMAIL_REFRESH_TOKEN_PERSONAL`
   - **Value:** the token from step 1
   - **Environments:** tick **Production**, **Preview**, and **Development**
3. Save.
4. Redeploy: **Deployments** tab → most recent prod deploy → ⋯ → **Redeploy** (no need to push code). Or wait for the 9 AM UTC cron — it picks up env vars on cold start.

## 3 · Verify

After the next cron run (or manually trigger):

```powershell
curl https://YOUR-DASHBOARD.vercel.app/api/triage/collect ^
  -H "Authorization: Bearer datakult-triage-2026"
```

Then check Supabase:

```sql
SELECT source, COUNT(*) FROM triage_items
WHERE triage_date = CURRENT_DATE
GROUP BY source;
```

You should see both `email` (work) and `gmail_personal` (personal) rows.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `invalid_grant` on token exchange | Auth code expired — re-run the script and complete it faster. |
| `redirect_uri_mismatch` | Add `http://localhost:9877` to the OAuth client's Authorized redirect URIs. |
| `access_denied` after sign-in | App is in Testing mode — add `philippelobokung@gmail.com` as a Test user on the OAuth consent screen. |
| Cron runs but no `gmail_personal` rows | Vercel env var not saved to all 3 environments, or you didn't redeploy. Hit the redeploy button. |
| Token works locally but fails on Vercel | The personal account refresh token may have been revoked when you signed out — re-run the script. |
