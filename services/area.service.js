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
				areaPoints: { type: "array", optional: true }
			},
			async handler(ctx) {
				const { country, countryCode, address, longitude, latitude, name, areaPoints} = ctx.params;

				const area = new Area({
					country,
					countryCode,
					address,
					longitude,
					latitude,
					name,
					areaPoints,
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

		editArea: {
			params: {
				id: { type: "string" }, 
				country: { type: "string", optional: true },
				countryCode: { type: "string", optional: true },
				address: { type: "string", optional: true },
				longitude: { type: "number", optional: true },
				latitude: { type: "number", optional: true },
				name: { type: "string", optional: true },
				areaPoints: { type: "array", optional: true }

			},
			async handler(ctx) {
				const { id, country, countryCode, address, longitude, latitude, name, areaPoints } = ctx.params;

				try {
					const updatedArea = await Area.findByIdAndUpdate(
						id,
						{ country, countryCode, address, longitude, latitude, name, areaPoints },
						{ new: true, runValidators: true }
					);

					if (!updatedArea) {
						throw new MoleculerError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found.",
						});
					}

					return updatedArea.toJSON();
				} catch (err) {
					console.error("Error editing area:", err);
					const message = "An error occurred while updating the area in db.";
					throw new MoleculerError("Area Update Failed", 500, "AREA_UPDATE_FAILED", {
						message,
					});
				}
			},
		},

		deleteArea: {
			params: {
				id: { type: "string" }, 
			},
			async handler(ctx) {
				const { id } = ctx.params;

				try {
					const deletedArea = await Area.findByIdAndDelete(id);

					if (!deletedArea) {
						throw new MoleculerError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found.",
						});
					}

					return { message: "Area successfully deleted.", id: deletedArea._id };
				} catch (err) {
					console.error("Error deleting area:", err);
					const message = "An error occurred while deleting the area in db.";
					throw new MoleculerError("Area Deletion Failed", 500, "AREA_DELETION_FAILED", {
						message,
					});
				}
			},
		},
		getAllAreas: {
			async handler(ctx) {
				try {
					const areas = await Area.find({});
					return areas.map(area => area.toJSON());
				} catch (err) {
					console.error("Error retrieving areas:", err);
					const message = "An error occurred while retrieving areas from db.";
					throw new MoleculerError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message,
					});
				}
			},
		},

		getAllAreasDashboard: {
			async handler(ctx) {
				try {
					const areas = await Area.find({});
		
					// Group areas by country and format each area
					const formattedAreas = areas.reduce((result, area) => {
						const country = area.country;
		
						if (!result[country]) {
							result[country] = [];
						}
		
						result[country].push({
							id: area._id,
							name: area.name,
							center: { lat: area.latitude, lng: area.longitude },
							area: area.areaPoints.map(point => [point.lat, point.lng])  // Formatting area points
						});
		
						return result;
					}, {});
		
					return formattedAreas;
				} catch (err) {
					console.error("Error retrieving areas:", err);
					const message = "An error occurred while retrieving areas from db.";
					throw new MoleculerError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message,
					});
				}
			},
		},
		
		getAreaById: {
			params: {
				id: { type: "string" },
				showConnectedItems: { type: "boolean", optional: true },
			},
			async handler(ctx) {
				const { id, showConnectedItems } = ctx.params;
		
				try {
					const area = await Area.findById(id);
		
					if (!area) {
						throw new MoleculerError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found.",
						});
					}
		
					let result = area.toJSON();
		
					if (showConnectedItems) {
						// Call the walletService to get wallets associated with the area
						const wallets = await ctx.call("wallet.getWalletsByArea", { areaId: id });
						result.connectedItems = wallets;
					}
		
					return result;
				} catch (err) {
					console.error("Error retrieving area:", err);
					const message = "An error occurred while retrieving the area from db.";
					throw new MoleculerError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message,
					});
				}
			},
		},		
		getAreasByCountry: {
			params: {
				country: { type: "string" },
			},
			async handler(ctx) {
				const { country } = ctx.params;
		
				try {
					const areas = await Area.find({ country });
					return areas.map(area => area.toJSON());
				} catch (err) {
					console.error("Error retrieving areas by country:", err);
					const message = "An error occurred while retrieving areas by country from db.";
					throw new MoleculerError("Area Retrieval by Country Failed", 500, "AREA_RETRIEVAL_BY_COUNTRY_FAILED", {
						message,
					});
				}
			},
		},
		getUniqueCountries: {
			async handler(ctx) {
				try {
					const uniqueCountries = await Area.distinct("country");
					return uniqueCountries;
				} catch (err) {
					console.error("Error retrieving unique countries:", err);
					const message = "An error occurred while retrieving unique countries from the db.";
					throw new MoleculerError("Unique Country Retrieval Failed", 500, "COUNTRY_RETRIEVAL_FAILED", {
						message,
					});
				}
			},
		},				

		getUniqueCountrieDashboard: {
			async handler(ctx) {
				try {
					// Retrieve distinct countries
					const uniqueCountries = await Area.distinct("country");
		
					// Format the result with id and name, indexing the countries
					const formattedCountries = uniqueCountries.map((country, index) => ({
						id: index + 1,
						name: country
					}));
		
					return formattedCountries;
				} catch (err) {
					console.error("Error retrieving unique countries:", err);
					const message = "An error occurred while retrieving unique countries from the db.";
					throw new MoleculerError("Unique Country Retrieval Failed", 500, "COUNTRY_RETRIEVAL_FAILED", {
						message,
					});
				}
			},
		},
	},
};

module.exports = areaService;
