import { render, screen } from '@testing-library/react';
import App, {
  buildMLFeatures,
  buildOsmRoutes,
  buildTransitRoute,
} from './App';

jest.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => <div data-testid="lottie-animation" />,
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  Marker: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>,
  useMap: () => ({ fitBounds: jest.fn() }),
}));

test('renders the BoulderMove trip dashboard', () => {
  render(<App />);
  expect(screen.getAllByText(/BoulderMove/i).length).toBeGreaterThan(0);
  expect(screen.getByTestId('map')).toBeInTheDocument();
});

test('maps complete RAPTOR geometry and transit stops', () => {
  const data = {
    geometry: [
      { lat: 40.0, lon: -105.2 },
      { lat: 40.1, lon: -105.1 },
      { lat: 40.2, lon: -105.0 },
    ],
    transit: [
      { route_id: 'FF1', intermediate_stops: ['A', 'B'] },
      { route_id: 'AB1', intermediate_stops: ['C'] },
    ],
  };
  const body = {
    origin: { lat: 40.0, lon: -105.2 },
    destination: { lat: 40.2, lon: -105.0 },
  };

  const route = buildTransitRoute(data, body);

  expect(route.summary).toBe('Transit via FF1');
  expect(route.polylineCoords).toHaveLength(3);
  expect(route.polylineCoords[1]).toEqual({ lat: 40.1, lng: -105.1 });
  expect(route.stops).toEqual(['A', 'B', 'C']);
});

test('maps every OSM alternative and preserves route context', () => {
  const data = {
    routes: [
      {
        duration: 600,
        distance: 2400,
        geometry: { coordinates: [[-105.2, 40.0], [-105.1, 40.1]] },
      },
      {
        duration: 720,
        distance: 2700,
        geometry: { coordinates: [[-105.2, 40.0], [-105.0, 40.2]] },
      },
    ],
    weather: { temp: 20, custom_alerts: [] },
    events_nearby: { count: 1, events: [{ name: 'Concert' }] },
  };

  const routes = buildOsmRoutes(
    data,
    'walking',
    { lat: 40.0, lon: -105.2 },
    { lat: 40.2, lon: -105.0 }
  );

  expect(routes).toHaveLength(2);
  expect(routes[0].duration_min).toBe(10);
  expect(routes[0].distance_km).toBe(2.4);
  expect(routes[0].events_nearby.count).toBe(1);
  expect(buildMLFeatures(routes[0], routes[0].weather).event_risk).toBe(1);
});

test('treats missing optional provider data as non-fatal', () => {
  const [route] = buildOsmRoutes(
    {
      routes: [
        {
          duration: 60,
          distance: 100,
          geometry: { coordinates: [[-105.2, 40.0]] },
        },
      ],
    },
    'walking',
    { lat: 40.0, lon: -105.2 },
    { lat: 40.1, lon: -105.1 }
  );

  expect(route.weather).toBeNull();
  expect(route.events_nearby).toEqual([]);
  expect(buildMLFeatures(route, route.weather).event_risk).toBe(0);
});
