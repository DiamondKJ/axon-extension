const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Allow CORS for all origins, and for preflight OPTIONS requests
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    // Ensure it's a POST request for summarization
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const contentType = event.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
        console.error("Invalid Content-Type header:", contentType);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid Content-Type, expected application/json' })
        };
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY not configured");
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'GEMINI_API_KEY not configured on server' })
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        console.error("Error parsing request body:", e.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON body' })
        };
    }

    const { contents, generationConfig, safetySettings } = requestBody;

    // Handle warm-up requests
    if (contents?.[0]?.parts?.[0]?.text === "warmup") {
        console.log('Warm-up request received');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ status: 'warm', message: 'Function is ready' })
        };
    }

    if (!contents || !contents[0]?.parts?.[0]?.text) {
        console.error('Empty or invalid contents received', requestBody);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Empty or invalid contents received' })
        };
    }

    try {
        console.log('Making request to Gemini API...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, generationConfig, safetySettings })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', data);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({ error: 'Failed to summarize', details: data })
            };
        }

        console.log('Gemini API success');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Server error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to summarize', details: error.message })
        };
    }
}; 