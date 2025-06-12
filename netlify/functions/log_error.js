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

    try {
        const errorData = JSON.parse(event.body);
        console.error("--- Extension Error Report ---");
        console.error("Context:", errorData.context);
        console.error("Message:", errorData.message);
        console.error("Stack:", errorData.stack);
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