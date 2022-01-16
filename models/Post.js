const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
	miki: {
		type: String,
		//unique: true,
	},
});

module.exports = mongoose.model("Post", walletSchema);
