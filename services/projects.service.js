"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const { MoleculerError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Project = require("../models/Project.js");

module.exports = {
	name: "project",
	logger: true,
	mixins: [DbService, axiosMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Project,

	actions: {
		addNewProject: {
			params: {
				projectName: { type: "string", min: 2, max: 60 },
				//projectDescription: { type: "string", max: 255 },
			},
			async handler(ctx) {
				try {
					let _user = ctx.meta.user.userId;
					let data = {
						projectName: ctx.params.projectName,
						userId: ctx.meta.userId,
						_user
						//	projectDescription: ctx.params.projectDescription,
					};
					const { userEmail } = ctx.meta.user;
					let project = new Project(data);
					await project.save();
					await ctx.call("user.addProjectToUser", { project, userEmail });
					return project;

				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR CREATING PROJECT", {
						message: error.message,
						internalErrorCode: "project10",
					});
				}
			},
		},
	},
	methods: {},
};
