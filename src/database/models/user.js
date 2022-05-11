const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  email: {
    type: String,
  },
  displayName: {
    type: String,
  },
  accountId: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const userModal = mongoose.model("Users", userSchema);

module.exports = userModal;
