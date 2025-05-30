// Store blocked sites in chrome.storage
const BLOCKED_SITES_KEY = 'blockedSites';

// Common time presets
const TIME_PRESETS = [
  { name: 'Work Hours (9:00 - 18:00)', startTime: '09:00', endTime: '18:00' },
  { name: 'Morning (8:00 - 12:00)', startTime: '08:00', endTime: '12:00' },
  { name: 'Afternoon (12:00 - 17:00)', startTime: '12:00', endTime: '17:00' },
  { name: 'Evening (17:00 - 22:00)', startTime: '17:00', endTime: '22:00' },
  { name: 'Night (22:00 - 8:00)', startTime: '22:00', endTime: '08:00' },
  { name: 'Custom', startTime: '', endTime: '' }
];

// Show notification
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  if (!notification) {
    console.error('Notification element not found');
    return;
  }
  
  notification.textContent = message;
  notification.style.backgroundColor = isError ? '#e74c3c' : '#4CAF50';
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Initialize time selectors
function initializeTimeSelectors() {
  const startHour = document.getElementById('startHour');
  const startMinute = document.getElementById('startMinute');
  const endHour = document.getElementById('endHour');
  const endMinute = document.getElementById('endMinute');
  
  // Add hours (00-23)
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    startHour.add(new Option(hour, hour));
    endHour.add(new Option(hour, hour));
  }
  
  // Add minutes (00-55, 5-minute intervals)
  for (let i = 0; i < 12; i++) {
    const minute = (i * 5).toString().padStart(2, '0');
    startMinute.add(new Option(minute, minute));
    endMinute.add(new Option(minute, minute));
  }
  
  // Set default times
  startHour.value = '09';
  startMinute.value = '00';
  endHour.value = '18';
  endMinute.value = '00';
}

// Handle time preset changes
function handleTimePresetChange() {
  const timePreset = document.getElementById('timePreset');
  const timeSection = document.getElementById('timeSection');
  const startHour = document.getElementById('startHour');
  const startMinute = document.getElementById('startMinute');
  const endHour = document.getElementById('endHour');
  const endMinute = document.getElementById('endMinute');
  
  timePreset.addEventListener('change', () => {
    const preset = TIME_PRESETS.find(p => p.name === timePreset.value);
    if (preset) {
      const [startHourStr, startMinuteStr] = preset.startTime.split(':');
      const [endHourStr, endMinuteStr] = preset.endTime.split(':');
      
      startHour.value = startHourStr;
      startMinute.value = startMinuteStr;
      endHour.value = endHourStr;
      endMinute.value = endMinuteStr;
    }
  });
}

// Handle permanent block checkbox
function handlePermanentBlock() {
  const permanentBlock = document.getElementById('permanentBlock');
  const timeSection = document.getElementById('timeSection');
  
  permanentBlock.addEventListener('change', () => {
    timeSection.style.display = permanentBlock.checked ? 'none' : 'block';
  });
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();
  
  const domain = document.getElementById('domain').value.trim().toLowerCase();
  const permanentBlock = document.getElementById('permanentBlock').checked;
  const timePreset = document.getElementById('timePreset').value;
  
  if (!domain) {
    showNotification('Please enter a domain', true);
    return;
  }
  
  try {
    const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
    const blockedSites = result[BLOCKED_SITES_KEY] || [];
    
    // Check if site is already blocked
    if (blockedSites.some(site => site.domain === domain)) {
      showNotification(`${domain} is already blocked`, true);
      return;
    }
    
    let startTime = '', endTime = '';
    
    if (!permanentBlock) {
      const preset = TIME_PRESETS.find(p => p.name === timePreset);
      if (preset) {
        startTime = preset.startTime;
        endTime = preset.endTime;
      } else {
        startTime = `${document.getElementById('startHour').value}:${document.getElementById('startMinute').value}`;
        endTime = `${document.getElementById('endHour').value}:${document.getElementById('endMinute').value}`;
      }
    }
    
    // Add new blocked site
    blockedSites.push({
      domain,
      enabled: true,
      startTime,
      endTime
    });
    
    await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
    showNotification(`${domain} has been blocked`);
    
    // Reset form
    document.getElementById('domain').value = '';
    document.getElementById('permanentBlock').checked = false;
    document.getElementById('timeSection').style.display = 'block';
  } catch (error) {
    console.error('Error blocking site:', error);
    showNotification('Error blocking site', true);
  }
}

// Handle current site button
async function handleCurrentSiteButton() {
  const blockCurrentBtn = document.getElementById('blockCurrentBtn');
  const domainInput = document.getElementById('domain');
  
  blockCurrentBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        showNotification('No active tab found', true);
        return;
      }
      
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      // Don't allow blocking extension's own URLs
      if (domain.startsWith('chrome-extension://')) {
        showNotification('Cannot block extension pages', true);
        return;
      }
      
      // Don't allow blocking chrome:// URLs
      if (domain.startsWith('chrome://')) {
        showNotification('Cannot block chrome:// pages', true);
        return;
      }
      
      domainInput.value = domain;
    } catch (error) {
      console.error('Error getting current tab:', error);
      showNotification('Error getting current tab', true);
    }
  });
}

// Handle manage button
function handleManageButton() {
  const manageBtn = document.getElementById('manageBtn');
  
  manageBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openManagePage' });
  });
}

// Initialize popup
function initializePopup() {
  // Initialize time selectors
  initializeTimeSelectors();
  
  // Add event listeners
  handleTimePresetChange();
  handlePermanentBlock();
  handleCurrentSiteButton();
  handleManageButton();
  
  // Handle form submission
  const form = document.getElementById('blockForm');
  form.addEventListener('submit', handleFormSubmit);
}

// Start initialization when the popup is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
} 