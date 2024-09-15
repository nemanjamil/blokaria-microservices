"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const Image = require("../models/Image");
const slugify = require("slugify");
const { MoleculerError } = require("moleculer").Errors;
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const mkdir = require("mkdirp").sync;
const has = require("lodash/has");
const isObjectLike = require("lodash/isObjectLike");
const axiosMixin = require("../mixins/axios.mixin");
const { getFilesFromPath, Web3Storage } = require("web3.storage");

const uploadDir = path.join(__dirname, "../public/__uploads");
mkdir(uploadDir);

module.exports = {
	name: "image",
	mixins: [DbService, axiosMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Image,

	actions: {
		getProductPicture: {
			async handler(ctx) {
				try {
					return await Image.findOne({ walletQrId: ctx.params.walletQrId });
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		deleteQrCodeImage: {
			async handler(ctx) {
				try {
					let imageLink = `./public/${ctx.params.allowedToDelete[0]._image[0].productPicture}`;
					let imageLinkDir = `./public/__uploads/${ctx.params.allowedToDelete[0].userEmail}/${ctx.params.allowedToDelete[0].walletQrId}`;

					let responseImageRemoval = "";
					let responseDirRemoval = "";

					return new Promise((resolve, reject) => {
						fs.unlink(imageLink, function (err) {
							if (err && err.code == "ENOENT") {
								responseImageRemoval = "File doesn't exist, won't remove it.";
								reject(responseImageRemoval);
							} else if (err) {
								responseImageRemoval = "Error occurred while trying to remove file";
								reject(responseImageRemoval);
							} else {
								console.log("Removed Image");

								responseImageRemoval = "Removed Image";

								fs.rmdir(imageLinkDir, (err) => {
									if (err) {
										responseDirRemoval = err;
										console.log(responseDirRemoval);
									} else {
										responseDirRemoval = "IMAGE DIR REMOVED OK";
										console.log(responseDirRemoval);
									}
								});

								resolve(responseImageRemoval);
							}
						});
					});
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		saveImageAndData: {
			// params: {
			// 	article: { type: "string" },
			// 	user: { type: "string" },
			// },
			async handler(ctx) {
				try {
					console.log("saveImageAndData imageSave START");

					const { user } = ctx.meta; // $multipart: qrCodeData

					await this.checIfUseCanCreateNft(user);

					const { generatenft } = ctx.meta.$multipart;

					let { meta, relativePath, filename, uploadDirMkDir } = await this.storeImage(ctx);

					let { imageSave } = await this.insertProductPicture(meta, relativePath, filename);

					console.log("saveImageAndData imageSave :", imageSave);

					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });

					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);

					let saveToDbResNft,
						createCardanoNftRes,
						cidRes = "";
					if (generatenft === "true") {
						let { saveToDb, createCardanoNft, cid } = await this.generateNftMethod(uploadDirMkDir, meta, ctx, storedIntoDb);
						saveToDbResNft = saveToDb;
						createCardanoNftRes = createCardanoNft;
						cidRes = cid;
					}

					await ctx.call("user.reduceNumberOfTransaction", meta);

					meta.$multipart.emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					meta.$multipart.accessCode = storedIntoDb.accessCode;
					meta.$multipart.publicQrCode = storedIntoDb.publicQrCode;
					meta.$multipart.qrCodeImageForStatus = qrCodeImageForStatus;

					console.log("\n\n Send Email Started \n\n");

					await ctx.call("v1.email.generateQrCodeEmail", meta.$multipart);

					console.log("\n\n Send Email FINISHED \n\n");

					console.log("saveToDbResNft", saveToDbResNft);
					console.log("createCardanoNftRes", createCardanoNftRes);
					console.log("cidRes", cidRes);

					// console.log("\n storedIntoDb \n", storedIntoDb);

					let getQrCodeInfo = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", {
						qrcode: meta.$multipart.walletQrId,
					});

					console.log("\n getQrCodeInfo \n", getQrCodeInfo);

					return getQrCodeInfo[0];
				} catch (error) {
					console.error("getQrCodeInfo ", error);
					throw new MoleculerError("SAVE_IMAGE_AND_DATA", 501, "ERROR_SAVE_IMAGE", {
						message: error.message,
						internalErrorCode: "internal5055",
					});
				}
			},
		},

		generateNftFromExistingQrCode: {
			async handler(ctx) {
				try {
					console.log("generateNftFromExistingQrCode START");

					const { user } = ctx.meta;

					await this.checIfUseCanCreateNft(user);
					let { meta, relativePath, filename, uploadDirMkDir } = await this.storeImage(ctx);
					let { imageSave } = await this.insertProductPicture(meta, relativePath, filename);

					console.log("generateNftFromExistingQrCode imageSave", imageSave);

					console.log("generateNftFromExistingQrCode ctx.meta", ctx.meta);

					let storedIntoDb = await ctx.call("wallet.getQrCodeDataNoRedeem", { qrcode: ctx.meta.$multipart.walletQrId });

					console.log("\n\n generateNftFromExistingQrCode START  \n\n");

					let storedIntoDbCopy = { ...storedIntoDb[0]._doc };

					this.logger.info("\n\n generateNftFromExistingQrCode  TTTT", storedIntoDbCopy);

					//storedIntoDbCopy._image = JSON.parse(JSON.stringify(Object.assign({}, storedIntoDbCopy)["_image"]));

					this.logger.info("\n\n generateNftFromExistingQrCode TTTT AFTER", storedIntoDbCopy);

					await ctx.call("wallet.addImageToQrCode", { imageSave, storedIntoDb: storedIntoDbCopy, cbnftimage: true });

					this.logger.info("generateNftFromExistingQrCode addImageToQrCode DONE");

					let updateWallet = {
						searchBy: ctx.meta.$multipart.walletQrId,
						what: "hasstory",
						howmany: ctx.meta.$multipart.hasstory === "true",
						emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID),
					};
					console.log("generateNftFromExistingQrCode updateWallet", updateWallet);

					await ctx.call("wallet.updateDataInDb", updateWallet);

					meta.$multipart.productName = storedIntoDb[0].productName;

					const { saveToDb, createCardanoNft, cid } = await this.generateNftMethod(uploadDirMkDir, meta, ctx, storedIntoDbCopy);

					//await ctx.call("user.reduceNumberOfTransaction", meta);

					console.log("generateNftFromExistingQrCode saveToDb", saveToDb);
					console.log("generateNftFromExistingQrCode createCardanoNft", createCardanoNft);
					console.log("generateNftFromExistingQrCode cid", cid);

					let getQrCodeInfo = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", {
						qrcode: meta.$multipart.walletQrId,
					});

					console.log("generateNftFromExistingQrCode getQrCodeInfo", getQrCodeInfo);

					return getQrCodeInfo[0];
				} catch (error) {
					console.log(error.message);
					throw new MoleculerError("Greška pri generisanju NFT-a", 401, "ERR_PICTURE_DB_INSERTING", {
						message: error.message,
						internalErrorCode: error.internalErrorCode,
					});
				}
			},
		},

		generateQrCodeInSystemNoImage: {
			params: {
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] },
			},
			async handler(ctx) {
				try {
					this.logger.info("1. generateQrCodeInSystemNoImage START", ctx.params);

					let meta = ctx.meta;
					let imageSave = "";

					if (ctx.params.userDesc) {
						const [latitude, longitude] = ctx.params.userDesc.split(",").map(Number);

						ctx.params.latitude = latitude;
						ctx.params.longitude = longitude;
					}

					meta.$multipart = ctx.params;
					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });

					this.logger.info("2. generateQrCodeInSystemNoImage generateQRCodeStatus", storedIntoDb);

					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);

					this.logger.info("3. generateQrCodeInSystemNoImage reduceNumberOfTransaction");

					await ctx.call("user.reduceNumberOfTransaction", meta);

					meta.$multipart.emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					meta.$multipart.accessCode = storedIntoDb.accessCode;
					meta.$multipart.publicQrCode = storedIntoDb.publicQrCode;
					meta.$multipart.qrCodeImageForStatus = qrCodeImageForStatus;
					meta.$multipart.userLang = ctx.params.userLang;

					this.logger.info("4. generateQrCodeInSystemNoImage meta.$multipart", meta.$multipart);
					this.logger.info("5. generateQrCodeInSystemNoImage generateQrCodeEmail START");

					let getQrCodeInfo = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", {
						qrcode: meta.$multipart.walletQrId,
					});

					this.logger.info("7. generateQrCodeInSystemNoImage getQrCodeInfo", getQrCodeInfo);

					// await ctx.call("v1.email.generateQrCodeEmail", meta.$multipart);

					// this.logger.info("6. generateQrCodeInSystemNoImage generateQrCodeEmail FINISHED");

					return getQrCodeInfo[0];
				} catch (error) {
					console.error("generateQrCodeInSystemNoImage error ", error);
					return Promise.reject(error);
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
		async generateQRCodeStatus(storedIntoDb) {
			try {
				let opts = {
					errorCorrectionLevel: "M",
					type: "png",
					width: "500",
					margin: 1,
				};
				let QrCodeText = `${process.env.BLOKARIA_WEBSITE}/status/${storedIntoDb.walletQrId}`;
				return QRCode.toDataURL(QrCodeText, opts);
			} catch (error) {
				console.log("QrCode Pic Error: ", error);
				return Promise.reject(error);
			}
		},
		async generateNftMethod(uploadDirMkDir, meta, ctx, storedIntoDb) {
			try {
				console.log("---- generateNftMethod STARTED -----");

				let cid = await this.uploadImagetoIPFS_V2(uploadDirMkDir);

				console.log("\n\n  >>>  ---- uploadImagetoIPFS DONE  -----");

				console.log("generateNftMethod cid: ", cid);
				console.log("meta.$multipart ", meta.$multipart);
				let additionalMetaData = {};

				additionalMetaData = has(meta.$multipart, "finalMetaData")
					? { ...additionalMetaData, ...JSON.parse(meta.$multipart.finalMetaData) }
					: additionalMetaData;

				console.log("Step 1 additionalMetaData ", additionalMetaData);

				additionalMetaData["Authors"] = meta.user.userFullName;
				additionalMetaData["QrCodeDetails"] = `${process.env.BLOKARIA_WEBSITE}/s/${storedIntoDb._id}`;

				console.log("Step 2 additionalMetaData: ", additionalMetaData);

				let nftObj = {
					imageIPFS: cid,
					assetName: meta.$multipart.productName,
					copyright: "Copyright Nature Plant",
					walletName: process.env.WALLET_NAME,
					storedIntoDb: storedIntoDb,
					additionalMetaData: additionalMetaData,
				};

				console.log("generateNftMethod NFT Object: ", nftObj, "\n");
				console.log("generateNftMethod process.env.LOCALENV", process.env.LOCALENV, "\n");

				let createCardanoNft;
				if (process.env.LOCALENV === "false") {
					console.log("START SERVER \n\n");
					console.log("START generateNftMethod createCardanoNft SERVER \n\n");
					createCardanoNft = await ctx.call("nftcardano.createCardanoNft", nftObj);

					console.log("\n\n");
					console.log("SUCCESSFULL generateNftMethod createCardano nft: ", createCardanoNft);
				} else {
					console.log("START LOCAL \n\n");
					console.log("generateNftMethod createCardanoNft LOCAL Dummy Data : \n\n");
					createCardanoNft = {
						mintNFT: {
							txHash: "a4589358f5bb431becd35c166d591dee0a4495f7b0bc4c895f7f936cb7d2b4ff",
							assetId: "b044e02d79be53ead0bc7ae3ae40a27ad191e44573c4cf6403319a50.414142424343",
						},
					};
				}
				console.log("generateNftMethod Create Cardano NFT: ", createCardanoNft);
				let nftCardanoDbObj = {
					walletQrId: meta.$multipart.walletQrId,
					cid: cid,
					transactionId: createCardanoNft.mintNFT.txHash,
					assetId: createCardanoNft.mintNFT.assetId,
				};
				console.log("generateNft prepare nft cardano object: ", nftCardanoDbObj);
				let saveToDb = await ctx.call("nftcardano.storeToDb", nftCardanoDbObj);
				console.log("generateNft save nft to db: ", saveToDb);

				console.log("\n\n --- generateNft FINISHED ---- \n\n ");

				console.log("reduceUserCoupons ");
				await ctx.call("user.reduceUserCoupons", meta.user);

				console.log("\n\n ---- generateNftMethod FINISHED ----- \n\n ");

				return { saveToDb, createCardanoNft, cid };
			} catch (error) {
				console.error("generateNft generateNft Error: ", error);
				throw new MoleculerError(error.message, 401, "GenerateNftMethod", {
					message: error.message,
					internalErrorCode: error.internalErrorCode,
				});
			}
		},
		async uploadImagetoIPFS(imageDir) {
			this.logger.info("USAO U uploadImagetoIPFS");
			const web3Storage = this.createIPFSWeb3Storage();
			if (web3Storage != false) {
				try {
					const web3Storage = new Web3Storage({ token: process.env.WEB3_TOKEN });

					let file = await getFilesFromPath(imageDir);
					console.log("UploadImagetoIPFS LOCAL FOLDER file: ", file, "\n");

					const cid = await web3Storage.put(file, { wrapWithDirectory: false });
					console.log(`UploadImagetoIPFS Root cid: ${cid}`);

					let numberOfSeconds = 5;
					console.log(`UploadImagetoIPFS 1 addDelay ${numberOfSeconds}sec - START `, Date.now());
					await this.addDelay(numberOfSeconds * 1000);
					console.log(`UploadImagetoIPFS 1 addDelay ${numberOfSeconds}sec - END`, Date.now());

					const infoCidStatus = await web3Storage.status(cid);
					console.log("UploadImagetoIPFS infoCidStatus", infoCidStatus);

					numberOfSeconds = 5;
					console.log(`UploadImagetoIPFS  2 addDelay ${numberOfSeconds}sec - START `, Date.now());
					await this.addDelay(numberOfSeconds * 1000);
					console.log(`UploadImagetoIPFS  2 addDelay ${numberOfSeconds}sec - END`, Date.now());

					let getCidReq = await this.axiosGet(`https://dweb.link/api/v0/ls?arg=${cid}`).catch(function () {
						throw new MoleculerError("Došlo je do greške pri povlacenju slike sa IPFS-a", 501, "ERR_IPFS", {
							message: "Došlo je do greške pri povlacenju NFT-a",
							internalErrorCode: "ipfs10",
						});
					});

					console.log("UploadImagetoIPFS getCidReq", getCidReq.data);

					// ovde treba dodati upit ako nema Objects[0] ili Links[0] da baci errir
					// @mihajlo

					return getCidReq.data.Objects[0].Links[0].Hash;

					// let numberOfSeconds = 5;
					// console.log(`UploadImagetoIPFS addDelay ${numberOfSeconds}sec - START `, Date.now());
					// await this.addDelay(numberOfSeconds * 1000);
					// console.log(`UploadImagetoIPFS addDelay ${numberOfSeconds}sec - END`, Date.now());

					// const infoCidStatus = await web3Storage.status(cid);
					// console.log("UploadImagetoIPFS infoCidStatus", infoCidStatus);

					// numberOfSeconds = 5;
					// console.log(`UploadImagetoIPFS addDelay ${numberOfSeconds}sec - START `, Date.now());
					// await this.addDelay(numberOfSeconds * 1000);
					// console.log(`UploadImagetoIPFS addDelay ${numberOfSeconds}sec - END`, Date.now());

					// console.log("UploadImagetoIPFS Received data from ipfs: ");
					// const res = await web3Storage.get(cid);
					// console.log(`UploadImagetoIPFS IPFS web3 response! [${res.status}] ${res.statusText}`);
					// if (res.status !== 200) {
					// 	throw new MoleculerError("Došlo je do greške pri povlacenju slike sa IPFS-a", 501, "ERR_IPFS", {
					// 		message: "Došlo je do greške pri povlacenju NFT-a",
					// 		internalErrorCode: "ipfs10",
					// 	});
					// }

					// console.log("UploadImagetoIPFS Unpack File objects from the response: ", res);
					// const responseFiles = await res.files();

					// console.log("UploadImagetoIPFS responseFiles", responseFiles);

					// console.log(`UploadImagetoIPFS ${responseFiles[0].cid} -- ${responseFiles[0].path} -- ${responseFiles[0].size}`);
					// console.log(`FINISH UploadImagetoIPFS Image url: https://${responseFiles[0].cid}.ipfs.dweb.link`);

					// return responseFiles[0].cid;:1
				} catch (error) {
					console.error("Error occured while storing image to IPFS: " + error);
					return Promise.reject(error);
				}
			}
		},
		async uploadImagetoIPFS_V2(imageDir) {
			this.logger.info("0. uploadImagetoIPFS_V2 START", imageDir);

			this.logger.info("0.1. importing pinata sdk");
			const PinataSDK = require("@pinata/sdk");

			this.logger.info(
				"0.2. creating pinata client with key:",
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1M2M1NDdmYi01NmE2LTQwYTEtOTFiMC0xYWM1ODNiMThmNDYiLCJlbWFpbCI6Im5lbWFuamFtaWxAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImZkOTNmZGQ3NTdkYzFkY2E5YTc2Iiwic2NvcGVkS2V5U2VjcmV0IjoiMTVhZTI0ODlkZTBkNmZkNGUzMzcxYzBhOTljNGJhMGJiNThhMzdkOTQzOGYyMDlmZDgxZjY5NmQ1OWE4ZGMzNiIsImV4cCI6MTc1MjU5MTk4Nn0.RjEqQhyJrGItPHCQhdf3tK5xdE4Y87U3Jfr9lzsPr5g"
			);
			const pinata = new PinataSDK({
				pinataJWTKey:
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1M2M1NDdmYi01NmE2LTQwYTEtOTFiMC0xYWM1ODNiMThmNDYiLCJlbWFpbCI6Im5lbWFuamFtaWxAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImZkOTNmZGQ3NTdkYzFkY2E5YTc2Iiwic2NvcGVkS2V5U2VjcmV0IjoiMTVhZTI0ODlkZTBkNmZkNGUzMzcxYzBhOTljNGJhMGJiNThhMzdkOTQzOGYyMDlmZDgxZjY5NmQ1OWE4ZGMzNiIsImV4cCI6MTc1MjU5MTk4Nn0.RjEqQhyJrGItPHCQhdf3tK5xdE4Y87U3Jfr9lzsPr5g",
			});

			this.logger.info("0.3. testing pinata connection");
			const pinataRes = await pinata.testAuthentication();
			this.logger.info("0.4. connection testing result:", pinataRes);
			if (!pinataRes || (pinataRes && pinataRes.authenticated !== true)) {
				throw new Error("Failed to make connection to pinata API");
			}

			let files = await getFilesFromPath(imageDir);

			this.logger.info("11. uploadImagetoIPFS_V2 getFilesFromPath", files);

			const file = files.pop();

			this.logger.info("12. uploadImagetoIPFS_V2 last file", file);

			const stream = file.stream();

			const res = await pinata.pinFileToIPFS(stream, {
				pinataMetadata: {
					name: file.name.replace(/^\/*/gi, ""),
				},
			});

			this.logger.info("13. uploadImagetoIPFS_V2 pinata pin file response", res);

			if (!res.IpfsHash) {
				throw new Error("No links found in the IPFS response");
			}

			return res.IpfsHash;
		},

		async addDelay(time) {
			return new Promise((res) => setTimeout(res, time));
		},
		async createIPFSWeb3Storage() {
			try {
				const web3Storage = new Web3Storage({ token: process.env.WEB3_TOKEN });
				console.log("Successfully created web3storage.");
				return web3Storage;
			} catch (error) {
				console.log("Failed to create web3storage: " + error);
				return false;
			}
		},
		async storeImage(ctx) {
			return new Promise((resolve, reject) => {
				let relativePath = `__uploads/${slugify(ctx.meta.user.userEmail)}/${ctx.meta.$multipart.walletQrId}`;
				let uploadDirMkDir = path.join(__dirname, `../public/${relativePath}`);
				mkdir(uploadDirMkDir);

				const filePath = path.join(uploadDirMkDir, ctx.meta.filename || this.randomName());
				const f = fs.createWriteStream(filePath);
				f.on("close", () => {
					resolve({ meta: ctx.meta, relativePath, filename: ctx.meta.filename, uploadDirMkDir });
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
		async insertProductPicture(meta, relativePath, filename) {
			let imageRelativePath = `${relativePath}/${filename}`;
			const entity = {
				walletQrId: meta.$multipart.walletQrId,
				productPicture: imageRelativePath,
			};
			try {
				let checkStatusOfImage = await this.actions.getProductPicture({ walletQrId: meta.$multipart.walletQrId });

				console.log("insertProductPicture checkStatusOfImage ", checkStatusOfImage);

				let imageStatus = isObjectLike(checkStatusOfImage);

				console.log("insertProductPicture imageStatus ", imageStatus);

				if (imageStatus) {
					console.log("insertProductPicture IMAGE EXIST ALREADY");
					return { imageSave: checkStatusOfImage };
				} else {
					let image = new Image(entity);
					let imageSave = await image.save();
					return { imageSave, imageRelativePath };
				}
			} catch (error) {
				console.error("insertProductPicture error ", error);
				throw new MoleculerError(error.message, 401, "ERR_PICTURE_DB_INSERTING", {
					message: "Greška pri ubacivanju linka slike u bazu podataka",
					internalErrorCode: "image10",
				});
			}
		},

		async checIfUseCanCreateNft(user) {
			const { numberOfCoupons } = user;

			if (numberOfCoupons < 1) {
				throw new MoleculerError("Nemate dovoljno kupona za gerisanje NFT-a", 501, "ERR_NFT_COUPONS_LIMIT", {
					message: "Nemate dovoljno kupona za gerisanje NFT-a",
					internalErrorCode: "nftCoupons10",
				});
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
