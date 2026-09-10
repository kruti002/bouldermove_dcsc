import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  Polyline: ({ positions }) => (
    <div data-testid="route-polyline">{JSON.stringify(positions)}</div>
  ),
  Marker: ({ children, position }) => (
    <div data-testid="route-marker">
      {JSON.stringify(position)}
      {children}
    </div>
  ),
  Tooltip: ({ children }) => <span>{children}</span>,
  useMap: () => ({ fitBounds: jest.fn() }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

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
async function selectLocations() {
  fireEvent.change(screen.getByPlaceholderText('Origin'), {
    target: { value: 'Origin' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Find' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Origin result' }));

  fireEvent.change(screen.getByPlaceholderText('Destination'), {
    target: { value: 'Destination' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Find' })[1]);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Destination result' })
  );
}

function mockLocationSearch(requestUrl) {
  const query = new URL(requestUrl).searchParams.get('q');
  const isDestination = query === 'Destination';
  return Promise.resolve({
    ok: true,
    json: async () => [
      {
        place_id: isDestination ? 2 : 1,
        display_name: `${query} result`,
        lat: isDestination ? '40.2' : '40',
        lon: isDestination ? '-105.2' : '-105',
      },
    ],
  });
}

describe('route recovery states', () => {
  test('keeps the newest destination route when the previous request finishes last', async () => {
    const pendingRoutes = [];
    jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
      const requestUrl = String(url);
      if (requestUrl.includes('nominatim.openstreetmap.org')) {
        const query = new URL(requestUrl).searchParams.get('q');
        const isOrigin = query === 'Origin';
        const isNewDestination = query === 'New Destination';
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              place_id: query,
              display_name: `${query} result`,
              lat: isOrigin ? '40' : isNewDestination ? '40.3' : '40.2',
              lon: isOrigin ? '-105' : isNewDestination ? '-105.3' : '-105.2',
            },
          ],
        });
      }
      if (requestUrl.includes('/osm_directions')) {
        return new Promise((resolve) => pendingRoutes.push(resolve));
      }
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ prob_on_time: 0.9, expected_delay_min: 1 }),
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
    await selectLocations();
    await waitFor(() => expect(pendingRoutes).toHaveLength(1));

    fireEvent.change(screen.getByPlaceholderText('Destination'), {
      target: { value: 'New Destination' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Find' })[1]);
    fireEvent.click(
      await screen.findByRole('button', { name: 'New Destination result' })
    );
    await waitFor(() => expect(pendingRoutes).toHaveLength(2));

    pendingRoutes[1]({
      ok: true,
      json: async () => ({
        routes: [
          {
            duration: 120,
            distance: 1000,
            geometry: { coordinates: [[-105, 40], [-105.3, 40.3]] },
          },
        ],
      }),
    });
    expect(await screen.findByText('2 min • 1 km')).toBeInTheDocument();

    pendingRoutes[0]({
      ok: false,
      json: async () => ({
        error: { code: 'provider_failure', message: 'Stale destination failure' },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('2 min • 1 km')).toBeInTheDocument();
      expect(screen.queryByText('Routing service unavailable')).not.toBeInTheDocument();
    });
  });

  test('keeps the latest trip when an older route response finishes last', async () => {
    let resolveDrivingRoute;
    let drivingSignal;
    jest.spyOn(global, 'fetch').mockImplementation((url, options) => {
      const requestUrl = String(url);
      if (requestUrl.includes('nominatim.openstreetmap.org')) {
        return mockLocationSearch(requestUrl);
      }
      if (requestUrl.includes('/osm_directions')) {
        drivingSignal = options?.signal;
        return new Promise((resolve) => {
          resolveDrivingRoute = resolve;
        });
      }
      if (requestUrl.includes('/plan_transit_full')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            geometry: [
              { lat: 40, lon: -105 },
              { lat: 40.2, lon: -105.2 },
            ],
            transit: [{ route_id: 'LATEST', intermediate_stops: ['Latest stop'] }],
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
    await selectLocations();
    await waitFor(() => expect(resolveDrivingRoute).toBeDefined());

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'transit' },
    });

    expect(await screen.findByText('Route A — Transit via LATEST')).toBeInTheDocument();
    expect(drivingSignal.aborted).toBe(true);

    resolveDrivingRoute({
      ok: false,
      json: async () => ({
        error: { code: 'provider_failure', message: 'Stale driving failure' },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('Route A — Transit via LATEST')).toBeInTheDocument();
      expect(screen.queryByText('Routing service unavailable')).not.toBeInTheDocument();
    });
  });

  test('shows loading and then a distinct no-route message', async () => {
    let resolveRoute;
    jest.spyOn(global, 'fetch').mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('nominatim.openstreetmap.org')) {
        return mockLocationSearch(requestUrl);
      }
      if (requestUrl.includes('/osm_directions')) {
        return new Promise((resolve) => {
          resolveRoute = resolve;
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
    await selectLocations();

    expect(await screen.findByText('Finding routes…')).toBeInTheDocument();

    resolveRoute({
      ok: true,
      json: async () => ({
        routes: [],
        error: {
          code: 'no_route',
          message: 'No route connects those locations for the selected travel mode.',
        },
      }),
    });

    expect((await screen.findAllByText('No route found')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Routing service unavailable')).not.toBeInTheDocument();
  });

  test('shows provider failure and retry issues a new route request', async () => {
    let routeRequests = 0;
    jest.spyOn(global, 'fetch').mockImplementation((url) => {
      const requestUrl = String(url);
      if (requestUrl.includes('nominatim.openstreetmap.org')) {
        return mockLocationSearch(requestUrl);
      }
      if (requestUrl.includes('/osm_directions')) {
        routeRequests += 1;
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: {
              code: 'provider_failure',
              message: 'The road routing service is temporarily unavailable.',
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
    await selectLocations();

    expect(
      (await screen.findAllByText('Routing service unavailable')).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('No route found')).not.toBeInTheDocument();
    expect(routeRequests).toBe(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]);

    await waitFor(() => expect(routeRequests).toBe(2));
  });
});

describe('location search failures', () => {
  test.each([
    {
      name: 'network errors',
      response: () => Promise.reject(new Error('Network unavailable')),
      message: /couldn't search for this origin.*check your connection and try again/i,
    },
    {
      name: 'empty results',
      response: () =>
        Promise.resolve({ ok: true, json: async () => [] }),
      message: /no usable origin found.*check the place name and try again/i,
    },
    {
      name: 'invalid coordinates',
      response: () =>
        Promise.resolve({
          ok: true,
          json: async () => [
            {
              place_id: 1,
              display_name: 'Broken result',
              lat: 'not-a-number',
              lon: '-105',
            },
          ],
        }),
      message: /no usable origin found.*check the place name and try again/i,
    },
  ])('keeps trip setup usable for $name without requesting a route', async ({
    response,
    message,
  }) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if (String(url).includes('nominatim.openstreetmap.org')) {
        return response();
      }
      return Promise.reject(new Error(`Unexpected route request: ${url}`));
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
    fireEvent.change(screen.getByPlaceholderText('Origin'), {
      target: { value: 'Unavailable place' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Find' })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByPlaceholderText('Destination')).toBeEnabled();
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.getByRole('button', { name: /show today’s weather/i })).toBeEnabled();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        /\/(?:osm_directions|plan_transit_full)/.test(String(url))
      )
    ).toBe(false);
  });
});

test('maps OSM directions to alternatives, complete coordinates, and endpoint markers', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  fetchMock.mockImplementation((url, options) => {
    const requestUrl = String(url);

    if (requestUrl.includes('nominatim.openstreetmap.org')) {
      const query = new URL(requestUrl).searchParams.get('q');
      const isDestination = query === 'Destination';
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            place_id: isDestination ? 2 : 1,
            display_name: `${query} result`,
            lat: isDestination ? '40.2' : '40',
            lon: isDestination ? '-105.2' : '-105',
          },
        ],
      });
    }

    if (requestUrl.includes('/osm_directions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          routes: [
            {
              duration: 600,
              distance: 5000,
              geometry: {
                coordinates: [
                  [-105, 40],
                  [-105.1, 40.1],
                  [-105.2, 40.2],
                ],
              },
            },
            {
              duration: 720,
              distance: 6500,
              geometry: {
                coordinates: [
                  [-105, 40],
                  [-105.05, 40.08],
                  [-105.2, 40.2],
                ],
              },
            },
          ],
          weather: null,
          events_nearby: { count: 0, events: [] },
        }),
      });
    }

    if (options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          prob_on_time: 0.9,
          expected_delay_min: 2,
        }),
      });
    }

    return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
  fireEvent.click(screen.getByLabelText('Show alternative routes'));
  await selectLocations();

  await waitFor(() => {
    expect(screen.getAllByTestId('route-polyline')).toHaveLength(2);
  });

  expect(screen.getAllByTestId('route-polyline')[0]).toHaveTextContent(
    '[[40,-105],[40.1,-105.1],[40.2,-105.2]]'
  );
  expect(screen.getAllByTestId('route-polyline')[1]).toHaveTextContent(
    '[[40,-105],[40.08,-105.05],[40.2,-105.2]]'
  );
  expect(screen.getAllByTestId('route-marker')).toHaveLength(2);
  expect(screen.getAllByText(/Route [AB] — driving route/)).toHaveLength(2);

  const routeRequest = fetchMock.mock.calls.find(([url]) =>
    String(url).includes('/osm_directions')
  )[0];
  expect(routeRequest).toContain('alternatives=true');
});

