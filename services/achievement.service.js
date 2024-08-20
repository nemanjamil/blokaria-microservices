const DbService = require("moleculer-db");
const { MoleculerError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Achievement = require("../models/Achievement");
const User = require("../models/User");

const achievementService = {
	name: "achievement",
	version: 1,
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Achievement,
	$noVersionPrefix: true,
	actions: {
		createAchievement: {
			params: {
				uid: { type: "string" },
				name: { type: "string" },
				description: { type: "string" },
				userId: { type: "string" },
			},
			async handler(ctx) {
				const { uid, name, description, userId } = ctx.params;

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
						uid,
						name,
						description,
						user,
					});
					await achievement.save();
					return achievement.toJSON();
				} catch (err) {
					const message = `Failed to create achievemnt for user with id '${userId}' and uid '${uid}'`;
					throw new MoleculerError(message, 400, "ACHIEVEMENT_FAILED", {
						message: err.message || message,
					});
				}
			},
		},
	},
};

module.exports = achievementService;
