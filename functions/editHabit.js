const mongoose = require('mongoose');

const HabitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  completedDates: [{ type: Date }],
  startDate: { type: Date, default: Date.now },
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
  if (event.httpMethod !== 'PUT') {
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
  const idMatch = event.path.match(/editHabit\/?([^\/]+)?$/);
  const habitId = idMatch && idMatch[1];
  if (!habitId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Habit ID is required in the path' }),
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
    const updatedHabit = await Habit.findByIdAndUpdate(
      habitId,
      { name, description },
      { new: true }
    );
    if (!updatedHabit) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Habit not found' }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Habit updated', habit: updatedHabit }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
