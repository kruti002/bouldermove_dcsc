import { render, screen } from '@testing-library/react';
import App from './App';

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
