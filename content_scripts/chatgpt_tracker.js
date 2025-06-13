// ==========================================================
//  chatgpt_tracker.js - V1.9 FINAL, COMPLETE
//  Implements the robust two-level observer and includes
//  all previously working functions.
// ==========================================================

console.log("Axon AI C: Content script started execution.");

// --- Globals ---
let totalTokens = 0;
let CONTEXT_LIMIT = 128000;
let uiCircleContainer, percentageTextElement, hoverMenuElement, fullDetailTextElement;
let summarizeButton;
let uiVisibilityInterval, hideMenuTimer;
let currentPlatform = null;
let SELECTORS = null;
let progressInterval = null;
let messageObserver = null; // Holds the observer that watches for new messages

// Debounce helper function
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Debounced version of processAllMessages
const debouncedProcessAllMessages = debounce(processAllMessages, 300); // 300ms debounce

// Helper to report errors to the background script
function reportContentScriptError(error, context = "unknown") {
    console.error(`Axon AI C: Error in ${context}:`, error);
    chrome.runtime.sendMessage({ 
        action: "reportError", 
        errorDetails: {
            context: `content_script:${context}`,
            message: error.message,
            stack: error.stack
        }
    }).catch(e => console.error("Axon AI C: Failed to send error report to background:", e));
}

// --- Platform Configuration ---
const MODEL_INFO = {
    "ChatGPT": { "Default": { limit: 128000 } },
    "Gemini": { "Default": { limit: 1000000 } },
    "Claude": { "Default": { limit: 200000 } }
};
const PLATFORM_SELECTORS = {
    ChatGPT: { mainContainer: '#main', userMessages: 'div[data-message-author-role="user"]', assistantMessages: 'div[data-message-author-role="assistant"]' },
    Gemini: { mainContainer: '#chat-history', userMessages: 'div.query-content', assistantMessages: 'message-content.model-response-text' },
    Claude: { mainContainer: 'div.flex-1.overflow-y-scroll', userMessages: 'div[data-testid="user-message"]', assistantMessages: 'div.font-claude-message' }
};

// --- Core Logic ---
async function init() {
    try {
    currentPlatform = detectPlatform();
        if (!currentPlatform) {
            console.warn("Axon AI C: No supported platform detected. Initialization aborted.");
            return; // Exit if platform not detected
        }
    SELECTORS = PLATFORM_SELECTORS[currentPlatform];
    console.log(`Axon AI C: Initializing for ${currentPlatform}.`);

    CONTEXT_LIMIT = MODEL_INFO[currentPlatform]['Default'].limit;

    injectAnimationStyles();
    setupTokenDisplayUI();
    
    startLookoutObserver();
    
    if (uiVisibilityInterval) clearInterval(uiVisibilityInterval);
    uiVisibilityInterval = setInterval(ensureUIVisible, 2000);
    } catch (error) {
        reportContentScriptError(error, "init");
        // Attempt to disable UI or show a critical error state
        if (summarizeButton) {
            summarizeButton.disabled = true;
            summarizeButton.textContent = "Error";
            summarizeButton.title = "An error occurred during initialization. Check console for details.";
        }
        showNotification("Axon AI: Initialization Error! Check console.", 5000);
    }
}

// --- NEW: The robust two-level observer system ---
function startLookoutObserver() {
    try {
    console.log("Axon AI C: Starting lookout observer to watch for chat container.");
    
    const lookoutObserver = new MutationObserver((mutations, observer) => {
            try { // Catch errors inside the observer callback
        const chatContainer = document.querySelector(SELECTORS.mainContainer);
        
        if (chatContainer) {
            // If we find the container and aren't already watching it...
            if (!chatContainer.dataset.axonWatching) {
                console.log("Axon AI C: Chat container found. Attaching message observer.");
                chatContainer.dataset.axonWatching = 'true'; // Mark as watched
                attachMessageObserver(chatContainer);
                        void debouncedProcessAllMessages(); // Initial count with debounce
            }
        } else {
            // If the container disappears (like on Claude chat switch), disconnect the old message watcher
            if (messageObserver) {
                console.log("Axon AI C: Chat container removed. Disconnecting old message observer.");
                messageObserver.disconnect();
                messageObserver = null;
            }
                }
            } catch (error) {
                reportContentScriptError(error, "startLookoutObserver.callback");
                // Attempt to stop the lookout observer if its callback is failing repeatedly
                observer.disconnect();
                console.error("Axon AI C: Lookout observer disconnected due to repeated errors.");
        }
    });

    // Start watching the whole body for the chat container to appear or disappear
    lookoutObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    } catch (error) {
        reportContentScriptError(error, "startLookoutObserver.setup");
        console.error("Axon AI C: Failed to set up lookout observer.");
    }
}