test('renders the complete RAPTOR geometry and transit stop list', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  fetchMock.mockImplementation((url, options) => {
    const requestUrl = String(url);

    if (requestUrl.includes('nominatim.openstreetmap.org')) {
      const query = new URL(requestUrl).searchParams.get('q');
      const isDestination = query === 'Destination';
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            place_id: isDestination ? 2 : 1,
            display_name: `${query} result`,
            lat: isDestination ? '40.2' : '40',
            lon: isDestination ? '-105.2' : '-105',
          },
        ],
      });
    }

    if (requestUrl.includes('/plan_transit_full')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          geometry: [
            { lat: 40, lon: -105 },
            { lat: 40.1, lon: -105.1 },
            { lat: 40.2, lon: -105.2 },
          ],
          transit: [
            {
              route_id: 'BOLT',
              intermediate_stops: ['Norlin Library', 'Downtown Boulder'],
            },
          ],
          weather: null,
          events_nearby: { count: 0, events: [] },
        }),
      });
    }

    if (requestUrl.includes('/osm_directions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ routes: [] }),
      });
    }

    return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
  await selectLocations();
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'transit' },
  });

  await waitFor(() => {
    expect(screen.getByTestId('route-polyline')).toHaveTextContent(
      '[[40,-105],[40.1,-105.1],[40.2,-105.2]]'
    );
  });

  expect(screen.getByText('Stops: Norlin Library → Downtown Boulder')).toBeInTheDocument();
  expect(screen.getByText('Route A — Transit via BOLT')).toBeInTheDocument();
  expect(screen.getAllByTestId('route-marker')).toHaveLength(2);
});

