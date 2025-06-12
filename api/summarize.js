// api/summarize.js
// This is a dummy comment to force a new Vercel deployment.
export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log('Summarize API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body; // Assuming prompt is sent directly in body
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('GEMINI_API_KEY not found in environment');
      return res.status(500).json({ 
        error: 'API key not configured' 
      });
    }

    if (!prompt || !prompt.trim()) {
      console.error('Empty prompt received');
      return res.status(400).json({ error: 'Empty prompt received' });
    }

    console.log('Prompt length:', prompt.length);
    console.log('First 100 chars of prompt:', prompt.substring(0, 100));
    console.log('Making request to Gemini API...');

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
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.log('Gemini API error:', data);
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

    console.log('Gemini API success');
    res.status(200).json({ summary: summary }); // Send only the summary text back
  } catch (error) {
    console.log('Server error:', error.message);
    res.status(500).json({ 
      error: 'Failed to summarize', 
      details: error.message 
    });
  }
} 