"use strict";

const DbService = require("moleculer-db");
const { MoleculerError, MoleculerClientError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Achievement = require("../models/Achievement");
const User = require("../models/User");
const { linkedInExchangeCode, linkedInGetUserProfile, createLinkedInPost } = require("../utils/linkedin");
const Utils = require("../utils/utils");
const nodemailer = require("nodemailer");
const fs = require("fs");
const handlebars = require("handlebars");

const achievementService = {
	name: "achievement",
	version: 1,
	settings: {
		from: "sender@moleculer.services",
		transport: {
			service: "gmail",
			auth: {
				user: "gmail.user@gmail.com",
				pass: "yourpass"
			}
		}
	},
	metadata: {
		scalable: true,
		priority: 5,
		bccemail: "bcc@blokaria.com",
		nameOfWebSite: "NaturePlant"
	},
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Achievement,
	$noVersionPrefix: true,
	actions: {
		publishAchievementLinkedInPost: {
			rest: "POST achievement/linkedin/post",
			params: { code: "string" },
			async handler(ctx) {
				this.logger.info("1. publishAchievementLinkedInPost publish achievement on linkedin TODO:");
				const code = ctx.params.code;
				const { userId } = ctx.meta.user;

				try {
					const user = await User.findById(userId, { _id: 1 }).populate({ path: "_level" }).exec();
					if (!user) {
						throw new MoleculerError("User not found", 404, "USER_SEARCH_FAILED", {
							message: "User not found"
						});
					}

					this.logger.info("3. publishAchievementLinkedInPost populated user: ", user);
					this.logger.info("5. publishAchievementLinkedInPostpopulated user (JSON): ", user.toJSON());

					this.logger.info("7. publishAchievementLinkedInPost user's current level: ", user._level);

					const achievement = await Achievement.findOne({ _level: user._level._id }).exec();

					this.logger.info("9. publishAchievementLinkedInPost achievement: ", achievement);

					if (!achievement || Object.keys(achievement).length === 0) {
						const message = "User does not have any achievements";
						throw new MoleculerError(message, 404, "ACHIEVEMENT_FETCH", {
							message
						});
					}

					const response = await linkedInExchangeCode(code);

					this.logger.info("10. publishAchievementLinkedInPost exchange response", response);

					const userProfile = await linkedInGetUserProfile(response.access_token, this.logger);

					this.logger.info("12. publishAchievementLinkedInPost user profile", userProfile);

					if (!userProfile) {
						throw new MoleculerClientError("userProfile doesn't exist", 404, "ERROR_ON_GETTING_LIN_USERINFO", {
							message: "Error on getting userInfo from LinkedIn"
						});
					}

					const imgHost = process.env.MOLECULER_SERVICE_LOCATION;

					this.logger.info("13. publishAchievementLinkedInPost imgHost", imgHost);

					const shareResponse = await createLinkedInPost(
						userProfile.sub,
						response.access_token,
						achievement,
						`${imgHost}${achievement.image.completed}`,
						this.logger
					);

					this.logger.info("15. publishAchievementLinkedInPost share response --- DONE -----", shareResponse);

					return {
						ok: true,
						share: shareResponse,
						achievement: achievement.toJSON()
					};
				} catch (err) {
					this.logger.error("18. publishAchievementLinkedInPost ERROR FINAL:", err);
					const message = err ? (err.message ? err.message : "failed to upload linkedin post") : "failed to upload linkedin post";
					throw new MoleculerError(message, 500, "LINKEDIN_API", {
						message
					});
				}
			}
		},
		getAchievementPostPreview: {
			async handler(ctx) {
				const user = ctx.meta.user;

				this.logger.info("1. getAchievementPostPreview ctx.meta user: ", user);
				const userDb = await User.findById(user.userId, { _id: 1 }).populate({ path: "_level" }).populate("_achievements").exec();

				this.logger.info("2. getAchievementPostPreview database fetched user: ", userDb);
				this.logger.info("4. getAchievementPostPreview user level:", userDb._level);

				if (!userDb._achievements.length) {
					this.logger.error("5. getAchievementPostPreview _achievements:", userDb._achievements.length);
					const message = "There are no achievement for this user.";
					throw new MoleculerClientError("Area Creation Failed", 404, "MISSING_ACHIEVEMENT", {
						message
					});
				}

				const achievement = userDb._achievements.find((achievement) => String(achievement._level) === String(userDb._level._id));

				this.logger.info("6. getAchievementPostPreview achievement:", achievement);

				if (userDb._achievements.length === 0) {
					this.logger.error("8. getAchievementPostPreview ERROR: No achievement found for publishing");
					throw new MoleculerError("No achievement found for publishing", 400, "ACHIEVEMENT_NOT_FOUND", { msg: "no achievements on user" });
				}
				const achievementPostTemplate = require("../public/templates/en/achievementPost.json");

				const imgHost = process.env.MOLECULER_SERVICE_LOCATION;

				const achievementUrl = `${imgHost}${achievement.image.completed}`;
				const salt = process.env.ACHIEVEMENTS_ENCRYPT_KEY;
				const encrypt = Utils.cipher(salt);
				const userEmail = encrypt(user.userEmail);
				this.logger.info("10. getAchievementPostPreview get achievement post template triggered");
				return {
					template: achievementPostTemplate,
					achievement: achievement ? achievement : null,
					achievementUrl: `${process.env.BLOKARIA_WEBSITE}/achievements/${userEmail}`,
					level: userDb._level,
					image: achievementUrl
				};
			}
		},
		createAchievement: {
			params: {
				name: { type: "string" },
				description: { type: "string" },
				image: { type: "object" },
				level: { type: "string" }
			},
			async handler(ctx) {
				const { name, description, level, image } = ctx.params;

				try {
					const achievement = new Achievement({
						name,
						description,
						_level: level,
						image
					});
					await achievement.save();
					return achievement.toJSON();
				} catch (err) {
					const message = `Failed to create achievemnt for name of:'${name}'`;
					throw new MoleculerError(message, 400, "ACHIEVEMENT_FAILED", {
						message: err.message || message
					});
				}
			}
		},

		getAchievements: {
			rest: "GET achievement",
			async handler() {
				try {
					return Achievement.find()
						.populate({
							path: "_level",
							options: { sort: { "_level.required_trees": 1 } }
						})
						.exec();
				} catch (e) {
					console.log("E", e);
					throw new MoleculerError("Achievements not found", 400, "ACHIEVEMENT_NOT_FOUND", {
						message: "Achievements not found",
						internalErrorCode: "achi404"
					});
				}
			}
		},

		updateAchievement: {
			rest: "PUT achievement",
			params: {
				id: { type: "string" },
				name: { type: "string" },
				description: { type: "string" },
				level: { type: "string" },
				image: { type: "object" }
			},
			async handler(ctx) {
				const { id, name, description, level, image } = ctx.params;
				try {
					const updatedAchievement = Achievement.findByIdAndUpdate(
						id,
						{
							name,
							description,
							_level: level,
							image
						},
						{ new: true, runValidators: true }
					);

					if (!updatedAchievement) {
						throw new MoleculerError("Achievement Not Found", 404, "ACHIEVEMENT_NOT_FOUND", {
							message: "The achievement with the given ID was not found."
						});
					}

					return updatedAchievement;
				} catch (e) {
					throw new MoleculerError("Achievement Update failed", 400, "ACHIEVEMENT_UPDATE_FAILED", {
						message: e.message || e.message,
						internalErrorCode: "achifail"
					});
				}
			}
		},

		deleteAchievement: {
			rest: "DELETE achievement",
			params: {
				id: { type: "string" }
			},
			async handler(ctx) {
				const { id } = ctx.params;
				try {
					return Achievement.findOneAndDelete(id);
				} catch (e) {
					throw new MoleculerError("Achievement delete failed", 400, "ACHIEVEMENT_DELETE_FAILED", {
						message: e.message || e.message,
						internalErrorCode: "achideletefail"
					});
				}
			}
		},

		sendAchievementEmail: {
			params: {
				userLang: { type: "string" },
				userEmail: { type: "string" },
				achievement: { type: "object" }
			},
			async handler(ctx) {
				this.logger.info("1. sendAchievementEmail START", ctx.params);
				const { userLang, userEmail, achievement } = ctx.params;
				const source = fs.readFileSync(`./public/templates/${userLang}/newAchievement.html`, "utf-8").toString();
				const user = await User.findOne({ userEmail: userEmail });
				const template = handlebars.compile(source);
				const replacements = {
					userFirstName: user.userFullName.split(" ")[0],
					achievementName: achievement.name,
					description: achievement.description,
					achievment: achievement.image.completed,
					backendUrl: process.env.MOLECULER_SERVICE_LOCATION,
					frontendUrl: process.env.BLOKARIA_WEBSITE,
					domainEmail: process.env.ADMIN_EMAIL
				};

				this.logger.info("2. sendAchievementEmail replacements", replacements);

				const htmlToSend = template(replacements);

				try {
					let transporter = await this.getTransporter();

					console.log("sendAchievementEmail transporter");

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: `"${this.metadata.nameOfWebSite} 🌳" ${process.env.ADMIN_EMAIL}`,
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "New Achievement is created for you ✔",
						html: htmlToSend
					};

					this.logger.info("3. sendAchievementEmail mailOptions");

					let sendEmailRes = await transporter.sendMail(mailOptions);

					this.logger.info("5. sendAchievementEmail sendEmailRes", sendEmailRes);

					return sendEmailRes;
				} catch (error) {
					this.logger.error("5. sendAchievementEmail ERRPR", error);

					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50"
					});
				}
			}
		}
	},

	methods: {
		sendMailMethod: {
			async handler() {
				return "sendMailMethod";
			}
		},
		getTransporter: {
			async handler() {
				let adminEmail = process.env.ADMIN_EMAIL;
				let adminPassword = process.env.PASSW_EMAIL;

				this.logger.info("adminEmail", adminEmail);
				this.logger.info("adminPassword", adminPassword);

				return nodemailer.createTransport({
					host: "mail.blokaria.com",
					port: 465,
					secure: true, // true for 465, false for other ports
					auth: {
						user: adminEmail,
						pass: adminPassword
					}
				});
			}
		}
	}
};

module.exports = achievementService;
