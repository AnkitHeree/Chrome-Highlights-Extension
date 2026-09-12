# Page Highlighter – Chrome Extension

Save text highlights on any webpage. Highlights survive page reloads and many dynamic DOM changes using **character-offset anchoring** + MutationObserver re-anchoring.

## Features

- **Select text → floating color toolbar** (yellow, green, blue, pink, orange)
- **Right-click context menu** → Highlight selection with color choices
- **Keyboard shortcuts**
  - `Alt+Shift+Y` → Highlight selection yellow
  - `Alt+Shift+G` → Highlight selection green
  - `Alt+Shift+B` → Highlight selection blue
  - `Alt+Shift+R` → Remove highlights under current selection
- **Persistent storage** per URL (`chrome.storage.local`)
- **Restore on load** + automatic re-apply when the page mutates (SPAs, infinite scroll, etc.)
- **Popup**
  - List of highlights on the current page
  - Delete individual / Clear all
  - **Export** current page highlights as JSON
  - **Import** highlights from a previously exported JSON file
- **Alt+Click** a highlight on the page to remove it
- Multi-node text wrapping

## Installation (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `highlight-extension` folder

After updating files, click the **Reload** button on the extension card.

## Project Structure

```
highlight-extension/
├── manifest.json
├── background.js          # Service worker, context menus, keyboard commands
├── content.js             # Create / restore / remove + MutationObserver
├── popup.html
├── popup.js
├── styles/
│   ├── highlight.css      # Highlight spans + floating toolbar
│   └── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## How Anchoring Works

1. On highlight: convert the selected `Range` → absolute character start/end offsets relative to `document.body` text content.
2. Store `{ id, start, end, color, text, createdAt, url }`.
3. On page load (and after relevant DOM mutations): rebuild a `Range` from those offsets and wrap matching segments in `<span class="ph-highlight">`.

A MutationObserver watches for childList / characterData changes and debounces a re-restore so highlights come back after dynamic content updates.

## Export / Import format

```json
{
  "version": 1,
  "exportedAt": "2026-09-11T...",
  "url": "https://example.com/page",
  "title": "Page Title",
  "highlights": [
    {
      "id": "h_...",
      "start": 1234,
      "end": 1456,
      "color": "yellow",
      "text": "preview text…",
      "createdAt": 1726...,
      "url": "https://example.com/page"
    }
  ]
}
```

You can also import a plain array of highlight objects.

## Known Limitations

- Character offsets assume relatively stable text content. Extremely aggressive DOM rewrites that change large amounts of text can still break restore.
- Restricted pages (`chrome://`, Chrome Web Store, etc.) block content scripts.
- Storage is local only (no cross-device sync yet).
- Keyboard shortcuts can be changed at `chrome://extensions/shortcuts`.

## Changelog

### v1.1.0
- Export / Import JSON
- MutationObserver-based re-anchoring for dynamic pages
- Keyboard shortcuts (Alt+Shift+Y/G/B/R)
- Improved restore robustness
