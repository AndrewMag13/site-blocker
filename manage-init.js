// Error handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
  const errorMessage = document.getElementById('error-message');
  const loadingMessage = document.getElementById('loading-message');
  errorMessage.style.display = 'block';
  loadingMessage.style.display = 'none';
  errorMessage.textContent = `Error: ${msg}`;
  console.error('Error:', msg, 'at', url, 'line', lineNo);
  return false;
};

// Check if chrome API is available
if (typeof chrome === 'undefined' || !chrome.storage) {
  const errorMessage = document.getElementById('error-message');
  const loadingMessage = document.getElementById('loading-message');
  errorMessage.style.display = 'block';
  loadingMessage.style.display = 'none';
  errorMessage.textContent = 'Error: Chrome API not available. Please make sure you are using this page within the extension.';
}

// Hide loading message when script is loaded
window.addEventListener('load', function() {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.style.display = 'none';
  }
}); 