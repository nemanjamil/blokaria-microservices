const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
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
	contributorData: { type: String, default: null },
	publicQrCode: { type: Boolean, default: true },
	costOfProduct: { type: Number, default: 0 },
	accessCode: { type: String, required: true },

	cbnftimage: { type: Boolean, default: false },
	nftimage: { type: String, default: null },
	nftsendaddress: { type: String },

	clientemailcb: { type: Boolean, default: true },
	ownernamecb: { type: Boolean, default: true },

	nftSenderWalletName: { type: String },
	nftReceiverAddressWallet: { type: String },
	nftAssetId: { type: String },
	nftMintTxHash: { type: String },
	nftAssetToWalletTxHash: { type: String },
	_creator: {
		type: ObjectId,
		ref: "User"
	},
	_image: [{
		type: ObjectId,
		ref: "Image"
	}],
	_nfts: [{
		type: ObjectId,
		ref: "Nftcardano"
	}],
	_project: {
		type: ObjectId,
		ref: "Project"
	}
});


module.exports = mongoose.model("Wallet", walletSchema);
