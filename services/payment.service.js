const { MoleculerError } = require("moleculer").Errors;
const DbService = require("moleculer-db");
const StripeMixin = require("../mixins/stripe.mixin");
const Invoice = require("../models/Invoice");
const dbConnection = require("../utils/dbConnection");
const { v4 } = require("uuid");
const Wallet = require("../models/Wallet");
const Achievement = require("../models/Achievement");
const Level = require("../models/Level");
const Utils = require("../utils/utils");
const User = require("../models/User");
const axios = require("axios");
const mongoose = require("mongoose");

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

const generatePaypalAccessToken = async () => {
	const response = await axios({
		url: process.env.PAYPAL_BASE_URL + "/v1/oauth2/token",
		method: "post",
		data: "grant_type=client_credentials",
		auth: {
			username: process.env.PAYPAL_CLIENT_ID,
			password: process.env.PAYPAL_SECRET,
		},
	});

	return response.data.access_token;
};

const verifyPaypalWebhookSignature = async ({ auth_algo, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id, webhook_event }) => {
	try {
		const accessToken = await generatePaypalAccessToken();

		const response = await axios({
			url: process.env.PAYPAL_BASE_URL + "/v1/notifications/verify-webhook-signature",
			method: "post",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			data: {
				auth_algo,
				cert_url,
				transmission_id,
				transmission_sig,
				transmission_time,
				webhook_id,
				webhook_event,
			},
		});

		return response.data.verification_status === "SUCCESS";
	} catch (error) {
		throw new MoleculerError("Webhook verification failed", 400, "WEBHOOK_VERIFICATION_FAILED", {
			message: error.message,
		});
	}
};

