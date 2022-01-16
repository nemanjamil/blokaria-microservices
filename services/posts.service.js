"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const Post = require("../models/Post.js");

module.exports = {
	name: "post",
	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb://localhost/blokariawallet", { useUnifiedTopology: true }),
	model: Post,

	actions: {
		mikiLutkica: {
			async handler(ctx) {
				this.logger.warn("GGGG", ctx.params);
				try {
					this.logger.warn("TRY");
					let findAll = await Post.find();
					this.logger.warn("findAll", findAll);
					return findAll;
				} catch (error) {
					return error;
				}
			},
		},
	},
};
