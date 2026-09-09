# Changelog

## 1.0.0

Clean-room rewrite on a modular base:

- Three display modes (`Digits`, `Gauges`, `Combo`) with combinable
  options instead of five fixed styles: digits-with-gauges, words
  instead of glyphs, and a flat-gray `Graphite` color mode.
- Menu in sections (Metrics, View, Units & alerts) with per-row
  reordering, adjustable alert thresholds and a reset-defaults footer.
- Versioned prefs file with validation and migration of pre-1.0 state
  (legacy keys, legacy `any-monitor.json`, legacy `barStyle` values).
- Provider-organized collector emitting a versioned (`schema: 1`)
  JSON reading; node + bash test suites; cold-start harness env vars.
