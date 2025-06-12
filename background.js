// background.js - FINAL with Summary Length Constraint

console.log("Axon AI B: Script evaluation started.");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callSummarizationAPI(prompt) {
    console.log("Axon AI B: Calling summarization API...");
    
    try {
        if (!prompt || prompt.trim().length === 0) {
            throw new Error("Generated prompt is empty");
        }

        console.log("Axon AI B: Prompt length:", prompt.length);
        console.log("Axon AI B: First 100 chars of prompt:", prompt.substring(0, 100));

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
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
        
        const response = await fetch('https://axon-extension-n6hc4iwqu-kaustubh-joshis-projects-2a0d2698.vercel.app/api/summarize?v=' + Date.now(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarizeText") {
        (async () => {
            const tabId = sender.tab?.id;
            try {
                const { textToSummarize } = request;
                if (!textToSummarize || !textToSummarize.trim()) throw new Error("There is no text to summarize.");

                // --- PROMPT WITH THE LENGTH CONSTRAINT ---
                const systemPrompt = `You are a precision-focused summarization engine. Your task is to meticulously analyze the following conversation and produce a single, comprehensive, and well-organized summary. Extract all key decisions, action items, critical data points, important questions, and definitive conclusions. Synthesize this information into a coherent narrative. The final output should be a clean, easy-to-read summary that captures the essence of the entire conversation. CRITICAL INSTRUCTION: The final summary must be under 4000 characters in total length.`;
                const fullPrompt = `${systemPrompt}\n\n---\n\nCONVERSATION TEXT:\n\n${textToSummarize}`;
                
                if(tabId) {
                    try {
                        await chrome.tabs.sendMessage(tabId, { action: "summarizationProgress", currentChunk: 1, totalChunks: 1 });
                    } catch (e) {
                        console.log("Axon AI B: Could not send progress update to tab, continuing anyway");
                    }
                }
                
                const finalSummary = await callSummarizationAPI(fullPrompt);
                
                sendResponse({ status: "success", summary: finalSummary });

            } catch (error) {
                console.error("Axon AI B: Critical summarization error:", error);
                sendResponse({ status: "error", message: error.message || "An unknown error occurred." });
            }
        })();
        return true;
    }
});

console.log("Axon AI B: onMessage listener attached. Script fully evaluated.");
