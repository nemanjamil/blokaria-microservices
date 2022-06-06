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
		//add, delete, update, get all nfts per project
		addNewProject: {
			params: {
				//odradi validaciju
				projectName: { type: "string", min: 4, max: 60 },
				//userId: { type: "string" },
				//projectDescription: { type: "string", max: 255 },
			},
			async handler(ctx) {
				try {
					let data = {
						projectName: ctx.params.projectName,
						userId: ctx.meta.userId,
						//	projectDescription: ctx.params.projectDescription,
					};
					let project = new Project(data);
					await project.save();
					await project.populate("_user").populate(String(ctx.params.userId)).execPopulate();
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},
	},
	methods: {},
};
