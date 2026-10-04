# Cloudflare Workers Builds (bkenterprises-api)

## Required settings

| Field | Value |
|-------|--------|
| **Root directory** | `/` if this repo is only the API; otherwise `e-commerce-backend` |
| **Build command** | `npm run build` *(or leave empty)* |
| **Deploy command** | `npm run deploy` **recommended** |

Alternative deploy command (equivalent):

```bash
(npx wrangler r2 bucket create bkenterprises-media || true) && npx wrangler deploy
```

> If you only run `npx wrangler deploy`, the R2 bucket must already exist in the **same Cloudflare account** as the build token (account from the build log).

## R2 bucket missing (error 10085)

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → the account tied to your **bkenterprises-api build token**.
2. **R2** → **Create bucket** → name **`bkenterprises-media`** (exact spelling).
3. Enable **R2** on the account if prompted.
4. Redeploy.

Ensure the build token has **Account → R2 → Edit** (or Admin) permissions.

## Worker secrets (bkenterprises-api)

`DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

## API URL

After deploy: `https://bkenterprises-api.<your-subdomain>.workers.dev`

Update Razorpay webhook and frontend `VITE_API_URL` to match.
