const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const walletSchema = new mongoose.Schema({
    walletQrId: { type: String, index: true, required: true }, // unique: true
    transactionId: { type: String },
    productName: { type: String },
    qrCodeRedeemStatus: { type: Number, required: true, default: 0 },
    _creator: {
        type: ObjectId,
        ref: "User"
    },
    // _image: [{
    //     type: ObjectId,
    //     ref: "Image"
    // }],
    createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("Nftcardano", walletSchema);
