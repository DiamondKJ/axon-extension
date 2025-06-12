// options.js - FINAL "Optimistic Save" Version

document.addEventListener('DOMContentLoaded', () => {
    const googleKeyInput = document.getElementById('googleApiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Load the saved key when the page opens
    chrome.storage.local.get(['axonGoogleApiKey'], (items) => {
        if (chrome.runtime.lastError) {
            console.error("Error loading key:", chrome.runtime.lastError.message);
            return;
        }
        if (items.axonGoogleApiKey) {
            googleKeyInput.value = items.axonGoogleApiKey;
        }
    });

    // --- SAVE BUTTON LOGIC (INSTANT) ---
    // This function's only job is to save the key to storage. No API calls.
    saveButton.addEventListener('click', () => {
        const googleKey = googleKeyInput.value.trim();
        
        // Disable button briefly to provide feedback
        saveButton.disabled = true;

        chrome.storage.local.set({
            axonGoogleApiKey: googleKey
        }, () => {
            if (chrome.runtime.lastError) {
                statusDiv.textContent = 'Error: Could not save settings.';
                statusDiv.style.color = 'red';
            } else {
                statusDiv.textContent = 'Settings Saved!';
                statusDiv.style.color = 'green';
            }

            // Re-enable button and clear message
            saveButton.disabled = false;
            setTimeout(() => { statusDiv.textContent = ''; }, 2500);
        });
    });
});
