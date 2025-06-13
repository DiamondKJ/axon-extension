// background.js - FINAL with Summary Length Constraint

console.log("Axon AI B: Script evaluation started. Version: Jun13_PM_V1");

// User ID Management System
chrome.runtime.onInstalled.addListener(async () => {
    console.log("Axon AI B: Extension installed/updated. Checking for user ID...");
    
    try {
        // Check if userId exists in storage
        const data = await chrome.storage.local.get('userId');
        
        if (!data.userId) {
            // Generate new userId if none exists
            const newUserId = crypto.randomUUID();
            console.log("Axon AI B: Generated new user ID:", newUserId);
            
            // Save the new userId
            await chrome.storage.local.set({ userId: newUserId });
            console.log("Axon AI B: User ID saved to storage");
        } else {
            console.log("Axon AI B: Existing user ID found:", data.userId);
        }
    } catch (error) {
        console.error("Axon AI B: Error managing user ID:", error);
    }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// New function to report errors to the backend
async function reportErrorToBackend(errorDetails) {
    console.error("Axon AI B: Reporting error to backend:", errorDetails);
    try {
        await fetch('https://axon-extension.netlify.app/.netlify/functions/log_error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(errorDetails)
        });
        console.log("Axon AI B: Error reported successfully.");
    } catch (e) {
        console.error("Axon AI B: Failed to report error to backend:", e);
    }
}

async function callSummarizationAPI(prompt) {
    console.log("Axon AI B: Calling summarization API...");
    
    try {
        if (!prompt || prompt.trim().length === 0) {
            throw new Error("Generated prompt is empty");
        }

        // Get the user ID
        const userData = await chrome.storage.local.get('userId');
        if (!userData.userId) {
            throw new Error("User ID not found");
        }

        // Define the system prompt for comprehensive context transfer - now concatenated
        const systemPromptContent = `You are a highly skilled and comprehensive conversation summarizer. Your ONLY job is to create a DETAILED and THOROUGH summary that captures ALL essential context for transferring to a new AI chat. Ensure you extract and include all key decisions, action items, critical data points, important questions, and definitive conclusions. Synthesize this information into a coherent, well-structured, and easy-to-read narrative.\n\nNEVER give feedback, suggestions, or improvements. NEVER say "this is good" or "here are enhancements." ABSOLUTELY NO CONVERSATIONAL FILLER OR CLOSINGS.\n\nStart with: "This is what the previous chat was about:"\n\n- Project/topic overview (Provide a complete understanding of the project/topic, its goals, and overall direction)
- Current status/progress (Detail the exact current state, completed tasks, and immediate focus areas)
- Key decisions made (Elaborate on important choices, the reasoning behind them, and alternatives considered)
- Technical details (Include specific implementations, relevant code snippets, configurations, and dependencies. Be precise.)
- Next steps needed (Clearly outline immediate actions, future considerations, and any known blockers. Be actionable.)\n\n---\n\nCONVERSATION TEXT:\n\n`;

        const fullConcatenatedPrompt = `${systemPromptContent}${prompt}`;

        console.log("Axon AI B: Prompt length:", fullConcatenatedPrompt.length);
        console.log("Axon AI B: First 500 chars of prompt:\n", fullConcatenatedPrompt.substring(0, 500));

        const requestBody = {
            userId: userData.userId, // Add user ID to request
            contents: [
                {
                    parts: [
                        { text: fullConcatenatedPrompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4000,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        console.log("Axon AI B: Request payload:", JSON.stringify(requestBody, null, 2));
        console.log("Axon AI B: Sending request to server...");
        
        const response = await fetch('https://axon-extension.netlify.app/.netlify/functions/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Axon AI B: Server response status:", response.status);
        const responseText = await response.text();
        console.log("Axon AI B: Server response:", responseText);

        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorData.details?.error || 'Failed to summarize';
            } catch (e) {
                errorMessage = responseText || 'Failed to summarize';
            }
            throw new Error(errorMessage);
        }
        
        const data = JSON.parse(responseText);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Axon AI B: Invalid response format:", data);
            throw new Error("Received an empty response from the API.");
        }

        const summary = data.candidates[0].content.parts[0].text;
        console.log("Axon AI B: Generated summary length:", summary.length);
        console.log("Axon AI B: First 100 chars of summary:", summary.substring(0, 100));

        return summary;

    } catch (e) {
        console.error("Axon AI B: Error during API call:", e.message);
        throw new Error(e.message);
    }
}

// Add warm-up mechanism for Netlify function
function startWarmupInterval() {
    // Initial warm-up call
    warmupFunction();
    
    // Set up interval for subsequent warm-up calls
    setInterval(warmupFunction, 10 * 60 * 1000); // 10 minutes
}

async function warmupFunction() {
    try {
        console.log("Axon AI B: Warming up Netlify function...");
        const response = await fetch('https://axon-extension.netlify.app/.netlify/functions/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "warmup" }]
                }]
            })
        });

        if (!response.ok) {
            console.warn("Axon AI B: Warm-up request failed:", response.status);
        } else {
            console.log("Axon AI B: Warm-up successful");
        }
    } catch (error) {
        console.warn("Axon AI B: Warm-up request failed:", error.message);
    }
}

