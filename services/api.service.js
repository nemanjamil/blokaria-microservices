"use strict";

const ApiGateway = require("moleculer-web");
const { MoleculerError } = require("moleculer").Errors;

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
				autoAliases: true,
				aliases: {
					//"POST /": "multipart:image.testiranje",
					//"PUT /:id": "stream:image.testiranje",
					"POST /multi": {
						type: "multipart",
						busboyConfig: {
							limits: {
								files: 1,
								fileSize: 1 * 1024 * 1024,
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
				},

				// onAfterCall(ctx, route, req, res, data) {
				// 	const fieldName = ctx.meta.fieldname;
				// 	console.log("onAfterCall", fieldName);
				// },

				busboyConfig: {
					limits: { files: 1 },
				},
				//callingOptions: {},
				mappingPolicy: "restrict", // Available values: "all", "restrict"
				logging: true,
				callOptions: {
					// meta: {
					// 	a: 5,
					// 	vidiMiki: "12312",
					// },
				},
			},
			{
				path: "/api",

				// Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
				use: [],

				// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
				mergeParams: true,

				// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
				authentication: false,

				// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
				authorization: false,

				// The auto-alias feature allows you to declare your route alias directly in your services.
				// The gateway will dynamically build the full routes from service schema.
				autoAliases: true,

				// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
				// mappingPolicy: "all", // Available values: "all", "restrict"
				whitelist: ["**"],

				mappingPolicy: "restrict",
				aliases: {
					// "POST sendEmail": "email.sendEmail",
					// "POST /getQrCodeData": "wallet.getQrCodeData",
				},

				/** 
				 * Before call hook. You can check the request.
				 * @param {Context} ctx 
				 * @param {Object} route 
				 * @param {IncomingRequest} req 
				 * @param {ServerResponse} res 
				 * @param {Object} data
				 * 
				onBeforeCall(ctx, route, req, res) {
					// Set request headers to context meta
					ctx.meta.userAgent = req.headers["user-agent"];
				}, */

				/**
				 * After call hook. You can modify the data.
				 * @param {Context} ctx 
				 * @param {Object} route 
				 * @param {IncomingRequest} req 
				 * @param {ServerResponse} res 
				 * @param {Object} data
				onAfterCall(ctx, route, req, res, data) {
					// Async function which return with Promise
					return doSomething(ctx, res, data);
				}, */

				// Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
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

				// Enable/disable logging
				logging: true,
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
					return { userEmail: getUser[0].userEmail, userFullName: getUser[0].userFullName, siki: "Bravo Miki" };
				} catch (error) {
					throw new MoleculerError(ApiGateway.Errors.ERR_INVALID_TOKEN, 401, ApiGateway.Errors.ERR_INVALID_TOKEN, {
						message: "Token is not Valid. Please Log in",
						internalErrorCode: "token10",
					});
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
