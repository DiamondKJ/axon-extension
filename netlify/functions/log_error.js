exports.handler = async (event, context) => {
    // Allow CORS for all origins (important for accepting logs from extension)
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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const contentType = event.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
        console.error("Invalid Content-Type header for error log:", contentType);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid Content-Type, expected application/json for error log' })
        };
    }

    try {
        const errorData = JSON.parse(event.body);
        
        // Validate structure of errorData
        if (!errorData || typeof errorData.context === 'undefined' || typeof errorData.message === 'undefined') {
            console.error("Invalid error log payload structure:", errorData);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid error log payload structure, missing context or message' })
            };
        }

        console.error("--- Extension Error Report ---");
        console.error("Context:", errorData.context);
        console.error("Message:", errorData.message);
        console.error("Stack:", errorData.stack || 'No stack provided'); // Stack is optional
        console.error("Timestamp:", new Date().toISOString());
        console.error("------------------------------");

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Error logged successfully' })
        };
    } catch (e) {
        console.error("Failed to parse error log payload:", e);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid error log payload' })
        };
    }
}; 