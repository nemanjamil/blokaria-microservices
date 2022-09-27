"use strict";
const nodemailer = require("nodemailer");
const { MoleculerError } = require("moleculer").Errors;
const fs = require("fs");
const handlebars = require("handlebars");

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
				pass: "yourpass",
			},
		},
	},
	metadata: {
		scalable: true,
		priority: 5,
	},
	actions: {
		registerUser: {
			rest: "POST /registerUser",
			params: {
				userEmail: { type: "email" },
				userOrgPass: { type: "string" },
				userFullName: { type: "string" },
				authenticateLink: { type: "string" },
				userLang: { type: "string" },
			},
			async handler(ctx) {
				let userEmail = ctx.params.userEmail;
				let userOrgPass = ctx.params.userOrgPass;
				let userFullName = ctx.params.userFullName;
				let authenticateLink = ctx.params.authenticateLink;
				let userLang = ctx.params.userLang;

				try {
					const source = fs.readFileSync(`./public/templates/${userLang}/registrateUser.html`, "utf-8").toString();
					const template = handlebars.compile(source);
					const replacements = {
						userEmail: userEmail,
						userOrgPass: userOrgPass,
						userFullName: userFullName,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL,
						authenticateLink: authenticateLink,
						backEnd: process.env.MOLECULER_SERVICE_LOCATION
					};
					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "User registration ✔",
						html: htmlToSend,
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			},
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
				productName: { type: "string" },
				//data: { type: "object" }, // { type: "object", optional: true },
			},
			async handler(ctx) {
				try {

					let userLang = ctx.params.userLang;

					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "email20",
						});
					const source = fs.readFileSync(`./public/templates/${userLang}/contractEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let clientEmail = ctx.params.clientEmail;
					let userEmail = ctx.params.userEmail;
					const replacements = {
						clientEmail: clientEmail,
						walletQrId: ctx.params.walletQrId,
						userFullname: ctx.params.userFullname,
						userEmail: userEmail,
						productName: ctx.params.productName,
						domainEmail: process.env.ADMIN_EMAIL,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}`,
						cc: `${userEmail}`,
						subject: "Information about the smart contract ✔",
						html: htmlToSend,
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		generateQrCodeEmail: {
			rest: "POST /generateQrCodeEmail",
			params: {
				emailVerificationId: { type: "number" },
				walletQrId: { type: "string" },
				userFullname: { type: "string" },
				userEmail: { type: "email" },
				productName: { type: "string" },
				accessCode: { type: "string" },
				qrCodeImageForStatus: { type: "string" },
				userLang: { type: "string" },
			},
			async handler(ctx) {
				try {
					const { qrCodeImageForStatus, userLang } = ctx.params;
					const source = fs.readFileSync(`./public/templates/${userLang}/generatingQrCodeEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let userEmail = ctx.params.userEmail;
					const replacements = {
						walletQrId: ctx.params.walletQrId,
						userFullname: ctx.params.userFullname,
						userEmail: userEmail,
						productName: ctx.params.productName,
						accessCode: ctx.params.accessCode,
						publicQrCode: ctx.params.publicQrCode,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "Generated QR code ✔",
						html: htmlToSend,
						attachments: [
							{
								// encoded string as an attachment
								filename: `qr-code-${ctx.params.walletQrId}.png`,
								content: qrCodeImageForStatus.split("base64,")[1],
								encoding: "base64",
							},
						],
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			},
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
				userLang: { type: "string" },
			},
			async handler(ctx) {
				try {
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification Id is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "sendTransactionEmail10",
						});
					const { userLang } = ctx.params;
					const source = fs.readFileSync(`./public/templates/${userLang}/transactionConfirmationEmail.html`, "utf-8").toString();
					const template = handlebars.compile(source);

					let userEmail = ctx.params.userEmail;
					let clientEmail = ctx.params.clientEmail;

					const replacements = {
						walletQrId: ctx.params.walletQrId,
						userFullname: ctx.params.userFullname,
						userEmail: userEmail,
						productName: ctx.params.productName,
						clientEmail: clientEmail,
						clientName: ctx.params.clientName,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
						domainEmail: process.env.ADMIN_EMAIL,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}, ${userEmail}`,
						subject: "Transaction email ✔",
						html: htmlToSend,
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		resetEmail: {
			params: {
				userEmail: { type: "email" },
				clearPassword: { type: "string" },
				userLang: { type: "string" },
			},
			async handler(ctx) {
				const { userEmail, clearPassword, userFullname, userLang } = ctx.params;

				const source = fs.readFileSync(`./public/templates/${userLang}/resetEmail.html`, "utf-8").toString();
				const template = handlebars.compile(source);

				const replacements = {
					userFullname,
					userEmail,
					clearPassword,
					webSiteLocation: process.env.BLOKARIA_WEBSITE,
					domainEmail: process.env.ADMIN_EMAIL,
				};

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "Password reset ✔",
						html: htmlToSend,
					};

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email20",
					});
				}
			},
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
					webSiteLocation: process.env.BLOKARIA_WEBSITE,
					transactionApprovalLink: `${process.env.BLOKARIA_WEBSITE}/creator-approval?walletQrId=${walletQrId}&clientEmail=${userEmailRegUser}&clientName=${userFullNameRegUser}`,
					domainEmail: process.env.ADMIN_EMAIL,
				};

				const htmlToSend = template(replacements);

				console.log("sendContractEmail htmlToSend");

				try {
					let transporter = await this.getTransporter();

					console.log("sendContractEmail transporter");

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "User is interested in your product ✔",
						html: htmlToSend,
					};

					console.log("sendContractEmail mailOptions");

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50",
					});
				}
			},
		},

		sendApprovalToClient: {
			async handler(ctx) {
				const { userEmail, userFullname, productName, accessCode, walletQrId } = ctx.params.walletIdData[0];
				const clientEmail = ctx.params.clientEmail;
				const clientName = ctx.params.clientName;
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
					webSiteLocation: process.env.BLOKARIA_WEBSITE,
					domainEmail: process.env.ADMIN_EMAIL,
				};

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}`,
						subject: "Request approved ✔",
						html: htmlToSend,
					};

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50",
					});
				}
			},
		},
	},

	methods: {
		sendMailMethod: {
			async handler() {
				return "sendMailMethod";
			},
		},
		getTransporter: {
			async handler() {
				let adminEmail = process.env.ADMIN_EMAIL;
				let adminPassword = process.env.PASSW_EMAIL;

				return nodemailer.createTransport({
					host: "mail.blokaria.com",
					port: 465,
					secure: true, // true for 465, false for other ports
					auth: {
						user: adminEmail,
						pass: adminPassword,
					},
				});
			},
		},
	},
};
