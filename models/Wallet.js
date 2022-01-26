const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
	walletQrId: { type: String, index: true, required: true }, // unique: true
	userDesc: { type: String },
	userFullname: { type: String },
	userEmail: { type: String },
	productName: { type: String },
	qrCodeRedeemStatus: { type: Number, required: true, default: 0 },
	transactionId: { type: String },
	usedAddress: { type: String },
	createdAt: { type: Date, default: Date.now, index: true },
	clientMessage: { type: String },
	clientName: { type: String },
	clientEmail: { type: String },
	metaDataRandomNumber: { type: Number },
	productPicture: { type: String },
	productVideo: { type: String },
});

module.exports = mongoose.model("Wallet", walletSchema);
