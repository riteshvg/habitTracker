/**
 * @fileoverview Habit Completion Service
 *
 * This file implements the POST endpoint for marking habits as complete/incomplete
 * and managing streak calculations. It supports both single-date and bulk-date operations
 * with comprehensive streak tracking.
 *
 * Key Features:
 * 1. Toggle habit completion status
 * 2. Bulk date completion
 * 3. Automatic streak calculation
 * 4. Duplicate date prevention
 *
 * Database Schema:
 * @typedef {Object} Habit
 * @property {string} name - Name of the habit
 * @property {string} description - Optional description
 * @property {Date[]} completedDates - Array of completion dates
 * @property {Date} startDate - Habit creation date
 * @property {number} streakCount - Current streak
 * @property {number} longestStreak - Longest achieved streak
 *
 * Functions:
 * @function connectToDatabase
 *   Manages MongoDB connection for habit operations
 *   @param {string} uri - MongoDB connection string
 *   @returns {Promise<Connection>} Mongoose connection
 *   Features:
 *   - Connection pooling
 *   - 5s server selection timeout
 *   - 45s socket timeout for operations
 *
 * @function calculateStreak
 *   Calculates habit completion streaks
 *   @param {Date[]} dates - Array of completion dates
 *   @param {boolean} isCurrentStreak - If true, calculates current streak; if false, longest streak
 *   @returns {number} Length of the streak
 *   Features:
 *   - Handles date gaps
 *   - Considers today/yesterday for current streaks
 *   - Supports both current and longest streak calculations
 *
 * @function handler
 *   Netlify serverless function handler for habit completion
 *   @param {Object} event - Contains HTTP method, path params, and request body
 *   @param {Object} context - Netlify function context
 *   @returns {Promise<Object>} Response with updated habit
 *
 *   Request Body Formats:
 *   Single Date:
 *   {
 *     "date": "YYYY-MM-DD" // Optional, defaults to current date
 *   }
 *
 *   Bulk Dates:
 *   {
 *     "dates": ["YYYY-MM-DD", ...] // Array of dates to mark as complete
 *   }
 *
 * Error Handling:
 * - 400: Invalid/missing habit ID
 * - 404: Habit not found
 * - 405: Invalid HTTP method
 * - 500: Database connection/operation errors
 *
 * Streak Calculation Rules:
 * 1. Current streak breaks if no completion for more than one day
 * 2. Streak increases only with consecutive days
 * 3. Longest streak tracks the best historical performance
 * 4. Duplicate dates are automatically filtered
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
      conn = await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s
        socketTimeoutMS: 45000, // Close sockets after 45s
      });
      console.log('Successfully connected to MongoDB');
    }
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

function calculateStreak(dates, isCurrentStreak = false) {
  if (!dates || dates.length === 0) return 0;

  // Sort dates in descending order for current streak calculation
  const sortedDates = dates
    .map((d) => new Date(d))
    .sort((a, b) => (isCurrentStreak ? b - a : a - b));

  let currentStreak = 1;
  let maxStreak = 1;

  // For current streak, check if the most recent date is today or yesterday
  if (isCurrentStreak) {
    const mostRecent = sortedDates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffFromToday = Math.round(
      (today - mostRecent) / (1000 * 60 * 60 * 24)
    );

    if (diffFromToday > 1) {
      return 0; // Streak broken if most recent completion was before yesterday
    }
  }

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);

    // Check if dates are consecutive
    const diffInDays = Math.round(
      Math.abs(currDate - prevDate) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      if (!isCurrentStreak) {
        maxStreak = Math.max(maxStreak, currentStreak);
      }
      currentStreak = 1;
    }
  }

  return isCurrentStreak ? currentStreak : maxStreak;
}

/**
 * Generates an affirmation message based on streak length
 * @param {number} streakCount - Current streak length
 * @param {string} habitName - Name of the habit
 * @returns {string|null} Affirmation message or null if no milestone reached
 */
function generateAffirmation(streakCount, habitName) {
  const milestones = [
    {
      days: 30,
      message:
        "🌟 Incredible achievement! You've maintained ${habitName} for a whole month! This is now part of your lifestyle!",
    },
    {
      days: 20,
      message:
        "🔥 Outstanding! 20 days of ${habitName}! You're building a powerful habit!",
    },
    {
      days: 15,
      message:
        '⭐ Amazing consistency with ${habitName} for 15 days! Keep this momentum going!',
    },
    {
      days: 5,
      message:
        '🎯 Great job! 5 days of ${habitName} shows your commitment to growth!',
    },
    {
      days: 1,
      message:
        '🌱 Excellent start with ${habitName}! The journey of a thousand miles begins with a single step!',
    },
  ];

  for (const milestone of milestones) {
    if (streakCount === milestone.days) {
      return milestone.message.replace('${habitName}', habitName);
    }
  }
  return null;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
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
  const idMatch = event.path.match(/completeHabit\/?([^\/]+)?$/);
  const habitId = idMatch && idMatch[1];
  if (!habitId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Habit ID is required in the path' }),
    };
  }

  try {
    await connectToDatabase(uri);
    const habit = await Habit.findById(habitId);
    if (!habit) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Habit not found' }),
      };
    }

    const data = event.body ? JSON.parse(event.body) : {};

    // Handle bulk dates
    if (data.dates && Array.isArray(data.dates)) {
      // Convert string dates to Date objects and filter out duplicates
      const newDates = data.dates.map((date) => new Date(date));
      const existingDatesStr = habit.completedDates.map(
        (d) => d.toISOString().split('T')[0]
      );

      // Add only unique dates
      newDates.forEach((date) => {
        const dateStr = date.toISOString().split('T')[0];
        if (!existingDatesStr.includes(dateStr)) {
          habit.completedDates.push(date);
        }
      });
    } else {
      // Handle single date
      const targetDate = data.date ? new Date(data.date) : new Date();

      // Check if the date already exists in completedDates
      const existingDate = habit.completedDates.find(
        (date) =>
          date.toISOString().split('T')[0] ===
          targetDate.toISOString().split('T')[0]
      );

      if (existingDate) {
        // If date exists, remove it (unchecking the box)
        habit.completedDates = habit.completedDates.filter(
          (date) =>
            date.toISOString().split('T')[0] !==
            targetDate.toISOString().split('T')[0]
        );
      } else {
        // If date doesn't exist, add it (checking the box)
        habit.completedDates.push(targetDate);
      }
    }

    // Sort completedDates to ensure proper streak calculation
    habit.completedDates.sort((a, b) => a - b);

    // Calculate longest streak from all dates
    habit.longestStreak = calculateStreak(habit.completedDates, false);

    // Calculate current streak considering all dates
    habit.streakCount = calculateStreak(habit.completedDates, true);

    // Generate affirmation if a milestone is reached
    const affirmation = generateAffirmation(habit.streakCount, habit.name);

    const updatedHabit = await habit.save();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Habit marked as complete',
        habit: updatedHabit,
        affirmation: affirmation,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
