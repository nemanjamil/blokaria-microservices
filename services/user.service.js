"use strict";
const DbService = require("moleculer-db");
//const jwt = require("jsonwebtoken");
const { MoleculerError } = require("moleculer").Errors;
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
		JWT_SECRET: process.env.JWT_SECRET
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

		reduceUserCoupons : {

			async handler(ctx) {

				const entity = {
					userEmail: ctx.params[0].clientEmail,		
				};
				(ctx.params.publicQrCode) ?  ""   :  entity.numberOfCoupons = { $gte: 0 };

				let data = {
					//$inc: { numberOfCoupons: -Number(ctx.params[0].costOfProduct) }
				};
				(ctx.params.publicQrCode) ?  ""   :  data.$inc = { numberOfCoupons: -Number(ctx.params[0].costOfProduct) };

				
				try {
					
					let resultFromReducting =  await User.findOneAndUpdate(entity, data, { new: true });
					if (!resultFromReducting) {
						throw new MoleculerError("User has negative number of coupons", 401, "USER_HAS_NEGATIVE_NUMBER_OF_COUPONS", {
							message: "User has negative number of coupons",
							internalErrorCode: "user41",
						});
					}
					return resultFromReducting;
				} catch (error) {
					throw new MoleculerError("Error in reducing coupons", 401, "ERROR_REDUCING_COUPONS", {
						message: "Error in reducing coupons",
						internalErrorCode: "user40",
					});
				}
			}
		}, 
		populateUserTable : {
			// params: {
			// 	_id: { type: Object },
			// },
			async handler(ctx) {
				
				const entity = {
					userEmail: ctx.params.userEmail,	
				};

				let data = {
					$push: { "_wallets": String(ctx.params._id)}
				};


				try {

					return await User.findOneAndUpdate(entity, data, { new: true }) // upsert: true
						.populate("_wallets");

					/* let userFind = await User.findOne(entity);
					let _wallets = userFind._wallets || []; 
					_wallets.push(ctx.params._id);
				    const updatedPost = await User.findOneAndUpdate(entity, {_wallets: _wallets}).populate({path : "_wallets"}); */


				} catch (error) {
					throw new MoleculerError("Can not populate user table with wallet ids", 401, "POPULATE_BUG", {
						message: "User Not Found",
						internalErrorCode: "user30",
					});
				}
			}
		},
		registerUser: {
			//rest: "POST /registerUser",
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
		userFind: {  // this is for LogIn 
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
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "user20",
					});
				}

			},
		}, 
		userGet: {  
			rest: "POST /userGet",
			params: {
				userEmail: { type: "email" },
			},
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail,
					userVerified: 1,
				};

				try {
					let user = await User.find(entity, { 
						numberOfTransaction: 1, 
						userEmail: 1, 
						userFullName: 1, 
						numberOfCoupons: 1, 
						userVerified: 1 
					});
					return user;
				} catch (error) {
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "user20",
					});
				}

			},
		}
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
				throw new MoleculerError("Error Inserting User", 501, "ERROR_INSERT_INTO_DB", { message: error.message, internalErrorCode: "user10" });
			}
		}
	},
};
