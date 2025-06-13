// background.js - FINAL with Summary Length Constraint

console.log("Axon AI B: Script evaluation started.");

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

        // Define the system prompt for comprehensive context transfer
        const systemPrompt = `You are a highly skilled technical summarization AI. Your task is to create a comprehensive summary that captures ALL essential context for transferring to a new AI conversation. The summary must be structured to allow a new AI to immediately understand the full context and continue the conversation seamlessly.

IMPORTANT: Provide a direct summary of the conversation. DO NOT provide feedback, suggestions, or "Even Better If" analysis. Focus on extracting and organizing the key information from the conversation.

Please analyze the conversation and create a structured summary with the following sections:

1. PROJECT OVERVIEW
   - Main project/feature being built
   - Core objectives and goals
   - Overall architecture/approach

2. CURRENT STATUS
   - Where the project stands
   - Latest completed work
   - Current focus area

3. KEY DECISIONS MADE
   - Important technical choices
   - Reasoning behind decisions
   - Trade-offs considered

4. TECHNICAL DETAILS
   - Specific implementations
   - Code snippets (if relevant)
   - Configuration details
   - Dependencies and versions

5. PROBLEMS SOLVED
   - Issues encountered
   - Solutions implemented
   - Workarounds used

6. NEXT STEPS
   - Immediate tasks
   - Future considerations
   - Known blockers

7. USER PREFERENCES
   - Coding style preferences
   - Framework choices
   - Development approach
   - Any specific requirements

8. CONTEXT DEPENDENCIES
   - External factors
   - Constraints
   - Requirements
   - Dependencies

Format the summary with clear headings and bullet points. Keep it concise but comprehensive. Prioritize actionable information and include specific examples where relevant. The goal is to enable a new AI to pick up exactly where the previous conversation left off, with zero context loss.`;

        const fullPrompt = `${systemPrompt}\n\n---\n\nCONVERSATION TEXT:\n\n${prompt}`;

        console.log("Axon AI B: Prompt length:", fullPrompt.length);
        console.log("Axon AI B: First 500 chars of prompt:\n", fullPrompt.substring(0, 500));

        const requestBody = {
            contents: [{
                parts: [{ text: fullPrompt }]
            }],
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
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
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
            })
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

        // Make the request to your Netlify function
        fetch('https://axon-extension.netlify.app/.netlify/functions/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: conversationText }]
                }],
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
            })
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
