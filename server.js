const express = require('express');
const axios = require('axios');
const app = express();

// Your API key (store this securely, e.g., as an environment variable)
const API_KEY = process.env.YOUR_API_KEY; // Replace with your actual API key

app.use(express.json());

// Proxy endpoint for summarization
app.post('/api/summarize', async (req, res) => {
  try {
    const response = await axios.post('https://api.example.com/summarize', req.body, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

// Export the Express app for Vercel
module.exports = app; 