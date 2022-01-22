"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const Image = require("../models/Image");

const { MoleculerError } = require("moleculer").Errors;

const fs = require("fs");
const path = require("path");
const mkdir = require("mkdirp").sync;

const uploadDir = path.join(__dirname, "../public/__uploads");
mkdir(uploadDir);

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

		saveImageAndData: {
			async handler(ctx) {
				try {
					let storedImage = await this.storeImage(ctx);
					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: storedImage.meta });
					return { storedImage, storedIntoDb };
				} catch (error) {
					throw new MoleculerError(error, 501, "ERR_DB_INSERTING", { message: error.message, internalErrorCode: "image20" });
				}
			},
		},

		testiranje: {
			async handler() {
				return "imageFiles";
			},
		},
	},

	methods: {
		async storeImage(ctx) {
			return new Promise((resolve, reject) => {
				const filePath = path.join(uploadDir, ctx.meta.filename || this.randomName());
				const f = fs.createWriteStream(filePath);
				f.on("close", () => {
					resolve({ filePath, meta: ctx.meta });
				});

				ctx.params.on("error", (err) => {
					reject(err);
					f.destroy(err);
				});

				f.on("error", () => {
					fs.unlinkSync(filePath);
				});

				ctx.params.pipe(f);
			});
		},
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

		randomName() {
			return "unnamed_" + Date.now() + ".png";
		},
	},
	settings: {},
	dependencies: [],
	events: {},
};
