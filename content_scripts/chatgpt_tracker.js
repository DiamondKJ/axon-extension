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
    currentPlatform = detectPlatform();
    if (!currentPlatform) return;
    SELECTORS = PLATFORM_SELECTORS[currentPlatform];
    console.log(`Axon AI C: Initializing for ${currentPlatform}.`);

    CONTEXT_LIMIT = MODEL_INFO[currentPlatform]['Default'].limit;

    injectAnimationStyles();
    setupTokenDisplayUI();
    
    startLookoutObserver();
    
    if (uiVisibilityInterval) clearInterval(uiVisibilityInterval);
    uiVisibilityInterval = setInterval(ensureUIVisible, 2000);
}

// --- NEW: The robust two-level observer system ---
function startLookoutObserver() {
    console.log("Axon AI C: Starting lookout observer to watch for chat container.");
    
    const lookoutObserver = new MutationObserver((mutations, observer) => {
        const chatContainer = document.querySelector(SELECTORS.mainContainer);
        
        if (chatContainer) {
            // If we find the container and aren't already watching it...
            if (!chatContainer.dataset.axonWatching) {
                console.log("Axon AI C: Chat container found. Attaching message observer.");
                chatContainer.dataset.axonWatching = 'true'; // Mark as watched
                attachMessageObserver(chatContainer);
                processAllMessages(); // Do an initial count
            }
        } else {
            // If the container disappears (like on Claude chat switch), disconnect the old message watcher
            if (messageObserver) {
                console.log("Axon AI C: Chat container removed. Disconnecting old message observer.");
                messageObserver.disconnect();
                messageObserver = null;
            }
        }
    });

    // Start watching the whole body for the chat container to appear or disappear
    lookoutObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function attachMessageObserver(targetNode) {
    if (messageObserver) messageObserver.disconnect();

    messageObserver = new MutationObserver(() => {
        // Use void to handle the Promise
        void processAllMessages();
    });
    messageObserver.observe(targetNode, {
        childList: true,
        subtree: true
    });
}

function injectAnimationStyles() {
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
}

async function countTokens(text) {
    // Use GPT tokenizer for all platforms
    if (typeof GPTTokenizer_cl100k_base !== 'undefined') {
        try {
            return GPTTokenizer_cl100k_base.encode(text).length;
        } catch (e) {
            return Math.ceil(text.length / 4);
        }
    }
    return Math.ceil(text.length / 4);
}

async function processAllMessages() {
    if (!document.querySelector(SELECTORS.mainContainer)) return;
    
    let combinedText = "";
    const userMessages = document.querySelectorAll(SELECTORS.userMessages);
    const assistantMessages = document.querySelectorAll(SELECTORS.assistantMessages);

    userMessages.forEach(el => { combinedText += el.innerText + "\n"; });
    assistantMessages.forEach(el => { combinedText += el.innerText + "\n"; });

    totalTokens = await countTokens(combinedText);
    updateTokenDisplayUI();
}

function getConversationAsTextForSummary() {
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
}

function detectPlatform() {
    const href = window.location.href;
    if (href.startsWith("https://chatgpt.com/")) return "ChatGPT";
    if (href.startsWith("https://gemini.google.com/")) return "Gemini";
    if (href.startsWith("https://claude.ai/")) return "Claude";
    return null;
}

function handleSummarizeClick() {
    if (summarizeButton && summarizeButton.disabled) return;
    summarizeButton.disabled = true;
    summarizeButton.style.display = 'none';

    if (uiCircleContainer) {
        uiCircleContainer.classList.add('axon-processing');
        uiCircleContainer.style.setProperty('--progress-percent', '0%');
    }
    
    let progress = 0;
    progressInterval = setInterval(() => {
        progress += 5; 
        if (progress <= 95 && uiCircleContainer) {
            uiCircleContainer.style.setProperty('--progress-percent', `${progress}%`);
        } else {
            clearInterval(progressInterval);
        }
    }, 500);

    const conversationText = getConversationAsTextForSummary();
    console.log(`Axon AI C: Sending 'summarizeText' to background...`);

    chrome.runtime.sendMessage({ action: "summarizeText", textToSummarize: conversationText }, 
    (response) => { 
        clearInterval(progressInterval);

        const handleFinish = (successMessage = null) => {
            if (successMessage) {
                if (uiCircleContainer) uiCircleContainer.style.setProperty('--progress-percent', `100%`);
                setTimeout(() => {
                    resetSummarizeButton(successMessage);
                    setTimeout(() => resetSummarizeButton("Summarize"), 2000);
                }, 1000);
            } else {
                resetSummarizeButton();
            }
        };
        
        if (chrome.runtime.lastError) {
            alert("Error: " + chrome.runtime.lastError.message);
            handleFinish();
            return; 
        }
        if (response && response.status === 'error') { 
            alert("Summarization Failed: " + response.message);
            handleFinish();
        } else if (response && response.status === 'success' && response.summary) {
            showNotification("✓ Summary copied to clipboard!");
            handleFinish("✓ Copied!");
        } else { 
            alert("An unexpected response was received.");
            handleFinish();
        }
    });
}

function resetSummarizeButton(message = "Summarize") {
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
}

function setupTokenDisplayUI() {
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
        clearTimeout(hideMenuTimer);
        hoverMenuElement.style.display = 'flex';
    });
    uiCircleContainer.addEventListener('mouseleave', () => {
        hideMenuTimer = setTimeout(() => { 
            hoverMenuElement.style.display = 'none';
        }, 1000);
    });
    hoverMenuElement.addEventListener('mouseenter', () => {
        clearTimeout(hideMenuTimer);
    });
    hoverMenuElement.addEventListener('mouseleave', () => {
        hideMenuTimer = setTimeout(() => { 
            hoverMenuElement.style.display = 'none';
        }, 500);
    });
}

function updateTokenDisplayUI() {
    if (!percentageTextElement || !fullDetailTextElement) return;
    const percentage = CONTEXT_LIMIT > 0 ? (totalTokens / CONTEXT_LIMIT) * 100 : 0;
    percentageTextElement.textContent = `${percentage.toFixed(0)}%`;
    fullDetailTextElement.textContent = `Axon (${currentPlatform || '...'}): ${totalTokens} Tokens / ${CONTEXT_LIMIT}`;
}

function ensureUIVisible() {
    if (uiCircleContainer && !uiCircleContainer.isConnected) {
        document.body.appendChild(uiCircleContainer);
    }
}

function onPageLoad() {
    setTimeout(init, 500); 
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageLoad);
} else {
    onPageLoad();
}

function showNotification(message, duration = 2000) {
    const notification = document.getElementById('axon-notification');
    if (!notification) return;

    notification.textContent = message;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}
