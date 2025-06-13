const faunadb = require('faunadb');
const q = faunadb.query;

// Initialize FaunaDB client
const client = new faunadb.Client({
    secret: process.env.FAUNA_SECRET_KEY
});

// Collection name
const USERS_COLLECTION = 'users';

// Create the users collection if it doesn't exist
async function createUsersCollection() {
    try {
        // Check if collection exists
        await client.query(
            q.Get(q.Collection(USERS_COLLECTION))
        );
        console.log('Users collection already exists');
    } catch (error) {
        if (error.name === 'NotFound') {
            // Create collection if it doesn't exist
            await client.query(
                q.CreateCollection({ name: USERS_COLLECTION })
            );
            console.log('Created users collection');
        } else {
            throw error;
        }
    }
}

// Create or get user
async function createOrGetUser(userId) {
    try {
        // Try to get existing user
        const user = await client.query(
            q.Get(q.Match(q.Index('users_by_id'), userId))
        );
        return user.data;
    } catch (error) {
        if (error.name === 'NotFound') {
            // Create new user if not found
            const newUser = {
                userId,
                status: 'free',
                usageCount: 0,
                lastResetDate: new Date().toISOString()
            };

            await client.query(
                q.Create(q.Collection(USERS_COLLECTION), {
                    data: newUser
                })
            );

            // Create index for user lookup if it doesn't exist
            try {
                await client.query(
                    q.CreateIndex({
                        name: 'users_by_id',
                        source: q.Collection(USERS_COLLECTION),
                        terms: [{ field: ['data', 'userId'] }],
                        unique: true
                    })
                );
            } catch (indexError) {
                if (indexError.name !== 'AlreadyExists') {
                    throw indexError;
                }
            }

            return newUser;
        }
        throw error;
    }
}

// Update user usage
async function updateUserUsage(userId) {
    try {
        const user = await client.query(
            q.Get(q.Match(q.Index('users_by_id'), userId))
        );

        const currentDate = new Date();
        const lastResetDate = new Date(user.data.lastResetDate);
        
        // Check if we need to reset usage count (e.g., monthly)
        const shouldReset = currentDate.getMonth() !== lastResetDate.getMonth() ||
                          currentDate.getFullYear() !== lastResetDate.getFullYear();

        const updateData = {
            usageCount: shouldReset ? 1 : user.data.usageCount + 1,
            lastResetDate: shouldReset ? currentDate.toISOString() : user.data.lastResetDate
        };

        await client.query(
            q.Update(user.ref, {
                data: updateData
            })
        );

        return {
            ...user.data,
            ...updateData
        };
    } catch (error) {
        throw error;
    }
}

// Update user status (e.g., upgrade to pro)
async function updateUserStatus(userId, newStatus) {
    try {
        const user = await client.query(
            q.Get(q.Match(q.Index('users_by_id'), userId))
        );

        await client.query(
            q.Update(user.ref, {
                data: {
                    ...user.data,
                    status: newStatus
                }
            })
        );

        return {
            ...user.data,
            status: newStatus
        };
    } catch (error) {
        throw error;
    }
}

// Get user details
async function getUserDetails(userId) {
    try {
        const user = await client.query(
            q.Get(q.Match(q.Index('users_by_id'), userId))
        );
        return user.data;
    } catch (error) {
        if (error.name === 'NotFound') {
            return null;
        }
        throw error;
    }
}

module.exports = {
    createUsersCollection,
    createOrGetUser,
    updateUserUsage,
    updateUserStatus,
    getUserDetails
}; 