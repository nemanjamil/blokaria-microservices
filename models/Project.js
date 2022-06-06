const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const projectSchema = new mongoose.Schema({
	projectName: { type: String, required: true },
	projectDesc: { type: String },
	date: { type: Date, default: Date.now },
	_wallets: [
		{
			type: ObjectId,
			ref: "Wallet",
		},
	],
	_user: [
		{
			type: ObjectId,
			ref: "User",
			required: true,
		},
	],
});

module.exports = mongoose.model("Project", projectSchema);
