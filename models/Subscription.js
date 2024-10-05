const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({
	fistName: { type: String },
	lastName: { type: String },
	userEmail: { type: String, index: true, required: true, unique: true }
});

module.exports = mongoose.model("Subscription", emailSchema);
