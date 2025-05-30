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

// Export blocked sites
async function exportSites() {
  try {
    const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
    const blockedSites = result[BLOCKED_SITES_KEY] || [];
    
    if (blockedSites.length === 0) {
      showNotification('No sites to export', true);
      return;
    }
    
    const dataStr = JSON.stringify(blockedSites, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'blocked-sites.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Sites exported successfully');
  } catch (error) {
    console.error('Error exporting sites:', error);
    showNotification('Error exporting sites', true);
  }
}

// Import blocked sites
async function importSites() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedSites = JSON.parse(event.target.result);
          
          if (!Array.isArray(importedSites)) {
            throw new Error('Invalid file format');
          }
          
          // Validate each site object
          for (const site of importedSites) {
            if (!site.domain || typeof site.domain !== 'string') {
              throw new Error('Invalid site data: missing or invalid domain');
            }
          }
          
          const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
          const existingSites = result[BLOCKED_SITES_KEY] || [];
          
          // Merge imported sites with existing ones, avoiding duplicates
          const mergedSites = [...existingSites];
          for (const importedSite of importedSites) {
            const existingIndex = mergedSites.findIndex(s => s.domain === importedSite.domain);
            if (existingIndex === -1) {
              // Add new site with all its properties
              mergedSites.push({
                domain: importedSite.domain,
                startTime: importedSite.startTime || '',
                endTime: importedSite.endTime || '',
                enabled: importedSite.enabled !== undefined ? importedSite.enabled : true
              });
            } else {
              // Update existing site with imported settings
              mergedSites[existingIndex] = {
                ...mergedSites[existingIndex],
                startTime: importedSite.startTime || mergedSites[existingIndex].startTime,
                endTime: importedSite.endTime || mergedSites[existingIndex].endTime,
                enabled: importedSite.enabled !== undefined ? importedSite.enabled : mergedSites[existingIndex].enabled
              };
            }
          }
          
          await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: mergedSites });
          showNotification('Sites imported successfully');
          loadBlockedSites();
        } catch (error) {
          console.error('Error parsing imported file:', error);
          showNotification('Error importing sites: Invalid file format', true);
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing sites:', error);
      showNotification('Error importing sites', true);
    }
  };
  
  input.click();
}

