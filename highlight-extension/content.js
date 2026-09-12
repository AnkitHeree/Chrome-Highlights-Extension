/**
 * Page Highlighter 
 */

const HIGHLIGHT_CLASS = 'ph-highlight';
const TOOLBAR_ID = 'ph-color-toolbar';
const STORAGE_KEY_PREFIX = 'ph:v1:';

const COLORS = {
  yellow: 'rgba(255, 235, 59, 0.55)',
  green:  'rgba(76, 175, 80, 0.45)',
  blue:   'rgba(33, 150, 243, 0.45)',
  pink:   'rgba(236, 64, 122, 0.45)',
  orange: 'rgba(255, 152, 0, 0.50)'
};

const SOLID_COLORS = {
  yellow: '#fff59d',
  green:  '#a5d6a7',
  blue:   '#90caf9',
  pink:   '#f48fb1',
  orange: '#ffcc80'
};

let isApplying = false;
let toolbarEl = null;
let savedRange = null;
let ignoreMouseUpUntil = 0;
let lastSelectionTime = 0;

// Page key

function pageKey() {
  try {
    const u = new URL(location.href);
    u.hash = '';
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    u.pathname = path;
    return STORAGE_KEY_PREFIX + u.origin + u.pathname + u.search;
  } catch (_) {
    return STORAGE_KEY_PREFIX + location.href.split('#')[0];
  }
}

//Offset

function getTextNodes(root = document.body) {
  const nodes = [];
  if (!root) return nodes;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

function getAbsoluteOffset(container, offset) {
  try {
    const range = document.createRange();
    range.selectNodeContents(document.body);
    range.setEnd(container, offset);
    return range.toString().length;
  } catch (_) {
    return null;
  }
}

function rangeToOffsets(range) {
  try {
    const start = getAbsoluteOffset(range.startContainer, range.startOffset);
    const end   = getAbsoluteOffset(range.endContainer, range.endOffset);
    if (start == null || end == null || start === end) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  } catch (_) {
    return null;
  }
}

function offsetsToRange(start, end) {
  const nodes = getTextNodes();
  let current = 0;
  let startNode = null, startOff = 0;
  let endNode = null, endOff = 0;

  for (const node of nodes) {
    const len = node.nodeValue ? node.nodeValue.length : 0;
    const next = current + len;

    if (startNode === null && start >= current && start <= next) {
      startNode = node;
      startOff = start - current;
    }
    if (end >= current && end <= next) {
      endNode = node;
      endOff = end - current;
      break;
    }
    current = next;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.min(startOff, startNode.length));
    range.setEnd(endNode, Math.min(endOff, endNode.length));
    return range;
  } catch (_) {
    return null;
  }
}

// wrap and unwrap

function createHighlightSpan(id, color, bg, text) {
  const span = document.createElement('span');
  span.className = HIGHLIGHT_CLASS;
  span.dataset.highlightId = id;
  span.dataset.color = color;
  span.style.backgroundColor = bg;
  span.style.boxShadow = 'inset 0 -2px 0 rgba(0,0,0,0.18)';
  span.textContent = text;
  return span;
}

function wrapRange(range, color, id) {
  if (!range || range.collapsed) return [];

  const spans = [];
  const bg = COLORS[color] || COLORS.yellow;

  // Single text node (most common – fast path)
  if (range.startContainer === range.endContainer &&
      range.startContainer.nodeType === Node.TEXT_NODE) {

    const textNode = range.startContainer;
    const parent = textNode.parentNode;
    if (!parent || parent.classList?.contains(HIGHLIGHT_CLASS)) return [];

    const start = range.startOffset;
    const end   = range.endOffset;
    if (start >= end) return [];

    const fullText = textNode.nodeValue;
    const before = fullText.slice(0, start);
    const middle = fullText.slice(start, end);
    const after  = fullText.slice(end);

    const span = createHighlightSpan(id, color, bg, middle);
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after)  frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, textNode);
    spans.push(span);
    return spans;
  }

  // Multi-node selection
  const common = range.commonAncestorContainer;
  const root = common.nodeType === Node.TEXT_NODE ? common.parentNode : common;
  if (!root) return [];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest?.(`.${HIGHLIGHT_CLASS}`)) return NodeFilter.FILTER_REJECT;
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch (_) {
        return NodeFilter.FILTER_REJECT;
      }
    }
  });

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  for (const textNode of textNodes) {
    if (!textNode.parentNode) continue;
    if (textNode.parentElement?.classList?.contains(HIGHLIGHT_CLASS)) continue;

    let start = 0;
    let end = textNode.length;
    if (textNode === range.startContainer) start = range.startOffset;
    if (textNode === range.endContainer)   end   = range.endOffset;
    if (start >= end) continue;

    const fullText = textNode.nodeValue;
    const before = fullText.slice(0, start);
    const middle = fullText.slice(start, end);
    const after  = fullText.slice(end);
    if (!middle) continue;

    const span = createHighlightSpan(id, color, bg, middle);
    const parent = textNode.parentNode;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after)  frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, textNode);
    spans.push(span);
  }
  return spans;
}

