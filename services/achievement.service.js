"use strict";

const DbService = require("moleculer-db");
const { MoleculerError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Achievement = require("../models/Achievement");
const User = require("../models/User");
const { linkedInExchangeCode, linkedInGetUserProfile, createLinkedInPost } = require("../utils/linkedin");

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
		bccemail: "bcc@blokaria.com"
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
				this.logger.info("publish achievement on linkedin TODO:");
				const code = ctx.params.code;
				const { userId } = ctx.meta.user;

				try {
					const user = await User.findById(userId, { _id: 1 }).populate({ path: "_level" }).exec();
					if (!user) {
						throw new MoleculerError("User not found", 404, "USER_SEARCH_FAILED", {
							message: "User not found"
						});
					}

					this.logger.info("populated user: ", user);
					this.logger.info("populated user (JSON): ", user.toJSON());

					this.logger.info("user's current level: ", user._level);

					const achievement = await Achievement.findOne({ user, completed: true, name: user.level }).exec();

					if (!achievement) {
						const message = "User does not have any achievements";
						throw new MoleculerError(message, 404, "ACHIEVEMENT_FETCH", {
							message
						});
					}

					const response = await linkedInExchangeCode(code);

					this.logger.info("1. addCertificateToLinkedIn  exchange response", response);

					const userProfile = await linkedInGetUserProfile(response.access_token);

					this.logger.info("2. addCertificateToLinkedIn  user profile", userProfile);

					const imgHost = process.env.MOLECULER_SERVICE_LOCATION;

					const shareResponse = await createLinkedInPost(
						userProfile.sub,
						response.access_token,
						achievement,
						`${imgHost}levels/${achievement.name.toLowerCase()}.jpg`
					);

					this.logger.info("3. addCertificateToLinkedIn  share response", shareResponse);

					return {
						ok: true,
						share: shareResponse,
						achievement: achievement.toJSON()
					};
				} catch (err) {
					console.log("error while uploading post to linkedin:", err);
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
				console.log("ctx.meta user: ", user);
				const userDb = await User.findById(user.userId, { _id: 1 }).populate({ path: "_level" }).exec();
				console.log("database fetched user: ", userDb);
				console.log("user level:", userDb.level);
				const achievement = await Achievement.findOne({
					user: user.userId,
					completed: true,
					name: user.level
				}).exec();
				if (!achievement) {
					throw new MoleculerError("No achievement found for publishing", 400, "ACHIEVEMENT_NOT_FOUND", { msg: "no achievements on user" });
				}
				const achievementPostTemplate = require("../public/templates/en/achievementPost.json");

				const imgHost = process.env.MOLECULER_SERVICE_LOCATION;

				const achievementUrl = `${imgHost}levels/${achievement.name.toLowerCase()}.jpg`;

				this.logger.info("get achievement post template triggered");
				return {
					template: achievementPostTemplate,
					achievement: achievement ? achievement.toJSON() : null,
					level: userDb.level,
					image: achievementUrl
				};
			}
		},
		createAchievement: {
			params: {
				name: { type: "string" },
				description: { type: "string" },
				level: { type: "string" }
			},
			async handler(ctx) {
				const { name, description, level } = ctx.params;

				try {
					const achievement = new Achievement({
						name,
						description,
						_level: level
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
					const achievements = await Achievement.find({}).populate({ path: "_level" }).sort({ "_level.required_trees": 1 });

					return achievements;
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
				level: { type: "string" }
			},
			async handler(ctx) {
				const { id, name, description, level } = ctx.params;
				try {
					const updatedAchievement = Achievement.findByIdAndUpdate(
						id,
						{
							name,
							description,
							_level: level
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
				const { userLang, userEmail, achievement } = ctx.params;
				const source = fs.readFileSync(`./public/templates/${userLang}/newAchievement.html`, "utf-8").toString();

				console.log("sendAchievementEmail source");

				const template = handlebars.compile(source);

				const replacements = {
					name: achievement.name,
					achievement
				};

				const htmlToSend = template(replacements);

				console.log("sendAchievementEmail htmlToSend");

				try {
					let transporter = await this.getTransporter();

					console.log("sendAchievementEmail transporter");

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: "\"Blokaria 👻\" <service@blokaria.com>",
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "New Achievement is created for you ✔",
						html: htmlToSend
					};

					console.log("sendAchievementEmail mailOptions");

					return await transporter.sendMail(mailOptions);
				} catch (error) {
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
