// Store blocked sites in chrome.storage
const BLOCKED_SITES_KEY = 'blockedSites';

// Initialize storage if empty
chrome.storage.local.get(BLOCKED_SITES_KEY, (result) => {
  if (!result[BLOCKED_SITES_KEY]) {
    chrome.storage.local.set({ [BLOCKED_SITES_KEY]: [] });
  }
});

// Handle form submission
document.getElementById('blockerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const domain = document.getElementById('domain').value.trim();
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  
  // Validate domain format
  if (!isValidDomain(domain)) {
    alert('Please enter a valid domain (e.g., example.com)');
    return;
  }
  
  // Validate time
  if (startTime >= endTime) {
    alert('End time must be after start time');
    return;
  }
  
  // Add to blocked sites
  chrome.storage.local.get(BLOCKED_SITES_KEY, (result) => {
    const blockedSites = result[BLOCKED_SITES_KEY] || [];
    blockedSites.push({
      domain,
      startTime,
      endTime,
      enabled: true
    });
    
    chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites }, () => {
      alert(`Site ${domain} will be blocked from ${startTime} to ${endTime}`);
      document.getElementById('blockerForm').reset();
    });
  });
});

// Helper function to validate domain
function isValidDomain(domain) {
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// Function to open management page
function openManagePage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('manage.html') });
}

// Check if current time is within blocking period
function isWithinBlockingPeriod(startTime, endTime) {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;
  
  return currentTime >= startTimeInMinutes && currentTime <= endTimeInMinutes;
}

// Listen for tab updates to check if site should be blocked
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const url = new URL(tab.url);
      const currentDomain = url.hostname;
      
      chrome.storage.local.get(BLOCKED_SITES_KEY, (result) => {
        const blockedSites = result[BLOCKED_SITES_KEY] || [];
        
        const shouldBlock = blockedSites.some(site => {
          if (!site.enabled) return false;
          
          const isDomainMatch = currentDomain.includes(site.domain);
          const isTimeMatch = isWithinBlockingPeriod(site.startTime, site.endTime);
          
          return isDomainMatch && isTimeMatch;
        });
        
        if (shouldBlock) {
          chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
        }
      });
    } catch (error) {
      console.error('Error processing URL:', error);
    }
  }
}); 