function unwrapById(id) {
  document.querySelectorAll(`span.${HIGHLIGHT_CLASS}[data-highlight-id="${id}"]`).forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

function unwrapAll() {
  [...document.querySelectorAll(`span.${HIGHLIGHT_CLASS}`)].forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

// storage

function loadHighlights() {
  return new Promise(resolve => {
    const key = pageKey();
    chrome.storage.local.get([key], res => {
      resolve(Array.isArray(res[key]) ? res[key] : []);
    });
  });
}

function saveHighlights(list) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [pageKey()]: list }, resolve);
  });
}

async function addHighlight(data) {
  const list = await loadHighlights();
  list.push(data);
  await saveHighlights(list);
}

async function removeHighlight(id) {
  const list = await loadHighlights();
  await saveHighlights(list.filter(h => h.id !== id));
}

// toolbar

function ensureToolbar() {
  if (toolbarEl) return toolbarEl;

  toolbarEl = document.createElement('div');
  toolbarEl.id = TOOLBAR_ID;
  toolbarEl.innerHTML = `
    <div class="ph-toolbar-colors">
      ${Object.entries(SOLID_COLORS).map(([name, hex]) =>
        `<button type="button" class="ph-color-btn" data-color="${name}" style="background:${hex}" title="${name}"></button>`
      ).join('')}
    </div>
    <button type="button" class="ph-toolbar-close" title="Cancel">×</button>
  `;
  document.documentElement.appendChild(toolbarEl);

  toolbarEl.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
  });

  toolbarEl.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.target.closest('.ph-color-btn');
    if (btn) {
      doHighlight(btn.dataset.color);
      hideToolbar();
    }
    if (e.target.classList.contains('ph-toolbar-close')) hideToolbar();
  });

  return toolbarEl;
}

function showToolbar(clientX, clientY) {
  const tb = ensureToolbar();
  tb.style.display = 'flex';
  requestAnimationFrame(() => {
    const rect = tb.getBoundingClientRect();
    let left = clientX - rect.width / 2;
    let top  = clientY - rect.height - 14;
    if (top < 8) top = clientY + 18;
    if (left < 8) left = 8;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    tb.style.left = (left + window.scrollX) + 'px';
    tb.style.top  = (top  + window.scrollY) + 'px';
  });
}

function hideToolbar() {
  if (toolbarEl) toolbarEl.style.display = 'none';
  savedRange = null;
}

//hilights

function doHighlight(color) {
  if (!savedRange) return;

  const range = savedRange;
  const offsets = rangeToOffsets(range);
  if (!offsets || offsets.start === offsets.end) {
    hideToolbar();
    return;
  }

  const text = range.toString().trim();
  if (!text) {
    hideToolbar();
    return;
  }

  const id = 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

  isApplying = true;
  wrapRange(range, color, id);
  isApplying = false;

  addHighlight({
    id,
    start: offsets.start,
    end: offsets.end,
    color,
    text: text.slice(0, 240),
    createdAt: Date.now(),
    url: location.href
  });

  // Clear selection cleanly so user can select next word immediately
  const sel = window.getSelection();
  if (sel) sel.removeAllRanges();

  ignoreMouseUpUntil = Date.now() + 300;
  savedRange = null;
}

// flickering solve done

function onMouseUp(e) {
  // Ignore toolbar clicks
  if (toolbarEl && toolbarEl.contains(e.target)) return;
  // Ignore right after we highlighted
  if (Date.now() < ignoreMouseUpUntil) return;

  // Use a short delay only to let the browser finish the selection
  setTimeout(() => {
    if (Date.now() < ignoreMouseUpUntil) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      // Click without selection → hide toolbar (unless clicked on highlight)
      if (!e.target.closest?.('.' + HIGHLIGHT_CLASS)) hideToolbar();
      return;
    }

    const range = sel.getRangeAt(0);
    const text = range.toString();
    if (!text || !text.trim()) {
      hideToolbar();
      return;
    }

    // Save range and show toolbar
    savedRange = range.cloneRange();
    lastSelectionTime = Date.now();

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideToolbar();
      return;
    }
    showToolbar(rect.left + rect.width / 2, rect.top);
  }, 10);
}

