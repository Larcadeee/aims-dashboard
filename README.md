# OPCEN Dashboard — Draft - 4 (React port)

A React + Vite port of the original static `Draft - 2` dashboard for the
CDRRMD Operations Center (Butuan City).

The look, the data sources, the third-party libraries, and the file layout
mirror the original as closely as possible — the only thing that changed is
the rendering layer: plain HTML pages are now React components, and the
multi-page navigation is handled by `react-router-dom` instead of file
links.

## Pages

| Route        | Source        | What it does                                       |
| ------------ | ------------- | -------------------------------------------------- |
| `/`          | `index.html`  | Live key metrics, heat map, charts, turn-around    |
| `/resource`  | `resource.html` | Resource grid + fleet availability donut chart   |
| `/report`    | `report.html` | E-Log records table with filter + batch print      |
| `/weather`   | `weather.html` | OpenWeather hero, sun cycle, operational impact   |
| `/news`      | `news.html`  | Bento-grid Facebook feed                           |

## Stack

- **React 18** + **Vite 5** + **react-router-dom 6**
- **Plotly.js 2.27** — same charts as the original
- **D3.js 7** + **topojson-client** — CSV/GeoJSON parsing
- **flatpickr** — date range filter
- **Choices.js** — team multi-select
- **FontAwesome 6.5.1** — icons

All of the above are still loaded from the same CDNs as the original
(via `index.html`) so behavior is identical to `Draft - 2`. Only the
React UI is new.

## Run

```bash
cd "/Users/gerard/Desktop/Work Projects/Draft - 4"
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Project layout

```
Draft - 4/
├── index.html                  # Vite entry (loads CDN libs, mounts React)
├── vite.config.js
├── package.json
├── public/
│   └── data/
│       └── Boundary.json       # copied from Draft - 2 (used by the heat map)
└── src/
    ├── main.jsx                # mounts <App />, sets up router
    ├── App.jsx                 # layout shell + <Outlet />
    ├── styles/
    │   └── style.css           # full original stylesheet, ported as-is
    ├── components/
    │   ├── Sidebar.jsx
    │   ├── PageHeader.jsx
    │   └── ZapierChat.jsx      # <zapier-interfaces-chatbot-embed>
    ├── pages/
    │   ├── Dashboard.jsx       # / (was index.html + js/script.js)
    │   ├── Resource.jsx        # /resource
    │   ├── Report.jsx          # /report (incl. batch print)
    │   ├── Weather.jsx         # /weather
    │   └── News.jsx            # /news
    └── utils/
        ├── time.js             # timeToSeconds, secondsToHMS, getAverageTime
        ├── filters.js          # shared priority / team / date filters
        └── chart.js            # renderDashboard() — port of the giant
                                # render function from Draft - 2
```

## What changed vs. Draft - 2

- Multi-page `<a href="x.html">` links became `<NavLink to="/x">`.
- Each page's `DOMContentLoaded` + `window.onload` initialization moved
  into `useEffect(() => { ... }, [])` inside the matching React component.
- The dashboard's `globalCleanedData` / `applyFilters` / `renderDashboard`
  became a single React hook (`useDashboardData`) that owns the filtered
  data and pushes it down to chart subcomponents.
- Choices.js, flatpickr, and Plotly are still global-window scripts.
  React wrappers (`useChoices`, `useFlatpickr`, `usePlotly`) handle the
  imperative lifecycle without pulling in extra npm packages.
- The Facebook page access token and the OpenWeather key stayed
  hard-coded in the original; they're now inside `src/pages/News.jsx` and
  `src/pages/Weather.jsx`. Move them to `.env` if you plan to deploy
  publicly.
# aims-dashboard
