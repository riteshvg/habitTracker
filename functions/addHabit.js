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
    conn = mongoose.connect(uri);
    await conn;
  }
  return conn;
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

  try {
    await connectToDatabase(uri);
    const data = JSON.parse(event.body);
    const { name, description } = data;
    if (!name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Habit name is required' }),
      };
    }
    const habit = new Habit({
      name,
      description,
      startDate: new Date(),
    });
    const savedHabit = await habit.save();
    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Habit created', habit: savedHabit }),
    };
  } catch (error) {
    console.error(error); // Log the full error stack for debugging
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