function attachMessageObserver(targetNode) {
    try {
    if (messageObserver) messageObserver.disconnect();

        messageObserver = new MutationObserver(() => {
            try { // Catch errors inside the observer callback
                void debouncedProcessAllMessages(); // Use debounced version here
            } catch (error) {
                reportContentScriptError(error, "attachMessageObserver.callback");
                // Attempt to stop the message observer if its callback is failing repeatedly
                messageObserver.disconnect();
                messageObserver = null;
                console.error("Axon AI C: Message observer disconnected due to repeated errors.");
            }
        });
    messageObserver.observe(targetNode, {
        childList: true,
        subtree: true
    });
    } catch (error) {
        reportContentScriptError(error, "attachMessageObserver.setup");
        console.error("Axon AI C: Failed to set up message observer.");
    }
}

function injectAnimationStyles() {
    try {
    const styleId = 'axon-animation-styles';
        if (document.getElementById(styleId)) return; // Styles are now loaded via styles.css

        // The dynamic style injection code has been moved to content_scripts/styles.css
        // This function now primarily acts as a check if needed, or can be simplified further.
        // If there were other non-CSS related side effects here, they would remain.

    } catch (error) {
        reportContentScriptError(error, "injectAnimationStyles");
}
}

async function countTokens(text) {
    try {
        // Use GPT tokenizer for all platforms
    if (typeof GPTTokenizer_cl100k_base !== 'undefined') {
        try {
            return GPTTokenizer_cl100k_base.encode(text).length;
        } catch (e) {
                reportContentScriptError(e, "countTokens.tokenizerEncode");
                return Math.ceil(text.length / 4); // Fallback to approximate
            }
        }
        return Math.ceil(text.length / 4); // Fallback if tokenizer not defined
    } catch (error) {
        reportContentScriptError(error, "countTokens");
        return 0; // Return 0 tokens on critical failure
    }
}

async function processAllMessages() {
    try {
    if (!document.querySelector(SELECTORS.mainContainer)) return;
    
    let combinedText = "";
    const userMessages = document.querySelectorAll(SELECTORS.userMessages);
    const assistantMessages = document.querySelectorAll(SELECTORS.assistantMessages);

    userMessages.forEach(el => { combinedText += el.innerText + "\n"; });
    assistantMessages.forEach(el => { combinedText += el.innerText + "\n"; });

        totalTokens = await countTokens(combinedText);
    updateTokenDisplayUI();
    } catch (error) {
        reportContentScriptError(error, "processAllMessages");
        totalTokens = 0; // Reset tokens on error
        updateTokenDisplayUI(); // Update UI to reflect error/reset
        if (percentageTextElement) percentageTextElement.textContent = "Error";
    }
}

