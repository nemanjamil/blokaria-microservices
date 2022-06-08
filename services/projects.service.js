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
						internalErrorCode: "project20",
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
					return await Project.deleteOne({ _id: ctx.params.projectId });
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR DELETING PROJECT", {
						message: error.message,
						internalErrorCode: "project10",
					});
				}
			},
		},
		addQrCodeToProject: {
			params: {
				projectId: { type: "string" },
				itemId: { type: "string" },
			},
			async handler(ctx) {
				try {

					const { itemId, projectId } = ctx.params;

					const entity = {
						_id: projectId,
					};

					let data = {
						$addToSet: { "_wallets": String(itemId) }
					};

					// getCurrentProject
					let getOldProjectId = await ctx.call("wallet.getProjectIdFromQrCode", { itemId });
					let projectIdOld = getOldProjectId[0]._project;

					// UPDATE NEW PROJECT
					await Project.findOneAndUpdate(entity, data, { new: true });
					let projectAdded = await ctx.call("wallet.addProjectToWallet", { projectId, itemId });

					let arrayOfQrCodeObject = [];
					if (projectAdded.length > 0) {
						projectAdded.map((item) => {
							arrayOfQrCodeObject.push(item._id);
						});
					}

					let qrCodesInProject = {
						"_wallets": arrayOfQrCodeObject
					};

					await Project.findOneAndUpdate(entity, qrCodesInProject, { new: true });


					// UPDATE OLD PROJECT
					let getAllQrCodesFromProjectRes = await ctx.call("wallet.getAllQrCodesFromProject", { projectIdOld });

					let arrayOfQrCodeObjectOld = [];
					if (getAllQrCodesFromProjectRes.length > 0) {
						getAllQrCodesFromProjectRes.map((item) => {
							arrayOfQrCodeObjectOld.push(item._id);
						});
					}

					let qrCodesInProjectOld = {
						"_wallets": arrayOfQrCodeObjectOld
					};

					const entityOld = {
						_id: projectIdOld,
					};

					await Project.findOneAndUpdate(entityOld, qrCodesInProjectOld, { new: true });

					return projectAdded;

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
