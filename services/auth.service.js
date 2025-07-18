"use strict";
const { MoleculerClientError, MoleculerError } = require("moleculer").Errors;
const jwt = require("jsonwebtoken");
const Utils = require("../utils/utils");
const bcrypt = require("bcrypt");

module.exports = {
	name: "auth",
	version: 1,
	settings: {
		JWT_SECRET: process.env.JWT_SECRET
	},

	metadata: {
		scalable: true,
		priority: 5
	},
	actions: {
		// auth10
		authenticate: {
			params: {
			userEmail: { type: "email" },
			userPassword: { type: "string", min: 1 }
			},
			async handler(ctx) {
			const { userEmail, userPassword } = ctx.params;
		
			this.logger.info("Authenticating user with email: ", userEmail);
		
			try {
				let users = await ctx.call("user.userFind", { userEmail });
				const user = users ? users[0] : null;
		
				if (!user) {
				throw new MoleculerClientError("User not found.", 422, "USER_FIND_ERROR", {
					message: "email is not found",
					internalErrorCode: "auth10"
				});
				}
		
				const { passwordHash: salt, userPassword: storedHashedPassword } = user;
				const passwordMatch = await bcrypt.compare(userPassword + salt, storedHashedPassword);
				// Use ctx.call to access Wallet service 
				const noOfWalletsPlanted = await ctx.call("wallet.count", { 
					query: { userEmail: user.userEmail, treePlanted: true } 
				});
				if (!passwordMatch) {
					throw new MoleculerClientError("Incorrect password.", 403, "COMPARE_PASSWORDS_ERROR", {
						message: "password do not match",
						internalErrorCode: "auth20"
					});
				}
				// Generate JWT token
				let expiresIn = "168h"; // token expiry
				let response = {
				token: jwt.sign({ userEmail: userEmail }, process.env.JWT_SECRET, { expiresIn }),
				expiresIn
				};
		
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
				noOfTreesPlanted: noOfWalletsPlanted
				};
		
				return { tokenData: response, user: copyUser };
		
			} catch (error) {
				this.logger.error("Authentication failed: ", error);
				return Promise.reject(error);
			}
			}
		},				 
		resolveToken: {
			rest: "GET /getByToken",
			authorization: false,
			cache: {
				keys: ["token"],
				ttl: 60 * 60 // 1 hour
			},
			params: {
				token: "string"
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
						"The token is invalid or has expired. Please log out and log in again.",
						401,
						"ApiGateway.Errors.ERR_INVALID_TOKEN",
						{
							message: "Token is not Valid. Please Log in.",
							internalErrorCode: "token10"
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
			}
		}
	},

	methods: {
		sendMailMethod: {
			async handler() {
				return "sendMailMethod";
			}
		}
	}
};
