const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Proxy endpoint for summarization
app.post('/api/summarize', async (req, res) => {
  const apiKey = req.headers['x-goog-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Google API key not provided' });
  }

  try {
    const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', req.body, {
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to summarize',
      details: error.response?.data || error.message
    });
  }
});

// Export the Express app for Vercel
module.exports = app; 