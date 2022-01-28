"use strict";
const { MoleculerClientError, MoleculerError } = require("moleculer").Errors;
const jwt = require("jsonwebtoken");
const Utils = require("../utils/utils");

module.exports = {
	name: "auth",
	version: 1,
	settings: {
		JWT_SECRET: process.env.JWT_SECRET,
	},

	metadata: {
		scalable: true,
		priority: 5,
	},
	actions: {
		// auth10
		authenticate: {
			rest: "POST /authenticate",
			authorization: false,
			params: {
				userEmail: { type: "email" },
				userPassword: { type: "string", min: 1 },
			},
			async handler(ctx) {
				const { userEmail, userPassword } = ctx.params;

				try {
					let users = await ctx.call("user.userFind", { userEmail });
					const user = users ? users[0] : null;
					// if (!user) throw new MoleculerClientError("User does not exist", 422, "USER_FIND_ERROR", { message: "email is not found", internalErrorCode: "auth10" });
					const res = await Utils.compare(userPassword, users[0].userPassword);
					if (!res) throw new MoleculerClientError("Password incorrect", 403, "COMPARE_PASSWORDS_ERROR", { message: "password do not match", internalErrorCode: "auth20" });
					let expiresIn = "72h";
					let response = {
						token: jwt.sign({ userEmail: userEmail }, process.env.JWT_SECRET, { expiresIn: expiresIn }),
						expiresIn: expiresIn,
					};

					let copyUser = {
						userEmail: user.userEmail,
						userFullName: user.userFullName,
						userVerified: user.userVerified,
					};

					return { tokenData: response, user: copyUser };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		resolveToken: {
			rest: "GET /getByToken",
			authorization: false,
			cache: {
				keys: ["token"],
				ttl: 60 * 60, // 1 hour
			},
			params: {
				token: "string",
			},
			async handler(ctx) {
				try {
					return jwt.verify(ctx.params.token, process.env.JWT_SECRET);	
				} catch (error) {
					throw new MoleculerError("Token is not verified", 401, "ApiGateway.Errors.ERR_INVALID_TOKEN", {
						message: "Token is not Valid. Please Log in",
						internalErrorCode: "token10",
					});
				}
				
				// return await new this.Promise((resolve, reject) => {
				// 	jwt.verify(ctx.params.token, process.env.JWT_SECRET, (err, decoded) => {
				// 		if (err) {
				// 			return reject(err);
				// 		} else {
				// 			resolve(decoded);
				// 		}
				// 	});
				// });
			},
		},

		// registerUser: {
		// 	rest: "POST /registerUser",
		// 	authorization: false,
		// 	params: {
		// 		email: { type: "email" },
		// 		password: { type: "string", min: 1 },
		// 	},
		// 	async handler(ctx) {
		// 		try {
		// 			const { email, password } = ctx.params;
		// 			const user = await ctx.call("users.find", { email });
		// 			if (!user) throw new MoleculerClientError("Email or password is invalid!", 422, "", [{ field: "email", message: "is not found" }]);
		// 			const res = await utils.compare(password, user.password);
		// 			if (!res) throw new MoleculerClientError("Wrong password!", 422, "", [{ field: "email", message: "is not found" }]);
		// 			let expiresIn = "24h";
		// 			return {
		// 				token: jwt.sign({ id: user.id }, this.settings.JWT_SECRET, { expiresIn: expiresIn }),
		// 				expiresIn: expiresIn,
		// 			};
		// 		} catch (error) {
		// 			return Promise.reject(error);
		// 		}
		// 	},
		// },
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
