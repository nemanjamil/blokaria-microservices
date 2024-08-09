const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const InvoiceStatus = {
	INITIALIZED: "initialized",
	CREATED: "created",
	COMPLETED: "completed",
	FAILED: "failed",
	EXPIRED: "expired",
};

const invoiceSchema = new mongoose.Schema(
	{
		status: { type: String, default: InvoiceStatus.INITIALIZED },
		amount: { type: Number, required: true },
		invoiceId: { type: String, required: true },
		payer: {
			type: ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);

module.exports.InvoiceStatus = InvoiceStatus;
