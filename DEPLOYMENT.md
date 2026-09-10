# BoulderMove Production & Model Deployment Guide

This document describes the complete architecture, XGBoost machine learning integration, on-demand/scale-to-zero deployment, and step-by-step instructions to run and deploy **BoulderMove**.

---

## 1. Architecture Overview

```
                          ┌───────────────────────────────┐
                          │    Netlify Edge CDN (Free)    │
                          │   React 18 + Leaflet Frontend │
                          │  https://bouldermove.netlify.app │
                          └──────────────┬────────────────┘
                                         │ HTTPS Requests (/api/predict, /health, /osm_directions)
                                         ▼
                          ┌───────────────────────────────┐
                          │    Render / Free Web Service  │
                          │        FastAPI Backend        │
                          │ ┌───────────────────────────┐ │
                          │ │  Saved XGBoost Booster    │ │
                          │ │  route_on_time_model.json │ │
                          │ └───────────────────────────┘ │
                          └──────┬───────────────┬────────┘
                                 │               │
                                 ▼               ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │ OpenWeather API  │  │ Ticketmaster API │
                    │ & OSM / Valhalla │  │ & CU Events Cal  │
                    └──────────────────┘  └──────────────────┘
```

---

## 2. XGBoost Model & Inference Engine

### How the Model is Stored
- The trained XGBoost model is serialized in native JSON format at [`backend/models/route_on_time_model.json`](file:///e:/Projects/bouldermove_dcsc/backend/models/route_on_time_model.json) (~1.0 MB).
- The associated feature column mapping is stored at [`backend/models/feature_cols.joblib`](file:///e:/Projects/bouldermove_dcsc/backend/models/feature_cols.joblib).
- Native JSON serialization provides cross-platform, dependency-light loading without insecure pickle files.

### How Inference Works
1. **Single-Instance Loading:** The model is loaded into memory **once** on application startup via `xgb.Booster.load_model(...)`.
2. **Feature Extraction:** When a route is planned, journey features are assembled:
   - `duration_min`: Base journey duration from routing engine
   - `buffer_min`: User buffer / schedule flexibility
   - `num_transfers`: Number of transit transfers (0 for walk/bike/drive)
   - `rain_1h`: Live precipitation rate from OpenWeather
   - `snow_1h`: Live snowfall rate from OpenWeather
   - `wind_speed`: Live wind speed in m/s
   - `temp`: Ambient temperature in °C
   - `event_risk`: Ticketmaster/CU event proximity indicator
   - `hour`: Hour of departure (0–23)
   - `is_weekend`: Weekend boolean indicator
3. **Inference Execution:** Features are passed to `model.predict(dmatrix)` in sub-millisecond execution time to produce an `on_time_probability` (0.0 to 1.0).
4. **ETA & Delay Derivation:**
   - Predicted Delay = `(1 - on_time_probability) * (duration_min * 0.22 + 4.5)`
   - Predicted Duration = `Base Duration + Predicted Delay`
   - Predicted Arrival = `Departure Time + Predicted Duration`
   - Traffic Rating = `Light` (≥85%), `Moderate` (68–85%), or `Heavy / Delay Expected` (<68%).

---

## 3. Scale-to-Zero & On-Demand Architecture

- **No 24/7 Compute Costs:** Rather than maintaining a costly, dedicated ML server running continuously, the XGBoost booster runs inside the FastAPI container.
- **Scale-to-Zero on Free Tiers:** On free platforms (Render / Koyeb / Fly.io / Cloud Run), the instance automatically scales to zero / sleeps after 15 minutes of inactivity.
- **Graceful Cold Starts:** When an idle instance receives a request, it spins up in ~25–35 seconds. The frontend features a live status monitor and helpful indicator ("Waking service...") while the container initializes.
- **Fallback Resilience:** If the prediction service is temporarily waking or offline, the mapping and routing engine continues functioning seamlessly.

---

## 4. API Endpoints

### `GET /health`
Verifies service availability and model readiness.
```json
{
  "status": "ok",
  "model_loaded": true,
  "service": "BoulderMove Prediction & Routing API",
  "version": "2.1.0"
}
```

### `POST /api/predict`
Executes on-demand XGBoost inference.
**Request Body:**
```json
{
  "duration_min": 38.0,
  "buffer_min": 5.0,
  "num_transfers": 0,
  "rain_1h": 0.0,
  "snow_1h": 0.0,
  "wind_speed": 4.0,
  "temp": 24.0,
  "event_risk": 0.0,
  "hour": 14,
  "is_weekend": false
}
```
**Response:**
```json
{
  "base_duration_minutes": 38,
  "predicted_duration_minutes": 40,
  "predicted_delay_minutes": 1.6,
  "predicted_arrival": "2:04 PM",
  "predicted_arrival_iso": "2026-09-10T14:04:56.758868",
  "prob_on_time": 0.88,
  "traffic_condition": "Light",
  "model_loaded": true,
  "model_type": "XGBoost Classifier (Saved Native JSON Booster)"
}
```

---

## 5. Local Setup & Testing

### 1. Start the Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn combined_router:app --host 127.0.0.1 --port 8080
```

### 2. Verify Endpoints
- Health: `curl http://127.0.0.1:8080/health`
- Predict: 
  ```bash
  curl -X POST http://127.0.0.1:8080/api/predict \
    -H "Content-Type: application/json" \
    -d '{"duration_min": 38, "temp": 22, "rain_1h": 0}'
  ```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5000`** in your browser.

---

## 6. Step-by-Step Production Deployment

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "feat: integrated native XGBoost model and refined UI"
git push origin main
```

### Step 2: Deploy Backend to Render (Free)
1. Go to **[render.com](https://render.com)** → **New +** → **Web Service**.
2. Connect your GitHub repository (`bouldermove_dcsc`).
3. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn combined_router:app --host 0.0.0.0 --port $PORT`
   - **Plan:** `Free`
4. Environment Variables:
   - `OPENWEATHER_API_KEY`: `b1f797ed5078abcd1bcbfb8d5d750e87`
   - `TICKETMASTER_API_KEY`: `waZJvQykZcKcIDmDNKrFkbvm9Ve35LIj`
5. Click **Deploy Web Service** and copy your backend URL (e.g. `https://bouldermove-backend.onrender.com`).

### Step 3: Deploy Frontend to Netlify (Free)
1. Go to **[netlify.com](https://app.netlify.com)** → **Add new site** → **Import an existing project**.
2. Select your GitHub repository.
3. Build Settings (auto-detected from `netlify.toml`):
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Environment Variables:
   - `VITE_BACKEND_URL`: `https://bouldermove-backend.onrender.com` (your Render URL from Step 2).
5. Click **Deploy site**.
