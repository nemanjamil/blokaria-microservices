"use strict";

const DbService = require("moleculer-db");
const { MoleculerError } = require("moleculer").Errors;
const dbConnection = require("../utils/dbConnection");
const Level = require("../models/level");

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
	}
};

module.exports = levelService;
