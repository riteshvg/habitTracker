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
