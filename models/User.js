const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	userEmail: { type: String, index: true, required: true, unique: true },
	userFullName: { type: String, required: true },
	clearPassword: { type: String, required: true },
	userPassword: { type: String, required: true },
	userVerified: { type: Number, required: true, default: 1 },
	date: { type: Date, default: Date.now },
	numberOfTransaction: { type: Number, required: true, default: parseInt(process.env.NUMBER_OF_TRANSACTIONS) },
});

module.exports = mongoose.model("User", userSchema);
