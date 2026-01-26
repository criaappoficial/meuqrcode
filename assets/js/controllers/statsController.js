import { db } from '../core/firebase.js';
import { doc, setDoc, updateDoc, increment, getDocs, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const StatsController = {
    /**
     * Logs a user action to the 'user_stats' collection.
     * @param {string} userId - The unique ID of the user.
     * @param {string} email - The email of the user (for identification).
     * @param {string} action - The action type: 'created', 'viewed', 'edited'.
     */
    async logAction(userId, email, action) {
        if (!userId) return;
        
        const statsRef = doc(db, 'user_stats', userId);
        const timestamp = new Date();

        try {
            // Attempt to update existing document
            await updateDoc(statsRef, {
                [action]: increment(1),
                lastActive: timestamp,
                email: email // Keep email updated
            });
            console.log(`Stats updated: ${action} for ${email}`);
        } catch (error) {
            // If document doesn't exist, create it (error code is usually 'not-found' but we catch generic)
            try {
                await setDoc(statsRef, {
                    email: email,
                    created: action === 'created' ? 1 : 0,
                    viewed: action === 'viewed' ? 1 : 0,
                    edited: action === 'edited' ? 1 : 0,
                    lastActive: timestamp,
                    joinedAt: timestamp
                });
                console.log(`Stats created: ${action} for ${email}`);
            } catch (createError) {
                console.error("Error creating stats:", createError);
            }
        }
    },

    /**
     * Retrieves all user statistics.
     * @returns {Promise<Array>} Array of user stats objects.
     */
    async getAllStats() {
        try {
            const querySnapshot = await getDocs(collection(db, "user_stats"));
            const stats = [];
            querySnapshot.forEach((doc) => {
                stats.push({ id: doc.id, ...doc.data() });
            });
            return stats;
        } catch (error) {
            console.error("Error getting stats:", error);
            return [];
        }
    }
};
