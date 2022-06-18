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
			},
			async handler(ctx) {
				let userEmail = ctx.params.userEmail;
				let userOrgPass = ctx.params.userOrgPass;
				let userFullName = ctx.params.userFullName;
				let authenticateLink = ctx.params.authenticateLink;

				try {
					const source = fs.readFileSync("./public/templates/registrateUser.html", "utf-8").toString();
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
						subject: "Registracija korisnika ✔",
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
							internalErrorCode: "email20",
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
						subject: "Informacije o pametnom ugovoru ✔",
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
			},
			async handler(ctx) {
				try {
					const { qrCodeImageForStatus } = ctx.params;
					const source = fs.readFileSync("./public/templates/generatingQrCodeEmail.html", "utf-8").toString();
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
						subject: "Generisanje QR koda ✔",
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
			},
			async handler(ctx) {
				try {
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification Id is not correct", 501, "ERR_VERIFICATION_ID", {
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
						domainEmail: process.env.ADMIN_EMAIL,
					};

					const htmlToSend = template(replacements);

					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${clientEmail}, ${userEmail}`,
						subject: "Email transakcije ✔",
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
			},
			async handler(ctx) {
				const { userEmail, clearPassword, userFullname } = ctx.params;

				const source = fs.readFileSync("./public/templates/resetEmail.html", "utf-8").toString();
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
						subject: "Resetovanje lozinke ✔",
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
		sendContractEmail: {
			async handler(ctx) {
				const { userEmail: userEmailRegUser, userFullName: userFullNameRegUser } = ctx.meta.user;
				const { userEmail, userFullname, clientEmail, clientName, productName, accessCode, walletQrId } = ctx.params.walletIdData[0];

				const source = fs.readFileSync("./public/templates/initiateProgressEmail.html", "utf-8").toString();
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

				try {
					let transporter = await this.getTransporter();

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						subject: "Korisnik je zainteresovan za Vaš proizvod ✔",
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

		sendApprovalToClient: {
			async handler(ctx) {
				const { userEmail, userFullname, productName, accessCode, walletQrId } = ctx.params.walletIdData[0];
				const clientEmail = ctx.params.clientEmail;
				const clientName = ctx.params.clientName;

				const source = fs.readFileSync("./public/templates/qrCodeApproval.html", "utf-8").toString();
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
						subject: "Zahtev odobren ✔",
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
