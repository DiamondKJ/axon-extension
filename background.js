// background.js - FINAL with Summary Length Constraint

// Import the official Google GenAI library
import { GoogleGenerativeAI } from './lib/genai.js'; 

console.log("Axon AI B: Script evaluation started.");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callGoogleAPI(apiKey, prompt) {
    console.log("Axon AI B: Calling Google AI SDK with streaming...");
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const result = await model.generateContentStream(prompt);

        let fullText = "";
        for await (const chunk of result.stream) {
            fullText += chunk.text();
        }
        
        if (!fullText) throw new Error("Received an empty response from Google AI API.");
        return fullText;

    } catch (e) {
        console.error("Axon AI B: Error during SDK call:", e.message);
        if (e.message.includes("API key not valid")) {
             throw new Error("Your Google AI API key is not valid. Please check it in the options.");
        }
        throw new Error(e.message);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarizeText") {
        (async () => {
            const tabId = sender.tab?.id;
            try {
                const { textToSummarize } = request;
                const settings = await chrome.storage.local.get(['axonGoogleApiKey']);
                const apiKey = settings.axonGoogleApiKey;

                if (!apiKey) throw new Error("Google AI API Key not set. Please set it in the options.");
                if (!textToSummarize || !textToSummarize.trim()) throw new Error("There is no text to summarize.");

                // --- PROMPT WITH THE LENGTH CONSTRAINT ---
                const systemPrompt = `You are a precision-focused summarization engine. Your task is to meticulously analyze the following conversation and produce a single, comprehensive, and well-organized summary. Extract all key decisions, action items, critical data points, important questions, and definitive conclusions. Synthesize this information into a coherent narrative. The final output should be a clean, easy-to-read summary that captures the essence of the entire conversation. CRITICAL INSTRUCTION: The final summary must be under 4000 characters in total length.`;
                const fullPrompt = `${systemPrompt}\n\n---\n\nCONVERSATION TEXT:\n\n${textToSummarize}`;
                
                if(tabId) chrome.tabs.sendMessage(tabId, { action: "summarizationProgress", currentChunk: 1, totalChunks: 1 });
                
                const finalSummary = await callGoogleAPI(apiKey, fullPrompt);
                
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
