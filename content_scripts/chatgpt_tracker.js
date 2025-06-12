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
                        void processAllMessages(); // Do an initial count, use void for async
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
                void processAllMessages();
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
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        #axon-ui-circle-container.axon-processing {
            background-image: conic-gradient(#007bff 0% var(--progress-percent, 0%), #ffffff var(--progress-percent, 0%) 100%);
            transition: background-image 0.25s ease-out;
        }
        #axon-ui-circle-container.axon-processing > span { color: #003E74; }

        #axon-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease-out;
            pointer-events: none;
        }

        #axon-notification.show {
            opacity: 1;
            transform: translateY(0);
        }
    `;
        document.head.appendChild(style);
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
            clone.querySelectorAll('img, button, svg, [aria-label*="copy"], [data-testid*="code-block-header"]').forEach(el => el.remove());
            const text = clone.innerText || clone.textContent || "";
            const role = msg.type === 'user' ? "User" : "Assistant";
            if (text.trim()) {
                conversationText += `${role}: ${text.trim()}\n\n`;
            }
        });
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

function handleSummarizeClick() {
    try {
        if (summarizeButton && summarizeButton.disabled) return;
        summarizeButton.disabled = true;
        summarizeButton.style.display = 'none';

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
                reportContentScriptError(error, "handleSummarizeClick.progressInterval");
                clearInterval(progressInterval); // Stop interval on error
            }
        }, 500);

        const conversationText = getConversationAsTextForSummary();
        if (!conversationText) {
            throw new Error("No conversation text available for summarization.");
        }
        console.log(`Axon AI C: Sending 'summarizeText' to background...`);

        chrome.runtime.sendMessage({ action: "summarizeText", textToSummarize: conversationText }, 
        (response) => { 
            clearInterval(progressInterval);

            const handleFinish = (successMessage = null) => {
                try { // Catch errors inside handleFinish
                    if (successMessage) {
                        if (uiCircleContainer) uiCircleContainer.style.setProperty('--progress-percent', `100%`);
                        setTimeout(() => {
                            resetSummarizeButton(successMessage);
                            setTimeout(() => resetSummarizeButton("Summarize"), 2000);
                        }, 1000);
                    } else {
                        resetSummarizeButton();
                    }
                } catch (error) {
                    reportContentScriptError(error, "handleSummarizeClick.handleFinish");
                    resetSummarizeButton(); // Ensure button is reset even if handleFinish fails
                }
            };
            
            if (chrome.runtime.lastError) {
                reportContentScriptError(chrome.runtime.lastError, "handleSummarizeClick.sendMessageResponse");
                alert("Error: " + chrome.runtime.lastError.message);
                handleFinish();
                return; 
            }
            if (response && response.status === 'error') { 
                reportContentScriptError(new Error(response.message), "handleSummarizeClick.summarizationError");
                alert("Summarization Failed: " + response.message);
                handleFinish();
            } else if (response && response.status === 'success' && response.summary) {
                navigator.clipboard.writeText(response.summary).then(() => {
                    console.log("Axon AI C: Summary successfully copied to clipboard.");
                    showNotification("✓ Summary copied to clipboard!");
                    handleFinish("✓ Copied!");
                }).catch(err => {
                    reportContentScriptError(err, "handleSummarizeClick.clipboardCopy");
                    console.error("Axon AI C: Failed to copy summary to clipboard:", err);
                    showNotification("✗ Failed to copy!");
                    handleFinish();
                });
            } else { 
                reportContentScriptError(new Error("Unexpected response from background script"), "handleSummarizeClick.unexpectedResponse");
                alert("An unexpected response was received.");
                handleFinish();
            }
        });
    } catch (error) {
        reportContentScriptError(error, "handleSummarizeClick.outer");
        alert("Axon AI: An internal error occurred during summarization.");
        resetSummarizeButton("Error"); // Indicate an error on the button
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
        summarizeButton.addEventListener('click', handleSummarizeClick);
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

function showNotification(message, duration = 2000) {
    try {
        const notification = document.getElementById('axon-notification');
        if (!notification) {
            console.warn("Axon AI C: Notification element not found.");
            return;
        }

        notification.textContent = message;
        notification.classList.add('show');

        setTimeout(() => {
            try { // Catch errors inside timeout
                notification.classList.remove('show');
            } catch (error) {
                reportContentScriptError(error, "showNotification.timeout");
            }
        }, duration);
    } catch (error) {
        reportContentScriptError(error, "showNotification");
    }
}
