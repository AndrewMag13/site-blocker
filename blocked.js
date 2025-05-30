document.addEventListener('DOMContentLoaded', () => {
  const blockMessage = document.getElementById('blockMessage');
  const timeInfo = document.getElementById('timeInfo');
  const endTimeElement = document.getElementById('endTime');
  const countdownElement = document.getElementById('countdown');
  const closeButton = document.getElementById('closeButton');
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isPermanent = urlParams.get('permanent') === 'true';
  const endTime = urlParams.get('endTime');
  
  // Update block message
  if (isPermanent) {
    blockMessage.textContent = 'This site is permanently blocked.';
    timeInfo.style.display = 'none';
  } else if (endTime) {
    const endDate = new Date(parseInt(endTime));
    const options = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    };
    endTimeElement.textContent = endDate.toLocaleTimeString(undefined, options);
    
    // Update countdown
    function updateCountdown() {
      const now = new Date();
      const timeLeft = endDate - now;
      
      if (timeLeft <= 0) {
        countdownElement.textContent = 'Blocking has ended';
        return;
      }
      
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      
      countdownElement.textContent = `${hours}h ${minutes}m ${seconds}s`;
    }
    
    // Update countdown immediately and then every second
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
  
  // Handle close button
  closeButton.addEventListener('click', () => {
    chrome.tabs.getCurrent(tab => {
      if (tab) {
        chrome.tabs.remove(tab.id);
      }
    });
  });
}); 