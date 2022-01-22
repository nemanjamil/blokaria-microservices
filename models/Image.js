const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
	walletQrId: {
		type: String,
		unique: true,
		index: true,
		required: [true, "Missing Unique Id"],
	},
	productPicture: {
		type: String,
		required: [true, "Missing Picture Link"],
	},
});

module.exports = mongoose.model("Image", imageSchema);
