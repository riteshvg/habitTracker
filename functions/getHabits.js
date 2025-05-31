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