// Alt + Click = remove highlight

function onClick(e) {
  
  if (!e.altKey) return;
  const span = e.target.closest('.' + HIGHLIGHT_CLASS);
  if (!span) return;

  e.preventDefault();
  e.stopPropagation();

  const id = span.dataset.highlightId;
  if (!id) return;

  isApplying = true;
  unwrapById(id);
  isApplying = false;
  removeHighlight(id);
  hideToolbar();
}

// restoire

async function restoreHighlights() {
  const list = await loadHighlights();
  if (!list.length) return 0;

  isApplying = true;
  unwrapAll();

  const sorted = [...list].sort((a, b) => a.start - b.start);
  let applied = 0;

  for (const h of sorted) {
    try {
      const range = offsetsToRange(h.start, h.end);
      if (range && !range.collapsed) {
        const spans = wrapRange(range, h.color || 'yellow', h.id);
        if (spans.length) applied++;
      }
    } catch (err) {}
  }

  isApplying = false;
  return applied;
}

async function restoreWithRetry() {
  const delays = [50, 400, 1200];
  for (const delay of delays) {
    await new Promise(r => setTimeout(r, delay));
    if (!document.body) continue;
    const applied = await restoreHighlights();
    const list = await loadHighlights();
    if (!list.length || applied > 0) break;
  }
}

// messages

function highlightSelection(color = 'yellow') {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  savedRange = sel.getRangeAt(0).cloneRange();
  doHighlight(color);
  return true;
}

function removeHighlightsInSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const ids = new Set();
  document.querySelectorAll('span.' + HIGHLIGHT_CLASS).forEach(span => {
    try {
      if (range.intersectsNode(span)) ids.add(span.dataset.highlightId);
    } catch (_) {}
  });
  ids.forEach(id => {
    unwrapById(id);
    removeHighlight(id);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_HIGHLIGHTS') {
    loadHighlights().then(list => sendResponse({ highlights: list }));
    return true;
  }
  if (msg.type === 'DELETE_HIGHLIGHT') {
    isApplying = true;
    unwrapById(msg.id);
    isApplying = false;
    removeHighlight(msg.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'CLEAR_ALL') {
    loadHighlights().then(list => {
      isApplying = true;
      list.forEach(h => unwrapById(h.id));
      isApplying = false;
      return saveHighlights([]);
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'HIGHLIGHT_SELECTION') {
    sendResponse({ ok: highlightSelection(msg.color || 'yellow') });
    return false;
  }
  if (msg.type === 'REMOVE_HIGHLIGHTS_IN_SELECTION') {
    removeHighlightsInSelection();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === 'EXPORT_PAGE') {
    loadHighlights().then(list => {
      sendResponse({
        export: {
          version: 1,
          exportedAt: new Date().toISOString(),
          url: location.href,
          title: document.title,
          highlights: list
        }
      });
    });
    return true;
  }
  if (msg.type === 'IMPORT_HIGHLIGHTS') {
    const incoming = Array.isArray(msg.highlights) ? msg.highlights : [];
    loadHighlights().then(async existing => {
      const map = new Map(existing.map(h => [h.id, h]));
      for (const h of incoming) {
        if (h?.id && h.start != null && h.end != null) {
          map.set(h.id, {
            id: h.id,
            start: h.start,
            end: h.end,
            color: h.color || 'yellow',
            text: h.text || '',
            createdAt: h.createdAt || Date.now(),
            url: location.href
          });
        }
      }
      const merged = [...map.values()];
      await saveHighlights(merged);
      await restoreHighlights();
      sendResponse({ ok: true, count: merged.length });
    });
    return true;
  }
});

// init

function init() {
  restoreWithRetry();

  // Use bubble phase (false) – less interference with page selection
  document.addEventListener('mouseup', onMouseUp, false);
  document.addEventListener('click', onClick, true);

  window.addEventListener('scroll', hideToolbar, { passive: true });
  window.addEventListener('resize', hideToolbar);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideToolbar();
  });

  window.addEventListener('pageshow', () => restoreWithRetry());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
