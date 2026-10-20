# Deploy your own copy (no terminal needed)

This guide puts the form builder on **your** Cloudflare account, connected to **your** GitHub copy of this repo. Every time the code changes on GitHub, Cloudflare redeploys it automatically. Your API keys stay in Cloudflare and never go to GitHub.

Time: about 20 minutes.

## What you need

- A **GitHub** account (free): https://github.com/signup
- A **Cloudflare** account (free plan is fine): https://dash.cloudflare.com/sign-up
- At least one image API key:
  - **OpenAI**: https://platform.openai.com/api-keys (needs credit on the account), and/or
  - **Google Gemini**: https://aistudio.google.com/apikey (billing must be turned on for image models)
- R2 storage needs a payment method on the Cloudflare account, even though small usage stays in the free tier.

## Step 1. Copy the repo to your GitHub

1. Open https://github.com/ognjenraljic/ai-jewelry-form-builder
2. Click **Fork** (top right) → **Create fork**.

You now have `github.com/<your-name>/ai-jewelry-form-builder`. Everything below uses your copy.

## Step 2. Create the database and the image storage

In the Cloudflare dashboard (https://dash.cloudflare.com):

**Database (D1)**

1. Left menu: **Storage & Databases** → **D1 SQL Database** → **Create**.
2. Name: `konfigurator` (exactly this). Create.
3. Copy the **Database ID** shown on the database page (a long code like `3f2a...`). You need it in step 3.

**Image storage (R2)**

1. Left menu: **R2 Object Storage** (add a payment method if Cloudflare asks).
2. **Create bucket**. Name: `konfigurator-media` (exactly this). Create.

## Step 3. Put the database ID into your copy

1. On GitHub, in **your** fork, open the file `wrangler.jsonc`.
2. Click the pencil icon (**Edit this file**).
3. Find `"database_id": "local-dev"` and replace `local-dev` with the Database ID from step 2. Keep the quotes.
4. Click **Commit changes** → **Commit changes**.

The database ID is not a secret, it is fine on GitHub.

## Step 4. Connect GitHub to Cloudflare

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**.
2. **Connect GitHub**. GitHub asks you to install the **Cloudflare Workers and Pages** app: choose **Only select repositories** → your `ai-jewelry-form-builder` → **Install & Authorize**.
3. Back in Cloudflare, pick your `ai-jewelry-form-builder` repository.
4. Settings:
   - **Project name:** `ai-jewelry-form-builder`
   - **Build command:** leave empty
   - **Deploy command:**
     ```
     npm run deploy
     ```
   - **Branch:** `main`
5. **Save and Deploy**. Wait until the build is green (1 to 3 minutes).

At the end you see your address, for example `https://ai-jewelry-form-builder.<your-subdomain>.workers.dev`.

### Step 4 (alternative). Deploy with GitHub Actions

Use this instead of step 4 if **Connect GitHub** fails (for example "Error connecting to git account"), or if the repo belongs to someone else. The repo already contains `.github/workflows/deploy.yml`; it only needs two secrets.

1. **Cloudflare API token** (in the Cloudflare account that should host the Worker):
   - Top right profile icon → **My Profile** → **API Tokens** → **Create Token**.
   - Template **Edit Cloudflare Workers** → **Use template**.
   - **Permissions**: add a row **Account** · **D1** · **Edit**.
   - **Account Resources**: Include → the account that should host the Worker.
   - **Zone Resources**: All zones (or All zones from that account).
   - **Continue to summary** → **Create Token** → copy the token (it is shown only once).
2. **Account ID**: **Workers & Pages** overview → right side **Account details** → **Account ID** (copy icon).
3. On GitHub, in the repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, twice:
   - `CLOUDFLARE_API_TOKEN` = the token from 1
   - `CLOUDFLARE_ACCOUNT_ID` = the Account ID from 2
4. **Actions** tab → **Deploy to Cloudflare** → **Run workflow** → **Run workflow**. Wait for the green check (about a minute).

From now on every push to `main` deploys automatically. The token is a Cloudflare deploy key, not an OpenAI/Gemini key: those still go only into Cloudflare (step 5). If the token ever leaks, delete it in **My Profile → API Tokens** and create a new one.

## Step 5. Add your keys (secrets)

1. **Workers & Pages** → open `ai-jewelry-form-builder` → **Settings** → **Variables and Secrets** → **Add**.
2. For each row below: Type **Secret**, enter the name and the value, then **Save** / **Deploy**.

| Name | Value |
| --- | --- |
| `ADMIN_TOKEN` | a long password you make up (at least 24 characters). You sign in to the builder with it. |
| `OPENAI_API_KEY` | your OpenAI key (starts with `sk-`) |
| `GEMINI_API_KEY` | optional, only if you switch a model to Nano Banana |
| `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` | optional bot check: Cloudflare → **Turnstile** → **Add widget** for your domain, copy both keys |

Always choose **Secret** for keys. A key added as **Text** can be lost on the next deploy.

Optional spending limits, as Type **Text**: `DAILY_BUDGET_USD` (default 30), `FORM_DAILY_BUDGET_USD` (default 15), `RENDERS_PAUSED` = `1` to stop all renders at once. These stay when you deploy.

One image key is enough. Without OpenAI all renders use Gemini, without Gemini all renders use GPT Image.

Do **not** add `DEV_MODE`. It is only for local testing.

## Step 6. Use it

1. Open your address from step 4. The builder sign-in appears.
2. Sign in with your `ADMIN_TOKEN`.
3. **New client** (your store or a jeweler you work with) → **New form** from a template (Custom Enquiry, Grillz, Ring or Blank).
4. Adjust pieces, styles, questions, colors and texts. The preview on the right updates live. **Save**.
5. **Embed** tab → copy the code → paste it into the website (WordPress: a Custom HTML block; Shopify: a Custom Liquid section; any site that accepts HTML).
6. Test it once as a customer: finish the form and check that a render appears. New leads show in `/admin` on your address.

## Changing a key later

1. Create a new key with the provider.
2. Cloudflare → your Worker → **Settings** → **Variables and Secrets** → the secret → **Edit**, paste the new value, save. (Secret values can never be viewed, only replaced.)
3. Make one test render.
4. Delete the old key at the provider.

## Getting updates from the original repo

On GitHub, in your fork, click **Sync fork** → **Update branch**. Cloudflare deploys the new version automatically. Your secrets and data stay as they are.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Build fails with a database error | The Database ID in `wrangler.jsonc` is wrong or the database is not named `konfigurator`. |
| Build fails at `migrations apply` with a permission/auth error | Open D1 → `konfigurator` → **Console** and run the files from the `migrations/` folder one by one, in order (0001, 0002, ...): copy each file's text, paste, **Execute**. Then change the deploy command to just `npx wrangler deploy` and redeploy. |
| Build fails with an R2 error | The bucket is missing or not named exactly `konfigurator-media`. |
| Renders stopped with "temporarily unavailable" | The daily budget was reached or `RENDERS_PAUSED` is `1`. Raise `DAILY_BUDGET_USD` / `FORM_DAILY_BUDGET_USD` or remove the pause. |
| Builder says the token is wrong | `ADMIN_TOKEN` secret missing or typed differently. Edit the secret and try again. |
| Customer sees "We could not create your preview" | Image key missing, wrong, or the provider account has no credit/billing. Check the Worker logs: **Workers & Pages** → your Worker → **Logs**. |
| Gemini error "User location is not supported" | In `wrangler.jsonc` add `"placement": { "region": "aws:us-east-1" },` on its own line (for example after the `"compatibility_date"` line), commit. |
