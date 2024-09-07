const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
const walletSchema = new mongoose.Schema({
	walletQrId: { type: String, index: true, required: true }, // unique: true
	geoLocation: { type: String },
	userFullname: { type: String },
	userEmail: { type: String },
	productName: { type: String },
	qrCodeRedeemStatus: { type: Number, required: true, default: 0 },
	nftRedeemStatus: { type: Boolean, required: true, default: false },
	transactionId: { type: String },
	usedAddress: { type: String },
	createdAt: { type: Date, default: Date.now, index: true },
	clientMessage: { type: String },
	clientName: { type: String },
	clientEmail: { type: String, default: "" },
	metaDataRandomNumber: { type: Number },
	productPicture: { type: String },
	productVideo: { type: String },
	contributorData: { type: String, default: null },
	publicQrCode: { type: Boolean, default: true },
	costOfProduct: { type: Number, default: 0 },
	accessCode: { type: String, required: true },

	cbnftimage: { type: Boolean, default: false },
	nftimage: { type: String, default: "" },
	nftsendaddress: { type: String },

	clientemailcb: { type: Boolean, default: true },
	ownernamecb: { type: Boolean, default: true },

	nftSenderWalletName: { type: String },
	nftReceiverAddressWallet: { type: String },
	nftAssetId: { type: String },
	nftMintTxHash: { type: String },
	nftAssetToWalletTxHash: { type: String },
	longText: { type: String },
	hasstory: { type: Boolean, default: false },
	area: {
		type: String,
		required: true,
		default: null,
	},
	_creator: {
		type: ObjectId,
		required: true,
		ref: "User",
	},
	_image: [
		{
			type: ObjectId,
			ref: "Image",
		},
	],
	_nfts: [
		{
			type: ObjectId,
			ref: "Nftcardano",
		},
	],
	_project: {
		type: ObjectId,
		ref: "Project",
	},
});

// const normalizeUnderscoreMiddleware = function (next) {
// 	if (Array.isArray(this)) {
// 		// If multiple documents are returned
// 		this.forEach((doc) => {
// 			console.log("normalizing underscore for doc:", doc);
// 			Object.keys(doc).forEach((key) => {
// 				if (key.startsWith("_")) {
// 					console.log("normalizing", key, "field");
// 					doc[key] = JSON.parse(JSON.stringify(Object.assign({}, doc)[key]));
// 				}
// 			});
// 		});
// 	} else if (this) {
// 		// If a single document is returned
// 		console.log("normalizing underscore for doc(this):", this);
// 		Object.keys(this).forEach((key) => {
// 			if (key.startsWith("_")) {
// 				console.log("normalizing", key, "field");
// 				this[key] = JSON.parse(JSON.stringify(Object.assign({}, this)[key]));
// 			}
// 		});
// 	}
// 	next();
// };

// Apply the middleware to various query methods
// walletSchema.post("find", function (docs, next) {
// 	if (!docs || docs.length === 0) {
// 		next();
// 		return;
// 	}

// 	docs.forEach((doc) => normalizeUnderscoreMiddleware.call(doc, next));
// });

// walletSchema.post("findOne", function (doc, next) {
// 	normalizeUnderscoreMiddleware.call(doc, next);
// });

// walletSchema.post("findOneAndUpdate", function (doc, next) {
// 	normalizeUnderscoreMiddleware.call(doc, next);
// });

// walletSchema.post("findById", function (doc, next) {
// 	normalizeUnderscoreMiddleware.call(doc, next);
// });

module.exports = mongoose.model("Wallet", walletSchema);
