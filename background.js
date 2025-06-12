// background.js - FINAL with Summary Length Constraint

console.log("Axon AI B: Script evaluation started.");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callSummarizationAPI(prompt) {
    console.log("Axon AI B: Calling summarization API...");
    
    try {
        const response = await fetch('https://axon-extension.vercel.app/api/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to summarize');
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error("Received an empty response from the API.");
        }

        return data.candidates[0].content.parts[0].text;

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
                
                if(tabId) chrome.tabs.sendMessage(tabId, { action: "summarizationProgress", currentChunk: 1, totalChunks: 1 });
                
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
