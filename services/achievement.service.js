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
				pass: "yourpass",
			},
		},
	},
	metadata: {
		scalable: true,
		priority: 5,
		bccemail: "bcc@blokaria.com",
	},
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Achievement,
	$noVersionPrefix: true,
	actions: {
		createAchievement: {
			params: {
				name: { type: "string" },
				description: { type: "string" },
				userId: { type: "string" },
				required_trees : { type: "number" }
			},
			async handler(ctx) {
				const { name, description, userId, required_trees } = ctx.params;

				try {
					const user = await User.findById(userId);
					if (!user) {
						const message = `No user with id '${userId}' found for target achievement`;
						this.logger.error(message);
						throw new MoleculerError(message, 400, "ACHIEVEMENT_FAILED", {
							message,
						});
					}
					const achievement = new Achievement({
						name,
						description,
						user,
						required_trees
					});
					await achievement.save();
					return achievement.toJSON();
				} catch (err) {
					const message = `Failed to create achievemnt for user with id '${userId}'`;
					throw new MoleculerError(message, 400, "ACHIEVEMENT_FAILED", {
						message: err.message || message,
					});
				}
			},
		},

		getUserAchievements: {
			rest: "GET achievement",
			async handler(ctx) {
				const { userId } = ctx.meta.user;

				try {
					const user = await User.findById(userId).exec();

					if (!user) {
						throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
							message: "User Not Found",
							internalErrorCode: "achiuser404",
						});
					}

					return  await Achievement.find({ user }).sort({required_trees: 1});
				} catch (err) {
					throw new MoleculerError("User not found", 401, "USER_NOT_FOUND", {
						message: "User Not Found",
						internalErrorCode: "achiuser404",
					});
				}
			},
		},

		updateAchievements: {
			rest: "PUT achievement",
			async handler(ctx) {
				const { userId } = ctx.meta.user;

				try {
					const user = await User.findById(userId).exec();

					const entity = {
						userEmail: user.userEmail,
						required_trees: { $lte: user.planted_trees_count },
						is_email_send: { $eq: false}
					};

					const achievementList = await Achievement.find(entity);

					for (const achievement of achievementList) {
						ctx.call("v1.achievement.sendAchievementEmail", {
							userLang: "en",
							userEmail: user.userEmail,
							achievement: achievement,
						});
					}

					const data = { $set: {completed: true, is_email_send: true} };
					return await Achievement.updateMany(entity, data, {new: true});

				} catch (err) {
					throw new MoleculerError("Achievement update fail", 401, "ACHIEVEMENT_FAILED", {
						message: "Achievement update fail",
						internalErrorCode: "achiupdatefail",
					});
				}
			}
		},

		sendAchievementEmail: {
			params: {
				userLang: { type: "string" },
				userEmail: { type: "string" },
				achievement: { type: "object" },
			},
			async handler(ctx) {
				const { userLang, userEmail, achievement } = ctx.params;
				const source = fs.readFileSync(`./public/templates/${userLang}/newAchievement.html`, "utf-8").toString();

				console.log("sendAchievementEmail source");

				const template = handlebars.compile(source);

				const replacements = {
					name: achievement.name,
					achievement,
				};

				const htmlToSend = template(replacements);

				console.log("sendAchievementEmail htmlToSend");

				try {
					let transporter = await this.getTransporter();

					console.log("sendAchievementEmail transporter");

					const mailOptions = {
						// eslint-disable-next-line quotes
						from: '"Blokaria 👻" <service@blokaria.com>',
						to: `${userEmail}`,
						bcc: `${this.metadata.bccemail}`,
						subject: "Korisnik je zainteresovan za Vaš proizvod ✔",
						html: htmlToSend,
					};

					console.log("sendAchievementEmail mailOptions");

					return await transporter.sendMail(mailOptions);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_SENDING_EMAIL", {
						message: error.message,
						internalErrorCode: "email50",
					});
				}
			},
		},

		postAchievementOnLinkedIn: {
			params: {
				achievementId: { type: "string", required: true },
				code: { type: "string", required: true },
			},
			async handler(ctx) {
				const { userId } = ctx.meta.user;
				const { achievementId, code } = ctx.params;

				try {
					const user = await User.findById(userId, { _id: 1 }).exec();
					if (!user) {
						throw new MoleculerError("User not found", 404, "USER_SEARCH_FAILED", {
							message: "User not found",
						});
					}

					const achievement = await Achievement.findOne({ _id: achievementId, user }).exec();

					if (!achievement)
						throw new MoleculerError("Achievement not found", 404, "USER_SEARCH_FAILED", {
							message: "Achievement not found",
						});

					const response = await linkedInExchangeCode(code);

					this.logger.info("1. addCertificateToLinkedIn  exchange response", response);

					const userProfile = await linkedInGetUserProfile(response.access_token);

					this.logger.info("2. addCertificateToLinkedIn  user profile", userProfile);

					const shareResponse = await createLinkedInPost(
						userProfile.sub,
						response.access_token,
						achievement,
						"https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwww.ccinsignia.com%2Fwp-content%2Fuploads%2F2020%2F03%2FCrook-Co-Sheriff-Badge-scaled.jpg&f=1&nofb=1&ipt=bc4d9aca37ca5c73fc255ca6f60c34e49d6cdfac57200d59172374dd87ad4644&ipo=images"
					);

					this.logger.info("3. addCertificateToLinkedIn  share response", shareResponse);

					return {
						ok: true,
						share: shareResponse,
					};
				} catch (err) {
					const message = `Failed to post achievement on linkedin for user with id '${userId}' and achievementId '${achievementId}'`;
					throw new MoleculerError(message, 400, "ACHIEVEMENT_FAILED", {
						message: err.message || message,
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

				this.logger.info("adminEmail", adminEmail);
				this.logger.info("adminPassword", adminPassword);

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

module.exports = achievementService;
