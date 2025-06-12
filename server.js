const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS with specific options
const corsOptions = {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Cache preflight requests for 24 hours
};

// Apply CORS middleware with options
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

app.post('/api/summarize', async (req, res) => {
    // Set CORS headers for this specific route
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const { contents, generationConfig, safetySettings } = req.body;
    
    if (!contents || !contents[0]?.parts?.[0]?.text) {
        console.log('Invalid request body:', req.body);
        return res.status(400).json({ error: 'Empty or invalid contents received' });
    }

    try {
        console.log('Making request to Gemini API...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig, safetySettings })
            }
        );

        const data = await response.json();
        
        if (!response.ok) {
            console.log('Gemini API error:', data);
            return res.status(response.status).json({ error: 'Failed to summarize', details: data });
        }

        console.log('Gemini API success');
        res.json(data);
    } catch (error) {
        console.log('Server error:', error.message);
        res.status(500).json({ error: 'Failed to summarize', details: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Axon AI backend is running.');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 