"use strict";
const nodemailer = require("nodemailer");
// const { MoleculerError } = require("moleculer").Errors;
const { ADMIN_EMAIL, PASSW_EMAIL } = process.env;
const fs = require("fs");
const handlebars = require("handlebars");

require("dotenv").config();

module.exports = {
	name: "mail",
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
		sendEmail: {
			async handler(ctx) {
				try {
					const source = fs.readFileSync("./public/templates/welcome.html", "utf-8").toString();
					const template = handlebars.compile(source);
					const replacements = {
						username: "Nemanja",
						token: "TOKEN",
					};
					const htmlToSend = template(replacements);

					let transporter = nodemailer.createTransport({
						host: "mail.blokaria.com",
						port: 465,
						secure: true, // true for 465, false for other ports
						auth: {
							user: ADMIN_EMAIL,
							pass: PASSW_EMAIL,
						},
					});

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Service Blokaria 👻" <service@blokaria.com>',
						to: "nemanjamil@gmail.com, office@madeofwood.rs",
						subject: "Hello ✔",
						text: "Hello world PLAIN?",
						html: htmlToSend,
						//text: 'Hola,\n\n' + 'Por favor verifica tu cuenta dando clic al siguente enlace:\n' + VERIFICATION_URL + ctx.params.token
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
	},
};
