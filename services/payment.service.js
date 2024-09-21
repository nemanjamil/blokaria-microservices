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
		console.log("1. updateInvoiceStatus invoiceId status", invoiceId, status);

		const invoice = await Invoice.findOneAndUpdate({ invoiceId }, { $set: { status } }, { new: true });

		console.log("2. updateInvoiceStatus invoice", invoice);

		return invoice.toJSON();
	} catch (err) {
		const message = `Failed to update invoice with id: '${invoiceId}'`;
		throw new MoleculerError(message, 400, "PAYMENT_FAILED", {
			message: err.message || message
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
			password: process.env.PAYPAL_SECRET
		}
	});

	return response.data.access_token;
};

const verifyPaypalWebhookSignature = async ({
												auth_algo,
												cert_url,
												transmission_id,
												transmission_sig,
												transmission_time,
												webhook_id,
												webhook_event
											}) => {
	try {
		const accessToken = await generatePaypalAccessToken();

		const response = await axios({
			url: process.env.PAYPAL_BASE_URL + "/v1/notifications/verify-webhook-signature",
			method: "post",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`
			},
			data: {
				auth_algo,
				cert_url,
				transmission_id,
				transmission_sig,
				transmission_time,
				webhook_id,
				webhook_event
			}
		});

		return response.data.verification_status === "SUCCESS";
	} catch (error) {
		throw new MoleculerError("Webhook verification failed", 400, "WEBHOOK_VERIFICATION_FAILED", {
			message: error.message
		});
	}
};

const captureOrder = async (orderId) => {
	console.log("1. captureOrder START");
	console.log("2. captureOrder START orderId", orderId);

	const accessToken = await generatePaypalAccessToken();

	console.log("3. captureOrder accessToken", accessToken);

	try {
		const response = await axios({
			url: `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
			method: "post",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`
			}
		});
		console.log("3. captureOrder response DONE", response.data);

		return response.data;
	} catch (error) {
		throw new MoleculerError("Order capture failed", 400, "ORDER_CAPTURE_FAILED", {
			message: error.message
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
							   brandName = "NaturePlant"
						   }) => {
	console.log("amount", amount);

	const accessToken = await generatePaypalAccessToken();
	console.log("accessToken", accessToken);

	const response = await axios({
		url: process.env.PAYPAL_BASE_URL + "/v2/checkout/orders",
		method: "post",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer " + accessToken
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
								value: amount
							}
						}
					],
					amount: {
						currency_code: currency,
						value: amount * quantity,
						breakdown: {
							item_total: {
								currency_code: currency,
								value: amount * quantity
							}
						}
					}
				}
			],
			application_context: {
				return_url: returnUrl,
				cancel_url: cancelUrl,
				shipping_preference: "NO_SHIPPING",
				user_action: "PAY_NOW",
				brand_name: brandName
			}
		})
	});

	const approveLink = response.data.links.find((link) => link.rel === "approve").href;
	const orderId = response.data.id;
	let totalAmount = amount * quantity;

	console.log("response:", response.data);

	return {
		approveLink,
		orderId,
		totalAmount
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
				amount: { type: "number" }
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
										name: "Donation"
									},
									unit_amount: amount * 100 // amount in cents
								},
								quantity: 1
							}
						],
						mode: "payment",
						success_url: process.env.PAYMENT_SUCCESS_ROUTE,
						cancel_url: process.env.PAYMENT_FAIL_ROUTE
					});

					const invoice = new Invoice({
						amount: session.amount_total,
						invoiceId: session.id,
						paymentSource: "stripe",
						paymentType: "donation"
					});

					let invoiceRes = await invoice.save();

					return { id: session.id, invoice: invoiceRes };
				} catch (err) {
					console.error("Error processing payment:", err);
					let message = "An error occurred while processing your payment.";
					if (err.type === "StripeCardError") {
						message = err.message;
					}
					throw new MoleculerError("Payment failed", 400, "PAYMENT_FAILED", {
						message: message
					});
				}
			}
		},

		buyTreePayment: {
			params: {
				quantity: { type: "number" },
				userEmail: { type: "string" },
				area: { type: "string" }
			},
			async handler(ctx) {
				this.logger.info("1. buyTreePayment Buy Tree Payment triggered:", ctx.params);
				const { quantity, userEmail, area } = ctx.params;

				this.logger.info("3. buyTreePayment quantity, userEmail, area", quantity, userEmail, area);

				const userId = ctx.meta.user.userId;
				const treePrice = 50; // TODO fix this price
				const stripe = this.getStripe();

				try {
					const session = await stripe.checkout.sessions.create({
						payment_method_types: ["card"],
						line_items: [
							{
								price_data: {
									currency: "usd",
									product_data: {
										name: "Donation"
									},
									unit_amount: treePrice * 100 // amount in cents
								},
								quantity: quantity
							}
						],
						mode: "payment",
						success_url: process.env.PAYMENT_SUCCESS_ROUTE,
						cancel_url: process.env.PAYMENT_FAIL_ROUTE,
						customer_email: userEmail
					});
					this.logger.info("5. buyTreePayment Creating Invoice from session:", session);

					const invoice = new Invoice({
						amount: session.amount_total,
						invoiceId: session.id,
						payer: userId,
						area: area,
						paymentSource: "stripe",
						paymentType: "purchase"
					});

					this.logger.info("7. buyTreePayment invoice:", invoice);

					let invoiceRes = await invoice.save();

					this.logger.info("10. buyTreePayment invoiceRes:", invoiceRes);

					this.logger.info("12. buyTreePayment DONE:", { id: session.id, invoice: invoice.toJSON() });

					return { id: session.id, invoice: invoice.toJSON() };
				} catch (err) {
					console.error("Error processing payment:", err);
					let message = "An error occurred while processing your payment.";
					if (err.type === "StripeCardError") {
						message = err.message;
					}
					throw new MoleculerError("Payment failed", 400, "PAYMENT_FAILED", {
						message: message
					});
				}
			}
		},

		paypalDonationCreateOrder: {
			params: {
				amount: { type: "number" }
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
						brandName: "Nature Planet"
					});

					this.logger.info("Creating Invoice with orderId");
					const invoice = new Invoice({
						amount: totalAmount,
						invoiceId: orderId,
						area: process.env.DONATION_AREA,
						paymentSource: "paypal",
						paymentType: "donation"
					});
					await invoice.save();

					return { approveLink };
				} catch (error) {
					console.log("Error creating PayPal order:", error);
					throw new MoleculerError("Order creation failed", 400, "ORDER_CREATION_FAILED", {
						message: error.message
					});
				}
			}
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
						donationDetails: donationDetails
					});
				} catch (error) {
					console.log("Error sending email:", error);
					throw new MoleculerError("Email sending error", 400, "EMAIL_SENDING_FAILED", {
						message: error.message
					});
				}
			}
		},

		paypalPurchaseCreateOrder: {
			params: {
				quantityOfTrees: { type: "number" },
				area: { type: "string" }
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
						brandName: "NaturePlant"
					});

					const areaObjectId = new mongoose.Types.ObjectId(area);

					this.logger.info("Creating Invoice with orderId");
					const invoice = new Invoice({
						amount: totalAmount,
						invoiceId: orderId,
						payer: userId,
						area: areaObjectId,
						paymentSource: "paypal",
						paymentType: "purchase"
					});
					await invoice.save();

					return { approveLink };
				} catch (error) {
					console.log("Error creating PayPal order:", error);
					throw new MoleculerError("Order creation failed", 400, "ORDER_CREATION_FAILED", {
						message: error.message
					});
				}
			}
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
					webhook_event: webhookEvent
				};

				this.logger.info("2. paypalWebhook verificationParams", verificationParams);

				let response = "";
				try {
					const orderType = webhookEvent.resource.purchase_units[0].items[0].name;
					const eventType = webhookEvent.event_type;

					if (eventType === "CHECKOUT.ORDER.APPROVED" && orderType === "Tree Purchase") {
						this.logger.info("5. paypalWebhook eventType orderType", eventType, orderType);

						response = await this.handleTreePurchaseWebhook(webhookEvent, verificationParams, ctx);
					} else if (eventType === "CHECKOUT.ORDER.APPROVED" && orderType === "Donation") {
						this.logger.info("7. paypalWebhook eventType orderType", eventType, orderType);

						response = await this.handleDonationWebhook(webhookEvent, verificationParams, ctx);
					} else {
						this.logger.error("9. paypalWebhook Unhandled webhook event type or order type ERROR ", {
							eventType,
							orderType
						});
						throw new MoleculerError("Unhandled webhook event type or order type", 400, "UNHANDLED_WEBHOOK", {
							message: "The event type or order type is not supported."
						});
					}
				} catch (error) {
					this.logger.error("11. paypalWebhook ERROR processing PayPal webhook", error);

					throw new MoleculerError("Webhook processing failed", 400, "WEBHOOK_PROCESSING_FAILED", {
						message: error.message
					});
				}

				this.logger.info("15. paypalWebhook ----- DONE ----- response", response);

				return "Webhook processed successfully.";
			}
		},

		handleStripeWebhook: {
			async handler(ctx) {
				this.logger.info("0. handleStripeWebhook START DATE : ", Date.now());
				this.logger.info("0. handleStripeWebhook START ctx.params:");

				const body = Buffer.from(Object.values(ctx.params));
				this.logger.info("1. handleStripeWebhook Stripe Webhook triggered:", body.length);
				this.logger.info("1.1 handleStripeWebhook Stripe Webhook triggered: body", body);

				const headers = ctx.options.parentCtx.params.req.headers;
				const sig = headers["stripe-signature"];

				this.logger.info("2. handleStripeWebhook sig", sig);

				const stripe = this.getStripe();

				this.logger.info("3. handleStripeWebhook stripe");

				let event;

				try {
					this.logger.info("4. handleStripeWebhook comparing signatures:", sig, ":", process.env.STRIPE_WEBHOOK_KEY);
					event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_KEY);

					this.logger.info("6. handleStripeWebhook event", event);
				} catch (err) {
					this.logger.error(`8. handleStripeWebhook Webhook Error: ${err.message}`);
					ctx.meta.$statusCode = 400;
					return `Webhook Error: ${err.message}`;
				}

				this.logger.info("9. handleStripeWebhook Stripe Event Data:", event.data);

				const lineItems = stripe.checkout.sessions.listLineItems(event.id);
				const quantity = lineItems.length > 0 ? lineItems[0].quantity : 1;

				// Handle the event

				let status = "";
				switch (event.type) {
					case "checkout.session.completed":
						this.logger.info("10. handleStripeWebhook Payment Intent Succeeded:", event.data.object);
						await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
						status = await this.createItem(event.data.object.id, quantity, ctx, event.data.object.customer_details.email);
						this.logger.info("10.A handleStripeWebhook Invoice.InvoiceStatus.COMPLETED FINISHED");
						break;
					case "checkout.session.async_payment_failed":
						this.logger.info("12. handleStripeWebhook Payment Intent Canceled:", event.data.object);
						status = await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.FAILED);
						break;
					case "checkout.session.expired":
						this.logger.info("14. handleStripeWebhook Payment Intent Expired:", event.data.object);
						status = await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.EXPIRED);
						break;
					case "charge.captured":
						this.logger.info("16. handleStripeWebhook Payment charge.captured:", event.data.object);
						status = await updateInvoiceStatus(event.data.object.id, Invoice.InvoiceStatus.COMPLETED);
						break;
					default:
						this.logger.info(`16. handleStripeWebhook default  Unhandled event type ${event.type}`);
						status = "default";
						break;
				}

				this.logger.info("10. handleStripeWebhook  ---- DONE ---", status);

				// Return a 200 response to acknowledge receipt of the event
				return true;
			}
		}
	},
	methods: {
		async generateRandomString(length) {
			const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			let result = "";
			for (let i = 0; i < length; i++) {
				result += characters.charAt(Math.floor(Math.random() * characters.length));
			}
			return result;
		},
		async createItem(invoiceId, quantity, ctx, email) {
			this.logger.info("1. createItem start invoiceId, quantity", invoiceId, quantity);

			const walletQrId = v4();

			this.logger.info("3. createItem walletQrId", walletQrId);

			const invoice = await Invoice.findOne({ invoiceId }).populate("payer").populate("area").exec();

			this.logger.info("5. createItem invoice", invoice);

			if (!invoice) {
				throw new MoleculerError("No Invoice Found");
			}

			const user = invoice.payer;
			const area = invoice.area;
			const randomString = await this.generateRandomString(5);
			const entity = {
				walletQrId: walletQrId,
				geoLocation: "",
				userFullname: user?.userFullName,
				userEmail: email || user?.userEmail,
				productName: `Tree-${randomString} in ${area?.name}`,
				publicQrCode: true,
				costOfProduct: 1,
				longText: "",
				hasstory: false, // false
				accessCode: Utils.generatePass(),
				_creator: user?._id,
				_area: area?._id || process.env.DONATION_AREA
			};

			this.logger.info("7. createItem entity", entity);

			const invoicedUser = await User.findOne({ userEmail: email || user.userEmail });

			this.logger.info("8. createItem invoicedUser", invoicedUser);
			this.logger.info("9. createItem invoicedUser WALLETS.length", invoicedUser?._wallets.length);
			this.logger.info("10. createItem invoicedUser PLANTED_TREES_COUNT", invoicedUser?.planted_trees_count);

			const noOfWallets = await Wallet.find({ userEmail: email || user.userEmail }).exec();

			this.logger.info("11. createItem NoOfWALLETS.length", noOfWallets.length);

			if (noOfWallets.length === invoicedUser?._wallets.length && invoicedUser?._wallets.length === invoicedUser?.planted_trees_count) {
				this.logger.info(
					"12. createItem noOfWallets.length === invoicedUser._wallets.length === invoicedUser.planted_trees_count ---- ALL OK ----",
					noOfWallets?.length,
					invoicedUser?._wallets.length,
					invoicedUser?.planted_trees_count
				);
			} else {
				this.logger.error(
					"13. createItem noOfWallets.length !== invoicedUser._wallets.length or !== invoicedUser.planted_trees_count",
					noOfWallets?.length,
					invoicedUser?._wallets.length,
					invoicedUser?.planted_trees_count
				);
			}

			// Creating an Item
			const item = new Wallet(entity);
			try {
				const treeItem = await item.save();

				const purchaseDetails = {
					numberOfTrees: quantity,
					amount: quantity * 50,
					orderId: invoiceId,
				};

				const sendPaymentConfirmationEmail = await ctx.call("v1.email.sendPaymentConfirmationEmail", {
					userLang: "en",
					userEmail: user.userEmail,
					purchaseDetails: purchaseDetails,
				});

				this.logger.info("createItem sendPaymentConfirmationEmail", sendPaymentConfirmationEmail);

				const generateQrCodeEmailData = {
					emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID),
					walletQrId: treeItem.walletQrId,
					userFullname: user?.userFullName || email,
					userEmail: email || user.userEmail,
					productName: treeItem.productName,
					accessCode: treeItem.accessCode,
					userLang: "en"
				};

				this.logger.info("createItem generateQrCodeEmailData", generateQrCodeEmailData);

				await ctx.call("v1.email.generateQrCodeEmail", generateQrCodeEmailData);
			} catch (err) {
				throw new MoleculerError("Item Create Failed", 500, "TREE_ITEM_CREATION", {
					message: "An error occured while trying creating an item in db: " + err.toString()
				});
			}

			this.logger.info("14. createItem item", item);
			this.logger.info("15. createItem item.userEmail", item.userEmail);

			if (invoicedUser) {
				let threshold = isNaN(invoicedUser?.planted_trees_count) ? Number(quantity) : Number(invoicedUser?.planted_trees_count) + Number(quantity);

				if (isNaN(threshold)) {
					threshold = 1;
				}

				this.logger.info("16. createItem threshold", threshold);

				let achievements = await Achievement.find({}).populate({
					path: "_level",
					match: { required_trees: { $lte: threshold } }
				});

				this.logger.info("17.A createItem achievements ALL", achievements);

				achievements = achievements.filter((achievement) => achievement._level && achievement._level.required_trees <= threshold);

				this.logger.info("17.B createItem achievements filtered", achievements);

				// Find and update user level
				const levels = await Level.findOne({
					required_trees: {
						$lte: threshold
					}
				}).sort({ required_trees: -1 });
				const userLevel = levels._id;

				this.logger.info("18. createItem levels", levels);
				this.logger.info("20. createItem userLevel", userLevel);

				let iterationNumber = 0;

				this.logger.info("\n\n\n ---- ACHIEVEMENTS START ---- \n\n\n");

				// Add achievements to user, it will check if its there it won't add with addToSet
				for (const element of achievements.filter((x) => x._level !== null)) {
					this.logger.info(`22.${iterationNumber} createItem: element`, element);

					if (element._level) {
						this.logger.info(`23.A.${iterationNumber} createItem element._level`, element._id);
						this.logger.info(`23.B.${iterationNumber} createItem invoicedUser._achievements`, invoicedUser._achievements);

						if (invoicedUser._achievements && !invoicedUser._achievements.includes(element._id)) {
							this.logger.info(`24.${iterationNumber} reduceNumberOfTransaction - New Achievement created.`);

							const achievementUpdate = {
								$addToSet: { _achievements: String(element._id) }
							};

							const updatedUser = await User.findOneAndUpdate({ userEmail: invoicedUser.userEmail }, achievementUpdate, { new: true })
								.populate("_achievements")
								.exec();

							let achPayload = {
								userLang: "en",
								userEmail: updatedUser.userEmail,
								achievement: element
							};
							this.logger.info(`25.${iterationNumber} createItem achPayload`, achPayload);

							let sendEmailAch = await ctx.call("v1.achievement.sendAchievementEmail", achPayload);

							this.logger.info(`26.${iterationNumber} createItem sendEmailAch`, sendEmailAch);
						} else {
							this.logger.info(`27.${iterationNumber} createItem - Achievement already exists for user.`);
						}
					} else {
						this.logger.info(`28.${iterationNumber} createItem - element._level does not exist.`);
					}
					iterationNumber++;

					this.logger.info("\n\n\n");
				}

				this.logger.info("29. createItem walletUpdate START");

				const walletUpdate = {
					$addToSet: { _wallets: String(item._id) }
				};
				let updatedWalletUser = await User.findOneAndUpdate({ userEmail: invoicedUser.userEmail }, walletUpdate, { new: true })
					.populate("_wallets")
					.exec();

				this.logger.info("30. createItem Add updatedWalletUser", updatedWalletUser);

				// Update transactional data
				const data = {
					$inc: { numberOfTransaction: -1, planted_trees_count: quantity },
					$set: { _level: String(userLevel) }
				};

				this.logger.info("32. createItem Update transactional data", data);

				let userUpdate = await User.findOneAndUpdate({ userEmail: invoicedUser.userEmail }, data, { new: true }).populate("_achievements");

				this.logger.info("34. createItem userUpdate");
			}

			this.logger.info("35. createItem ----- DONE -----");

			return { user: invoicedUser, itemTree: entity };
		},

		async handleTreePurchaseWebhook(webhookEvent, verificationParams, ctx) {
			this.logger.info("1. handleTreePurchaseWebhook Handling Tree Purchase Webhook");

			verificationParams.webhook_id = process.env.PAYPAL_CHECKOUT_APPROVED_ID;
			const isValid = await verifyPaypalWebhookSignature(verificationParams);

			if (isValid) {
				this.logger.info("2. handleTreePurchaseWebhook Tree Purchase Webhook successfully verified", webhookEvent);

				const orderId = webhookEvent.resource.id;

				this.logger.info("2. handleTreePurchaseWebhook orderId", orderId);

				const captureResult = await captureOrder(orderId);

				this.logger.info("4. handleTreePurchaseWebhook captureResult", captureResult);

				this.logger.info("6. handleTreePurchaseWebhook orderId", orderId);

				const quantity = webhookEvent.resource.purchase_units[0].items[0].quantity;

				this.logger.info("8. handleTreePurchaseWebhook quantity", quantity);

				if (captureResult.status === "COMPLETED") {
					this.logger.info("10. handleTreePurchaseWebhook Capture completed");
					let updateInvoiceStatusRes = await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.COMPLETED);

					this.logger.info("12. handleTreePurchaseWebhook updateInvoiceStatusRes", updateInvoiceStatusRes);

					const { user, itemTree } = await this.createItem(orderId, quantity, ctx);

					this.logger.info("14. handleTreePurchaseWebhook user", user);
					this.logger.info("15. handleTreePurchaseWebhook itemTree", itemTree);

					ctx.meta.user = {
						userEmail: user.userEmail,
						userFullName: `${user.userFullName}`,
						userId: user._id,
						userRole: user.role,
						numberOfTransaction: user.transactionsCount,
						numberOfCoupons: user.couponsCount
					};

					let userLevel = user.level;

					this.logger.info("16. handleTreePurchaseWebhook userLevel, userLevel");

					let purchaseDetails = {
						numberOfTrees: quantity,
						amount: quantity * 50,
						orderId: orderId
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
						isLevelChanged: userLevel !== newLevel
					};

					this.logger.info("18. handleTreePurchaseWebhook levelStatus", levelStatus);

					// Log new level if it has changed
					if (levelStatus.isLevelChanged) {
						this.logger.info("20. handleTreePurchaseWebhook isLevelChanged", true);
					}
					let sendPaymentConfirmationEmail = await ctx.call("v1.email.sendPaymentConfirmationEmail", {
						userLang: "en",
						userEmail: user.userEmail,
						purchaseDetails: purchaseDetails,
						levelStatus: levelStatus
					});

					this.logger.info("22. handleTreePurchaseWebhook sendPaymentConfirmationEmail", sendPaymentConfirmationEmail);

					let generateQrCodeEmailData = {
						emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID),
						walletQrId: itemTree.walletQrId,
						userFullname: user.userFullName,
						userEmail: user.userEmail,
						productName: itemTree.productName,
						accessCode: itemTree.accessCode,
						userLang: "en"
					};

					this.logger.info("24. handleTreePurchaseWebhook generateQrCodeEmailData", generateQrCodeEmailData);

					await ctx.call("v1.email.generateQrCodeEmail", generateQrCodeEmailData);
				} else {
					this.logger.info("Capture failed");
					await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.FAILED);
				}
				this.logger.info("26. handleTreePurchaseWebhook captureResult DONE", captureResult);
			} else {
				console.log("Webhook verification failed.");
				throw new MoleculerError("Invalid webhook signature", 400, "INVALID_SIGNATURE", {
					message: "Webhook signature verification failed."
				});
			}
		},

		async handleDonationWebhook(webhookEvent, verificationParams, ctx) {
			this.logger.info("1. handleDonationWebhook Handling Donation Webhook");

			verificationParams.webhook_id = process.env.PAYPAL_CHECKOUT_APPROVED_ID;
			const isValid = await verifyPaypalWebhookSignature(verificationParams);

			if (isValid) {
				this.logger.info("3. handleDonationWebhook Donation Webhook successfully verified", webhookEvent);

				const captureResult = await captureOrder(webhookEvent.resource.id);
				const orderId = webhookEvent.resource.id;
				const totalPrice = webhookEvent.resource.purchase_units[0].amount.value;

				if (captureResult.status === "COMPLETED") {
					this.logger.info("5. handleDonationWebhook Capture COMPLETED");
					let updateInvoiceStatusRes = await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.COMPLETED);

					this.logger.info("7. handleDonationWebhook updateInvoiceStatusRes", updateInvoiceStatusRes);

					const payerEmail = webhookEvent.resource.payer.email_address;

					let donationDetails = {
						amount: totalPrice,
						orderId: orderId
					};

					this.logger.info("9. handleDonationWebhook donationDetails", donationDetails);

					let sendObject = {
						userLang: "en",
						userEmail: payerEmail,
						donationDetails: donationDetails
					};

					this.logger.info("10. handleDonationWebhook sendObject", sendObject);

					let sendPaymentDonationEmailRes = await ctx.call("v1.email.sendPaymentDonationEmail", sendObject);

					this.logger.info("11. handleDonationWebhook sendPaymentDonationEmailRes", sendPaymentDonationEmailRes);
				} else {
					this.logger.error("13. handleDonationWebhook ERROR");
					let updateInvoiceStatusErr = await updateInvoiceStatus(orderId, Invoice.InvoiceStatus.FAILED);
					this.logger.error("15. handleDonationWebhook ERROR updateInvoiceStatusErr", updateInvoiceStatusErr);
				}
				this.logger.info("17. handleDonationWebhook Donation Webhook captureResult DONE", captureResult);
			} else {
				this.logger.error("19. handleDonationWebhook  Webhook ERROR verification failed");
				throw new MoleculerError("Invalid webhook signature", 400, "INVALID_SIGNATURE", {
					message: "Webhook signature verification failed."
				});
			}
		}
	}
};

module.exports = paymentService;
