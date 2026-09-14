# BoulderMove

> Multimodal transit and smart navigation for Boulder, Colorado.

🔗 **Live Deployment:** [bouldermove.netlify.app](https://bouldermove.netlify.app)  
📦 **Repository:** [github.com/kruti002/bouldermove_dcsc](https://github.com/kruti002/bouldermove_dcsc)

---

## Overview

BoulderMove is a transit planning platform tailored for Boulder, CO. It integrates multimodal routing (walking, biking, driving, and RTD bus connections) with real-time delay predictions and environmental context.

### Key Capabilities
* **Multimodal Routing:** RAPTOR transit router combining RTD GTFS schedules with OSMnx pedestrian and road graphs.
* **ML Punctuality Predictions:** Trained XGBoost delay model predicting on-time arrival probabilities and traffic risks.
* **Live Environmental Context:** Boulder road weather alerts (rain/snow/ice) and Ticketmaster destination event impact.
* **Slack Integration:** OAuth workspace installation and `/bouldermove` slash command trip dispatching.
* **Interactive Map:** High-resolution OpenStreetMap canvas with landmark presets, live stops, and parking overlays.
* **Trip Management:** Save recurring routes locally with one-click reload.

---

## Tech Stack

* **Frontend:** React 18, Vite, Lucide Icons, Leaflet / OpenStreetMap
* **Backend:** Python 3.11, FastAPI, Uvicorn
* **Algorithms & ML:** RAPTOR transit routing, OSMnx, NetworkX, XGBoost, Scikit-learn
* **APIs:** OpenWeatherMap, Ticketmaster Discovery, Slack OAuth & Webhooks

---

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
