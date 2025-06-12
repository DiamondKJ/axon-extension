// api/summarize.js
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
    // Your extension sends the full Gemini API format
    const { contents, generationConfig, safetySettings } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('GEMINI_API_KEY not found in environment');
      return res.status(500).json({ 
        error: 'API key not configured' 
      });
    }

    if (!contents || !contents[0]?.parts?.[0]?.text) {
      console.error('Empty or invalid contents received');
      return res.status(400).json({ error: 'Empty or invalid contents received' });
    }

    const prompt = contents[0].parts[0].text;
    console.log('Prompt length:', prompt.length);
    console.log('First 100 chars of prompt:', prompt.substring(0, 100));
    console.log('Making request to Gemini API...');

    const requestBody = {
      contents,
      generationConfig,
      safetySettings
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

    console.log('Gemini API success');
    // Return the full response format that your extension expects
    res.status(200).json(data);
  } catch (error) {
    console.log('Server error:', error.message);
    res.status(500).json({ 
      error: 'Failed to summarize', 
      details: error.message 
    });
  }
}