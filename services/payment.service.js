const { MoleculerError } = require("moleculer").Errors;
const DbService = require("moleculer-db");
const StripeMixin = require("../mixins/stripe.mixin");
const Invoice = require("../models/Invoice");
const dbConnection = require("../utils/dbConnection");
const { v4 } = require("uuid");
const Wallet = require("../models/Wallet");
const Utils = require("../utils/utils");
const { AchievementUID, getNextLevel } = require("../models/Achievement");
const User = require("../models/User");

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
				area: { type: "string" },
			},
			async handler(ctx) {
				this.logger.info("Buy Tree Payment triggered:", ctx.params);
				// TODO: Lazar kindly use ctx.meta.user to get user email
				const { quantity, userEmail, area } = ctx.params;
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
						area: area
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
						await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
						await this.createItem(event.data.object.id, event.data.object.quantity);
						return await ctx.call("v1.achievement.updateAchievements");
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
		async createItem(invoiceId,quantity) {
			const walletQrId = v4();

			const invoice = await Invoice.findOne({ invoiceId }).populate("payer").populate("area").exec();

			if (!invoice) {
				throw new MoleculerError("No Invoice Found");
			}

			const user = invoice.payer;
			const area = invoice.area;

			const entity = {
				walletQrId: walletQrId,
				userDesc: `${area.longitude}, ${area.latitude}`, // Use selected point
				userFullname: user.userFullName,
				userEmail: user.userEmail,
				productName: `Plant in ${area.name}`, // TODO: random letters and numbers for unique names
				publicQrCode: true,
				costOfProduct: 1,
				longText: "",
				hasstory: false, // false
				accessCode: Utils.generatePass(),
				_creator: user.userId,
				_area: area._id,
			};

			// Creating an Item
			const item = new Wallet(entity);

			try {
				await item.save();
			} catch (err) {
				throw new MoleculerError("Item Create Failed", 500, "TREE_ITEM_CREATION", {
					message: "An error occured while trying creating an item in db: " + err.toString(),
				});
			}

			const invoicedUser = await User.findOne({ userEmail: user.userEmail });
			const userNextLevel = getNextLevel(user.level,invoicedUser.planted_trees_count + 1);

			const data = {
				$inc: { numberOfTransaction: -1, planted_trees_count: quantity }, $set: {level: userNextLevel}
			};

			await User.findOneAndUpdate(entity,data,{ new: true });
		},
	},
};

module.exports = paymentService;