const captureOrder = async (orderId) => {
	const accessToken = await generatePaypalAccessToken();

	try {
		const response = await axios({
			url: `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
			method: "post",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});
		console.log("Capture response:", response.data);
		return response.data;
	} catch (error) {
		throw new MoleculerError("Order capture failed", 400, "ORDER_CAPTURE_FAILED", {
			message: error.message,
		});
	}
};

const createOrder = async ({
	amount,
	itemName,
	itemDescription,
	quantity,
	currency = "USD",
	returnUrl = process.env.PAYMENT_SUCCESS_ROUTE,
	cancelUrl = process.env.PAYMENT_FAIL_ROUTE,
	brandName = "NaturePlant",
}) => {
	console.log("amount", amount);

	const accessToken = await generatePaypalAccessToken();
	console.log("accessToken", accessToken);

	const response = await axios({
		url: process.env.PAYPAL_BASE_URL + "/v2/checkout/orders",
		method: "post",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer " + accessToken,
		},
		data: JSON.stringify({
			intent: "CAPTURE",
			purchase_units: [
				{
					items: [
						{
							name: itemName,
							description: itemDescription,
							quantity: quantity,
							unit_amount: {
								currency_code: currency,
								value: amount,
							},
						},
					],
					amount: {
						currency_code: currency,
						value: amount * quantity,
						breakdown: {
							item_total: {
								currency_code: currency,
								value: amount * quantity,
							},
						},
					},
				},
			],
			application_context: {
				return_url: returnUrl,
				cancel_url: cancelUrl,
				shipping_preference: "NO_SHIPPING",
				user_action: "PAY_NOW",
				brand_name: brandName,
			},
		}),
	});

	const approveLink = response.data.links.find((link) => link.rel === "approve").href;
	const orderId = response.data.id;
	let totalAmount = amount * quantity;

	console.log("response:", response.data);

	return {
		approveLink,
		orderId,
		totalAmount,
	};
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
						area: area,
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

		paypalDonationCreateOrder: {
			params: {
				amount: { type: "number" },
			},
			async handler(ctx) {
				try {
					this.logger.info("ctx params", ctx.params);
					const { amount } = ctx.params;

					const { approveLink, orderId, totalAmount } = await createOrder({
						amount: amount,
						itemName: "Donation",
						itemDescription: "Charitable Donation",
						quantity: 1,
						currency: "USD",
						returnUrl: process.env.PAYMENT_SUCCESS_ROUTE,
						cancelUrl: process.env.PAYMENT_FAIL_ROUTE,
						brandName: "Nature Planet",
					});

					this.logger.info("Creating Invoice with orderId");
					const invoice = new Invoice({
						amount: totalAmount,
						invoiceId: orderId,
					});
					await invoice.save();

					return { approveLink };
				} catch (error) {
					console.log("Error creating PayPal order:", error);
					throw new MoleculerError("Order creation failed", 400, "ORDER_CREATION_FAILED", {
						message: error.message,
					});
				}
			},
		},

		testEmail: {
			async handler(ctx) {
				try {
					let donationDetails = {};
					const quantity = 1;
					donationDetails.name = "XAVI";
					donationDetails.numberOfTrees = 1;
					donationDetails.amount = quantity * 50;
					donationDetails.orderId = "XXXXX";
					console.log("donationDetails", donationDetails);
					ctx.call("v1.email.sendPaymentConfirmationEmail", {
						userLang: "en",
						userEmail: "abdulrahman.omar17h@gmail.com",
						donationDetails: donationDetails,
					});
				} catch (error) {
					console.log("Error sending email:", error);
					throw new MoleculerError("Email sending error", 400, "EMAIL_SENDING_FAILED", {
						message: error.message,
					});
				}
			},
		},

		paypalPurchaseCreateOrder: {
			params: {
				quantityOfTrees: { type: "number" },
				area: { type: "string" },
			},
			async handler(ctx) {
				try {
					this.logger.info("ctx params", ctx.params);
					const userId = ctx.meta.user.userId;
					console.log("userId", ctx.meta.user);
					const { quantityOfTrees, area } = ctx.params;

					// const pricePerTree = process.env.TREE_PRICE;
					const pricePerTree = 50;

					const { approveLink, orderId, totalAmount } = await createOrder({
						amount: pricePerTree,
						itemName: "Tree Purchase",
						itemDescription: "Purchase of Trees",
						quantity: quantityOfTrees,
						currency: "USD",
						returnUrl: process.env.PAYMENT_SUCCESS_ROUTE,
						cancelUrl: process.env.PAYMENT_FAIL_ROUTE,
						brandName: "NaturePlant",
					});

					const areaObjectId = new mongoose.Types.ObjectId(area);

					this.logger.info("Creating Invoice with orderId");
					const invoice = new Invoice({
						amount: totalAmount,
						invoiceId: orderId,
						payer: userId,
						area: areaObjectId,
					});
					await invoice.save();

					return { approveLink };
				} catch (error) {
					console.log("Error creating PayPal order:", error);
					throw new MoleculerError("Order creation failed", 400, "ORDER_CREATION_FAILED", {
						message: error.message,
					});
				}
			},
		},

		paypalWebhook: {
			async handler(ctx) {
				this.logger.info("0. paypalWebhook START");
				this.logger.info("1. paypalWebhook ctx.params", ctx.params);

				const headers = ctx.options.parentCtx.params.req.headers;
				const webhookEvent = ctx.params;

				const verificationParams = {
					auth_algo: headers["paypal-auth-algo"],
					cert_url: headers["paypal-cert-url"],
					transmission_id: headers["paypal-transmission-id"],
					transmission_sig: headers["paypal-transmission-sig"],
					transmission_time: headers["paypal-transmission-time"],
					webhook_event: webhookEvent,
				};

				this.logger.info("2. paypalWebhook verificationParams", verificationParams);

				try {
					const orderType = webhookEvent.resource.purchase_units[0].items[0].name;
					const eventType = webhookEvent.event_type;

					if (eventType === "CHECKOUT.ORDER.APPROVED" && orderType === "Tree Purchase") {
						await this.handleTreePurchaseWebhook(webhookEvent, verificationParams, ctx);
					} else if (eventType === "CHECKOUT.ORDER.APPROVED" && orderType === "Donation") {
						await this.handleDonationWebhook(webhookEvent, verificationParams, ctx);
					} else {
						this.logger.info("Unhandled webhook event type or order type", { eventType, orderType });
						throw new MoleculerError("Unhandled webhook event type or order type", 400, "UNHANDLED_WEBHOOK", {
							message: "The event type or order type is not supported.",
						});
					}
				} catch (error) {
					console.log("Error processing PayPal webhook:", error);
					throw new MoleculerError("Webhook processing failed", 400, "WEBHOOK_PROCESSING_FAILED", {
						message: error.message,
					});
				}

				return "Webhook processed successfully.";
			},
		},

		handleStripeWebhook: {
			async handler(ctx) {
				// const secret = "whsec_3dcfddcd5427bacb88780b92982a2f6851ebcc7da3987c0000c3564322bf18e6";
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
						this.logger.info("Payment Intent Succeeded:", event.data.object);
						await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
						return this.createItem(event.data.object.id, event.data.object.quantity, ctx);
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
		async createItem(invoiceId, quantity, ctx) {
			const walletQrId = v4();

			const invoice = await Invoice.findOne({ invoiceId }).populate("payer").populate("area").exec();
			if (!invoice) {
				throw new MoleculerError("No Invoice Found");
			}

			const user = invoice.payer;
			const area = invoice.area;

			const entity = {
				walletQrId: walletQrId,
				geoLocation: `${area.longitude}, ${area.latitude}`, // Use selected point
				userFullname: user.userFullName,
				userEmail: user.userEmail,
				productName: `Plant in ${area.name}`, // TODO: random letters and numbers for unique names
				publicQrCode: true,
				costOfProduct: 1,
				longText: "",
				hasstory: false, // false
				accessCode: Utils.generatePass(),
				_creator: user._id,
				area: area._id,
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

			const invoicedUser = await User.findOne({ userEmail: user.userEmail }).populate({ path: "_achievements" });
			const achievements = await Achievement.find({})
				.populate({
					path: "_level",
					match: { required_trees: { $lte: invoicedUser.planted_trees_count + quantity } },
				})
				.exec();

			// Find and update user level
			const levels = await Level.findOne({
				required_trees: {
					$lte: invoicedUser.planted_trees_count + quantity,
				},
			})
				.sort({ required_trees: -1 })
				.exec();
			const userLevel = levels[0]._id;

			// Add achievements to user, it will check if its there it won't add with addToSet
			for (let achievement in achievements) {
				const achievementUpdate = {
					$addToSet: { _achievements: String(achievement._id) },
				};

				await User.findOneAndUpdate({ userEmail: user.userEmail }, achievementUpdate, { new: true });

				if (invoicedUser._achievements.filter((x) => x._id === achievement._id).length === 0) {
					ctx.call("v1.achievement.sendAchievementEmail", {
						userLang: "en",
						userEmail: user.userEmail,
						achievement: achievement,
					});
				}
			}
			// Update transactional data
			const data = {
				$inc: { numberOfTransaction: -1, planted_trees_count: quantity },
				$set: { _level: String(userLevel) },
			};
			await User.findOneAndUpdate({ userEmail: user.userEmail }, data, { new: true }).populate("_achievements");

			return invoicedUser;
		},

		async handleTreePurchaseWebhook(webhookEvent, verificationParams, ctx) {
			this.logger.info("Handling Tree Purchase Webhook");

			verificationParams.webhook_id = process.env.PAYPAL_CHECKOUT_APPROVED_ID;
			const isValid = await verifyPaypalWebhookSignature(verificationParams);

			if (isValid) {
				this.logger.info("2. Tree Purchase Webhook successfully verified", webhookEvent);

				const captureResult = await captureOrder(webhookEvent.resource.id);
				const orderId = webhookEvent.resource.id;
				const quantity = webhookEvent.resource.purchase_units[0].items[0].quantity;

				if (captureResult.status === "COMPLETED") {
					this.logger.info("Capture completed");
					await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.COMPLETED);
					const user = await this.createItem(orderId, quantity);
					ctx.meta.user = {
						userEmail: user.userEmail,
						userFullName: `${user.firstName} ${user.lastName}`,
						userId: user._id,
						userRole: user.role,
						numberOfTransaction: user.transactionsCount,
						numberOfCoupons: user.couponsCount,
					};

					let userLevel = user.level;
					console.log("userLevel", userLevel);
					let purchaseDetails = {
						numberOfTrees: quantity,
						amount: quantity * 50,
						orderId: orderId,
					};

					let updatedUser = await User.findById(user._id).exec();
					if (!updatedUser) {
						throw new Error("Updated user not found");
					}
					purchaseDetails.name = updatedUser.userFullName;
					const newLevel = updatedUser.level;
					const levelStatus = {
						oldLevel: userLevel,
						newLevel: newLevel,
						isLevelChanged: userLevel !== newLevel,
					};

					// Log new level if it has changed
					if (levelStatus.isLevelChanged) {
						console.log("New Level:", newLevel);
					}
					await ctx.call("v1.email.sendPaymentConfirmationEmail", {
						userLang: "en",
						userEmail: user.userEmail,
						purchaseDetails: purchaseDetails,
						levelStatus: levelStatus,
					});
				} else {
					this.logger.info("Capture failed");
					await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.FAILED);
				}
				this.logger.info("3. Tree Purchase Webhook captureResult", captureResult);
			} else {
				console.log("Webhook verification failed.");
				throw new MoleculerError("Invalid webhook signature", 400, "INVALID_SIGNATURE", {
					message: "Webhook signature verification failed.",
				});
			}
		},

		async handleDonationWebhook(webhookEvent, verificationParams, ctx) {
			this.logger.info("Handling Donation Webhook");

			verificationParams.webhook_id = process.env.PAYPAL_CHECKOUT_APPROVED_ID;
			const isValid = await verifyPaypalWebhookSignature(verificationParams);

			if (isValid) {
				this.logger.info("2. Donation Webhook successfully verified", webhookEvent);

				const captureResult = await captureOrder(webhookEvent.resource.id);
				const orderId = webhookEvent.resource.id;
				const totalPrice = webhookEvent.resource.purchase_units[0].amount.value;

				if (captureResult.status === "COMPLETED") {
					this.logger.info("Capture completed");
					await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.COMPLETED);
					const payerEmail = webhookEvent.resource.payer.email_address;

					let donationDetails = {
						amount: totalPrice,
						orderId: orderId,
					};

					await ctx.call("v1.email.sendPaymentDonationEmail", {
						userLang: "en",
						userEmail: payerEmail,
						donationDetails: donationDetails,
					});
				} else {
					this.logger.info("Capture failed");
					await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.FAILED);
				}
				this.logger.info("3. Donation Webhook captureResult", captureResult);
			} else {
				console.log("Webhook verification failed.");
				throw new MoleculerError("Invalid webhook signature", 400, "INVALID_SIGNATURE", {
					message: "Webhook signature verification failed.",
				});
			}
		},
	},
};

module.exports = paymentService;
