# BoulderMove

BoulderMove is a multimodal trip planner for Boulder that combines transit routing, walking, and contextual information like weather and alerts in a single UI.

This repository contains:

- `backend/` - FastAPI routing API  
- `frontend/` - React app with Google Maps UI  
- `data/` - Preprocessed network / GTFS data (if present)  


---

## 1. Prerequisites

Please install:

- Python 3.10+  
- Node.js 18+ and npm  
- Git  
- (Optional) `python -m venv` for a virtual environment  

You will also need a Google Maps JavaScript API key with:

- Maps JavaScript API enabled  
- Places API enabled (if autocomplete is used)  

---

## 2. Clone the repository
```bash
git clone https://github.com/rheanair7/BoulderMove.git
cd BoulderMove
```

Repo layout:
```
BoulderMove/
├── backend/
├── frontend/
├── data/              # network / GTFS data if included
└── README.md
```

---

## 3. Backend setup (FastAPI)

The backend lives in `backend/` and exposes endpoints consumed by the frontend.

### 3.1 Create and activate a virtual environment
```bash
cd backend
python -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate
```

### 3.2 Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```


```

The backend should still run even if some optional variables are missing, but it may skip weather or event enrichment depending on how the code is written.

### 3.3 Run the backend (development)

From inside `backend/` with the virtual environment active:
```bash
uvicorn combined_router:app --host 0.0.0.0 --port 8080 --reload
```

You should now be able to open:

- API docs: http://localhost:8080/docs

Key endpoint used by the frontend:

- `POST /plan_transit_full` - returns routes between origin and destination

If startup fails due to missing data, make sure the `data/` folder is present and that your paths in the code or `.env` file match.

---

## 4. Frontend setup (React + Google Maps)

The frontend lives in `frontend/`. It renders the map and calls the backend API.

### 4.1 Install dependencies
```bash
cd ../frontend
npm install
```

### 4.2 Configure environment variables

Create a file `frontend/.env`:
```env
# Google Maps JavaScript API key (required)
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE

# Backend URL (FastAPI)
REACT_APP_COMBINED_ROUTER_URL=http://localhost:8080
```

Make sure the variable names match what is used in `src/App.js`.  
For example, if `App.js` uses `process.env.REACT_APP_COMBINED_ROUTER_URL`, keep that exact name here.

### 4.3 Run the frontend (development)
```bash
npm start
```

This starts the React development server at:

- http://localhost:3000

You should see:

- A Google Map centered on Boulder
- Origin and destination inputs
- Controls or a button to plan a trip

When you submit a route request, the frontend calls the backend at http://localhost:8080.

---

## 5. End-to-end test

### 5.1 Start the backend
```bash
cd backend
source venv/bin/activate
uvicorn combined_router:app --host 0.0.0.0 --port 8080 --reload
```

### 5.2 Start the frontend
```bash
cd ../frontend
npm start
```

### 5.3 Use the app

1. Navigate to http://localhost:3000
2. Enter an origin (for example, CU Boulder, Folsom Field)
3. Enter a destination (for example, Pearl Street Mall, Boulder)
4. Click the route button

Expected behavior (depending on the exact version of the code):

- The map displays a polyline representing the selected route
- A sidebar or panel shows route steps or segments (walk, bus, etc.)
- Optional: any weather or alert messages appear alongside the route

---

## 6. Troubleshooting

### 6.1 Map not loading, grey screen, or "For development purposes only"

- Check `REACT_APP_GOOGLE_MAPS_API_KEY` in `frontend/.env`
- Ensure Maps JavaScript API (and Places API if used) are enabled for that key

### 6.2 CORS errors in the browser

The FastAPI app should be using `CORSMiddleware`. In `combined_router.py`, verify something like:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6.3 Frontend cannot reach backend (Network Error or ECONNREFUSED)

- Confirm the backend is running on http://localhost:8080
- Confirm `REACT_APP_COMBINED_ROUTER_URL` in `frontend/.env` matches the running backend URL

### 6.4 Backend fails on import or missing data

- Ensure required data files exist under `data/`
- Ensure any paths in the code or `.env` file (such as `NETWORK_DATA_DIR`) point to the correct directories

---
