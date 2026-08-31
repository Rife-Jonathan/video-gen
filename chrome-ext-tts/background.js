// Service worker: owns downloads and opens the side panel.

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'save') return false;

  // The content script hands over a data: URL, which works whether the page's audio
  // src was a blob:, an https: URL, or already a data: URL — so the download path
  // does not care how AI Studio happens to deliver the take.
  chrome.downloads.download(
    { url: msg.dataUrl, filename: msg.filename, saveAs: false, conflictAction: 'uniquify' },
    (id) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ ok: true, downloadId: id });
      }
    },
  );
  return true; // async
});
