// const { Sequelize } = require('sequelize');
// const path = require('path');

// const sequelize = new Sequelize({
//     dialect: 'sqlite',
//     storage: process.env.DB_STORAGE || './database.sqlite',
//     logging: false, // Set to console.log to see SQL queries
// });

// module.exports = sequelize;

const mongoose = require("mongoose");

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database Connection Successfull: ${conn.connection.host}`);
};

module.exports = connectDB;
