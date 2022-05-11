const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (process.env.NODE_ENV === "test") {
      const conn = await mongoose.connect(process.env.TEST_DATABASE, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`Testing db connected ${conn.connection.host}`);
      return conn;
    } else {
      const conn = await mongoose.connect(process.env.MONGO_CONNECT, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`Dev db connected ${conn.connection.host}`);
      return conn;
    }
  } catch (error) {
    process.exit(1);
  }
};

module.exports = connectDB;
