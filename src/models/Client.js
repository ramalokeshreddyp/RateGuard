const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    hashedApiKey: {
      type: String,
      required: true
    },
    apiKeyFingerprint: {
      type: String,
      required: true,
      unique: true
    },
    maxRequests: {
      type: Number,
      required: true,
      min: 1
    },
    windowSeconds: {
      type: Number,
      required: true,
      min: 1
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model('Client', clientSchema);
