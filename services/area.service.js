const { MoleculerClientError } = require("moleculer").Errors;
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const Area = require("../models/Area");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const areaService = {
	name: "area",
	version: 1,
	mixins: [DbService],
	adapter: dbConnection.getMongooseAdapter(),
	model: Area,
	actions: {
		createArea: {
			params: {
				_id: { type: "object", optional: true },
				country: { type: "string" },
				countryCode: { type: "string" },
				address: { type: "string" },
				longitude: { type: "number" },
				latitude: { type: "number" },
				name: { type: "string" },
				areaPoints: { type: "array", optional: true },
				active: { type: "boolean", optional: true }

			},
			async handler(ctx) {
				const { _id, country, countryCode, address, longitude, latitude, name, areaPoints, active, photo } = ctx.params;

				let area = new Area({
					country,
					countryCode,
					address,
					longitude,
					latitude,
					name,
					areaPoints
				});

				if (_id) {
					area._id = _id;
					area.active = active;
				}

				if (photo) {
					updatStatus = await ctx.call("image.updateAreaImage", { photo, area });
				}

				try {
					await area.save();
					return area.toJSON();
				} catch (err) {
					console.error("Error creating area:", err);
					const message = "An error occured while saving new area in db.";
					throw new MoleculerClientError("Area Creation Failed", 500, "AREA_FAILED", {
						message
					});
				}
			}
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
				areaPoints: { type: "array", optional: true },
				photo: { type: "string", optional: true }
			},
			async handler(ctx) {
				const { id, country, countryCode, address, longitude, latitude, name, areaPoints, photo } = ctx.params;

				try {
					const updatedArea = await Area.findByIdAndUpdate(
						id,
						{ country, countryCode, address, longitude, latitude, name, areaPoints },
						{ new: true, runValidators: true }
					);

					if (photo != '')
					{
						await ctx.call("image.updateAreaImage", { photo: photo, area: updatedArea});
					}

					if (!updatedArea) {
						throw new MoleculerClientError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found."
						});
					}

					return updatedArea.toJSON();
				} catch (err) {
					console.error("Error editing area:", err);
					const message = "An error occurred while updating the area in db.";
					throw new MoleculerClientError("Area Update Failed", 500, "AREA_UPDATE_FAILED", {
						message
					});
				}
			}
		},

		deleteArea: {
			params: {
				id: { type: "string" }
			},
			async handler(ctx) {
				const { id } = ctx.params;

				try {
					const deletedArea = await Area.findByIdAndDelete(id);

					if (!deletedArea) {
						throw new MoleculerClientError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found."
						});
					}

					return { message: "Area successfully deleted.", id: deletedArea._id };
				} catch (err) {
					console.error("Error deleting area:", err);
					const message = "An error occurred while deleting the area in db.";
					throw new MoleculerClientError("Area Deletion Failed", 500, "AREA_DELETION_FAILED", {
						message
					});
				}
			}
		},

		getAllAreas: {
			async handler(ctx) {
				try {
					const areas = await Area.find({ active: true });
					if (!areas.length) {
						return "No active areas";
					}
					return areas.map((area) => area.toJSON());
				} catch (err) {
					console.error("Error retrieving areas:", err);
					const message = "An error occurred while retrieving areas from db.";
					throw new MoleculerClientError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message
					});
				}
			}
		},
		

		getAllAreasDashboard: {
			async handler(ctx) {
				try {
					const areas = await Area.find({ active: true });

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
							area: area.areaPoints.map((point) => [point.lat, point.lng]) // Formatting area points
						});

						return result;
					}, {});

					return formattedAreas;
				} catch (err) {
					console.error("Error retrieving areas:", err);
					const message = "An error occurred while retrieving areas from db.";
					throw new MoleculerClientError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message
					});
				}
			}
		},

		getAreaById: {
			params: {
				id: { type: "string" },
				showConnectedItems: { type: "boolean", optional: true }
			},
			async handler(ctx) {
				const { id, showConnectedItems } = ctx.params;

				try {
					const area = await Area.findOne({ _id: id, active: true });

					if (!area) {
						throw new MoleculerClientError("Area Not Found", 404, "AREA_NOT_FOUND", {
							message: "The area with the given ID was not found."
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
					throw new MoleculerClientError("Area Retrieval Failed", 500, "AREA_RETRIEVAL_FAILED", {
						message
					});
				}
			}
		},

		getAreasByCountry: {
			params: {
				country: { type: "string" }
			},
			async handler(ctx) {
				const { country } = ctx.params;

				try {
					const areas = await Area.find({ country, active: true });
					return areas.map((area) => area.toJSON());
				} catch (err) {
					console.error("Error retrieving areas by country:", err);
					const message = "An error occurred while retrieving areas by country from db.";
					throw new MoleculerClientError("Area Retrieval by Country Failed", 500, "AREA_RETRIEVAL_BY_COUNTRY_FAILED", {
						message
					});
				}
			}
		},

		getUniqueCountries: {
			async handler(ctx) {
				try {
					const uniqueCountries = await Area.distinct("country");
					return uniqueCountries;
				} catch (err) {
					console.error("Error retrieving unique countries:", err);
					const message = "An error occurred while retrieving unique countries from the db.";
					throw new MoleculerClientError("Unique Country Retrieval Failed", 500, "COUNTRY_RETRIEVAL_FAILED", {
						message
					});
				}
			}
		},

		addAccessibleAreas: {
			params: {
				areas: { type: "array", items: "string" },
				userId: { type: "string", required: true }
			},
			async handler(ctx) {
				try {
					const { areas, userId } = ctx.params;

					console.log("userId", userId);
					console.log("areas", areas);

					const user = await User.findById(userId).populate("accessibleAreas");

					if (!user) {
						throw new MoleculerClientError("User Not Found", 404, "USER_NOT_FOUND", {
							message: `The user with the ID '${userId}' was not found.`
						});
					}

					const areasToAdd = [];

					for (const areaId of areas) {
						const area = await Area.findById(areaId);
						if (!area) {
							throw new MoleculerClientError("Area Not Found", 404, "AREA_NOT_FOUND", {
								message: `The area with the ID '${areaId}' was not found.`
							});
						}

						const alreadyExists = user.accessibleAreas.some((existingArea) => existingArea._id.toString() === areaId);

						if (!alreadyExists) {
							areasToAdd.push(areaId);
						}
					}

					if (areasToAdd.length > 0) {
						user.accessibleAreas.push(...areasToAdd);
						await user.save();
					}

					return { message: "Accessible areas updated", areasAdded: areasToAdd };
				} catch (error) {
					console.error("Error in addAccessibleAreas:", error);
					throw new MoleculerClientError(error.message || "Internal Server Error", 500);
				}
			}
		},

		getAllUsersWithAccessibleAreas: {
			async handler(ctx) {
				try {
					const usersWithAccessibleAreas = await User.find({
						accessibleAreas: { $exists: true, $ne: [] }
					})
						.select("userFullName _id accessibleAreas")
						.populate("accessibleAreas");

					return {
						message: "Users with accessible areas retrieved successfully",
						users: usersWithAccessibleAreas
					};
				} catch (error) {
					console.error("Error in getAllUsersWithAccessibleAreas:", error);
					throw new MoleculerClientError(error.message || "Internal Server Error", 500);
				}
			}
		},

		getMyAccessibleAreas: {
			async handler(ctx) {
				try {
					const { userId } = ctx.meta.user;

					const user = await User.findById(userId)
					.select("accessibleAreas")
					.populate({
						path: "accessibleAreas",
						match: { active: true } 
					});
					
					if (!user) {
						throw new MoleculerClientError("User Not Found", 404, "USER_NOT_FOUND", {
							message: `The user with the ID '${userId}' was not found.`
						});
					}

					const accessibleAreasWithWallets = await Promise.all(
						user.accessibleAreas.map(async (area) => {
							const wallets = await ctx.call("wallet.getWalletsByArea", { areaId: area._id.toString() });

							const filteredWallets = wallets.map((wallet) => {
								wallet.latitude = null;
								wallet.longitude = null;
								wallet.isPlanted = false;
								if (wallet.geoLocation !== null && wallet.geoLocation !== "") {
									wallet.isPlanted = true;
									const [latitude, longitude] = wallet.geoLocation.split(",").map((coord) => parseFloat(coord.trim()));
									wallet.latitude = latitude;
									wallet.longitude = longitude;
								}

								return {
									_id: wallet._id.toString(),
									name: wallet.productName,
									latitude: wallet.latitude,
									longitude: wallet.longitude,
									isPlanted: wallet.isPlanted,
									longText: wallet.longText,
									walletQrId: wallet.walletQrId,
									userFullName: wallet.userFullname,
								};
							});

							return {
								...area.toObject(),
								_id: area._id.toString(),
								wallets: filteredWallets
							};
						})
					);

					return {
						message: "User's accessible areas with wallets retrieved successfully",
						user: {
							userFullName: user.userFullName,
							_id: user._id.toString(),
							accessibleAreas: accessibleAreasWithWallets
						}
					};
				} catch (error) {
					console.error("Error in getMyAccessibleAreas:", error);
					throw new MoleculerClientError(error.message || "Internal Server Error", 500);
				}
			}
		},

		getAllPlanters: {
			async handler(ctx) {
				try {
					const planters = await User.find({
						userRole: 3
					})
						.select("userFullName _id accessibleAreas")
						.populate("accessibleAreas");
					return {
						message: "Planters retrieved successfully",
						users: planters
					};
				} catch (error) {
					console.error("Error in getAllPlanters:", error);
					throw new MoleculerClientError(error.message || "Internal Server Error", 500);
				}
			}
		},

		removeAccessibleAreas: {
			params: {
				areas: { type: "array", items: "string" },
				userId: { type: "string", required: true }
			},
			async handler(ctx) {
				try {
					const { areas, userId } = ctx.params;

					console.log("userId", userId);
					console.log("areas", areas);

					const user = await User.findById(userId).populate("accessibleAreas");

					if (!user) {
						throw new MoleculerClientError("User Not Found", 404, "USER_NOT_FOUND", {
							message: `The user with the ID '${userId}' was not found.`
						});
					}

					const areasToRemove = [];

					for (const areaId of areas) {
						const area = await Area.findById(areaId);
						if (!area) {
							throw new MoleculerClientError("Area Not Found", 404, "AREA_NOT_FOUND", {
								message: `The area with the ID '${areaId}' was not found.`
							});
						}

						const exists = user.accessibleAreas.some((existingArea) => existingArea._id.toString() === areaId);

						if (exists) {
							areasToRemove.push(areaId);
						}
					}

					if (areasToRemove.length > 0) {
						user.accessibleAreas = user.accessibleAreas.filter((existingArea) => !areasToRemove.includes(existingArea._id.toString()));
						await user.save();
					}

					return { message: "Accessible areas removed", areasRemoved: areasToRemove };
				} catch (error) {
					console.error("Error in removeAccessibleAreas:", error);
					throw new MoleculerClientError(error.message || "Internal Server Error", 500);
				}
			}
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
					throw new MoleculerClientError("Unique Country Retrieval Failed", 500, "COUNTRY_RETRIEVAL_FAILED", {
						message
					});
				}
			}
		},
		getAresFromUserWallets: {
			async handler(ctx) {
				try {
					const { userEmail } = ctx.meta.user;
					this.logger.info("0. getAresFromUserWallets userEmail", userEmail);

					// Aggregation pipeline to group wallets by _area._id and include related wallets in areaDetails
					const groupedAreas = await Wallet.aggregate([
						// Step 1: Match documents by userEmail
						{
							$match: { userEmail }
						},
						// Step 2: Populate _area field by using $lookup
						{
							$lookup: {
								from: "areas", // The name of the collection where areas are stored
								localField: "_area", // The field in Wallet schema that references the Area
								foreignField: "_id", // The field in Area collection to match on
								as: "areaDetails" // The output array field that will hold the matched areas
							}
						},
						// Step 3: Unwind the areaDetails array since $lookup creates an array
						{
							$unwind: "$areaDetails"
						},
						// Step 4: Group wallets by _area._id and accumulate the wallets within the areaDetails object
						{
							$group: {
								_id: "$_area", // Group by _area._id
								areaDetails: { $first: "$areaDetails" }, // Take the first occurrence of the area details
								wallets: { $push: "$$ROOT" } // Accumulate the wallets in an array
							}
						},
						// Step 5: Add wallets to areaDetails
						{
							$addFields: {
								"areaDetails.wallets": "$wallets" // Add the wallets array to areaDetails
							}
						},
						{
							$project: {
								_id: 0, // Exclude the group _id if not needed
								areaDetails: 1 // Only return areaDetails with its wallets
								//country: "$areaDetails.country", // Only return areaDetails with its wallets
								//"wallets._id": 1
							}
						}
					]).exec();

					return groupedAreas;
				} catch (err) {
					this.logger.error("Error retrieving areas from user wallets:", err);
					throw new MoleculerClientError(err.message, 500, "AREAS_RETRIEVAL_FAILED", {
						err
					});
				}
			}
		},
	},
	async started() {
		const area = {
			_id: new ObjectId("66ebef1bad440ed7abcad62b"),
			country: "Mars",
			countryCode: "123",
			address: "Mars 12",
			longitude: -38.455728048040726,
			latitude: 79.02992065941754,
			active: false,
			areaPoints: [
				{
					lat: 80.58437789211486,
					lng: -59.44303506820781,
					_id: "66ebef1bad440ed7abcad62c"
				},
				{
					lat: 74.54758502739952,
					lng: -23.223005210822656,
					_id: "66ebef1bad440ed7abcad62d"
				},
				{
					lat: 66.136489689171,
					lng: -40.99451518757706,
					_id: "66ebef1bad440ed7abcad62e"
				}
			],
			name: "Mars Hidden Park",
			__v: 0
		};

		const arealist = await Area.find({ _id: process.env.DONATION_AREA });
		if (arealist.length === 0) {
			await this.actions.createArea(area);
		}
	}
};

module.exports = areaService;
