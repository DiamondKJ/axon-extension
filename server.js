const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Get API key from environment variable
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Proxy endpoint for summarization
app.post('/api/summarize', async (req, res) => {
  console.log('Received summarization request');
  
  if (!GOOGLE_API_KEY) {
    console.error('API key not configured');
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    console.log('Sending request to Google API');
    const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', req.body, {
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    console.log('Received response from Google API');
    res.json(response.data);
  } catch (error) {
    console.error('Error details:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to summarize',
      details: error.response?.data || error.message
    });
  }
});

// Export the Express app for Vercel
module.exports = app; 