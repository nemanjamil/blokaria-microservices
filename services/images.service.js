"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const Image = require("../models/Image");

const { MoleculerClientError, MoleculerError } = require("moleculer").Errors;
const { ForbiddenError } = require("moleculer-web").Errors;
// throw new MoleculerError("Something happened", 501, "ERR_SOMETHING", { a: 5, nodeID: "node-666" });
// throw new MoleculerClientError("Article not found", 404);

module.exports = {
	name: "image",
	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb://localhost/blokariawallet", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true,
	}),
	model: Image,

	actions: {
		storePublicImageUrl: {
			async handler(ctx) {
				try {
					return await this.insertProductPicture(ctx);
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},
	},

	methods: {
		async insertProductPicture(ctx) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				productPicture: ctx.params.productPicture,
			};
			try {
				let image = new Image(entity);
				return await image.save();
			} catch (error) {
				throw new MoleculerError(error, 501, "ERR_DB_INSERTING", { message: error.message, internalErrorCode: "image10" });
			}
		},
	},
	settings: {},
	dependencies: [],
	events: {},
};
