import { useEffect, useRef } from 'react';

// Tiny wrappers around the global CDN scripts so the React components
// don't have to touch `window.Plotly` / `window.flatpickr` / etc.

// Flatpickr: the original used `flatpickr('#filter-date', { mode: 'range', ... })`.
// We replicate that exactly, then forward every onChange to the React
// component as a single date-string value.
export function useFlatpickr(ref, options) {
  useEffect(() => {
    if (!window.flatpickr) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const instance = window.flatpickr(el, options);
    return () => {
      if (instance && instance.destroy) instance.destroy();
    };
    // We intentionally do NOT include `options` in the deps — the caller
    // is expected to memoize the options object. Mirrors the original
    // "set up once" behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Choices.js: same idea, but it owns the underlying <select> so we
// return a `ref` for the host <select> and a getter for the instance.
export function useChoices(options, deps = []) {
  const ref = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!window.Choices || !ref.current) return undefined;

    instanceRef.current = new window.Choices(ref.current, options);
    return () => {
      if (instanceRef.current) instanceRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, instanceRef];
}

// Generic helper for any DOM element that Plotly should manage.
export function usePlotly(elementId, drawFn, deps) {
  useEffect(() => {
    if (!window.Plotly) return undefined;
    drawFn();
    return () => {
      if (window.Plotly && document.getElementById(elementId)) {
        window.Plotly.purge(elementId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
