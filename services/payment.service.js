const { MoleculerError } = require("moleculer").Errors;
const StripeMixin = require("../mixins/stripe.mixin");

const paymentService = {
	name: "payment",
	version: 1,
	mixins: [StripeMixin],
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
				const { quantity, userEmail } = ctx.params;
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
						break;
					// ... handle other event types
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
