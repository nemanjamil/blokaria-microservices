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
			params: {
				userEmail: { type: "email" },
				userPassword: { type: "string", min: 1 },
			},
			async handler(ctx) {
				const { userEmail, userPassword } = ctx.params;

				this.logger.info("getting user by email: ", userEmail);

				try {
					let users = await ctx.call("user.userFind", { userEmail });
					this.logger.info("got users by that email:", users);
					const user = users ? users[0] : null;

					if (!user)
						throw new MoleculerClientError("Korisnik ne postoji.", 422, "USER_FIND_ERROR", {
							message: "email is not found",
							internalErrorCode: "auth10",
						});
					const res = await Utils.compare(userPassword, users[0].userPassword);
					if (!res)
						throw new MoleculerClientError("Lozinka nije ispravna.", 403, "COMPARE_PASSWORDS_ERROR", {
							message: "password do not match",
							internalErrorCode: "auth20",
						});

					let expiresIn = "168h";
					let response = {
						token: jwt.sign({ userEmail: userEmail }, process.env.JWT_SECRET, { expiresIn: expiresIn }),
						expiresIn: expiresIn,
					};

					// console.log(response.token);

					// const algorithm = 'aes-256-cbc';  // Algorithm to use for encryption
					// const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
					// const iv = crypto.randomBytes(16);

					// const cipher = crypto.createCipheriv(algorithm, key, iv);
					// let encryptedToken = cipher.update(response.token, 'utf8', 'hex');
					// encryptedToken += cipher.final('hex');
					// encryptedToken = iv.toString('hex') + ':' + encryptedToken;

					// const parts = encryptedToken.split(':');
					// const iv_d = Buffer.from(parts.shift(), 'hex');
					// const encryptedText = parts.join(':');

					// const decipher = crypto.createDecipheriv(algorithm, key, iv_d);
					// let decryptedToken = decipher.update(encryptedText, 'hex', 'utf8');
					// decryptedToken += decipher.final('utf8');
					let copyUser = {
						userEmail: user.userEmail,
						userFullName: user.userFullName,
						userVerified: user.userVerified,
						userRole: user.userRole,
						numberOfTransaction: user.numberOfTransaction,
						numberOfCoupons: user.numberOfCoupons,
						level: user.level,
						achievements: user._achievements,
						wallets: user._wallets,
					};

					// response.token = encryptedToken;
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
					// const algorithm = 'aes-256-cbc';  // Algorithm to use for encryption
					// const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);

					// const parts = ctx.params.token.split(':');
					// const iv_d = Buffer.from(parts.shift(), 'hex');
					// const encryptedText = parts.join(':');

					// const decipher = crypto.createDecipheriv(algorithm, key, iv_d);
					// let decryptedToken = decipher.update(encryptedText, 'hex', 'utf8');
					// decryptedToken += decipher.final('utf8');

					return jwt.verify(ctx.params.token, process.env.JWT_SECRET);
				} catch (error) {
					throw new MoleculerError(
						"Token nije verifikovan ili je istekao. Izlogujte se i ulogujte ponovo.",
						401,
						"ApiGateway.Errors.ERR_INVALID_TOKEN",
						{
							message: "Token is not Valid. Please Log in.",
							internalErrorCode: "token10",
						}
					);
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
	},

	methods: {
		sendMailMethod: {
			async handler() {
				return "sendMailMethod";
			},
		},
	},
};
