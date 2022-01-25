"use strict";
const DbService = require("moleculer-db");
//const jwt = require("jsonwebtoken");
const { MoleculerClientError, EntityNotFoundError, MoleculerError } = require("moleculer").Errors;
const Utils = require("../utils/Utils");
const dbConnection = require("../utils/dbConnection");
const User = require("../models/User.js");
//const Date = require("../utils/Date");
//const { decode } = require("utf8");
//const LG = require("../utils/Logger");
//const LOGGER = new LG("USER");

module.exports = {
	name: "user",
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	settings: {
		JWT_SECRET: process.env.JWT_SECRET,
	},
	model: User,
	hooks: {
		// before: {
		// 	async create(ctx) {
		// 		if (!ctx.params.password) {
		// 			ctx.params.password = Utils.salt(ctx.params.clearPassword);
		// 		}
		// 	},
		// },
	},
	actions: {
		registerUser: {
			rest: "POST /registerUser",
			params: {
				userEmail: { type: "email" },
				userFullName: { type: "string" },
				userPassword: { type: "string", min: 1 },
			},

			async handler(ctx) {
				try {
					let clearPassword = Utils.generatePass();
					ctx.meta.clearPassword = clearPassword;
					await this.addUserToDB({ ctx, clearPassword });

					let userEmail = ctx.params.userEmail;

					const sendEmail = await ctx.call("v1.email.registerUser", {
						userEmail: ctx.params.userEmail,
						userOrgPass: ctx.params.userPassword,
						userFullName: ctx.params.userFullName,
					});
					return { sendEmail, userEmail };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		userFind: {
			rest: "POST /userfind",
			params: {
				userEmail: { type: "email" },
			},
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail,
					userVerified: 1,
				};

				try {
					let user = await User.find(entity);
					return user;
				} catch (error) {
					return new EntityNotFoundError();
				}
			},
		},

		getByEmail: {
			rest: "GET /getByEmail",
			authorization: true,
			params: {
				email: { type: "email" },
			},
			async handler(ctx) {
				return await ctx
					.call("user.find", {
						query: {
							email: ctx.params.email ? ctx.params.email : "",
						},
					})
					.then((res) => {
						if (res.length == 1) {
							const user = res[0];
							delete user.password;
							return user;
						} else if (res.length > 1) {
							return new MoleculerClientError("Plusieurs utilisateurs trouvés avec ce mail");
						} else {
							return new EntityNotFoundError();
						}
					});
			},
		},
	},

	methods: {
		// user10
		async addUserToDB({ ctx, clearPassword }) {
			const userEntity = {
				userEmail: ctx.params.userEmail,
				userFullName: ctx.params.userFullName,
				userPassword: Utils.salt(ctx.params.userPassword),
				clearPassword: clearPassword,
			};
			try {
				let user = new User(userEntity);
				return await user.save();
			} catch (error) {
				throw new MoleculerError("CODE_ERROR", 501, "ERROR_INSERT_INTO_DB", { message: error.message, internalErrorCode: "user10" });
			}
		},
	},
};
