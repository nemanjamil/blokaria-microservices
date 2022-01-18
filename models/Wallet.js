const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
	walletQrId: { type: String, unique: true, required: true },
	walletDesc: { type: String },
	userFullname: { type: String },
	userEmail: { type: String },
	qrCodeRedeemStatus: { type: Number },
});

module.exports = mongoose.model("Wallet", walletSchema);
