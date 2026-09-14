# BoulderMove

> Multimodal transit and smart navigation for Boulder, Colorado.

🔗 **Live Deployment:** [bouldermove.netlify.app](https://bouldermove.netlify.app)  

---
## Overview
BoulderMove is a cloud-native transit planning platform tailored for Boulder, CO. Built on a containerized microservices architecture, it combines high-performance multimodal graph routing, distributed ML delay predictions, and live environmental intelligence into an edge-delivered web application.

### Key Capabilities
* **Multimodal Routing:** High-speed RAPTOR transit router combining RTD GTFS schedules with OSMnx pedestrian and road graphs.
* **ML Punctuality Predictions:** Serverless XGBoost inference predicting corridor delay risks and on-time arrival probabilities.
* **Cloud-Native Architecture:** Containerized FastAPI backend with automated health monitoring and Netlify edge distribution.
* **Live Environmental Context:** Real-time Boulder road weather alerts (rain/snow/ice) and Ticketmaster event impact analysis.
* **Slack Integration:** OAuth workspace installation and `/bouldermove` slash command trip dispatching.
* **Interactive Map:** High-resolution OpenStreetMap canvas with landmark presets, live stops, and parking overlays.
* **Trip Management:** Persistent route bookmarks with one-click reload.

---

## Tech Stack

* **Frontend:** React 18, Vite, Lucide Icons, Leaflet / OpenStreetMap
* **Backend:** Python 3.11, FastAPI, Uvicorn
* **Algorithms & ML:** RAPTOR transit routing, OSMnx, NetworkX, XGBoost, Scikit-learn
* **Cloud & DevOps:** Netlify (Edge CDN), Docker, Google Cloud Run, Render, Cloud SQL (PostgreSQL)
* **APIs:** OpenWeatherMap, Ticketmaster Discovery, Slack OAuth & Webhooks


## Quick Start (Local Setup)

### 1. Clone the repo
```bash
git clone https://github.com/kruti002/bouldermove_dcsc.git
cd bouldermove_dcsc
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

pip install -r requirements.txt
uvicorn combined_router:app --reload --port 8080
```
Backend runs at `http://localhost:8080`.

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5000`.

---

## Deployment

* **Frontend:** Hosted on Netlify (see `frontend/netlify.toml`).
* **Backend:** Dockerized FastAPI service deployable to Render, Railway, or Google Cloud Run (see `backend/Dockerfile` and `DEPLOYMENT.md`).

---

## Author

**Kruti Shah**  
University of Colorado Boulder • 2026
