const { MoleculerError } = require("moleculer").Errors;
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const Area = require("../models/Area");

const areaService = {
	name: "area",
	version: 1,
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Area,
	actions: {
		createArea: {
			params: {
				country: { type: "string" },
				countryCode: { type: "string" },
				address: { type: "string" },
				longitude: { type: "number" },
				latitude: { type: "number" },
				name: { type: "string" },
			},
			async handler(ctx) {
				const { country, countryCode, address, longitude, latitude, name } = ctx.params;

				const area = new Area({
					country,
					countryCode,
					address,
					longitude,
					latitude,
					name,
				});

				try {
					await area.save();
					return area.toJSON();
				} catch (err) {
					console.error("Error creating area:", err);
					const message = "An error occured while saving new area in db.";
					throw new MoleculerError("Area Creation Failed", 500, "AREA_FAILED", {
						message,
					});
				}
			},
		},
	},
};

module.exports = areaService;
