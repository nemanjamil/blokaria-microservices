"use strict";

const DbService = require("moleculer-db");
const { MoleculerError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Invoice = require("../models/Invoice");

const invoiceService = {
	name: "invoice",
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Invoice,
	actions: {
		getDonatorsList: {
			async handler(ctx) {
				try {
					const groupedInvoices = await Invoice.aggregate([
						// Filter to only include invoices with status "completed"
						{
							$match: { status: "completed" }
						},
						// Group by donatorEmail and count the number of invoices
						{
							$group: {
								_id: "$donatorEmail", // Group by donatorEmail
								totalInvoices: { $sum: 1 }, // Count the number of invoices
								invoices: { $push: "$$ROOT" }, // Push all invoice details to the array
								totalAmount: { $sum: "$amount" } // Sum the amount donated by the donator
							}
						},
						// Add a new field to pseudonymize donatorEmail
						{
							$addFields: {
								pseudonymizedEmail: {
									$cond: {
										if: { $gt: [{ $strLenBytes: "$_id" }, 3] }, // Check if email length is greater than 3
										then: {
											$concat: [
												{ $substr: ["$_id", 0, 3] }, // Keep first 3 characters of the email
												"****", // Mask the middle part
												{ $substr: ["$_id", { $indexOfBytes: ["$_id", "@"] }, -1] } // Show domain part
											]
										},
										else: "$_id" // If email is 3 characters or shorter, use it as is
									}
								}
							}
						},
						// Sort by the number of invoices in descending order
						{
							$sort: { totalInvoices: -1 }
						}
					]);

					// Map through the result and remove unnecessary fields
					return groupedInvoices.map((group) => ({
						pseudonymizedEmail: group.pseudonymizedEmail, // Keep pseudonymized email
						totalInvoices: group.totalInvoices, // Keep total invoice count
						totalAmount: group.totalAmount, // Keep total donation amount
						invoices: group.invoices.map((invoice) => ({
							// Remove fields: donatorEmail, invoiceId, _id from each invoice
							status: invoice.status
							//paymentSource: invoice.paymentSource,
							//paymentType: invoice.paymentType,
							//createdAt: invoice.createdAt,
							//updatedAt: invoice.updatedAt
						}))
					}));
				} catch (e) {
					throw new MoleculerError(e.message, 400, "INVOICE_DONATORS_FAILED", {
						message: e.message || e,
						internalErrorCode: "invoiceDonatorsFailed"
					});
				}
			}
		}
	}
};

module.exports = invoiceService;
