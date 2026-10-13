import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for the OPCEN React app.
// We expose a public Mapbox token via env if you need it (the original
// Plotly choropleth used carto-positron which doesn't need a token,
// so this is purely optional — see src/pages/Dashboard.jsx).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
