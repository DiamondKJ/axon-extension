const { createOrGetUser, updateUserUsage, updateUserStatus, getUserDetails } = require('./db');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { action, userId } = JSON.parse(event.body);

        if (!userId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'User ID is required' })
            };
        }

        let result;

        switch (action) {
            case 'getUser':
                result = await getUserDetails(userId);
                break;

            case 'createUser':
                result = await createOrGetUser(userId);
                break;

            case 'updateUsage':
                result = await updateUserUsage(userId);
                break;

            case 'updateStatus':
                const { newStatus } = JSON.parse(event.body);
                if (!newStatus || !['free', 'pro'].includes(newStatus)) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Invalid status' })
                    };
                }
                result = await updateUserStatus(userId, newStatus);
                break;

            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Error in user management:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 