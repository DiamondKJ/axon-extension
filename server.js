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
  try {
    console.log('Received summarization request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Validate request body
    if (!req.body || !req.body.prompt) {
      console.error('Missing prompt in request body');
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    const prompt = req.body.prompt;
    if (!prompt.trim()) {
      console.error('Empty prompt received');
      return res.status(400).json({ error: 'Empty prompt received' });
    }

    console.log('Prompt length:', prompt.length);
    console.log('First 100 chars of prompt:', prompt.substring(0, 100));

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
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
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

    console.log('Sending request to Gemini API with body:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Received response from Google API');
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
      console.error('Invalid response format:', response.data);
      throw new Error('Invalid response format from Google API');
    }

    const summary = response.data.candidates[0].content.parts[0].text;
    console.log('Generated summary length:', summary.length);
    console.log('First 100 chars of summary:', summary.substring(0, 100));

    res.json(response.data);
  } catch (error) {
    console.error('Error in /api/summarize:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to summarize',
      details: error.response?.data || { error: error.message }
    });
  }
});

// Export the Express app for Vercel
module.exports = app; 