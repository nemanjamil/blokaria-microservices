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
			},
			async handler(ctx) {
				let userEmail = ctx.params.userEmail;
				let userOrgPass = ctx.params.userOrgPass;
				let userFullName = ctx.params.userFullName;

				try {
					const source = fs.readFileSync("./public/templates/welcome.html", "utf-8").toString();
					const template = handlebars.compile(source);
					const replacements = {
						userEmail: userEmail,
						userOrgPass: userOrgPass,
						userFullName: userFullName,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
					};
					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`, // 
						subject: "Register User ✔",
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
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "email10",
						});
					const source = fs.readFileSync("./public/templates/contractEmail.html", "utf-8").toString();
					const template = handlebars.compile(source);

					let clientEmail = ctx.params.clientEmail;
					let userEmail = ctx.params.userEmail;
					const replacements = {
						clientEmail: clientEmail,
						walletQrId: ctx.params.walletQrId,
						userFullname: ctx.params.userFullname,
						userEmail: userEmail,
						productName: ctx.params.productName,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}`,
						cc: `${userEmail}`,
						subject: "Contract Informations ✔",
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
			},
			async handler(ctx) {
				try {
					const source = fs.readFileSync("./public/templates/generatingQrCodeEmail.html", "utf-8").toString();
					const template = handlebars.compile(source);

					let userEmail = ctx.params.userEmail;
					const replacements = {
						walletQrId: ctx.params.walletQrId,
						userFullname: ctx.params.userFullname,
						userEmail: userEmail,
						productName: ctx.params.productName,
						webSiteLocation: process.env.BLOKARIA_WEBSITE,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "Generate QR Code ✔",
						html: htmlToSend,
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
			},
			async handler(ctx) {
				try {
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("VErification Id is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "sendTransactionEmail10",
						});

					const source = fs.readFileSync("./public/templates/transactionConfirmationEmail.html", "utf-8").toString();
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
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}, ${userEmail}`,
						subject: "Transaction Email ✔",
						html: htmlToSend,
					};

					let info = await transporter.sendMail(mailOptions);

					return info;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},
	},
	// events: {
	// 	"main.sendEmail"(ctx) {
	// 		this.logger.info("User created:", ctx.params);
	// 		// Do something
	// 	},
	// },

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
