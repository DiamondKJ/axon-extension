// axon-extension/offscreen.js
import { pipeline } from './lib/sentence-transformers.js';

console.log("Axon Offscreen: Script loaded.");

// The embedding pipeline will be created and managed here
class EmbeddingPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2'; // A good, lightweight default model
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log("Axon Offscreen: Embedding pipeline instance not found. Initializing...");
            // The library will download the model from Hugging Face Hub on first run
            this.instance = await pipeline(this.task, this.model, { progress_callback });
            console.log("Axon Offscreen: Embedding pipeline initialized successfully.");
        }
        return this.instance;
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Axon Offscreen: Message received", request);
    if (request.action === 'offscreenCreateEmbedding') {
        (async () => {
            try {
                const text = request.textToEmbed;
                if (!text) throw new Error("No text provided to embed in offscreen doc.");
                
                const embedder = await EmbeddingPipeline.getInstance();
                const embedding = await embedder(text, { pooling: 'mean', normalize: true });
                
                // Convert the Float32Array to a standard JavaScript array before sending
                const vector = Array.from(embedding.data);
                
                console.log(`Axon Offscreen: Successfully created embedding for text: "${text.substring(0, 30)}..."`);
                sendResponse({ status: "success", vector: vector });

            } catch (error) {
                console.error("Axon Offscreen: Error creating embedding:", error);
                sendResponse({ status: "error", message: error.message });
            }
        })();
        return true; // Asynchronous response
    }
});