# BoulderMove 🏔️  
### Multimodal Transit & Smart Navigation for Boulder, CO

BoulderMove is a production-ready multimodal trip planner for Boulder, Colorado. It intelligently blends **RTD GTFS transit routing (RAPTOR)**, **pedestrian walking graphs (OSMnx)**, **OpenStreetMap / Valhalla routing (Bike, Walk, Drive)**, **real-time OpenWeather analysis & severe weather warnings**, **Ticketmaster event alerts**, and **machine-learning delay prediction** into a high-performance modern web interface.

---

## 🚀 Quick Deployment (Production)

| Tier | Service | Deployment Guide |
|------|---------|------------------|
| **Frontend (Edge CDN)** | **Netlify (Free)** | Fully configured with `netlify.toml` SPA routing. Run `npm run build` with output to `dist/`. Set `VITE_BACKEND_URL`. |
| **Backend (Python API)** | **Render / Railway / Koyeb (Free)** | Deploy in 1-click via `render.yaml` Blueprint or Dockerfile. |
| **ML Engine** | **Cloud Run / Fast API** | On-demand delay risk and on-time reliability scoring. |

See the complete step-by-step instructions in [DEPLOYMENT.md](file:///e:/Projects/bouldermove_dcsc/DEPLOYMENT.md).

---

## ✨ Features

- 🌲 **Modern Alpine UI**: Curated Boulder mountain aesthetic with responsive controls, glassmorphic panels, and one-click Dark / Light mode.
- ⚡ **Vite + React 18**: High-speed edge-optimized frontend with instant client-side transitions.
- 📍 **Boulder Landmarks Presets**: One-tap navigation to CU Boulder, Pearl Street Mall, Chautauqua Park & Flatirons, Boulder Junction, and Sanitas.
- 🚌 **GTFS RAPTOR Transit Router**: Optimized transit engine computing earliest-arrival journeys across RTD and Bustang feeds.
- 🌧️ **Live Weather & Alerts**: Real-time temperature, wind, snow, and rain delay warnings powered by OpenWeather.
- 🎟️ **Event Impact**: Ticketmaster integration flagging events along transit and driving corridors.
- 🤖 **ML On-Time Probability**: Real-time delay risk and punctuality score calculated per route.
- 🔋 **Zero-Cost Production Ready**: Free-tier cloud backend keep-alive & cold-start helper banner.

---

# 2. Clone the Repository

```bash
git clone https://github.com/cu-csci-4253-datacenter-fall-2025/final-project-rheanair7.git
cd main
```

---

# 3. Backend Setup (FastAPI)

The backend lives in `backend/` and exposes endpoints consumed by the frontend.

## 3.1 Create and activate a virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
```

## 3.2 Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 3.3 Create backend `.env`

Create a file: `backend/.env`

```
OPENWEATHER_API_KEY=YOUR_KEY
TICKETMASTER_API_KEY=YOUR_KEY

DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:PORT/DB_NAME

ML_SERVICE_URL=http://localhost:9000/predict
GTFS_DIR=./data/gtfs
```

## 3.4 Start backend server

### Development
```bash
uvicorn combined_router:app --reload --host 0.0.0.0 --port 8080
```

### Production
```bash
gunicorn combined_router:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8080
```

Backend runs at:

```
http://localhost:8080
```

---

# 4. Frontend Setup (React + Vite)

## 4.1 Install dependencies
```bash
cd ../frontend
npm install
```

## 4.2 Create frontend `.env` (Optional in local development)

Create `frontend/.env`:

```
VITE_BACKEND_URL=http://localhost:8080
```

## 4.3 Run frontend

```bash
npm run dev
```

Frontend runs at:
```
http://localhost:5000 (or http://localhost:5173)
```

---

# 5. Using the App

When the frontend loads, you will see:

- An interactive OpenStreetMap Leaflet map centered on Boulder  
- Origin, waypoint, and destination input boxes with autocomplete & landmark presets  
- Mode toggles: Transit, Bicycling, Walking, Driving  
- Real-time weather banner, ML delay prediction gauge, and step-by-step navigation breakdown  

Expected behavior when requesting a route:

- A responsive, animated polyline route is rendered on the map  
- Walking + RTD transit segments with intermediate stops are displayed  
- Weather + event alerts appear automatically  
- XGBoost machine learning ETA prediction & on-time reliability score are computed in real time  

---

# 6. Machine Learning Model

ML training scripts are located in:

```
backend/train_route_model_from_sql.py  
backend/train_on_time_model.py
```

## Train model locally
```bash
cd backend
source venv/bin/activate
python train_route_model_from_sql.py
```

This generates a model file used by the ML microservice.

---

# 7. Cloud Deployment

## 7.1 Cloud SQL (PostgreSQL)

Add the following to backend `.env`:

```
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@/bouldermove?host=/cloudsql/PROJECT:REGION:INSTANCE
```

## 7.2 Cloud Storage

Upload files:

```
GTFS → gs://bouldermove-data/gtfs/
Models → gs://bouldermove-data/models/
```

## 7.3 Deploy ML Service (Cloud Run)

### Build image
```bash
gcloud builds submit backend/ml_service \
  --tag gcr.io/PROJECT_ID/bouldermove-ml
```

### Deploy
```bash
gcloud run deploy bouldermove-ml \
  --image gcr.io/PROJECT_ID/bouldermove-ml \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

Add to backend `.env`:

```
ML_SERVICE_URL=https://bouldermove-ml-xxxx.run.app/predict
```

## 7.4 Deploy Backend to Compute Engine VM

SSH into your VM:

```bash
sudo apt update
sudo apt install -y git python3 python3-venv
git clone https://github.com/<username>/BoulderMove.git
cd BoulderMove/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create service file at:

`/etc/systemd/system/bouldermove.service`

```
[Unit]
Description=BoulderMove Backend
After=network.target

[Service]
User=USER
WorkingDirectory=/home/USER/BoulderMove/backend
Environment="PATH=/home/USER/BoulderMove/backend/venv/bin"
ExecStart=/home/USER/BoulderMove/backend/venv/bin/gunicorn combined_router:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8080
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bouldermove
sudo systemctl start bouldermove
```

## 7.5 Deploy Frontend

Upload the `frontend/build/` folder to your VM and serve using **Nginx**.

---

# 8. End-to-End Test

1. Open frontend at **http://localhost:3000**  
2. Enter origin + destination  
3. Validate:

- Transit routing path appears  
- Walking route is drawn  
- Weather alerts displayed  
- Event alerts displayed  
- ML prediction appears  

If debugging:

```bash
journalctl -u bouldermove -f
gcloud run logs read bouldermove-ml
```

---

# 9. Troubleshooting

### 9.1 Map not loading
- Ensure API key is correct  
- Enable Maps JavaScript and Places API  

### 9.2 CORS Issues
Ensure backend includes:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 9.3 Frontend cannot reach backend
- Confirm backend is running at http://localhost:8080  
- Ensure frontend `.env` contains correct backend URL  

### 9.4 Missing GTFS or data files
- Ensure GTFS is under `backend/data/gtfs/`  
- Ensure paths in `.env` are correct  

---

# 10. Using the App (Summary)

1. Navigate to **http://localhost:3000**  
2. Enter origin & destination  
3. Click **Plan Trip**  
4. View:
   - Transit + walking route  
   - Weather + event alerts  
   - ML prediction score  

---

