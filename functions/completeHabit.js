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

function calculateStreak(dates, isCurrentStreak = false) {
  if (!dates || dates.length === 0) return 0;

  // Sort dates in descending order for current streak calculation
  const sortedDates = dates
    .map(d => new Date(d))
    .sort((a, b) => isCurrentStreak ? b - a : a - b);

  let currentStreak = 1;
  let maxStreak = 1;
  
  // For current streak, check if the most recent date is today or yesterday
  if (isCurrentStreak) {
    const mostRecent = sortedDates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffFromToday = Math.round((today - mostRecent) / (1000 * 60 * 60 * 24));
    
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

    // Calculate longest streak from all dates
    habit.longestStreak = calculateStreak(habit.completedDates, false);

    // Calculate current streak considering all dates
    habit.streakCount = calculateStreak(habit.completedDates, true);

    const updatedHabit = await habit.save();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Habit marked as complete',
        habit: updatedHabit,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
