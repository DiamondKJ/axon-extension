const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/summarize', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const { contents, generationConfig, safetySettings } = req.body;
  if (!contents || !contents[0]?.parts?.[0]?.text) {
    return res.status(400).json({ error: 'Empty or invalid contents received' });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig, safetySettings })
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to summarize', details: data });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to summarize', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Axon AI backend is running.');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 