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
		editProjectName: {
			params: {
				projectId: { type: "string" },
				projectNewName: { type: "string", min: 2, max: 60 },
			},
			async handler(ctx) {
				try {
					const filter = { _id: ctx.params.projectId };
					const update = { projectName: ctx.params.projectNewName };

					return await Project.findOneAndUpdate(filter, update);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR EDITING PROJECT NAME", {
						message: error.message,
						internalErrorCode: "project10",
					});
				}
			},
		},
		deleteProject: {
			params: {
				projectId: { type: "string" },
			},
			async handler(ctx) {
				try {
					//TODO select upit u bazu da proverimo da li postoji neki nft vezan za ovaj proj. ako postoji, delete nije moguc

					//TODO ako ne postoji, slobodno brisi projekat iz baze
					return await Project.deleteOne({ _id: ctx.params.projectId });
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR DELETING PROJECT", {
						message: error.message,
						internalErrorCode: "project10",
					});
				}
			},
		},
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
						_user,
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
