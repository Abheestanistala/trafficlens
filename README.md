# HTK Traffic Lens

HTK Traffic Lens is a browser-only HTTP traffic analyzer, like Fiddler Classic but read-only. Open HAR, SAZ or Charles captures to inspect requests, filter, auto-detect problems, view waterfalls, search, diff and redact. Everything is parsed locally; nothing is uploaded.

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (importers, filters)
npm run e2e        # Playwright smoke tests (npx playwright install chromium once)
npm run build      # static site in dist/
node fixtures/make.mjs   # regenerate sample.har / sample.saz
```

## Features
- **Importers**: HAR 1.2, Fiddler SAZ (chunked + gzip/deflate, timers, process, comments), Charles `.chlsj`, Charles XML session `.chlx` (best-effort, untested against real files). Native binary `.chls` is rejected with export guidance. Multiple files merge into one workspace.
- **Sessions grid**: virtualized, keyboard nav, column chooser, custom header columns, size/time meters, rule-based row colours.
- **Inspectors**: Headers, Text, Syntax (local Monaco), JSON, Params, Image, Hex, Cookies, Auth (JWT/Basic), Caching, Timing, Raw.
- **Filtering**: QuickExec (`?text  >10k  =404  @host  select json  cls`), mitmproxy-style expressions (`~m POST & ~c 5xx`, `~u`, `~h`, `~b`, `~dur >2000`, ...), filter panel.
- **Views**: Timeline waterfall, Findings analyzer (errors, redirect loops, slow, compression, caching, duplicates, CORS, mixed content, cookies, auth, HSTS), Stats, Find (worker-based search over URLs, headers, bodies), Compare (session diff and capture-to-capture diff), TextWizard tools, Rules (colour + alert on expressions), Saved workspaces (IndexedDB).
- **Export/share**: HAR, SAZ, redacted bundle `.zip` with a sanitize wizard; Copy as cURL.
- **Plugins**: `window.HTK.registerAnalyzer({id, name, run(sessions) => Finding[]})`. The strict CSP blocks remote scripts, so register from trusted local code.
- Light/dark themes with a validated categorical palette (status pills always carry an icon, not colour alone).

## Known gaps
Brotli/zstd bodies are shown raw. `.chlx` is unverified against real Charles output. SAZ scheme is inferred from CONNECT tunnels (SAZ does not store it).
