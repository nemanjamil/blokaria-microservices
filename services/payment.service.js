const { MoleculerError } = require("moleculer").Errors;
const { default: DbService } = require("moleculer-db");
const StripeMixin = require("../mixins/stripe.mixin");
const Invoice = require("../models/Invoice");
const dbConnection = require("../utils/dbConnection");

const updateInvoiceStatus = async (invoiceId, status) => {
	try {
		const invoice = await Invoice.findOneAndUpdate({ invoiceId }, { $set: { status } }, { new: true });
		return invoice.toJSON();
	} catch (err) {
		const message = `Failed to update invoice with id: '${invoiceId}'`;
		throw new MoleculerError(message, 400, "PAYMENT_FAILED", {
			message: err.message || message,
		});
	}
};

const paymentService = {
	name: "payment",
	version: 1,
	mixins: [DbService, StripeMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Invoice,
	$noVersionPrefix: true,
	actions: {
		donationPayment: {
			params: {
				amount: { type: "number" },
			},
			async handler(ctx) {
				const { amount } = ctx.params;
				const stripe = this.getStripe();
				try {
					const session = await stripe.checkout.sessions.create({
						payment_method_types: ["card"],
						line_items: [
							{
								price_data: {
									currency: "usd",
									product_data: {
										name: "Donation",
									},
									unit_amount: amount * 100, // amount in cents
								},
								quantity: 1,
							},
						],
						mode: "payment",
						success_url: process.env.PAYMENT_SUCCESS_ROUTE,
						cancel_url: process.env.PAYMENT_FAIL_ROUTE,
					});
					return { id: session.id };
				} catch (err) {
					console.error("Error processing payment:", err);
					let message = "An error occurred while processing your payment.";
					if (err.type === "StripeCardError") {
						message = err.message;
					}
					throw new MoleculerError("Payment failed", 400, "PAYMENT_FAILED", {
						message: message,
					});
				}
			},
		},

		buyTreePayment: {
			params: {
				quantity: { type: "number" },
				userEmail: { type: "string" },
			},
			async handler(ctx) {
				// TODO: Lazar kindly use ctx.meta.user to get user email
				const { quantity, userEmail } = ctx.params;
				const userId = ctx.meta.user.userId;
				const treePrice = 50;
				const stripe = this.getStripe();
				try {
					const session = await stripe.checkout.sessions.create({
						payment_method_types: ["card"],
						line_items: [
							{
								price_data: {
									currency: "usd",
									product_data: {
										name: "Donation",
									},
									unit_amount: treePrice * 100, // amount in cents
								},
								quantity,
							},
						],
						mode: "payment",
						success_url: process.env.PAYMENT_SUCCESS_ROUTE,
						cancel_url: process.env.PAYMENT_FAIL_ROUTE,
						customer_email: userEmail,
					});
					this.logger.info("Creating Invoice from session:", session);
					const invoice = new Invoice({
						amount: session.amount,
						invoiceId: session.id,
						payer: userId,
					});
					await invoice.save();
					return { id: session.id, invoice: invoice.toJSON() };
				} catch (err) {
					console.error("Error processing payment:", err);
					let message = "An error occurred while processing your payment.";
					if (err.type === "StripeCardError") {
						message = err.message;
					}
					throw new MoleculerError("Payment failed", 400, "PAYMENT_FAILED", {
						message: message,
					});
				}
			},
		},

		handleStripeWebhook: {
			async handler(ctx) {
				const body = Buffer.from(Object.values(ctx.params));
				this.logger.info("Stripe Webhook triggered:", body.length);
				const headers = ctx.options.parentCtx.params.req.headers;
				const sig = headers["stripe-signature"];

				const stripe = this.getStripe();

				let event;

				try {
					this.logger.info("comparing signatures:", sig, ":", process.env.STRIPE_ENDPOINT_SECRET);
					event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_ENDPOINT_SECRET);
				} catch (err) {
					this.logger.error(`Webhook Error: ${err.message}`);
					ctx.meta.$statusCode = 400;
					return `Webhook Error: ${err.message}`;
				}

				// Handle the event
				switch (event.type) {
					case "payment_intent.succeeded":
						// Then define and call a function to handle the event payment_intent.succeeded
						this.logger.info("Payment Intent Succeeded:", event.data.object);
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
					// ... handle other event types
					case "payment_intent.canceled":
						this.logger.info("Payment Intent Canceled:", event.data.object);
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.FAILED);
					case "payment_intent.created":
						this.logger.info("Payment Intent Created:", event.data.object);
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.CREATED);
					case "checkout.session.expired":
						this.logger.info("Payment Intent Expired:", event.data.object);
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.EXPIRED);
					default:
						this.logger.info(`Unhandled event type ${event.type}`);
				}

				// Return a 200 response to acknowledge receipt of the event
				return;
			},
		},
	},
};

module.exports = paymentService;