// Start the warm-up interval when the background script loads
startWarmupInterval();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Service Worker: Message received from content script:", message.action);

    if (message.action === "summarizeConversation") {
        const conversationText = message.text;

        if (!conversationText || conversationText.length === 0) {
            sendResponse({ success: false, error: "No conversation text to summarize." });
            return true; // Indicate async response
        }

        // Get user ID and create payload
        chrome.storage.local.get('userId').then(userData => {
            if (!userData.userId) {
                sendResponse({ success: false, error: "User ID not found" });
                return;
            }

            // Define the explicit concatenated system prompt directly within the listener
            const finalSystemPromptAndConversation = `You are a highly skilled and comprehensive conversation summarizer. Your ONLY job is to create a DETAILED and THOROUGH summary that captures ALL essential context for transferring to a new AI chat. Ensure you extract and include all key decisions, action items, critical data points, important questions, and definitive conclusions. Synthesize this information into a coherent, well-structured, and easy-to-read narrative.\n\nNEVER give feedback, suggestions, or improvements. NEVER say "this is good" or "here are enhancements." ABSOLUTELY NO CONVERSATIONAL FILLER OR CLOSINGS.\n\nStart with: "This is what the previous chat was about:"\n\n- Project/topic overview (Provide a complete understanding of the project/topic, its goals, and overall direction)
- Current status/progress (Detail the exact current state, completed tasks, and immediate focus areas)
- Key decisions made (Elaborate on important choices, the reasoning behind them, and alternatives considered)
- Technical details (Include specific implementations, relevant code snippets, configurations, and dependencies. Be precise.)
- Next steps needed (Clearly outline immediate actions, future considerations, and any known blockers. Be actionable.)\n\n---\n\nCONVERSATION TEXT:\n\n${conversationText}`;

            console.log("Axon AI B: Sending request to server (from listener)...");
            console.log("Axon AI B: Request body (from listener) - CONCATENATED PROMPT:");
            
            const payloadToSend = {
                userId: userData.userId, // Add user ID to request
                contents: [
                    {
                        parts: [
                            { text: finalSystemPromptAndConversation }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4000
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            console.log(JSON.stringify(payloadToSend, null, 2));

            fetch('https://axon-extension.netlify.app/.netlify/functions/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payloadToSend)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        console.error("Netlify Function Error:", response.status, errorData);
                        sendResponse({ 
                            success: false, 
                            error: `Summarization API error: ${errorData.error || errorData.details?.error || 'Unknown error'}` 
                        });
                    }).catch(e => {
                        // Handle case where response is not JSON
                        console.error("Error parsing error response:", e);
                        sendResponse({ 
                            success: false, 
                            error: `Server error: ${response.status} ${response.statusText}` 
                        });
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Service Worker: Summary received from Netlify");
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    sendResponse({ success: true, summary: data.candidates[0].content.parts[0].text });
                } else {
                    sendResponse({ success: false, error: "No summary returned from API." });
                }
            })
            .catch(error => {
                console.error("Service Worker: Error during summarization API call:", error);
                sendResponse({ 
                    success: false, 
                    error: "Network or server error during summarization." 
                });
            });

            return true; // IMPORTANT: Indicate that you will send a response asynchronously
        });
    } else if (message.action === "reportError") { // New error reporting action
        (async () => {
            reportErrorToBackend(message.errorDetails);
            sendResponse({ status: "acknowledged" });
        })();
        return true;
    }

    // Return false for other messages if no response is needed
    return false;
});

console.log("Axon AI B: onMessage listener attached. Script fully evaluated.");
