/**
 * Page Highlighter 
 */

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'];

chrome.runtime.onInstalled.addListener(() => {
  // Parent
  chrome.contextMenus.create({
    id: 'ph-parent',
    title: 'Highlight selection',
    contexts: ['selection']
  });

  COLORS.forEach(color => {
    chrome.contextMenus.create({
      id: `ph-color-${color}`,
      parentId: 'ph-parent',
      title: color.charAt(0).toUpperCase() + color.slice(1),
      contexts: ['selection']
    });
  });

  chrome.contextMenus.create({
    id: 'ph-quick-yellow',
    title: 'Highlight (Yellow)',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  let color = 'yellow';
  if (info.menuItemId.startsWith('ph-color-')) {
    color = info.menuItemId.replace('ph-color-', '');
  } else if (info.menuItemId === 'ph-quick-yellow') {
    color = 'yellow';
  } else {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHLIGHT_SELECTION',
      color
    });
  } catch (err) {
    console.warn('[Page Highlighter] context menu message failed', err);
  }
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    if (command === 'highlight-yellow') {
      await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_SELECTION', color: 'yellow' });
    } else if (command === 'highlight-green') {
      await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_SELECTION', color: 'green' });
    } else if (command === 'highlight-blue') {
      await chrome.tabs.sendMessage(tab.id, { type: 'HIGHLIGHT_SELECTION', color: 'blue' });
    } else if (command === 'remove-highlights') {
      await chrome.tabs.sendMessage(tab.id, { type: 'REMOVE_HIGHLIGHTS_IN_SELECTION' });
    }
  } catch (err) {
    console.warn('[Page Highlighter] command failed', command, err);
  }
});

// Optional ping
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ pong: true });
  }
});