function getConversationAsTextForSummary() {
    try {
        let conversationText = "";
        const userMessages = document.querySelectorAll(SELECTORS.userMessages);
        const assistantMessages = document.querySelectorAll(SELECTORS.assistantMessages);
        const taggedMessages = [];
        userMessages.forEach(el => taggedMessages.push({ element: el, type: 'user' }));
        assistantMessages.forEach(el => taggedMessages.push({ element: el, type: 'assistant' }));

        const allMessages = taggedMessages.sort((a, b) => {
            const position = a.element.compareDocumentPosition(b.element);
            return (position & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : (position & Node.DOCUMENT_POSITION_PRECEDING) ? 1 : 0;
        });

        allMessages.forEach(msg => {
            const clone = msg.element.cloneNode(true);
            
            // Preserve code blocks but remove UI elements
            const codeBlocks = clone.querySelectorAll('pre, code');
            codeBlocks.forEach(block => {
                // Keep the code content but remove any UI elements within it
                block.querySelectorAll('button, [aria-label*="copy"], [data-testid*="code-block-header"]').forEach(el => el.remove());
            });
            
            // Remove other UI elements
            clone.querySelectorAll('img, button, svg, [aria-label*="copy"], [data-testid*="code-block-header"]').forEach(el => el.remove());
            
            const text = clone.innerText || clone.textContent || "";
            const role = msg.type === 'user' ? "User" : "Assistant";
            
            // Add message number for better context
            const messageNumber = allMessages.indexOf(msg) + 1;
            
            if (text.trim()) {
                conversationText += `[Message ${messageNumber}] ${role}:\n${text.trim()}\n\n`;
            }
        });

        // Add conversation metadata
        const metadata = {
            platform: currentPlatform,
            timestamp: new Date().toISOString(),
            totalMessages: allMessages.length,
            contextLimit: CONTEXT_LIMIT
        };

        conversationText = `CONVERSATION METADATA:\n${JSON.stringify(metadata, null, 2)}\n\n---\n\n${conversationText}`;
        
        return conversationText;
    } catch (error) {
        reportContentScriptError(error, "getConversationAsTextForSummary");
        return ""; // Return empty string on error
    }
}

function detectPlatform() {
    try {
    const href = window.location.href;
    if (href.startsWith("https://chatgpt.com/")) return "ChatGPT";
    if (href.startsWith("https://gemini.google.com/")) return "Gemini";
    if (href.startsWith("https://claude.ai/")) return "Claude";
    return null;
    } catch (error) {
        reportContentScriptError(error, "detectPlatform");
        return null; // Return null on error
    }
}

// Function to create and show the upgrade modal
function displayUpgradeModal() {
    // Remove existing modal if any
    const existingModal = document.getElementById('axon-upgrade-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'axon-upgrade-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        text-align: center;
    `;

    // Create title
    const title = document.createElement('h2');
    title.textContent = "You've Reached Your Free Limit";
    title.style.cssText = `
        color: #333;
        margin-bottom: 1rem;
        font-size: 1.5rem;
    `;

    // Create body text
    const bodyText = document.createElement('p');
    bodyText.textContent = "You have used all 20 of your free summaries for the month. To get unlimited summaries and support Axon AI, please upgrade to Pro.";
    bodyText.style.cssText = `
        color: #666;
        margin-bottom: 1.5rem;
        line-height: 1.5;
    `;

    // Create upgrade button
    const upgradeButton = document.createElement('button');
    upgradeButton.textContent = "Upgrade to Pro";
    upgradeButton.style.cssText = `
        background-color: #007AFF;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
        margin-bottom: 1rem;
        transition: background-color 0.2s;
    `;
    upgradeButton.onmouseover = () => upgradeButton.style.backgroundColor = '#0056b3';
    upgradeButton.onmouseout = () => upgradeButton.style.backgroundColor = '#007AFF';
    upgradeButton.onclick = () => window.open('https://my-future-payment-page.com', '_blank');

    // Create footer text
    const footerText = document.createElement('p');
    footerText.textContent = "Your free limit will reset on the 1st of next month.";
    footerText.style.cssText = `
        color: #888;
        font-size: 0.9rem;
        margin-top: 1rem;
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = "×";
    closeButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #666;
        cursor: pointer;
        padding: 5px;
    `;
    closeButton.onclick = () => modal.remove();

    // Assemble modal
    modalContent.appendChild(closeButton);
    modalContent.appendChild(title);
    modalContent.appendChild(bodyText);
    modalContent.appendChild(upgradeButton);
    modalContent.appendChild(footerText);
    modal.appendChild(modalContent);

    // Add modal to page
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
}

// Modify the sendSummarizeRequest function to handle the 403 error
async function sendSummarizeRequest() {
    if (summarizeButton && summarizeButton.disabled) return;

    // Show loading state immediately on button click
    updateSummarizeButtonState('loading');

    if (uiCircleContainer) {
        uiCircleContainer.classList.add('axon-processing');
        uiCircleContainer.style.setProperty('--progress-percent', '0%');
    }
    
    let progress = 0;
    progressInterval = setInterval(() => {
        try { // Catch errors inside the interval callback
        progress += 5; 
        if (progress <= 95 && uiCircleContainer) {
            uiCircleContainer.style.setProperty('--progress-percent', `${progress}%`);
        } else {
            clearInterval(progressInterval);
            }
        } catch (error) {
            reportContentScriptError(error, "sendSummarizeRequest.progressInterval");
            clearInterval(progressInterval); // Stop interval on error
        }
    }, 500);

    const conversationText = getConversationAsTextForSummary(); // Get the full text
    if (!conversationText) {
        clearInterval(progressInterval);
        reportContentScriptError(new Error("No conversation text available for summarization."), "sendSummarizeRequest.noText");
        showNotification("No conversation text to summarize.", 'error');
        updateSummarizeButtonState('idle');
        return;
    }

    try {
        // Get the user ID from storage
        const userData = await chrome.storage.local.get('userId');
        if (!userData.userId) {
            throw new Error("User ID not found");
        }

        // Send message to service worker and await response
        const response = await chrome.runtime.sendMessage({
            action: "summarizeConversation",
            text: conversationText,
            userId: userData.userId
        });

        clearInterval(progressInterval);
        if (uiCircleContainer) uiCircleContainer.style.setProperty('--progress-percent', `100%`);

        // Check if the response indicates success or failure
        if (response && response.success) {
            // Summary received, copy to clipboard
            await navigator.clipboard.writeText(response.summary);
            showNotification("✓ Summary copied to clipboard!", 'success');
            setTimeout(() => updateSummarizeButtonState('idle'), 2000);
        } else {
            // Handle specific error cases
            if (response.status === 403 && response.error === 'limit_exceeded') {
                displayUpgradeModal();
            } else {
                // Handle other errors
                showNotification(response.error || "Summarization failed. Please try again.", 'error');
            }
            updateSummarizeButtonState('idle');
        }
    } catch (error) {
        clearInterval(progressInterval);
        // This catch handles issues like service worker not responding, or permission errors
        console.error("Error sending message to service worker or processing response:", error);
        showNotification("Extension communication error. Try reloading the page.", 'error');
        updateSummarizeButtonState('idle');
    }
}

function resetSummarizeButton(message = "Summarize") {
    try {
    if (progressInterval) clearInterval(progressInterval);

    if (summarizeButton) {
        summarizeButton.textContent = message;
        summarizeButton.disabled = false;
        summarizeButton.style.display = 'block';
    }
    
    if (message === "Summarize") {
        if (uiCircleContainer) {
            uiCircleContainer.classList.remove('axon-processing');
            uiCircleContainer.style.backgroundImage = ''; 
        }
        }
    } catch (error) {
        reportContentScriptError(error, "resetSummarizeButton");
    }
}

function setupTokenDisplayUI() {
    try {
    if (document.getElementById('axon-ui-circle-container')) return;

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'axon-notification';
        document.body.appendChild(notification);

    uiCircleContainer = document.createElement('div');
    uiCircleContainer.id = 'axon-ui-circle-container';
    
    percentageTextElement = document.createElement('span');
    percentageTextElement.id = 'axon-percentage-text';
    uiCircleContainer.appendChild(percentageTextElement);
    
    hoverMenuElement = document.createElement('div');
    hoverMenuElement.id = 'axon-hover-menu';
    hoverMenuElement.style.display = 'none';
    
    fullDetailTextElement = document.createElement('div');
    fullDetailTextElement.className = 'axon-detail-text';
    hoverMenuElement.appendChild(fullDetailTextElement);
    
    summarizeButton = document.createElement('button');
    summarizeButton.textContent = 'Summarize';
        summarizeButton.addEventListener('click', sendSummarizeRequest);
    hoverMenuElement.appendChild(summarizeButton);

    uiCircleContainer.appendChild(hoverMenuElement);
    document.body.appendChild(uiCircleContainer);

    uiCircleContainer.addEventListener('mouseenter', () => { 
            try {
        clearTimeout(hideMenuTimer);
        hoverMenuElement.style.display = 'flex';
            } catch (error) {
                reportContentScriptError(error, "uiCircleContainer.mouseenter");
            }
    });
    uiCircleContainer.addEventListener('mouseleave', () => {
            try {
        hideMenuTimer = setTimeout(() => { 
            hoverMenuElement.style.display = 'none';
        }, 1000);
            } catch (error) {
                reportContentScriptError(error, "uiCircleContainer.mouseleave");
            }
    });
    hoverMenuElement.addEventListener('mouseenter', () => {
            try {
        clearTimeout(hideMenuTimer);
            } catch (error) {
                reportContentScriptError(error, "hoverMenuElement.mouseenter");
            }
    });
    hoverMenuElement.addEventListener('mouseleave', () => {
            try {
        hideMenuTimer = setTimeout(() => { 
            hoverMenuElement.style.display = 'none';
        }, 500);
            } catch (error) {
                reportContentScriptError(error, "hoverMenuElement.mouseleave");
            }
        });
    } catch (error) {
        reportContentScriptError(error, "setupTokenDisplayUI");
        // Attempt to hide/disable UI elements if setup fails
        if (uiCircleContainer) uiCircleContainer.style.display = 'none';
        if (summarizeButton) summarizeButton.disabled = true;
    }
}

function updateTokenDisplayUI() {
    try {
    if (!percentageTextElement || !fullDetailTextElement) return;
    const percentage = CONTEXT_LIMIT > 0 ? (totalTokens / CONTEXT_LIMIT) * 100 : 0;
    percentageTextElement.textContent = `${percentage.toFixed(0)}%`;
        fullDetailTextElement.textContent = `Axon (${currentPlatform || '...' || 'N/A'}): ${totalTokens} Tokens / ${CONTEXT_LIMIT}`;
    } catch (error) {
        reportContentScriptError(error, "updateTokenDisplayUI");
        if (percentageTextElement) percentageTextElement.textContent = "N/A";
        if (fullDetailTextElement) fullDetailTextElement.textContent = "Error";
    }
}

function ensureUIVisible() {
    try {
    if (uiCircleContainer && !uiCircleContainer.isConnected) {
        document.body.appendChild(uiCircleContainer);
        }
    } catch (error) {
        reportContentScriptError(error, "ensureUIVisible");
    }
}

function onPageLoad() {
    try {
    setTimeout(init, 500); 
    } catch (error) {
        reportContentScriptError(error, "onPageLoad");
    }
}

// Global error handler for content script
window.addEventListener('error', (event) => {
    reportContentScriptError(event.error || new Error(event.message), `globalWindowError:${event.filename}:${event.lineno}`);
}, true); // Use true to catch errors from scripts not in the same origin

window.addEventListener('unhandledrejection', (event) => {
    reportContentScriptError(event.reason || new Error("Unhandled Promise Rejection"), `globalUnhandledRejection`);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoad);
} else {
    onPageLoad();
}

function showNotification(message, type = 'info', duration = 2000) {
    try {
        const notification = document.getElementById('axon-notification');
        if (!notification) {
            console.warn("Axon AI C: Notification element not found.");
            return;
        }

        notification.textContent = message;
        // Remove previous type classes
        notification.classList.remove('success', 'error', 'info'); 
        notification.classList.add(type);
        notification.classList.add('show');

        setTimeout(() => {
            try { // Catch errors inside timeout
                notification.classList.remove('show');
                // Optionally remove type class after hiding
                setTimeout(() => notification.classList.remove(type), 300); 
            } catch (error) {
                reportContentScriptError(error, "showNotification.timeout");
            }
        }, duration);
    } catch (error) {
        reportContentScriptError(error, "showNotification");
    }
}

function updateSummarizeButtonState(state) {
    try {
        if (progressInterval) clearInterval(progressInterval); // Clear interval when state changes

        if (summarizeButton) {
            summarizeButton.disabled = state === 'loading';
            summarizeButton.style.display = state === 'loading' ? 'none' : 'block';
            summarizeButton.textContent = state === 'loading' ? 'Summarizing...' :
                                          state === 'error' ? 'Error' : 'Summarize';
        }

        if (uiCircleContainer) {
            if (state === 'loading') {
                uiCircleContainer.classList.add('axon-processing');
                uiCircleContainer.style.setProperty('--progress-percent', '0%');
            } else if (state === 'idle' || state === 'error') {
                uiCircleContainer.classList.remove('axon-processing');
                uiCircleContainer.style.backgroundImage = ''; // Reset background
                uiCircleContainer.style.setProperty('--progress-percent', '0%');
            }
        }
    } catch (error) {
        reportContentScriptError(error, "updateSummarizeButtonState");
    }
}
