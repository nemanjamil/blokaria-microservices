"use strict";
const DbService = require("moleculer-db");
const { MoleculerError, MoleculerClientError } = require("moleculer").Errors;
const Utils = require("../utils/utils");
const { strings } = require("../utils/strings");
const dbConnection = require("../utils/dbConnection");
const User = require("../models/User.js");
const Wallet = require("../models/Wallet.js");
const Achievement = require("../models/Achievement");
const Level = require("../models/Level");
const bcrypt = require("bcrypt");

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
		// TODO Mihajlo
		// meta: {
		// 	userId: { type: "Number" },
		// },
		listProjectByUser: {
			async handler(ctx) {
				const { userId } = ctx.meta.user;
				try {
					const noOfWalletsPlanted = await Wallet.find({ userEmail: ctx.meta.user.userEmail, treePlanted: true }).exec();
					let user = await User.findOne({ _id: userId }).populate({
						path: "_projects",
						populate: {
								path: "_wallets",
						// select: "productName _nfts",
						populate: {
								path: "_nfts"
							}
						}
					});
					// return user;
					// Return user data with tree count as a separate property
					return {
						...user.toJSON(),
						noOfTreesPlanted: noOfWalletsPlanted ? noOfWalletsPlanted.length : 0
					};
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR Listing Projects", {
						message: error.message,
						internalErrorCode: "project101"
					});
				}
			}
		},

		// user80
		addCouponsAndQrCodesToUser: {
			rest: "POST /addCouponsAndQrCodesToUser",
			params: {
				userEmail: { type: "email" },
				emailVerificationId: { type: "number" },
				what: { type: "string" },
				howmany: { type: "number" }
			},
			async handler(ctx) {
				if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
					throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
						message: "Verification email failed",
						internalErrorCode: "email20"
					});

				let what = ctx.params.what;
				let howmany = ctx.params.howmany;

				console.log(what, howmany);

				const entity = {
					userEmail: ctx.params.userEmail
				};

				let data = {};
				data[what] = howmany;

				try {
					let resultFromReducting = await User.findOneAndUpdate(entity, data, { new: true });

					if (!resultFromReducting) {
						throw new MoleculerError(strings.userReduceTrx, 401, "USER_HAS_NEGATIVE_NUMBER_OF_AVAILABLE_TRANSACTIONS", {
							message: strings.userReduceTrx,
							internalErrorCode: "user81"
						});
					}
					return resultFromReducting;
				} catch (error) {
					throw new MoleculerError(strings.userReduceTrx, 401, "ERROR_REDUCING_TRANSACTIONS", {
						message: error.message,
						internalErrorCode: "user80"
					});
				}
			}
		},

		editProfile: {
			params: {
				firstName: { type: "string" },
				lastName: { type: "string" },
				photo: { type: "string", optional: true } // Mark photo as optional
			},
			async handler(ctx) {
				const { userId } = ctx.meta.user;
				const { firstName, lastName, photo } = ctx.params;

				try {
					const updatedUser = await User.findOneAndUpdate(
						{ _id: userId },
						{
							firstName,
							lastName,
							userFullName: `${firstName} ${lastName}`
						},
						{ new: true }
					);

					if (!updatedUser) {
						throw new MoleculerError("User not found", 404, "USER_NOT_FOUND");
					}

					if (photo) {
						await ctx.call("image.storeProfilePicture", { photo });
						console.log("Profile picture updated successfully");
					}

					return "Profile updated successfully";
				} catch (error) {
					console.error("Error updating profile", error);
					throw new MoleculerError("Failed to update profile", 401, "ERROR_EDITING_PROFILE", {
						message: error.message,
						internalErrorCode: "userEditProfile"
					});
				}
			}
		},

		// user70
		reduceNumberOfTransaction: {
			params: {
				user: {
					type: "object",
					userEmail: { type: "email" }
				}
			},
			async handler(ctx) {
				const invoicedUser = await User.findOne({ userEmail: ctx.params.user.userEmail });

				const threshold = Number(invoicedUser._wallets?.length) + 1 || 1;

				this.logger.info("1. reduceNumberOfTransaction threshold", threshold);

				let achievements = await Achievement.find({}).populate({
					path: "_level",
					match: { required_trees: { $lte: threshold } }
				});

				this.logger.info("2. reduceNumberOfTransaction achievements", achievements);

				achievements = achievements.filter((achievement) => achievement._level && achievement._level.required_trees <= threshold);

				this.logger.info("4. reduceNumberOfTransaction achievements filtered", achievements);

				// Find and update user level
				const levels = await Level.findOne({
					required_trees: {
						$lte: threshold
					}
				}).sort({ required_trees: -1 });
				const userLevel = levels._id;

				this.logger.info("6. reduceNumberOfTransaction levels", levels);

				let iterationNumber = 0;

				// Add achievements to user, it will check if its there it won't add with addToSet
				for (const element of achievements.filter((x) => x._level !== null)) {
					if (element._level) {
						if (invoicedUser._achievements && !invoicedUser._achievements.includes(element._id)) {
							this.logger.info(`8.${iterationNumber} reduceNumberOfTransaction - New Achievement created.`);

							const achievementUpdate = {
								$addToSet: { _achievements: String(element._id) }
							};

							const updatedUser = await User.findOneAndUpdate({ userEmail: invoicedUser.userEmail }, achievementUpdate, { new: true })
								.populate("_achievements")
								.exec();

							ctx.call("v1.achievement.sendAchievementEmail", {
								userLang: "en",
								userEmail: updatedUser.userEmail,
								achievement: element
							});
						} else {
							this.logger.info(`10.${iterationNumber} reduceNumberOfTransaction - Achievement already exists for user.`);
						}
					} else {
						this.logger.info(`12.${iterationNumber} reduceNumberOfTransaction - element._level does not exist.`);
					}

					iterationNumber++;
				}

				// Update transactional data
				const data = {
					$inc: { numberOfTransaction: -1 },
					$set: { _level: String(userLevel) }
				};

				try {
					let resultFromReducting = await User.findOneAndUpdate({ userEmail: invoicedUser.userEmail }, data, { new: true }).populate("_achievements");

					if (!resultFromReducting) {
						throw new MoleculerError(strings.userReduceTrx, 401, "USER_HAS_NEGATIVE_NUMBER_OF_AVAILABLE_TRANSACTIONS", {
							message: strings.userReduceTrx,
							internalErrorCode: "user71"
						});
					}

					// TODO: Transactions for reaching out

					return resultFromReducting;
				} catch (error) {
					throw new MoleculerError(strings.userReduceTrx, 401, "ERROR_REDUCING_TRANSACTIONS", {
						message: error.message,
						internalErrorCode: "user70"
					});
				}
			}
		},

		// user40
		reduceUserCoupons: {
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail,
					numberOfCoupons: { $gte: 0 }
				};
				//(ctx.params.publicQrCode) ? "" : entity.numberOfCoupons = { $gte: 0 };

				let data = {
					$inc: { numberOfCoupons: -Number(1) }
				};
				//(ctx.params.publicQrCode) ? "" : data.$inc = { numberOfCoupons: -Number(ctx.params[0].costOfProduct) };

				console.log("USER reduceUserCoupons entity: ", entity);
				console.log("USER reduceUserCoupons data: ", data);

				try {
					let resultFromReducting = await User.findOneAndUpdate(entity, data, { new: true });
					if (!resultFromReducting) {
						throw new MoleculerError(
							"User has negative number of coupons. Please add coupons on profile page",
							401,
							"USER_HAS_NEGATIVE_NUMBER_OF_COUPONS",
							{
								message: "User has negative number of coupons",
								internalErrorCode: "user41"
							}
						);
					}
					return resultFromReducting;
				} catch (error) {
					throw new MoleculerError("Error in reducing coupons", 401, "ERROR_REDUCING_COUPONS", {
						message: error.message,
						internalErrorCode: "user40"
					});
				}
			}
		},

		populateUserTable: {
			// params: {
			// 	_id: { type: Object },
			// },
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail
				};

				let data = {
					$push: { _wallets: String(ctx.params._id) }
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
						internalErrorCode: "user30"
					});
				}
			}
		},

		removeItemFromUserId: {
			params: {
				userId: { type: "object" },
				itemId: { type: "object" }
			},
			async handler(ctx) {
				const { userId, itemId } = ctx.params;

				this.logger.info("removeItemFromUserId userId", userId);
				this.logger.info("removeItemFromUserId itemId", itemId);

				let data = {
					$pull: { _wallets: String(itemId) }
				};

				try {
					return await User.findOneAndUpdate(
						{
							_id: userId
						},
						data,
						{ new: true }
					).populate("_wallets");
				} catch (error) {
					throw new MoleculerError("Can not populate user table with wallet ids", 401, "POPULATE_BUG", {
						message: "User Not Found",
						internalErrorCode: "user30"
					});
				}
			}
		},

		addItemToUserId: {
			params: {
				userId: { type: "object" },
				itemId: { type: "object" }
			},
			async handler(ctx) {
				const { userId, itemId } = ctx.params;

				this.logger.info("addItemToUserId userId", userId);
				this.logger.info("addItemToUserId itemId", itemId);

				let data = {
					$push: { _wallets: String(itemId) }
				};

				try {
					return await User.findOneAndUpdate(
						{
							_id: userId
						},
						data,
						{ new: true }
					).populate("_wallets");
				} catch (error) {
					throw new MoleculerError("Can not populate user table with wallet ids", 401, "POPULATE_BUG", {
						message: "User Not Found",
						internalErrorCode: "user30"
					});
				}
			}
		},

		addProjectToUser: {
			params: {
				userEmail: { type: "email" }
				// project : {
				// 	_id: {type: "Number"}
				// }
			},
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail
				};
				let data = {
					$push: { _projects: String(ctx.params.project._id) }
				};

				try {
					return await User.findOneAndUpdate(entity, data, { new: true }) // upsert: true
						.populate("_projects");
				} catch (error) {
					throw new MoleculerError("Can not populate user table with wallet ids", 401, "POPULATE_BUG", {
						message: "User Not Found",
						internalErrorCode: "user30"
					});
				}
			}
		},

		deleteProjectFromUser: {
			async handler(ctx) {
				const { projectId, userId } = ctx.params;

				const entity = {
					_id: userId
				};
				let data = {
					$pull: { _projects: String(projectId) }
				};

				try {
					return await User.findOneAndUpdate(entity, data, { new: true }); // upsert: true
					//.populate("_projects");
				} catch (error) {
					throw new MoleculerError("Can not populate user table with wallet ids", 401, "POPULATE_BUG", {
						message: "User Not Found",
						internalErrorCode: "user30"
					});
				}
			}
		},

		registerUser: {
			params: {
				userEmail: { type: "email" },
				firstName: { type: "string" },
				lastName: { type: "string" },
				userPassword: { type: "string", min: 1 },
				recaptchaValue: { type: "string", min: 1 },
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] }
			},

			async handler(ctx) {
				try {
					const { recaptchaValue } = ctx.params;
					ctx;
					console.log("checking recaptcha values:", recaptchaValue);

					console.log("verify payload:", {
						event: {
							token: recaptchaValue,
							expectedAction: "register",
							siteKey: process.env.RECAPTCHA_SITEKEY
						}
					});

					let callToGoogle = await ctx.call("http.post", {
						url: `https://recaptchaenterprise.googleapis.com/v1/projects/projekat1-184714/assessments?key=${process.env.RECAPTCHA_SECRET}`,
						opt: {
							responseType: "json",
							json: {
								event: {
									token: recaptchaValue,
									expectedAction: "register",
									siteKey: process.env.RECAPTCHA_SITEKEY
								}
							}
						}
					});

					console.log("checked recaptcha:", callToGoogle);

					if (!callToGoogle || (callToGoogle && callToGoogle.riskAnalysis && callToGoogle.riskAnalysis.score < 0.5)) {
						throw new MoleculerError("Fail in recaptchaValue", 401, "USER_CANT_REGISTRATE", {
							message: "Fail in recaptchaValue",
							internalErrorCode: "recaptchaValue_1"
						});
					}
					ctx.params.userFullName = `${ctx.params.firstName} ${ctx.params.lastName}`;
					let clearPassword = Utils.generatePass();
					ctx.meta.clearPassword = clearPassword;
					let userAdded = await this.addUserToDB({ ctx, clearPassword });

					this.logger.info("registerUser userAdded", userAdded);

					// When user created, we created their achievement list as well
					// achievementList.map(async (achievement) => {
					// 	await ctx.call("v1.achievement.createAchievement", {
					// 		name: achievement.name,
					// 		description: achievement.description,
					// 		required_trees: achievement.required_trees,
					// 		userId: userAdded._id.toString(),
					// 	});
					// });

					let userEmail = ctx.params.userEmail;
					const sendEmail = await ctx.call("v1.email.registerUser", {
						userEmail: ctx.params.userEmail,
						userOrgPass: ctx.params.userPassword,
						firstName: ctx.params.firstName,
						authenticateLink: clearPassword,
						userLang: ctx.params.userLang
					});

					this.logger.info("registerUser sendEmail", sendEmail);

					return { sendEmail, userEmail };
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		authenticate: {
			params: {
				id: { type: "string", min: 2, max: 60 },
				userEmail: { type: "email" }
			},
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail,
					clearPassword: ctx.params.id
				};
				let data = { userVerified: 1 };
				try {
					await User.findOneAndUpdate(entity, data, { new: true });
					ctx.meta.$statusCode = 302;
					ctx.meta.$location = `${process.env.BLOKARIA_WEBSITE}/log-in-user`;
					return;
				} catch (error) {
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "user9"
					});
				}
			}
		},

		userFind: {
			// this is for LogIn
			rest: "POST /userfind",
			params: {
				userEmail: { type: "email" }
			},
			async handler(ctx) {
				const entity = {
					userEmail: ctx.params.userEmail,
					userVerified: 1
				};

				try {
					let user = await User.find(entity).populate({ path: "_achievements" }).populate({ path: "_level" });
					return user;
				} catch (error) {
					console.log("failed to execute user.userFind:", error);
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "user20"
					});
				}
			}
		},

		userGet: {
			rest: "POST /userGet",
			params: {
				userEmail: { type: "email", optional: true }
			},
			async handler(ctx) {
				this.logger.info("0. userGet START");
				let { userEmail } = ctx.params;
				const { user } = ctx.meta;

				if (user.userRole == 1 && userEmail) {
					userEmail = ctx.params.userEmail;
				} else {
					userEmail = user.userEmail;
				}
				const entity = {
					userEmail: userEmail,
					userVerified: 1
				};

				this.logger.info("1. userGet entity", entity);

				const noOfWalletsPlanted = await Wallet.find({ userEmail: user.userEmail, treePlanted: true }).exec();

				try {
					const userData = await User.find(entity, {
						clearPassword: 0,
						userPassword: 0
					})
						.populate("_achievements")
						.populate("_level")
						.exec();
					
					// Convert Mongoose document to plain object and add noOfWalletsPlanted
					if (userData && userData.length > 0) {
						const userObject = userData[0].toObject();
						userObject.noOfTreesPlanted = noOfWalletsPlanted ? noOfWalletsPlanted.length : 0;
						return [userObject];
					}
					
					return userData;
				} catch (error) {
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "user20"
					});
				}
			}
		},

		userGetMetrics: {
			rest: "GET /userMetrics",
			async handler(ctx) {
				const CARBON_YEARLY_FOOTPRINT = process.env.CARBON_YEARLY_FOOTPRINT;
				const TREE_REDUCE_FOOTPRINT = process.env.TREE_REDUCE_FOOTPRINT;

				const { userId } = ctx.meta.user;

				this.logger.info("1. userMetrics userId", userId);
				try {
					const user = await User.findById(userId).exec();
					if (!user) {
						throw new MoleculerError("User not found", 400, "USER_NOT_FOUND", {
							message: "User Not Found",
							internalErrorCode: "user212"
						});
					}

					//this.logger.info("2. userMetrics user", user);

					const noOfWallets = await Wallet.find({ userEmail: user.userEmail }).exec();
					const noOfWalletsPlanted = await Wallet.find({ userEmail: user.userEmail, treePlanted: true }).exec();

					this.logger.info("3. userMetrics noOfWallets.length", noOfWallets.length);
					this.logger.info("4. userMetrics user._wallets?.length", user._wallets?.length);

					if (noOfWallets.length !== user._wallets.length) {
						this.logger.error("5. userMetrics are not equal", noOfWallets.length, user._wallets?.length);
						// throw new MoleculerClientError(
						// 	`Wallet numbers are not equal noOfWallets=${noOfWallets.length} : user._wallets=${user._wallets?.length} : planted_trees_count=${user.planted_trees_count}`,
						// 	400,
						// 	"NUMBERS ARE NOT EQUAL",
						// 	{
						// 		message: "Items are not equeal",
						// 		internalErrorCode: "notequal123"
						// 	}
						// );
					}

					// Check the number of items in user._wallets
					const itemsAmount = user._wallets?.length || 0;

					const value = CARBON_YEARLY_FOOTPRINT - itemsAmount * TREE_REDUCE_FOOTPRINT;

					this.logger.info("7. userMetrics itemsAmount", itemsAmount);
					this.logger.info("8. userMetrics value", value);

					let percentage = 0;
					if (itemsAmount > 0) {
						percentage = (TREE_REDUCE_FOOTPRINT / CARBON_YEARLY_FOOTPRINT) * 100 * itemsAmount;
					}

					this.logger.info("9. userMetrics percentage", percentage);

					return {
						ok: true,
						tonsPerYear: CARBON_YEARLY_FOOTPRINT,
						tonsUserConsume: value,
						percentage: percentage,
						noOfWallets: noOfWallets.length,
						noOfTreesPlanted: noOfWalletsPlanted.length,
						userWallets: user._wallets?.length
					};
				} catch (err) {
					this.logger.error("10. userMetrics ERROR", err);
					throw new MoleculerError(err.message, 500, "METRICS_FETCH_FAILED", {
						message: err.message,
						internalErrorCode: "metrics500"
					});
				}
			}
		},

		updateUser: {
			params: {
				userEmail: { type: "email" },
				keyName: { type: "any" },
				valueName: { type: "any" },
				emailVerificationId: { type: "number" }
			},

			async handler(ctx) {
				const entity = { userEmail: ctx.params.userEmail };
				let data = { [ctx.params.keyName]: ctx.params.valueName };

				try {
					if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
						throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
							message: "Verification email failed",
							internalErrorCode: "email20"
						});

					return await User.findOneAndUpdate(entity, data, { new: true });
				} catch (error) {
					throw new MoleculerError(error.message, 401, "FAIL UPDATE USER", {
						message: error.message,
						internalErrorCode: "user505"
					});
				}
			}
		},

		getUserByItemId: {
			params: {
				itemId: { type: "object" }
			},

			async handler(ctx) {
				const { itemId } = ctx.params;

				this.logger.info("getUserByItemId itemId", itemId);

				try {
					return await User.findOne(
						{
							_wallets: itemId
						},
						{ new: true }
					);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "FAIL TO GET USER", {
						message: error.message,
						internalErrorCode: "user5215"
					});
				}
			}
		},

		// user60
		resetPassword: {
			params: {
				userEmail: { type: "email" },
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] }
			},
			async handler(ctx) {
				const { userEmail, userLang } = ctx.params;

				try {
					let getUserData = await this.actions.userFind({ userEmail: userEmail });

					if (getUserData.length < 1) {
						throw new MoleculerError("User does not exist", 401, "USER_DOES_NOT_EXIST", {
							message: "User does not exist",
							internalErrorCode: "user60"
						});
					}
					// here we should add updateUser availableForPassChange boolean

					let sentResetEmail = await ctx.call("v1.email.resetEmail", {
						userFullname: getUserData[0].userFullName,
						userEmail: userEmail,
						clearPassword: getUserData[0].clearPassword,
						userLang: userLang
					});

					return sentResetEmail;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		// user50
		resetPasswordCode: {
			params: {
				clearPassword: { type: "string" },
				userEmail: { type: "email" },
				userPassword: { type: "string", min: 8 }
			},
			async handler(ctx) {
				const { userEmail, clearPassword, userPassword } = ctx.params;

				if (!userPassword) {
					throw new MoleculerClientError("Password is not provided", 400, "USER_PASSWORD_ERROR", {
						message: "Password is required",
						internalErrorCode: "auth20"
					});
				}

				if (userPassword.length < 8) {
					throw new MoleculerClientError("Password is too short", 400, "USER_PASSWORD_ERROR", {
						message: "Password must be at least 8 characters long",
						internalErrorCode: "auth21"
					});
				}

				let users = await ctx.call("user.userFind", { userEmail });
				const user = users ? users[0] : null;
				console.log("user:", user);
				if (!user) {
					throw new MoleculerClientError("User not found.", 422, "USER_FIND_ERROR", {
						message: "Email not found",
						internalErrorCode: "auth10"
					});
				}

				if (user.clearPassword !== clearPassword) {
					throw new MoleculerError("Invalid reset token provided", 401, "RESET_TOKEN_MISMATCH", {
						message:
							"The reset token you provided does not match our records. Please ensure you are using the correct password reset link or request a new one.",
						internalErrorCode: "user51"
					});
				}

				const { passwordHash: salt } = user;
				const saltRounds = 10;
				let hashedPassword;

				try {
					hashedPassword = await bcrypt.hash(userPassword + salt, saltRounds);
				} catch (err) {
					throw new MoleculerError("Hashing error", 500, "HASHING_ERROR", {
						message: err.message,
						internalErrorCode: "hashError01"
					});
				}

				let data = {
					userPassword: hashedPassword,
					clearPassword: Utils.generatePass()
				};

				try {
					let userFind = await User.findOneAndUpdate({ userEmail }, data, { new: true });

					if (!userFind) {
						throw new MoleculerError("User and Hash do not match", 401, "UPDATE_PASSWORD_FAIL_HASH", {
							message: "User and Hash do not match",
							internalErrorCode: "user51"
						});
					}

					return "Password successfully reset";
				} catch (error) {
					throw new MoleculerError(error.message, 500, "UPDATE_PASSWORD_FAIL", {
						message: error.message,
						internalErrorCode: "user50"
					});
				}
			}
		},

		healthcheck: {
			async handler() {
				return "Health is OK";
			}
		},

		getUsersEmail: {
			async handler(ctx) {
				const users = await User.find({ userRole: { $in: [5, 3, 1] }, userVerified: 1 }, { userEmail: 1, userFullName: 1 }).exec();
				return users;
			}
		}
	},

	methods: {
		// user10
		async addUserToDB({ ctx, clearPassword }) {
			try {
				const { userEmail, userPassword, userFullName } = ctx.params;

				const saltRounds = 10;
				const salt = await bcrypt.genSalt(saltRounds);
				const hashedPassword = await bcrypt.hash(userPassword + salt, saltRounds);

				const userEntity = {
					userEmail: userEmail,
					userFullName: userFullName,
					passwordHash: salt,
					userPassword: hashedPassword,
					clearPassword: clearPassword
				};
				console.log("clearPassword:", clearPassword);
				console.log("salt:", salt);
				console.log("hashedPassword:", hashedPassword);
				console.log("userPassword:", userPassword);
				let user = new User(userEntity);
				return await user.save();
			} catch (error) {
				throw new MoleculerError(error.message, 501, "ERROR_INSERT_INTO_DB", {
					message: error.message,
					internalErrorCode: "user10"
				});
			}
		}
	}
};
