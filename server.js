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
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // First verify the model is available
    try {
      const modelCheck = await axios.get(
        `https://generativelanguage.googleapis.com/v1/models?key=${GOOGLE_API_KEY}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Available models:', modelCheck.data);
    } catch (error) {
      console.error('Error checking available models:', error.response?.data || error.message);
    }

    // Now make the actual request
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: req.body.prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Received response from Google API');
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      throw new Error('Invalid response format from Google API');
    }

    const summary = response.data.candidates[0].content.parts[0].text;
    
    res.json(response.data);
  } catch (error) {
    console.error('Error details:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Send a more detailed error response
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to summarize',
      details: error.response?.data || error.message,
      status: error.response?.status || 500
    });
  }
});

// Export the Express app for Vercel
module.exports = app; 