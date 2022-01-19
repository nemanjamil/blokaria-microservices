const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
	walletQrId: { type: String, index: true, required: true }, // unique: true
	walletDesc: { type: String },
	userFullname: { type: String },
	userEmail: { type: String },
	qrCodeRedeemStatus: { type: Number },
	transactionId: { type: String },
	usedAddress: { type: String },
	createdAt: { type: Date, default: Date.now, index: true },
	clientMessage: { type: String },
	clientName: { type: String },
});

module.exports = mongoose.model("Wallet", walletSchema);
