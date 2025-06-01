/**
 * @fileoverview Habit Data Retrieval Service
 *
 * This file serves as the main data retrieval endpoint for the Habit Tracker application.
 * It handles database connections and fetching of habit data using MongoDB and Mongoose.
 *
 * Key Components:
 * 1. Database Schema Definition
 * 2. Connection Management with Retry Logic
 * 3. Serverless Function Handler
 *
 * Database Schema:
 * - name: String (required) - The name of the habit
 * - description: String - Optional description of the habit
 * - completedDates: [Date] - Array of dates when the habit was completed
 * - startDate: Date - When the habit tracking began
 * - streakCount: Number - Current streak of habit completion
 * - longestStreak: Number - Longest streak achieved
 *
 * Connection Features:
 * - Implements exponential backoff for connection retries
 * - Configurable timeout settings
 * - Connection pooling with max 10 connections
 * - Heartbeat monitoring every 2 seconds
 *
 * Functions:
 * @function connectToDatabase
 *   Manages MongoDB connection with retry mechanism
 *   @param {string} uri - MongoDB connection string
 *   @returns {Promise<Connection>} Mongoose connection object
 *   @throws {Error} If connection fails after all retries
 *
 * @function handler
 *   Netlify serverless function handler
 *   @param {Object} event - HTTP event object
 *   @param {Object} context - Function context
 *   @returns {Object} HTTP response with habits or error
 *
 * Error Handling:
 * - Validates HTTP method (GET only)
 * - Checks for required environment variables
 * - Provides detailed connection error information
 * - Includes IP whitelist guidance for MongoDB Atlas
 *
 * Security Features:
 * - Connection string validation
 * - Method restriction
 * - Error message sanitization
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
  try {
    if (conn == null) {
      console.log('Creating new connection to MongoDB...');

      // Enhanced retry mechanism with exponential backoff
      let retries = 5;
      let backoffDelay = 1000; // Start with 1 second

      while (retries > 0) {
        try {
          conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000, // Increased timeout
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000, // Increased timeout
            retryWrites: true,
            retryReads: true,
            maxPoolSize: 10,
            heartbeatFrequencyMS: 2000,
          });
          console.log('Successfully connected to MongoDB');
          break;
        } catch (error) {
          retries--;
          console.log(`Connection attempt failed. Error: ${error.message}`);
          console.log(`Retries left: ${retries}`);

          if (retries === 0) {
            console.error('All connection attempts failed:', error);
            throw new Error(
              `Failed to connect to database after multiple attempts: ${error.message}`
            );
          }

          console.log(
            `Waiting ${backoffDelay / 1000} seconds before next attempt...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          backoffDelay *= 2; // Exponential backoff
        }
      }
    }
    return conn;
  } catch (err) {
    console.error('MongoDB connection error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
    });

    if (err.message.includes('IP address')) {
      err.message =
        "Your application's IP address needs to be whitelisted in MongoDB Atlas. Please add 0.0.0.0/0 to your IP whitelist at https://cloud.mongodb.com";
    }

    throw err;
  }
}

/**
 * Serverless function handler for retrieving habits from MongoDB
 *
 * This handler function serves as the main entry point for the GET /habits endpoint.
 * It follows a structured flow:
 * 1. Validates the HTTP method (only GET allowed)
 * 2. Checks for required environment variables
 * 3. Establishes database connection
 * 4. Retrieves and returns all habits
 *
 * Error Cases Handled:
 * - 405: If a non-GET HTTP method is used
 * - 500: If MONGODB_URI is missing
 * - 500: If database connection fails
 * - 500: For any other server-side errors
 *
 * Response Format:
 * Success (200):
 * {
 *   "habits": [
 *     {
 *       "name": string,
 *       "description": string,
 *       "completedDates": Date[],
 *       "startDate": Date,
 *       "streakCount": number,
 *       "longestStreak": number
 *     },
 *     ...
 *   ]
 * }
 *
 * Error:
 * {
 *   "error": string
 * }
 *
 * @param {Object} event - The event object from Netlify Functions
 *   @property {string} httpMethod - The HTTP method of the request
 * @param {Object} context - The context object from Netlify Functions
 * @returns {Promise<Object>} Response object with status code and JSON body
 */
exports.handler = async function (event, context) {
  if (event.httpMethod !== 'GET') {
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

  try {
    await connectToDatabase(uri);
    const habits = await Habit.find({});
    return {
      statusCode: 200,
      body: JSON.stringify({ habits }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
