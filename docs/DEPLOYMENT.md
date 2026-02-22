# Deployment Guide — Aegis Pick

## Prerequisites
- GitHub account with the repo pushed
- [Vercel](https://vercel.com) account (free tier works)
- [Render](https://render.com) account (free tier works)

---

## 1. Generate Initial Data (one-time)

Run locally before first deploy so the backend has data to serve:

```bash
pip install -r pipeline/requirements.txt
python pipeline/train.py
```

Commit the generated `data/` files:
```bash
git add data/
git commit -m "chore: initial matchup data"
git push
```

---

## 2. Deploy Backend (Render)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Render auto-detects `render.yaml` — no extra config needed
4. Note your service URL: `https://aegis-pick-backend.onrender.com`

### render.yaml already configures:
- Build command: `pip install -r backend/requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Region: Oregon (us-west)

> **Free tier note:** Render free services sleep after 15 minutes of inactivity. The frontend pings `/health` every 4 minutes to prevent this.

---

## 3. Deploy Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New Project**
2. Import your GitHub repo
3. Set root directory to **`frontend/`**
4. Add environment variable:
   - `NEXT_PUBLIC_BACKEND_URL` = `https://your-render-service.onrender.com`
5. Click **Deploy**

### vercel.json already configures:
- Framework: Next.js
- Build command: `npm run build`

---

## 4. Configure GitHub Actions

Add these secrets to your repo (**Settings → Secrets → Actions**):

| Secret | Value | Required? |
|---|---|---|
| `OPENDOTA_API_KEY` | Your OpenDota API key | Optional (higher rate limits) |
| `RENDER_DEPLOY_HOOK` | Render deploy hook URL | Required for auto-redeploy |
| `GH_PAT` | Personal access token (repo scope) | Required for data commits |

### Get Render deploy hook:
Render Dashboard → Your Service → **Settings** → **Deploy Hook** → Copy URL

### Get GitHub PAT:
GitHub Settings → **Developer settings** → **Personal access tokens** → **Fine-grained** → Create with `contents: write` on your repo

---

## 5. First Automated Run

Trigger the data pipeline manually:
1. Go to **Actions** tab in your GitHub repo
2. Click **Refresh Matchup Data**
3. Click **Run workflow** → **Run workflow**

This will:
- Fetch all hero matchup data from OpenDota
- Write `data/*.json` files
- Commit them to `main`
- Trigger Render to redeploy with fresh data

After this, the pipeline runs automatically every 12 hours.

---

## 6. Verify Everything Works

```bash
# Check backend health
curl https://your-render-service.onrender.com/health

# Check heroes endpoint
curl https://your-render-service.onrender.com/api/heroes | head -c 200

# Check suggestions (with two enemy heroes: AM=1, Axe=2)
curl -X POST https://your-render-service.onrender.com/api/suggestions \
  -H "Content-Type: application/json" \
  -d '{"ally_ids":[],"enemy_ids":[1,2],"banned_ids":[],"ally_roles":{},
       "ally_facets":{},"enemy_facets":{},"mmr_bracket":"legend",
       "game_mode":"ranked","region":"us"}'
```

---

## Updating the Frontend Domain in Render CORS

If you change your Vercel domain, update `ALLOWED_ORIGINS` in `backend/main.py`:

```python
ALLOWED_ORIGINS = [
    "https://your-app.vercel.app",
    "https://your-custom-domain.com",
    "http://localhost:3000",
    "http://localhost:3001",
]
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Backend returns 404 on `/api/heroes` | Run pipeline to generate `data/heroes.json` |
| Frontend shows "Backend offline" | Check Render service logs; may be starting up (cold start ~30s) |
| Suggestions return empty | No enemies picked, or matchup data missing for current patch |
| Build fails on Vercel | Check `npx tsc --noEmit` passes locally; ensure `NEXT_PUBLIC_BACKEND_URL` is set |
