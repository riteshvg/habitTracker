/**
 * @fileoverview Habit Deletion Service
 *
 * This file implements the DELETE endpoint for removing habits from the tracking system.
 * It provides a clean way to remove habits that users no longer want to track while
 * maintaining database integrity.
 *
 * Key Features:
 * 1. Permanent habit deletion
 * 2. ID-based deletion
 * 3. Path parameter validation
 * 4. Safe database operations
 *
 * Database Schema:
 * @typedef {Object} Habit
 * @property {string} name - Name of the habit to be deleted
 * @property {string} description - Habit description
 * @property {Date[]} completedDates - Historical completion records
 * @property {Date} startDate - When tracking began
 * @property {number} streakCount - Current streak at deletion
 * @property {number} longestStreak - Best streak achieved
 *
 * Functions:
 * @function connectToDatabase
 *   Simple database connection manager
 *   @param {string} uri - MongoDB connection string
 *   @returns {Promise<Connection>} Mongoose connection
 *   Features:
 *   - Connection reuse
 *   - Basic MongoDB configuration
 *   - Unified topology support
 *
 * @function handler
 *   Netlify serverless function handler for habit deletion
 *   @param {Object} event - Contains HTTP method and path parameters
 *   @param {Object} context - Netlify function context
 *   @returns {Promise<Object>} Response with deletion status
 *
 *   URL Format:
 *   DELETE /deleteHabit/{habitId}
 *
 *   Response Formats:
 *   Success (200):
 *   {
 *     "message": "Habit deleted",
 *     "habit": {deleted habit object}
 *   }
 *
 * Error Handling:
 * - 400: Missing or invalid habit ID
 * - 404: Habit not found
 * - 405: Invalid HTTP method
 * - 500: Database connection/operation errors
 *
 * Security Considerations:
 * 1. Validates habit existence before deletion
 * 2. Uses findByIdAndDelete for atomic operation
 * 3. Proper error handling for missing resources
 * 4. Environment variable validation
 */

const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  completedDates: [{ type: Date }],
  startDate: { type: Date, default: Date.now },
  streakCount: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
});

const Habit = mongoose.models.Habit || mongoose.model('Habit', HabitSchema);

let conn = null;

async function connectToDatabase(uri) {
  if (conn == null) {
    conn = mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await conn;
  }
  return conn;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Missing MONGODB_URI environment variable',
      }),
    };
  }

  // Extract habit ID from path
  const idMatch = event.path.match(/deleteHabit\/?([^\/]+)?$/);
  const habitId = idMatch && idMatch[1];
  if (!habitId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Habit ID is required in the path' }),
    };
  }

  try {
    await connectToDatabase(uri);
    const deletedHabit = await Habit.findByIdAndDelete(habitId);
    if (!deletedHabit) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Habit not found' }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Habit deleted', habit: deletedHabit }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
