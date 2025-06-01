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
