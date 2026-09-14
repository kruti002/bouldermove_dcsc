/**
 * BoulderMove Saved Trips Persistence Service
 * 
 * Current implementation: Browser localStorage
 * Future extension: Authenticated cloud synchronization (MongoDB / PostgreSQL)
 */

const STORAGE_KEY = "bouldermove_saved_trips_v3";

const DEFAULT_SAVED_TRIPS = [
  {
    id: "trip-default-1",
    name: "Campus Commute",
    origin: "Williams Village",
    destination: "CU Boulder (UMC)",
    mode: "transit",
    savedAt: new Date().toISOString(),
  },
  {
    id: "trip-default-2",
    name: "Weekend Flatirons Hike",
    origin: "Pearl St Mall",
    destination: "Chautauqua & Flatirons",
    mode: "transit",
    savedAt: new Date().toISOString(),
  },
];

export function getSavedTrips() {
  if (typeof window === "undefined") return DEFAULT_SAVED_TRIPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVED_TRIPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SAVED_TRIPS;
  } catch (err) {
    console.warn("Failed to load saved trips from localStorage:", err);
    return DEFAULT_SAVED_TRIPS;
  }
}

export function saveTrip({ origin, destination, mode = "transit", name, originCoord, destCoord, timePreference }) {
  const current = getSavedTrips();
  const existingIdx = current.findIndex(
    (t) => t.origin.toLowerCase() === origin.toLowerCase() && t.destination.toLowerCase() === destination.toLowerCase()
  );

  const newEntry = {
    id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name || `${origin} → ${destination}`,
    origin,
    destination,
    mode,
    originCoord,
    destCoord,
    timePreference,
    savedAt: new Date().toISOString(),
  };

  let updated;
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...newEntry, id: updated[existingIdx].id };
  } else {
    updated = [newEntry, ...current];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save trip to localStorage:", err);
  }
  return updated;
}

export function deleteTrip(tripId) {
  const current = getSavedTrips();
  const updated = current.filter((t) => t.id !== tripId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to delete trip from localStorage:", err);
  }
  return updated;
}

export function updateTripName(tripId, newName) {
  const current = getSavedTrips();
  const updated = current.map((t) => (t.id === tripId ? { ...t, name: newName } : t));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to update trip name in localStorage:", err);
  }
  return updated;
}

export function isTripSaved(origin, destination) {
  if (!origin || !destination) return false;
  const current = getSavedTrips();
  return current.some(
    (t) => t.origin.toLowerCase() === origin.toLowerCase() && t.destination.toLowerCase() === destination.toLowerCase()
  );
}
