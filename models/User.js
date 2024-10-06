const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const userSchema = new mongoose.Schema({
	userEmail: { type: String, index: true, required: true, unique: true },
	userFullName: { type: String, required: true },
	firstName: { type: String },
	lastName: { type: String },
	clearPassword: { type: String, required: true },
	userPassword: { type: String, required: true },
	userVerified: { type: Number, required: true, default: 0 },
	userRole: { type: Number, required: true, default: 5 },
	date: { type: Date, default: Date.now },
	image: { type: String },
	numberOfTransaction: { type: Number, required: true, default: parseInt(process.env.NUMBER_OF_TRANSACTIONS) },
	numberOfCoupons: { type: Number, required: true, default: parseInt(process.env.NUMBER_OF_COUPONS) },
	_level: { type: ObjectId, ref: "Level" },
	accessibleAreas: [
		{
			type: ObjectId,
			ref: "Area"
		}
	],
	_wallets: [
		{
			type: ObjectId,
			ref: "Wallet"
		}
	],
	_projects: [
		{
			type: ObjectId,
			ref: "Project"
		}
	],
	_achievements: [
		{
			type: ObjectId,
			ref: "Achievement"
		}
	]
});
module.exports = mongoose.model("User", userSchema);
