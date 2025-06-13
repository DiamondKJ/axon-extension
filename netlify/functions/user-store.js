// Constants
const FREE_TIER_LIMIT = 20; // Number of free summaries per month

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
                // Get user data from KV store
                const userData = await context.client.kv.get(userId);
                result = userData || { status: 'free', usageCount: 0 };
                break;

            case 'createUser':
                // Create new user with default values
                const newUser = { status: 'free', usageCount: 0 };
                await context.client.kv.set(userId, newUser);
                result = newUser;
                break;

            case 'updateUsage':
                // Get current user data
                const currentUser = await context.client.kv.get(userId) || { status: 'free', usageCount: 0 };
                
                // Check if user is free tier and has reached limit
                if (currentUser.status === 'free' && currentUser.usageCount >= FREE_TIER_LIMIT) {
                    return {
                        statusCode: 403,
                        body: JSON.stringify({ 
                            error: 'Free tier limit reached',
                            limit: FREE_TIER_LIMIT,
                            current: currentUser.usageCount
                        })
                    };
                }

                // Update usage count
                currentUser.usageCount += 1;
                await context.client.kv.set(userId, currentUser);
                result = currentUser;
                break;

            case 'updateStatus':
                const { newStatus } = JSON.parse(event.body);
                if (!newStatus || !['free', 'pro'].includes(newStatus)) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'Invalid status' })
                    };
                }

                const user = await context.client.kv.get(userId) || { status: 'free', usageCount: 0 };
                user.status = newStatus;
                await context.client.kv.set(userId, user);
                result = user;
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
        console.error('Error in user store:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 