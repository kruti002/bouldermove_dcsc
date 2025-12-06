# BoulderMove  
### By Kruti Shah and Rhea Nair  

BoulderMove is a multimodal trip planner for Boulder that combines **transit routing**, **walking**, **weather analysis**, **event alerts**, and a **machine-learning prediction model** into a single smart UI.

This repository contains:

- `backend/` — FastAPI routing API + routing engine + ML training  
- `frontend/` — React UI + Google Maps  

---

# 1. Prerequisites

## Local Requirements
- Python 3.10+
- Node.js LTS
- Git
- Virtualenv or Conda

## Cloud Requirements
- Compute Engine VM  
- Cloud SQL (PostgreSQL)  
- Cloud Storage bucket  
- Cloud Run (ML service)  
- Cloud Build + Artifact Registry  

### API Keys Needed
You must have a Google Maps JavaScript API key with:
- Maps JavaScript API enabled  
- Places API enabled  

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
GOOGLE_MAPS_API_KEY=YOUR_KEY
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

# 4. Frontend Setup (React)

## 4.1 Install dependencies
```bash
cd ../frontend
npm install
```

## 4.2 Create frontend `.env`

Create `frontend/.env`:

```
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_KEY
REACT_APP_BACKBINDED_URL=http://localhost:8080
```

## 4.3 Run frontend

```bash
npm start
```

Frontend runs at:
```
http://localhost:3000
```

---

# 5. Using the App

When the frontend loads, you should see:

- A Google Map centered on Boulder  
- Origin and destination input boxes  
- A button to plan a trip  

Expected behavior when requesting a route:

- A polyline route is drawn on the map  
- Walking + transit segments are displayed  
- Weather + event alerts appear  
- ML-based on-time arrival probability is shown  

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