test('shows a usable route when optional weather and event data are unavailable', async () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  fetchMock.mockImplementation((url, options) => {
    const requestUrl = String(url);

    if (requestUrl.includes('nominatim.openstreetmap.org')) {
      const query = new URL(requestUrl).searchParams.get('q');
      const isDestination = query === 'Destination';
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            place_id: isDestination ? 2 : 1,
            display_name: `${query} result`,
            lat: isDestination ? '40.2' : '40',
            lon: isDestination ? '-105.2' : '-105',
          },
        ],
      });
    }

    if (requestUrl.includes('/osm_directions')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          routes: [
            {
              duration: 600,
              distance: 5000,
              geometry: {
                coordinates: [
                  [-105, 40],
                  [-105.2, 40.2],
                ],
              },
            },
          ],
          weather: null,
          events_nearby: [],
        }),
      });
    }

    if (options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          prob_on_time: null,
          expected_delay_min: null,
        }),
      });
    }

    return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter BoulderMove' }));
  await selectLocations();

  await waitFor(() => {
    expect(screen.getByText('Route A — driving route')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show today’s weather' }));

  expect(
    screen.getByText('Weather data unavailable for this route.')
  ).toBeInTheDocument();
  expect(
    screen.getByText('⚠️ No events today along this route.')
  ).toBeInTheDocument();
});
