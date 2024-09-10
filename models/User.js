const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const userSchema = new mongoose.Schema({
	userEmail: { type: String, index: true, required: true, unique: true },
	userFullName: { type: String, required: true },
	clearPassword: { type: String, required: true },
	userPassword: { type: String, required: true },
	userVerified: { type: Number, required: true, default: 0 },
	userRole: { type: Number, required: true, default: 5 },
	date: { type: Date, default: Date.now },
	numberOfTransaction: { type: Number, required: true, default: parseInt(process.env.NUMBER_OF_TRANSACTIONS) },
	numberOfCoupons: { type: Number, required: true, default: parseInt(process.env.NUMBER_OF_COUPONS) },
	level: { type: String, default: null },
	planted_trees_count: { type: Number, default: 0 },
	accessibleAreas: [
		{
			type: ObjectId,
			ref: "Area",
		},
	],
	_wallets: [
		{
			type: ObjectId,
			ref: "Wallet",
		},
	],
	_projects: [
		{
			type: ObjectId,
			ref: "Project",
		},
	],
});

module.exports = mongoose.model("User", userSchema);
