console.log('Background script loaded');

// Store blocked sites in chrome.storage
const BLOCKED_SITES_KEY = 'blockedSites';

// Check if a URL should be blocked
async function shouldBlockUrl(url) {
  try {
    // Don't block extension's own URLs
    if (url.startsWith('chrome-extension://')) {
      console.log('Skipping extension URL:', url);
      return false;
    }

    // Don't block chrome:// URLs
    if (url.startsWith('chrome://')) {
      console.log('Skipping chrome:// URL:', url);
      return false;
    }

    console.log('Checking URL:', url);
    const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
    const blockedSites = result[BLOCKED_SITES_KEY] || [];
    
    if (!blockedSites.length) {
      console.log('No blocked sites found');
      return false;
    }

    const hostname = new URL(url).hostname;
    console.log('Checking hostname:', hostname);

    // Find matching blocked site
    const blockedSite = blockedSites.find(site => 
      site.enabled && hostname.includes(site.domain)
    );

    if (!blockedSite) {
      console.log('No matching blocked site found');
      return false;
    }

    console.log('Found matching blocked site:', blockedSite);

    // If permanent block, always block
    if (!blockedSite.startTime || !blockedSite.endTime) {
      console.log('Permanent block - blocking site');
      return true;
    }

    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Parse blocking times
    const [startHour, startMinute] = blockedSite.startTime.split(':').map(Number);
    const [endHour, endMinute] = blockedSite.endTime.split(':').map(Number);
    
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    console.log('Current time:', currentTime, 'minutes');
    console.log('Block period:', startTime, 'to', endTime, 'minutes');

    // Handle overnight blocking (e.g., 22:00 to 08:00)
    if (endTime < startTime) {
      if (currentTime >= startTime || currentTime < endTime) {
        console.log('Overnight block - blocking site');
        return true;
      }
    } else {
      if (currentTime >= startTime && currentTime < endTime) {
        console.log('Time-based block - blocking site');
        return true;
      }
    }

    console.log('Outside blocking period - allowing site');
    return false;
  } catch (error) {
    console.error('Error checking URL:', error);
    return false;
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const shouldBlock = await shouldBlockUrl(tab.url);
      console.log('Should block:', shouldBlock);
      
      if (shouldBlock) {
        // Get the blocked site info
        const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
        const blockedSites = result[BLOCKED_SITES_KEY] || [];
        const hostname = new URL(tab.url).hostname;
        const blockedSite = blockedSites.find(site => 
          site.enabled && hostname.includes(site.domain)
        );
        
        // Construct redirect URL with block info
        const redirectUrl = chrome.runtime.getURL('blocked.html');
        const params = new URLSearchParams();
        params.set('permanent', (!blockedSite.startTime || !blockedSite.endTime).toString());
        if (blockedSite.endTime) {
          const [endHour, endMinute] = blockedSite.endTime.split(':').map(Number);
          const endDate = new Date();
          endDate.setHours(endHour, endMinute, 0, 0);
          if (endDate < new Date()) {
            endDate.setDate(endDate.getDate() + 1);
          }
          // Use getTime() to pass the timestamp in milliseconds
          params.set('endTime', endDate.getTime().toString());
        }
        
        // Redirect to blocked page
        await chrome.tabs.update(tabId, {
          url: `${redirectUrl}?${params.toString()}`
        });
      }
    } catch (error) {
      console.error('Error in tab update listener:', error);
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'openManagePage') {
    chrome.tabs.create({ url: 'manage.html' }, (tab) => {
      console.log('Opened manage page in tab:', tab.id);
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for the async response
  }
});

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed');
  const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
  if (!result[BLOCKED_SITES_KEY]) {
    console.log('Initializing empty blocked sites list');
    await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: [] });
  }
}); 