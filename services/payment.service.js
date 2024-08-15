const { MoleculerError } = require("moleculer").Errors;
const DbService = require("moleculer-db");
const StripeMixin = require("../mixins/stripe.mixin");
const Invoice = require("../models/Invoice");
const dbConnection = require("../utils/dbConnection");
const { v4 } = require("uuid");
const Wallet = require("../models/Wallet");

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
				this.logger.info("Buy Tree Payment triggered:", ctx.params);
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
						amount: session.amount_total,
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

				this.logger.info("Stripe Event Data:", event.data);

				// Handle the event
				switch (event.type) {
					case "checkout.session.completed":
						// Then define and call a function to handle the event checkout.session.completed
						this.logger.info("Payment Intent Succeeded:", event.data.object);
						// TODO: create an item in user's inventory (tree)
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
					// ... handle other event types
					case "checkout.session.async_payment_failed":
						this.logger.info("Payment Intent Canceled:", event.data.object);
						return await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.FAILED);
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
	methods: {
		// async createItem(user, location) {
		// 	// {
		// 	//     "walletQrId": "b9865c5d-e3f3-4674-8d5f-507ace1866f5",
		// 	//     "userDesc": "52.54177259075365, 13.421598507704305",
		// 	//     "userFullname": "Nemanja Milivojevic",
		// 	//     "productName": "product #2",
		// 	//     "userEmail": "nemanjamil@gmail.com",
		// 	//     "costOfProduct": 1,
		// 	//     "qrCodeRedeemStatus": 0,
		// 	//     "contributorData": "",
		// 	//     "generatenft": false,
		// 	//     "productVideo": "",
		// 	//     "publicQrCode": true,
		// 	//     "longText": "longy",
		// 	//     "userLang": "en",
		// 	//     "productPicture": ""
		// 	// }
		// 	const walletQrId = v4();
		// 	const entity = {
		// 		walletQrId: walletQrId,
		// 		userDesc: "",
		// 		userFullname: user.userFullname,
		// 		userEmail: user.userEmail,
		// 		productName: "",
		// 		publicQrCode: wallet.publicQrCode,
		// 		costOfProduct: wallet.costOfProduct,
		// 		contributorData: wallet.contributorData,
		// 		longText: wallet.longText, // TODO: Advanced Settings
		// 		hasstory: wallet.hasstory, // false
		// 		accessCode: Utils.generatePass(),
		// 		_creator: user.userId,
		// 	};
		// 	// longText, contributorData
		// 	// Creating an Item
		// 	const item = new Wallet({
		// 		wallet,
		// 	});
		// },
	},
};

module.exports = paymentService;
