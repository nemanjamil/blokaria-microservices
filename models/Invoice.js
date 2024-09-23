const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const InvoiceStatus = {
	CREATED: "created",
	COMPLETED: "completed",
	FAILED: "failed",
	EXPIRED: "expired"
};

const invoiceSchema = new mongoose.Schema(
	{
		status: { type: String, default: InvoiceStatus.CREATED },
		amount: { type: Number, required: true },
		invoiceId: { type: String, required: true },
		donatorEmail: { type: String, lowercase: true, trim: true },
		showInDonations: { type: Boolean, default: false },
		paymentSource: {
			type: String,
			required: true,
			enum: ["paypal", "stripe"]
		},
		paymentType: {
			type: String,
			required: true,
			enum: ["purchase", "donation"]
		},
		payer: {
			type: ObjectId,
			ref: "User",
			required: false,
			default: null
		},
		area: {
			type: ObjectId,
			ref: "Area",
			required: false,
			default: null
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);

module.exports.InvoiceStatus = InvoiceStatus;
