"use strict";
const nodemailer = require("nodemailer");
const { MoleculerError } = require("moleculer").Errors;
const fs = require("fs");
const handlebars = require("handlebars");
const Utils = require("../utils/utils");
const Wallet = require("../models/Wallet");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const path = require("path");
const { first } = require("lodash");

require("dotenv").config();

module.exports = {
	name: "email",
	version: 1,
	settings: {
		from: "sender@moleculer.services",
		transport: {
			service: "gmail",
			auth: {
				user: "gmail.user@gmail.com",
				pass: "yourpass"
			}
		}
	},
	metadata: {
		scalable: true,
		priority: 5,
		bccemail: "bcc@blokaria.com",
		nameOfWebSite: "NaturePlant"
	},
	actions: {
		registerUser: {
			rest: "POST /	",
			params: {
				userEmail: { type: "email" },
				userOrgPass: { type: "string" },
				firstName: { type: "string" },
				authenticateLink: { type: "string" },
				userLang: { type: "string" }
			},
			async handler(ctx) {
				let userEmail = ctx.params.userEmail;
				let userOrgPass = ctx.params.userOrgPass;
				let authenticateLink = ctx.params.authenticateLink;
				let userLang = ctx.params.userLang;
				let firstName = ctx.params.firstName;
				try {
					const source = fs.readFileSync(`./public/templates/${userLang}/registrateUser.html`, "utf-8").toString();
					const template = handlebars.compile(source);
					const replacements = {
						userEmail: userEmail,
						userOrgPass: userOrgPass,
						userFirstName: firstName,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL,
						authenticateLink: authenticateLink,
						backendUrl: process.env.MOLECULER_SERVICE_LOCATION
					};
					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						subject: "User registration ✔",
						html: htmlToSend
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		// za sada ga nigde ne koristimo
		sendContractEmalForClient: {
			rest: "GET /sendContractEmalForClient",
			params: {
				emailVerificationId: { type: "number" },
				clientEmail: { type: "email" },
				walletQrId: { type: "string" },
				userFullname: { type: "string" },
				userEmail: { type: "email" },
				productName: { type: "string" }
				//data: { type: "object" }, // { type: "object", optional: true },
			},
			async handler(ctx) {
				try {
					let userLang = ctx.params.userLang;

					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "email20"
						});
					const source = fs.readFileSync(`./public/templates/${userLang}/contractEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let clientEmail = ctx.params.clientEmail;
					let userEmail = ctx.params.userEmail;
					const replacements = {
						clientEmail: clientEmail,
						walletQrId: ctx.params.walletQrId,
						userFirstName: ctx.params.userFullname.split(" ")[0],
						userEmail: userEmail,
						productName: ctx.params.productName,
						domainEmail: process.env.ADMIN_EMAIL,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${clientEmail}`,
						cc: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "Information about the smart contract ✔",
						html: htmlToSend
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		generateQrCodeEmail: {
			rest: "POST /generateQrCodeEmail",
			params: {
				emailVerificationId: { type: "number" },
				walletQrId: { type: "array" },
				userFullname: { type: "string" },
				userEmail: { type: "email" },
				productName: { type: "array" },
				accessCode: { type: "array" },
				qrCodeImageForStatus: { type: "string", optional: true },
				userLang: { type: "string" }
			},
			async handler(ctx) {
				try {
					this.logger.info("0. generateQrCodeEmail START", ctx.params);

					const { qrCodeImageForStatus, userLang } = ctx.params;

					const source = fs.readFileSync(`./public/templates/${userLang}/generatingQrCodeEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let userEmail = ctx.params.userEmail;

					this.logger.info("1. generateQrCodeEmail userEmail", userEmail);
					const replacements = {
						walletQrId: ctx.params.walletQrId,
						firstName: ctx.params.userFullname.split(" ")[0],
						userEmail: userEmail,
						productName: ctx.params.productName,
						accessCode: ctx.params.accessCode,
						publicQrCode: ctx.params.publicQrCode,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL
					};

					this.logger.info("2. generateQrCodeEmail replacements", replacements);

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌱" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: `Generated Tree Item 🌱: ${ctx.params.walletQrId[0].walletQrId}`,
						html: htmlToSend
					};

					if (qrCodeImageForStatus) {
						mailOptions.attachments = [
							{
								// encoded string as an attachment
								filename: `qr-code-${ctx.params.walletQrId}.png`,
								content: qrCodeImageForStatus.split("base64,")[1],
								encoding: "base64"
							}
						];
					}
					let info = await transporter.sendMail(mailOptions);

					this.logger.info("5. generateQrCodeEmail DONE", info);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendTransactionEmail: {
			rest: "POST /sendTransactionEmail",
			params: {
				emailVerificationId: { type: "number" },
				walletQrId: { type: "string" },
				userFullname: { type: "string" },
				userEmail: { type: "email" },
				productName: { type: "string" },
				clientEmail: { type: "email" },
				clientName: { type: "string" },
				userLang: { type: "string" }
			},
			async handler(ctx) {
				try {
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification Id is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "sendTransactionEmail10"
						});
					const { userLang } = ctx.params;
					const source = fs.readFileSync(`./public/templates/${userLang}/transactionConfirmationEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let userEmail = ctx.params.userEmail;
					let clientEmail = ctx.params.clientEmail;

					const replacements = {
						walletQrId: ctx.params.walletQrId,
						userFirstName: ctx.params.userFullname.split(" ")[0],
						userEmail: userEmail,
						productName: ctx.params.productName,
						clientEmail: clientEmail,
						clientName: ctx.params.clientName,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${clientEmail}, ${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "Transaction email ✔",
						html: htmlToSend
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		resetEmail: {
			params: {
				userEmail: { type: "email" },
				clearPassword: { type: "string" },
				userLang: { type: "string" },
				userFullname: { type: "string" }
			},
			async handler(ctx) {
				const { userEmail, clearPassword, userFullname, userLang } = ctx.params;
				let userFirstName = userFullname.split(" ")[0];
				const source = fs.readFileSync(`./public/templates/${userLang}/resetEmail.html`, "utf-8").toString();
				const template = handlebars.compile(source);

				const replacements = {
					userFirstName,
					userEmail,
					clearPassword,
					frontendUrl: process.env.BLOKARIA_WEBSITE,
					domainEmail: process.env.ADMIN_EMAIL
				};

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "Password reset ✔",
						html: htmlToSend
					};

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email20"
					});
				}
			}
		},

		sendContractEmailToOwner: {
			async handler(ctx) {
				console.log("sendContractEmailToOwner", ctx.params);

				const { userEmail: userEmailRegUser, userFullName: userFullNameRegUser } = ctx.params.meta;
				const { userEmail, userFullname, clientEmail, clientName, productName, accessCode, walletQrId } = ctx.params.walletIdData[0];
				const { userLang } = ctx.params;

				const source = fs.readFileSync(`./public/templates/${userLang}/initiateProgressEmail.html`, "utf-8").toString();

				console.log("sendContractEmailToOwner source");

				const template = handlebars.compile(source);

				const replacements = {
					walletQrId,
					userEmailRegUser,
					userFullNameRegUser,
					userFullname,
					userEmail,
					clientEmail,
					clientName,
					productName,
					accessCode,
					frontendUrl: process.env.BLOKARIA_WEBSITE,
					transactionApprovalLink: `${process.env.BLOKARIA_WEBSITE}/creator-approval?walletQrId=${walletQrId}&clientEmail=${userEmailRegUser}&clientName=${userFullNameRegUser}`,
					domainEmail: process.env.ADMIN_EMAIL
				};

				const htmlToSend = template(replacements);

				console.log("sendContractEmail htmlToSend");

				try {
					let transporter = await this.getTransporter();

					console.log("sendContractEmail transporter");

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "User is interested in your product ✔",
						html: htmlToSend
					};

					console.log("sendContractEmail mailOptions");

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50"
					});
				}
			}
		},

		sendPaymentConfirmationEmail: {
			rest: "POST /sendPaymentConfirmationEmail",
			params: {
				userLang: { type: "string" },
				userEmail: { type: "string" },
				purchaseDetails: { type: "object" },
				levelStatus: { type: "object", optional: true }
			},
			async handler(ctx) {
				try {
					const { userLang, userEmail, purchaseDetails, levelStatus } = ctx.params;
					this.logger.info("1. sendPaymentConfirmationEmail START", ctx.params);
					const source = fs.readFileSync(`./public/templates/${userLang}/purchaseConfirmation.html`, "utf-8").toString();

					const template = handlebars.compile(source);
					const user = await User.findOne({ userEmail: userEmail });
					let levelUpMessage = "";
					if (levelStatus?.isLevelChanged) {
						levelUpMessage = `Congratulations! You have advanced from level ${levelStatus.oldLevel} to level ${levelStatus.newLevel}!`;
					}

					const replacements = {
						name: user.userFullName.split(" ")[0],
						numberOfTrees: purchaseDetails.numberOfTrees,
						amount: purchaseDetails.amount,
						orderId: purchaseDetails.orderId,
						levelUpMessage: levelUpMessage,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL
					};

					this.logger.info("2. sendPaymentConfirmationEmail replacements", replacements);

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: `Purchase confirmation 👍 OrderId: ${purchaseDetails.orderId}`,
						html: htmlToSend
					};

					this.logger.info("4. sendPaymentConfirmationEmail mailOptions");

					let info = await transporter.sendMail(mailOptions);

					this.logger.info("6. sendPaymentConfirmationEmail ---DONE---");

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendPaymentDonationEmail: {
			rest: "POST /sendPaymentDonationEmail",
			params: {
				userLang: { type: "string" },
				userEmail: { type: "string" },
				donationDetails: { type: "object" },
			},
			async handler(ctx) {
				try {
					const { userLang, userEmail, donationDetails } = ctx.params;
					const source = fs.readFileSync(`./public/templates/${userLang}/donationConfirmation.html`, "utf-8").toString();

					const template = handlebars.compile(source);
					const certPath = await ctx.call("v1.achievement.generateDonationCertificate", { firstName: donationDetails.firstName, lastName: donationDetails.lastName, orderId: donationDetails.orderId});
										
					const achievementImagePath = path.join(__dirname, "../public", "levels/carbonNeutralAwarness.png");
					const achievementImageBuffer = fs.readFileSync(achievementImagePath);
					const base64Badge = achievementImageBuffer.toString('base64');
			
					const replacements = {
						firstName: donationDetails.firstName,
						amount: donationDetails.amount,
						orderId: donationDetails.orderId,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🙌" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: `🌱 Donation Confirmation - Thank You, ${donationDetails.firstName}! 🙌 Your Impact Matters`,
						html: htmlToSend,
						attachments: [
							{
								filename: "badge.png",
								content: base64Badge,
								encoding: "base64",
								cid: "badge"
							},
							{
								filename: 'certificate.pdf',
								path: certPath,                                         
								contentType: 'application/pdf'
							}
						]
					};

					let info = await transporter.sendMail(mailOptions);
					fs.unlinkSync(certPath);
					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendTreePlantingConfirmationEmail: {
			rest: "POST /sendTreePlantingConfirmationEmail",
			params: {
				userLang: { type: "string" },
				userEmails: { type: "array", items: "string" },
				userFullName: { type: "string" },
				plantingDetails: {
					type: "object",
					props: {
						latitude: { type: "number" },
						longitude: { type: "number" },
						areaName: { type: "string" },
						areaId: { type: "string" },
						walletQrId: { type: "string" },
						photo: { type: "string" } // base64 encoded photo
					}
				}
			},
			async handler(ctx) {
				try {
					const { userLang, userEmails, plantingDetails, userFullName } = ctx.params;
					const source = fs.readFileSync(`./public/templates/${userLang}/treePlantingConfirmation.html`, "utf-8").toString();

					const template = handlebars.compile(source);
					const salt = process.env.WALLETS_ENCRYPT_KEY
					const encrypt = Utils.cipher(salt);
					// Pass the planting details to the template
					const replacements = {
						userFullName: userFullName,
						latitude: plantingDetails.latitude,
						longitude: plantingDetails.longitude,
						areaName: plantingDetails.areaName,
						areaId: plantingDetails.areaId,
						walletQrId: plantingDetails.walletQrId,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL,
						photo: plantingDetails.photo,
						frontendUrl: process.env.BLOKARIA_WEBSITE,
						userId: encrypt(userEmails[0])
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: userEmails.join(","),
						bcc: `${this.metadata.bccemail}`,
						subject: "Tree Planting Confirmation 🌳",
						html: htmlToSend,
						attachments: [
							{
								filename: "tree_photo.png",
								content: plantingDetails.photo,
								encoding: "base64",
								cid: "treePhoto"
							}
						]
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendApprovalToClient: {
			async handler(ctx) {
				const { userEmail, userFullname, productName, accessCode, walletQrId } = ctx.params.walletIdData[0];
				const clientEmail = ctx.params.clientEmail;
				const clientName = ctx.params.clientName.split(" ")[0];
				const userLang = ctx.params.userLang;

				const source = fs.readFileSync(`./public/templates/${userLang}/qrCodeApproval.html`, "utf-8").toString();
				const template = handlebars.compile(source);
				const replacements = {
					walletQrId,
					userFullname,
					userEmail,
					clientEmail,
					clientName,
					productName,
					accessCode,
					frontendUrl: process.env.BLOKARIA_WEBSITE,
					domainEmail: process.env.ADMIN_EMAIL
				};

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${clientEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "Request approved ✔",
						html: htmlToSend
					};

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50"
					});
				}
			}
		},

		sendGiftEmail: {
			params: {
				userEmail: { type: "email" },
				walletQrId: { type: "uuid" },
				userLang: { type: "string" }
			},
			async handler(ctx) {
				const { userEmail, walletQrId, userLang } = ctx.params;
				const { user } = ctx.meta;

				let accessCode = Utils.generatePass();

				let updateWallet = await Wallet.findOneAndUpdate(
					{
						walletQrId
					},
					{ accessCode },
					{ new: true }
				);

				console.log("updateWallet", updateWallet);

				const source = fs.readFileSync(`./public/templates/${userLang}/sendGiftEmail.html`, "utf-8").toString();
				const template = handlebars.compile(source);
				const replacements = {
					userFirstName: user.userFullName.split(" ")[0],
					walletQrId,
					from: user,
					accessCode,
					frontendUrl: process.env.BLOKARIA_WEBSITE
				};

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "GIFT ✔",
						html: htmlToSend
					};

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50"
					});
				}
			}
		},

		subscribeEmail: {
			params: {
				email: { type: "email" }
			},
			async handler(ctx) {
				this.logger.info("1. subscribeEmail START", ctx.params);
				const { email } = ctx.params;

				try {
					let dataEmail = {
						userEmail: email
					};

					this.logger.info("2. subscribeEmail dataEmail", dataEmail);
					const addToEmailList = new Subscription(dataEmail);

					let addToEmailListRes = await addToEmailList.save();

					// TODO if is succesffull adding send notification email to the clinet

					this.logger.info("3. subscribeEmail addToEmailListRes", addToEmailListRes);

					return addToEmailListRes;
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_STORING_EMAIL", {
						message: error.message,
						internalErrorCode: "email55"
					});
				}
			}
		}
	},

	methods: {
		sendMailMethod: {
			async handler() {
				return "sendMailMethod";
			}
		},
		
		getTransporter: {
			async handler() {
				let adminEmail = process.env.ADMIN_EMAIL;
				let adminPassword = process.env.PASSW_EMAIL;

				this.logger.info("adminEmail", adminEmail);
				this.logger.info("adminPassword", adminPassword);

				return nodemailer.createTransport({
					host: process.env.MAIL_HOST,
					port: 465,
					secure: true, // true for 465, false for other ports
					auth: {
						user: adminEmail,
						pass: adminPassword
					}
				});
			}
		}
	}
};
