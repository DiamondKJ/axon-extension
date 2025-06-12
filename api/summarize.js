export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Received summarization request');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('API key not configured');
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const { prompt } = req.body;
    
    if (!prompt || !prompt.trim()) {
      console.error('Empty prompt received');
      return res.status(400).json({ error: 'Empty prompt received' });
    }

    console.log('Prompt length:', prompt.length);
    console.log('First 100 chars of prompt:', prompt.substring(0, 100));

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();
    console.log('Received response from Google API');
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('Error from Google API:', data);
      return res.status(response.status).json({
        error: 'Failed to summarize',
        details: data
      });
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error('Invalid response format:', data);
      return res.status(500).json({
        error: 'Invalid response format from Google API',
        details: data
      });
    }

    const summary = data.candidates[0].content.parts[0].text;
    console.log('Generated summary length:', summary.length);
    console.log('First 100 chars of summary:', summary.substring(0, 100));

    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /api/summarize:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to summarize',
      details: error.response?.data || { error: error.message }
    });
  }
} 