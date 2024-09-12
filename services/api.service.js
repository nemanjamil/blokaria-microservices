"use strict";

const ApiGateway = require("moleculer-web");
const { MoleculerError } = require("moleculer").Errors;
//const isObjectLike = require("lodash/isObjectLike");
const isEmpty = require("lodash/isEmpty");
/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 * @typedef {import('http').IncomingMessage} IncomingRequest Incoming HTTP Request
 * @typedef {import('http').ServerResponse} ServerResponse HTTP Server Response
 */
// const Busboy = require("busboy");

// function uploader(req, res, next) {
// 	console.log(req.headers);
// 	const busboy = new Busboy({ headers: req.headers });
// 	busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
// 		console.log("File [" + fieldname + "]: filename: " + filename + ", encoding: " + encoding + ", mimetype: " + mimetype);
// 		file.on("data", function (data) {
// 			console.log("File [" + fieldname + "] got " + data.length + " bytes");
// 		});
// 		file.on("end", function () {
// 			console.log("File [" + fieldname + "] Finished");
// 		});
// 	});

// 	res.end(next);
// }

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	// More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
	settings: {
		// Exposed port
		port: process.env.PORT || 3022,

		cors: {
			origin: "*",
			methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
			allowedHeaders: ["Access-Control-Allow-Headers", "Content-Type", "Authorization"],
			exposedHeaders: [],
			credentials: false,
			maxAge: 3600,
		},

		// Exposed IP
		ip: "0.0.0.0",

		// Global Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
		use: [],

		routes: [
			{
				path: "/upload",
				use: [],
				authentication: true,
				authorization: false,
				autoAliases: false,
				mappingPolicy: "restrict", // Available values: "all", "restrict"
				aliases: {
					"POST /multi": {
						type: "multipart",
						busboyConfig: {
							limits: {
								files: 1,
								fileSize: 2 * 1024 * 1024, // 2MB - ADD RESIZE IN CODE
							},
							onPartsLimit(busboy, alias, svc) {
								this.logger.info("Busboy parts limit!", busboy);
							},
							onFilesLimit(busboy, alias, svc) {
								this.logger.info("Busboy file limit!", busboy);
							},
							onFieldsLimit(busboy, alias, svc) {
								this.logger.info("Busboy fields limit!", busboy);
							},
						},
						action: "image.saveImageAndData",
					},
					"POST /generateNftFromExistingQrCode": {
						type: "multipart",
						busboyConfig: {
							limits: {
								files: 1,
								fileSize: 2 * 1024 * 1024, // 2MB - ADD RESIZE IN CODE
							},
						},
						action: "image.generateNftFromExistingQrCode",
					},
				},

				// onAfterCall(ctx, route, req, res, data) {
				// 	const fieldName = ctx.meta.fieldname;
				// 	console.log("onAfterCall", fieldName);
				// },

				busboyConfig: {
					limits: { files: 1 },
				},
				//callingOptions: {},

				logging: true,
				callOptions: {
					// meta: {
					// 	a: 5,
					// 	vidiMiki: "12312",
					// },
				},
			},

			{
				path: "/nrapi",
				use: [],
				mergeParams: true,
				authentication: false,
				authorization: false,
				whitelist: ["**"],
				mappingPolicy: "restrict",
				autoAliases: false,
				aliases: {
					"POST payment/donation": "v1.payment.donationPayment",
					"POST user/registerUser": "user.registerUser",
					"GET user/authenticate/:id/:userEmail": "user.authenticate",
					"GET user/healthcheck": "user.healthcheck",
					"POST v1/auth/authenticate": "v1.auth.authenticate",
					"POST user/resetPassword": "user.resetPassword",
					"POST user/resetPasswordCode": "user.resetPasswordCode",
					"POST wallet/getQrCodeDataNoRedeem": "wallet.getQrCodeDataNoRedeem",
					"POST wallet/getListQrCodesByUser": "wallet.getListQrCodesByUser",
					"POST wallet/getListQrCodesGeneral": "wallet.getListQrCodesGeneral",
					"POST wallet/getListQrCodesOwners": "wallet.getListQrCodesOwners",
					"POST wallet/sendApprovalToClient": "wallet.sendApprovalToClient",
					"POST wallet/getQrCodeFromId": "wallet.getQrCodeFromId",
					"POST project/listAllProjectNrApi": "project.listAllProjectNrApi",
					"GET project/getOneProject/:projectId": "project.getOneProject",
					"GET area/getUniqueCountries": "v1.area.getUniqueCountries",
					"POST payment/paypalDonationCreateOrder": "v1.payment.paypalDonationCreateOrder",
					"POST payment/paypalWebhook": "v1.payment.paypalWebhook",
					"GET area/getAllAreasDashboard": "v1.area.getAllAreasDashboard",
					"GET area/getUniqueCountrieDashboard": "v1.area.getUniqueCountrieDashboard",
					"POST payment/testEmail": "v1.payment.testEmail",
				},
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
			},
			{
				path: "/nrapi-reg",
				use: [],
				mergeParams: true,
				authentication: false,
				authorization: false,

				whitelist: ["http.*"],
				mappingPolicy: "restrict",
				autoAliases: true,

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
			},

			{
				path: "/api",
				use: [], // Route-level middlewares.
				mergeParams: true,
				authentication: true,
				authorization: false,
				whitelist: ["**"],
				mappingPolicy: "restrict", // restrict
				autoAliases: false,
				aliases: {
					"POST image/generateQrCodeInSystemNoImage": "image.generateQrCodeInSystemNoImage",
					"POST wallet/getListQrCodesByUser": "wallet.getListQrCodesByUser",
					"POST user/registerUser": "user.registerUser",
					"POST user/updateUser": "user.updateUser",
					"POST user/addCouponsAndQrCodesToUser": "user.addCouponsAndQrCodesToUser",
					"POST user/userGet": "user.userGet",
					"GET user/userMetrics": "user.userGetMetrics",
					"POST wallet/getListQrCodesByUserPrivate": "wallet.getListQrCodesByUserPrivate",
					"POST wallet/getQrCodeData": "wallet.getQrCodeData",
					"POST wallet/generateContract": "wallet.generateContract",
					"POST wallet/initiateTransactionToClientWallet": "wallet.initiateTransactionToClientWallet",
					"POST wallet/deleteQrCode": "wallet.deleteQrCode",
					"POST wallet/sendContractEmail": "wallet.sendContractEmail",
					"POST nftcardano/createCardanoNft": "nftcardano.createCardanoNft",
					"POST nftcardano/createCardanoNftWithAssignWallet": "nftcardano.createCardanoNftWithAssignWallet",
					"POST nftcardano/sendAssetToWallet": "nftcardano.sendAssetToWallet",
					"POST nftcardano/checkWallet": "nftcardano.checkWallet",
					"POST project/addNewProject": "project.addNewProject",
					"POST project/editProjectName": "project.editProjectName",
					"GET user/listProjectByUser": "user.listProjectByUser",
					"POST project/deleteProject": "project.deleteProject",
					"POST project/updateProject": "project.updateProject",
					"POST project/addQrCodeToProject": "project.addQrCodeToProject",
					"POST wallet/changeStatusOfQrCode": "wallet.changeStatusOfQrCode",
					"POST nftcardano/updateNftStory": "nftcardano.updateNftStory",
					"POST nftcardano/addDataToNftTable": "nftcardano.addDataToNftTable",
					"POST wallet/updateDataInDb": "wallet.updateDataInDb",
					"POST wallet/updateStory": "wallet.updateStory",
					"POST nftcardano/generateNft": "nftcardano.generateNft",
					"POST payment/plant-tree": "v1.payment.buyTreePayment",
					"POST payment/paypalPurchaseCreateOrder": "v1.payment.paypalPurchaseCreateOrder",
					"GET achievement": "v1.achievement.getUserAchievements",
					"POST achievement": "v1.achievement.createAchievement",
					"PUT achievement": "v1.achievement.updateAchievements",
					"POST achievement/getPostPreview": "v1.achievement.getAchievementPostPreview",
					"POST achievement/linkedin/post": "v1.achievement.publishAchievementLinkedInPost",
					"POST email/sendGiftEmail": "v1.email.sendGiftEmail",
					"POST wallet/generateGift": "wallet.generateGift",
				},
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
				logging: true,
				/**
				onBeforeCall(ctx, route, req, res) {
					// https://github.com/teezzan/commitSpy-Core/blob/ed14a9aa28f166bc7e1482086728b64e696fcf28/services/api.service.js
					// Set request headers to context meta
					ctx.meta.userAgent = req.headers["user-agent"];
				}, */

				/**
				onAfterCall(ctx, route, req, res, data) {
					// Async function which return with Promise
					return doSomething(ctx, res, data);
				}, */
			},
			{
				path: "/api-verify",

				authentication: true,
				authorization: "validateUpdateQrCode",
				whitelist: ["**"],
				mappingPolicy: "restrict", // restrict
				autoAliases: false,
				aliases: {
					"POST nftcardano/updateQrCodeUrlForward": ["nftcardano.updateQrCodeUrlForward"],
					"POST nftcardano/updateQrCodeUrl": "nftcardano.updateQrCodeUrl",
					"POST wallet/updateQrCodeText": "wallet.updateQrCodeText",
				},
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
				logging: true,
			},
			{
				path: "/api-auth",

				authentication: true,
				authorization: "adminAuth",
				whitelist: ["**"],
				mappingPolicy: "restrict",
				autoAliases: false,
				aliases: {
					"POST /area/create": "v1.area.createArea",
					"POST /area/edit": "v1.area.editArea",
					"POST /area/delete": "v1.area.deleteArea",
					"GET /area/getAllAreas": "v1.area.getAllAreas",
					"POST /area/getAreaById": "v1.area.getAreaById",
					"POST /area/getAreasByCountry": "v1.area.getAreasByCountry",
					"PUT /area/addAccessibleAreas": "v1.area.addAccessibleAreas",
					"DELETE /area/removeAccessibleAreas": "v1.area.removeAccessibleAreas",
					"GET /area/getAllUsersWithAccessibleAreas": "v1.area.getAllUsersWithAccessibleAreas",
					"GET /area/getAllPlanters": "v1.area.getAllPlanters",
				},
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
				logging: true,
			},
			{
				path: "/papi",

				authentication: true,
				authorization: "planterOrAdminAuth",
				whitelist: ["**"],
				mappingPolicy: "restrict",
				autoAliases: false,
				aliases: {
					"GET /area/getMyAccessibleAreas": "v1.area.getMyAccessibleAreas",
					"POST /area/modifyAccessibleLocation": "v1.area.modifyAccessibleLocation",
				},
				callingOptions: {},

				bodyParsers: {
					json: {
						strict: false,
						limit: "1MB",
					},
					urlencoded: {
						extended: true,
						limit: "1MB",
					},
				},
				logging: true,
			},
			{
				path: "/stripe",
				aliases: {
					"POST /webhook": "v1.payment.handleStripeWebhook",
				},
				bodyParsers: {
					json: false,
					raw: {
						type: "application/json",
					},
				},
			},
		],

		// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
		log4XXResponses: false,
		// Logging the request parameters. Set to any log level to enable it. E.g. "info"
		logRequestParams: null,
		// Logging the response data. Set to any log level to enable it. E.g. "info"
		logResponseData: null,

		// Serve assets from "public" folder. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Serve-static-files
		assets: {
			folder: "public",

			// Options to `server-static` module
			options: {},
		},
	},

	methods: {
		/**

		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */

		async validateUpdateQrCode(ctx, route, req) {
			try {
				console.log("req", req.body);
				console.log("meta", ctx.meta);

				const { qrcode } = req.body;
				const { userEmail } = ctx.meta.user;
				let qrcodeRes = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", { qrcode });

				if (isEmpty(qrcodeRes)) {
					throw new MoleculerError("QR Code doesn't exist", 401, "ERROR_EMPTY", {
						message: "QR Code doesn't exist",
						internalErrorCode: "no_qr_code_1",
					});
				}
				const { qrCodeRedeemStatus, userEmail: userQrCodeEmail, clientEmail } = qrcodeRes[0];

				let canPass = false;
				switch (true) {
					case userEmail === userQrCodeEmail && qrCodeRedeemStatus === 0:
						canPass = true;
						break;
					case userEmail === clientEmail && qrCodeRedeemStatus === 1:
						canPass = true;
						break;

					default:
						break;
				}

				console.log("canPass", canPass);

				if (!canPass) {
					throw new MoleculerError("You do not have sufficient permissions to do this request", 401, "ERROR_ON_PERMISSIONS", {
						message: "You do not have sufficient permissions to do this request",
						internalErrorCode: "permission_error_1",
					});
				}
			} catch (error) {
				throw new MoleculerError(error.message, 401, "ERROR_VALIDATE_IF_USER_HAS_PRIVILAGES_TO_UPDATE", {
					message: error.message,
					internalErrorCode: "update10",
				});
			}
		},
		async adminAuth(ctx, route, req) {
			try {
				console.log("req", req.body);
				console.log("meta", ctx.meta);

				const { userEmail } = ctx.meta.user;
				let users = await ctx.call("user.userFind", { userEmail });
				const user = users ? users[0] : null;

				if (!user) {
					throw new MoleculerError("User not found.", 422, "USER_FIND_ERROR", {
						message: "User with the provided email does not exist.",
						internalErrorCode: "auth30",
					});
				}

				console.log("userRole", user.userRole);
				let canPass = false;

				if (user.userRole == 1) {
					/* Assume 1 - admin */
					canPass = true;
				}

				console.log("canPass", canPass);

				if (!canPass) {
					throw new MoleculerError("You do not have sufficient permissions to do this request", 401, "ERROR_ON_PERMISSIONS", {
						message: "You do not have sufficient permissions to do this request",
						internalErrorCode: "permission_error_1",
					});
				}
			} catch (error) {
				throw new MoleculerError(error.message, 401, "ERROR_VALIDATE_IF_USER_HAS_PRIVILAGES_TO_UPDATE", {
					message: error.message,
					internalErrorCode: "update10",
				});
			}
		},

		async planterOrAdminAuth(ctx, route, req) {
			try {
				console.log("req", req.body);
				console.log("meta", ctx.meta);

				const { userEmail } = ctx.meta.user;
				let users = await ctx.call("user.userFind", { userEmail });
				const user = users ? users[0] : null;

				if (!user) {
					throw new MoleculerError("User not found.", 422, "USER_FIND_ERROR", {
						message: "User with the provided email does not exist.",
						internalErrorCode: "auth30",
					});
				}

				console.log("userRole", user.userRole);
				let canPass = false;

				if (user.userRole == 3 || user.userRole == 1) {
					/* Assume 1 - Admin | 3 - Planter */
					canPass = true;
				}

				console.log("canPass", canPass);

				if (!canPass) {
					throw new MoleculerError("You do not have sufficient permissions to do this request", 401, "ERROR_ON_PERMISSIONS", {
						message: "You do not have sufficient permissions to do this request",
						internalErrorCode: "permission_error_1",
					});
				}
			} catch (error) {
				throw new MoleculerError(error.message, 401, "ERROR_VALIDATE_IF_USER_HAS_PRIVILAGES_TO_UPDATE", {
					message: error.message,
					internalErrorCode: "update10",
				});
			}
		},

		/**
		 * Authenticate the request. It check the `Authorization` token value in the request header.
		 * Check the token value & resolve the user by the token.
		 * The resolved user will be available in `ctx.meta.user`
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authenticate(ctx, route, req) {
			const auth = req.headers["authorization"];

			if (auth && auth.startsWith("Bearer")) {
				const token = auth.slice(7);
				try {
					let tokenVerified = await ctx.call("v1.auth.resolveToken", { token });
					let getUser = await ctx.call("user.userFind", { userEmail: tokenVerified.userEmail });
					// Returns the resolved user. It will be set to the `ctx.meta.user`
					return {
						userEmail: getUser[0].userEmail,
						userFullName: getUser[0].userFullName,
						userId: getUser[0]._id,
						// userRole: (("userRole" in getUser[0])) ? getUser[0].userRole : 1,
						userRole: "userRole" in getUser[0] ? getUser[0].userRole : 1,
						numberOfTransaction: getUser[0].numberOfTransaction,
						numberOfCoupons: getUser[0].numberOfCoupons,
					};
				} catch (error) {
					return Promise.reject(error);
				}
			} else {
				throw new MoleculerError(ApiGateway.Errors.ERR_INVALID_TOKEN, 401, ApiGateway.Errors.ERR_INVALID_TOKEN, {
					message: "Token is not present. Please Log in",
					internalErrorCode: "token20",
				});
				//new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_NO_TOKEN);
			}
		},

		/**
		 * Authorize the request. Check that the authenticated user has right to access the resource.
		 *
		 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			// Get the authenticated user.
			const user = ctx.meta.user;

			// It check the `auth` property in action schema.
			if (req.$action.auth == "required" && !user) {
				throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS");
			}
		},
	},
};
