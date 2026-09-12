/**
 * Page Highlighter 
 * List, delete, clear, export, import
 */

const COLORS = {
  yellow: '#fff59d',
  green:  '#a5d6a7',
  blue:   '#90caf9',
  pink:   '#f48fb1',
  orange: '#ffcc80'
};

const listEl     = document.getElementById('list');
const statusEl   = document.getElementById('status');
const clearBtn   = document.getElementById('clear-all');
const exportBtn  = document.getElementById('export-btn');
const importBtn  = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage(tab.id, message);
}

async function fetchHighlights() {
  try {
    const response = await sendToTab({ type: 'GET_HIGHLIGHTS' });
    return response?.highlights || [];
  } catch (err) {
    statusEl.textContent = 'Cannot access this page (try refreshing)';
    return null;
  }
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function render(highlights) {
  listEl.innerHTML = '';

  if (highlights === null) return;

  if (!highlights.length) {
    statusEl.textContent = '';
    listEl.innerHTML = '<div class="empty">No highlights on this page yet.<br>Select text to highlight.</div>';
    return;
  }

  statusEl.textContent = `${highlights.length} highlight${highlights.length === 1 ? '' : 's'} on this page`;

  const sorted = [...highlights].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const h of sorted) {
    const li = document.createElement('li');
    li.dataset.id = h.id;

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = COLORS[h.color] || COLORS.yellow;

    const body = document.createElement('div');
    body.style.flex = '1';

    const text = document.createElement('div');
    text.className = 'hl-text';
    text.textContent = h.text || '(empty)';

    const meta = document.createElement('div');
    meta.className = 'hl-meta';
    meta.textContent = h.createdAt ? formatTime(h.createdAt) : '';

    body.appendChild(text);
    body.appendChild(meta);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.title = 'Delete highlight';
    del.textContent = '×';
    del.addEventListener('click', async () => {
      try {
        await sendToTab({ type: 'DELETE_HIGHLIGHT', id: h.id });
        li.remove();
        const remaining = listEl.querySelectorAll('li').length;
        statusEl.textContent = remaining
          ? `${remaining} highlight${remaining === 1 ? '' : 's'} on this page`
          : '';
        if (!remaining) {
          listEl.innerHTML = '<div class="empty">No highlights on this page yet.<br>Select text to highlight.</div>';
        }
      } catch (_) {}
    });

    li.appendChild(swatch);
    li.appendChild(body);
    li.appendChild(del);
    listEl.appendChild(li);
  }
}

// Clear all
clearBtn.addEventListener('click', async () => {
  if (!confirm('Remove all highlights from this page?')) return;
  try {
    await sendToTab({ type: 'CLEAR_ALL' });
    render([]);
  } catch (_) {}
});

// Export current page highlights as JSON
exportBtn.addEventListener('click', async () => {
  try {
    const response = await sendToTab({ type: 'EXPORT_PAGE' });
    const data = response?.export;
    if (!data) {
      statusEl.textContent = 'Nothing to export';
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const safeTitle = (data.title || 'page').replace(/[^\w\-]+/g, '_').slice(0, 40);
    a.href = url;
    a.download = `highlights_${safeTitle}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = `Exported ${data.highlights.length} highlight(s)`;
  } catch (err) {
    statusEl.textContent = 'Export failed – try refreshing the page';
  }
});

// Import
importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    let highlights = [];
    if (Array.isArray(data)) {
      highlights = data;
    } else if (data && Array.isArray(data.highlights)) {
      highlights = data.highlights;
    } else {
      statusEl.textContent = 'Invalid JSON format';
      return;
    }

    const response = await sendToTab({
      type: 'IMPORT_HIGHLIGHTS',
      highlights
    });

    statusEl.textContent = `Imported – now ${response?.count ?? highlights.length} highlight(s)`;
    const list = await fetchHighlights();
    render(list);
  } catch (err) {
    statusEl.textContent = 'Import failed (invalid file or page not ready)';
  } finally {
    importFile.value = '';
  }
});

// Init
fetchHighlights().then(render);
