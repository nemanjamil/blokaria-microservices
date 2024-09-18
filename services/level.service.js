"use strict";

const DbService = require("moleculer-db");
const { MoleculerError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Level = require("../models/Level");
const { levelsData } = require("../data/levels");
const Achievement = require("../models/Achievement");
const { achievementList } = require("../data/achievement");

const levelService = {
	name: "level",
	version: 1,
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Level,
	$noVersionPrefix: true,
	actions: {
		createLevel: {
			params: {
				name: { type: "string" },
				required_trees: { type: "number" }
			},
			async handler(ctx) {
				const { name, required_trees } = ctx.params;

				try {
					const level = new Level({ name, required_trees });
					await level.save();
					return level.toJSON();
				} catch (err) {
					const message = `Failed to create level for name of:'${name}'`;
					throw new MoleculerError(message, 400, "LEVEL_CREATE_FAILED", {
						message: err.message || message,
						internalErrorCode: "levelCreateFailed"
					});
				}
			}
		},
		getLevels: {
			async handler() {
				try {
					return Level.find({});
				} catch (e) {
					throw new MoleculerError("Failed to get levels", 400, "LEVEL_GET_FAILED", {
						message: e.message || e,
						internalErrorCode: "levelGetFailed"
					});
				}
			}
		},
		updateLevel: {
			params: {
				id: { type: "string" },
				name: { type: "string" },
				required_trees: { type: "number" }
			},
			async handler(ctx) {
				const { id, name, required_trees } = ctx.params;

				try {
					return Level.findByIdAndUpdate(id, { name, required_trees }, { new: true });
				} catch (e) {
					throw new MoleculerError("Failed to update level", 400, "LEVEL_UPDATE_FAILED", {
						message: e.message || e,
						internalErrorCode: "levelUpdateFailed"
					});
				}
			}
		},
		deleteLevel: {
			params: {
				id: { type: "string" }
			},
			async handler(ctx) {
				const { id } = ctx.params;
				try {
					return Level.findOneAndDelete(id);
				} catch (e) {
					throw new MoleculerError("Failed to delete level", 400, "LEVEL_DELETE_FAILED", {
						message: e.message || e,
						internalErrorCode: "levelDeleteFailed"
					});
				}
			}
		}
	},
	async started() {
		const levels = await Level.find({});
		const levelsArray = [];
		if (levels.length === 0) {
			for await (const level of levelsData) {
				const createdLevel = await this.actions.createLevel(level);
				levelsArray.push(String(createdLevel._id));
			}
		}

		await this.broker.waitForServices("v1.achievement");
		const achievements = await Achievement.find({});
		if (achievements.length === 0) {
			let i = 0;
			for (const element of achievementList) {
				const achievement = { ...element, level: levelsArray[i] };
				i += 1;
				this.broker.call("v1.achievement.createAchievement", achievement);
			}
		}

	}
};

module.exports = levelService;
