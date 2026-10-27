# Times Table Time

A 15-minute (adjustable) active-time multiplication drill with a PIN-protected parent screen.

- **App:** `index.html`, hosted on GitHub Pages.
- **Data:** `worker.js`, a Cloudflare Worker that saves sessions to the KV namespace `times-table-time` (binding name `TTT`).

The app's `API` constant in `index.html` holds the Worker's address.