// Load blocked sites
async function loadBlockedSites() {
  const loadingMessage = document.getElementById('loadingMessage');
  const errorMessage = document.getElementById('errorMessage');
  const emptyState = document.getElementById('emptyState');
  const blockedSitesList = document.getElementById('blockedSitesList');
  
  if (!loadingMessage || !errorMessage || !emptyState || !blockedSitesList) {
    console.error('Required elements not found');
    return;
  }
  
  try {
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    emptyState.style.display = 'none';
    blockedSitesList.style.display = 'none';
    
    const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
    const blockedSites = result[BLOCKED_SITES_KEY] || [];
    
    loadingMessage.style.display = 'none';
    
    if (blockedSites.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    
    blockedSitesList.innerHTML = '';
    blockedSitesList.style.display = 'block';
    
    blockedSites.forEach(site => {
      const li = document.createElement('li');
      li.className = 'site-item';
      
      const timeText = site.startTime && site.endTime 
        ? `Blocked from ${site.startTime} to ${site.endTime}`
        : 'Permanently blocked';
      
      li.innerHTML = `
        <div class="site-info">
          <div class="site-domain">${site.domain}</div>
          <div class="site-time">${timeText}</div>
        </div>
        <div class="site-actions">
          <button class="toggle-btn ${site.enabled ? 'secondary' : ''}" data-domain="${site.domain}">
            ${site.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="edit-btn secondary" data-domain="${site.domain}">Edit</button>
          <button class="delete-btn danger" data-domain="${site.domain}">Delete</button>
        </div>
      `;
      
      blockedSitesList.appendChild(li);
    });
    
    // Add event listeners
    addEventListeners();
  } catch (error) {
    console.error('Error loading blocked sites:', error);
    loadingMessage.style.display = 'none';
    errorMessage.style.display = 'block';
  }
}

function createEditDialog(site) {
  const dialog = document.createElement('div');
  dialog.className = 'edit-dialog';
  
  dialog.innerHTML = `
    <div class="edit-dialog-content">
      <h2>Edit Block Settings</h2>
      <div class="form-group">
        <label>Domain:</label>
        <input type="text" value="${site.domain}" readonly>
      </div>
      
      <div class="form-group">
        <label>Block Type:</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="blockType" value="permanent" ${!site.startTime ? 'checked' : ''}>
            Permanent Block
          </label>
          <label>
            <input type="radio" name="blockType" value="time" ${site.startTime ? 'checked' : ''}>
            Time-based Block
          </label>
        </div>
      </div>
      
      <div id="timeSettings" class="form-group" style="display: ${site.startTime ? 'block' : 'none'}">
        <label for="timePreset">Time Preset:</label>
        <select id="timePreset" class="time-preset">
          ${TIME_PRESETS.map((preset, index) => `
            <option value="${index}" ${preset.startTime === site.startTime && preset.endTime === site.endTime ? 'selected' : ''}>
              ${preset.name}
            </option>
          `).join('')}
        </select>
        
        <div id="customTimeSettings" class="time-inputs" style="display: ${TIME_PRESETS.some(p => p.startTime === site.startTime && p.endTime === site.endTime) ? 'none' : 'flex'}">
          <div class="time-input-group">
            <label>Start Time:</label>
            <div class="time-selectors">
              <select id="startHour">
                ${Array.from({length: 24}, (_, i) => `
                  <option value="${i.toString().padStart(2, '0')}" ${site.startTime?.split(':')[0] === i.toString().padStart(2, '0') ? 'selected' : ''}>
                    ${i.toString().padStart(2, '0')}
                  </option>
                `).join('')}
              </select>
              :
              <select id="startMinute">
                ${Array.from({length: 12}, (_, i) => `
                  <option value="${(i * 5).toString().padStart(2, '0')}" ${site.startTime?.split(':')[1] === (i * 5).toString().padStart(2, '0') ? 'selected' : ''}>
                    ${(i * 5).toString().padStart(2, '0')}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <div class="time-input-group">
            <label>End Time:</label>
            <div class="time-selectors">
              <select id="endHour">
                ${Array.from({length: 24}, (_, i) => `
                  <option value="${i.toString().padStart(2, '0')}" ${site.endTime?.split(':')[0] === i.toString().padStart(2, '0') ? 'selected' : ''}>
                    ${i.toString().padStart(2, '0')}
                  </option>
                `).join('')}
              </select>
              :
              <select id="endMinute">
                ${Array.from({length: 12}, (_, i) => `
                  <option value="${(i * 5).toString().padStart(2, '0')}" ${site.endTime?.split(':')[1] === (i * 5).toString().padStart(2, '0') ? 'selected' : ''}>
                    ${(i * 5).toString().padStart(2, '0')}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-buttons">
        <button class="cancel-btn secondary">Cancel</button>
        <button class="save-btn">Save Changes</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Add event listeners
  const blockTypeRadios = dialog.querySelectorAll('input[name="blockType"]');
  const timeSettings = dialog.querySelector('#timeSettings');
  const timePreset = dialog.querySelector('#timePreset');
  const customTimeSettings = dialog.querySelector('#customTimeSettings');
  const cancelBtn = dialog.querySelector('.cancel-btn');
  const saveBtn = dialog.querySelector('.save-btn');
  
  blockTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      timeSettings.style.display = radio.value === 'time' ? 'block' : 'none';
    });
  });
  
  timePreset.addEventListener('change', () => {
    const preset = TIME_PRESETS[timePreset.value];
    if (preset.name === 'Custom') {
      customTimeSettings.style.display = 'flex';
    } else {
      customTimeSettings.style.display = 'none';
      const [startHour, startMinute] = preset.startTime.split(':');
      const [endHour, endMinute] = preset.endTime.split(':');
      dialog.querySelector('#startHour').value = startHour;
      dialog.querySelector('#startMinute').value = startMinute;
      dialog.querySelector('#endHour').value = endHour;
      dialog.querySelector('#endMinute').value = endMinute;
    }
  });
  
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  
  saveBtn.addEventListener('click', async () => {
    const isPermanent = dialog.querySelector('input[name="blockType"]:checked').value === 'permanent';
    let startTime = '', endTime = '';
    
    if (!isPermanent) {
      const preset = TIME_PRESETS[timePreset.value];
      if (preset.name === 'Custom') {
        startTime = `${dialog.querySelector('#startHour').value}:${dialog.querySelector('#startMinute').value}`;
        endTime = `${dialog.querySelector('#endHour').value}:${dialog.querySelector('#endMinute').value}`;
      } else {
        startTime = preset.startTime;
        endTime = preset.endTime;
      }
    }
    
    try {
      const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
      const blockedSites = result[BLOCKED_SITES_KEY] || [];
      const siteIndex = blockedSites.findIndex(s => s.domain === site.domain);
      
      if (siteIndex !== -1) {
        blockedSites[siteIndex] = {
          ...blockedSites[siteIndex],
          startTime,
          endTime
        };
        
        await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
        showNotification(`${site.domain} has been updated`);
        loadBlockedSites();
      }
    } catch (error) {
      console.error('Error updating site:', error);
      showNotification('Error updating site', true);
    }
    
    document.body.removeChild(dialog);
  });
}

// Add event listeners to site items
function addEventListeners() {
  // Toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const domain = button.dataset.domain;
      try {
        const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
        const blockedSites = result[BLOCKED_SITES_KEY] || [];
        const siteIndex = blockedSites.findIndex(s => s.domain === domain);
        
        if (siteIndex !== -1) {
          blockedSites[siteIndex].enabled = !blockedSites[siteIndex].enabled;
          await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: blockedSites });
          showNotification(`${domain} has been ${blockedSites[siteIndex].enabled ? 'enabled' : 'disabled'}`);
          loadBlockedSites();
        }
      } catch (error) {
        console.error('Error toggling site:', error);
        showNotification('Error toggling site', true);
      }
    });
  });
  
  // Edit buttons
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const domain = button.dataset.domain;
      try {
        const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
        const blockedSites = result[BLOCKED_SITES_KEY] || [];
        const site = blockedSites.find(s => s.domain === domain);
        
        if (site) {
          createEditDialog(site);
        }
      } catch (error) {
        console.error('Error loading site for edit:', error);
        showNotification('Error loading site for edit', true);
      }
    });
  });
  
  // Delete buttons
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const domain = button.dataset.domain;
      if (confirm(`Are you sure you want to remove ${domain} from the block list?`)) {
        try {
          const result = await chrome.storage.local.get(BLOCKED_SITES_KEY);
          const blockedSites = result[BLOCKED_SITES_KEY] || [];
          const updatedSites = blockedSites.filter(s => s.domain !== domain);
          
          await chrome.storage.local.set({ [BLOCKED_SITES_KEY]: updatedSites });
          showNotification(`${domain} has been removed`);
          loadBlockedSites();
        } catch (error) {
          console.error('Error deleting site:', error);
          showNotification('Error deleting site', true);
        }
      }
    });
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadBlockedSites();
  
  // Add event listeners for import/export buttons
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  if (importBtn) importBtn.addEventListener('click', importSites);
  if (exportBtn) exportBtn.addEventListener('click', exportSites);
  if (refreshBtn) refreshBtn.addEventListener('click', loadBlockedSites);
});