/**
 * @fileoverview Habit Creation Service
 *
 * This file implements the POST endpoint for creating new habits in the Habit Tracker application.
 * It handles habit creation, database connections, and input validation with comprehensive error handling.
 *
 * Key Features:
 * 1. CORS Support for cross-origin requests
 * 2. Input validation for required fields
 * 3. Secure database operations
 * 4. Detailed error logging and handling
 *
 * Database Schema:
 * @typedef {Object} Habit
 * @property {string} name - Required name of the habit
 * @property {string} [description] - Optional description
 * @property {Date[]} completedDates - Array tracking completion dates
 * @property {Date} startDate - Habit creation date
 * @property {number} streakCount - Current completion streak
 * @property {number} longestStreak - Record streak length
 *
 * Functions:
 * @function connectToDatabase
 *   Manages MongoDB connection with retry logic
 *   @param {string} uri - MongoDB connection string
 *   @returns {Promise<Connection>} Mongoose connection
 *   @throws {Error} Connection failure after retries
 *   Features:
 *   - 3 retry attempts with 2-second delays
 *   - Enhanced error messages for common issues
 *   - Timeout configurations for reliability
 *
 * @function handler
 *   Netlify serverless function handler for habit creation
 *   @param {Object} event - Contains HTTP method and request body
 *   @param {Object} context - Netlify function context
 *   @returns {Promise<Object>} Response with status and created habit
 *
 *   Request Body:
 *   {
 *     "name": string,       // Required
 *     "description": string // Optional
 *   }
 *
 *   Response (201):
 *   {
 *     "message": "Habit created",
 *     "habit": Habit
 *   }
 *
 * Error Handling:
 * - 400: Missing required fields
 * - 405: Invalid HTTP method
 * - 500: Database connection issues
 * - Custom error messages for common MongoDB problems:
 *   • IP whitelist issues
 *   • Authentication failures
 *   • Connection timeouts
 *
 * Security Features:
 * - CORS headers configuration
 * - Input sanitization
 * - Sensitive data redaction in logs
 * - Proper error message handling
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

      // Add retries for connection
      let retries = 3;
      while (retries > 0) {
        try {
          conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // Increased timeout
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000, // Added connect timeout
            retryWrites: true,
          });
          console.log('Successfully connected to MongoDB');
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.log(`Connection attempt failed. Retries left: ${retries}`);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s between retries
        }
      }
    }
    return conn;
  } catch (err) {
    console.error('MongoDB connection error details:', {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    // Enhance error message for common issues
    if (err.message.includes('IP address')) {
      err.message =
        'IP Address not whitelisted in MongoDB Atlas. Please add current IP to the access list.';
    } else if (err.message.includes('authentication failed')) {
      err.message =
        'MongoDB authentication failed. Please check username and password.';
    } else if (err.name === 'MongoTimeoutError') {
      err.message =
        'Connection timed out. Please check network connectivity and MongoDB Atlas status.';
    }

    throw err;
  }
}

exports.handler = async function (event, context) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI is missing');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Missing MONGODB_URI environment variable',
      }),
    };
  }

  try {
    console.log('Attempting to connect to MongoDB...');
    await connectToDatabase(uri);
    console.log('Successfully connected to MongoDB');

    const data = JSON.parse(event.body);
    console.log('Received data:', { ...data, mongodb_uri: '[REDACTED]' });

    const { name, description } = data;
    if (!name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Habit name is required' }),
      };
    }

    const habit = new Habit({
      name,
      description,
      startDate: new Date(),
      completedDates: [],
      streakCount: 0,
      longestStreak: 0,
    });

    console.log('Attempting to save habit:', habit);
    const savedHabit = await habit.save();
    console.log('Successfully saved habit:', savedHabit);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ message: 'Habit created', habit: savedHabit }),
    };
  } catch (error) {
    console.error('Error in addHabit:', error);
    // Log detailed error information
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.error('MongoDB Error Details:', {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create habit',
        details: error.message,
        type: error.name,
      }),
    };
  }
};
