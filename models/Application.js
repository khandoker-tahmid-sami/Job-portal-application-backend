// const { DataTypes } = require('sequelize');
// const sequelize = require('../config/database');

// const Application = sequelize.define('Application', {
//     id: {
//         type: DataTypes.UUID,
//         defaultValue: DataTypes.UUIDV4,
//         primaryKey: true
//     },
//     jobId: {
//         type: DataTypes.UUID,
//         allowNull: false
//     },
//     userId: {
//         type: DataTypes.UUID,
//         allowNull: false
//     },
//     status: {
//         type: DataTypes.ENUM('New', 'Shortlisted', 'Interviewed', 'Rejected', 'Hired'),
//         defaultValue: 'New'
//     },
//     coverLetter: {
//         type: DataTypes.TEXT
//     },
//     resumeUrl: {
//         type: DataTypes.STRING // Snapshot of resume at time of application
//     }
// }, {
//     timestamps: true
// });

// module.exports = Application;

const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["New", "Shortlisted", "Interviewed", "Rejected", "Hired"],
      default: "New",
    },
    coverLetter: String,
    resumeUrl: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Application", applicationSchema);
