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
const User = require("../models/User");
const { getFilesFromPath, Web3Storage } = require("web3.storage");
const Achievement = require("../models/Achievement");
const Level = require("../models/Level");
const uuid = require("uuid").v4;

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
			}
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
			}
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
						qrcode: meta.$multipart.walletQrId
					});

					console.log("\n getQrCodeInfo \n", getQrCodeInfo);

					return getQrCodeInfo[0];
				} catch (error) {
					console.error("getQrCodeInfo ", error);
					throw new MoleculerError("SAVE_IMAGE_AND_DATA", 501, "ERROR_SAVE_IMAGE", {
						message: error.message,
						internalErrorCode: "internal5055"
					});
				}
			}
		},

		updateTreeImage: {
			params: {
				photo: { type: "string" }, // base64-encoded image
				wallet: { type: "object" },
				user: { type: "object" }
			},
			async handler(ctx) {
				try {
					console.log("updateTree imageSave START");

					const { user, wallet, photo } = ctx.params;
					const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
					const uploadDir = path.join(__dirname, `../public/__uploads/${wallet.walletQrId}`);
					const newFileBuffer = Buffer.from(base64Data, "base64");
					const newFileName = `${wallet._id}_photo.jpg`;

					const newImagePath = await this.replaceFile({
						oldFilePath: wallet._treeImageDir ? path.join(__dirname, "../public", wallet._treeImageDir) : null,
						newFileBuffer,
						newFileName,
						uploadDir
					});

					// let image = await Image.findOne({ walletQrId: wallet.walletQrId });
					// if (image)
					// {
					// 	image.productPicture = newImagePath;
					// 	await image.save();
					// }

					wallet._treeImageDir = newImagePath;
					await wallet.save();

					console.log("Image updated successfully");

					return wallet;
				} catch (error) {
					console.error("updateTree error", error);
					throw new MoleculerError("SAVE_IMAGE_AND_DATA", 501, "ERROR_SAVE_IMAGE", {
						message: error.message,
						internalErrorCode: "internal5055"
					});
				}
			}
		},

		updateAreaImage: {
			params: {
				photo: { type: "string" }, // base64-encoded image
				area: { type: "object" }
			},
			async handler(ctx) {
				try {
					console.log("updateTree imageSave START");

					const { area, photo } = ctx.params;
					const uploadDir = path.join(__dirname, `../public/__uploads/areas`);
					const newFileBuffer = Buffer.from(base64Data, "base64");
					const newFileName = `${area._id}_photo.jpg`;

					const newImagePath = await this.replaceFile({
						oldFilePath: `__uploads/areas/${area._id}_photo.jpg` ? path.join(__dirname, "../public", `__uploads/areas/${area._id}_photo.jpg`) : null,
						newFileBuffer,
						newFileName,
						uploadDir
					});

					// let image = await Image.findOne({ walletQrId: wallet.walletQrId });
					// if (image)
					// {
					// 	image.productPicture = newImagePath;
					// 	await image.save();
					// }

					console.log(`Image updated successfully ${newImagePath}`);

					return "Image updated successfully";
				} catch (error) {
					console.error("updateTree error", error);
					throw new MoleculerError("SAVE_IMAGE_AND_DATA", 501, "ERROR_SAVE_IMAGE", {
						message: error.message,
						internalErrorCode: "internal5055"
					});
				}
			}
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

					await ctx.call("wallet.addImageToQrCode", {
						imageSave,
						storedIntoDb: storedIntoDbCopy,
						cbnftimage: true
					});

					this.logger.info("generateNftFromExistingQrCode addImageToQrCode DONE");

					let updateWallet = {
						searchBy: ctx.meta.$multipart.walletQrId,
						what: "hasstory",
						howmany: ctx.meta.$multipart.hasstory === "true",
						emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID)
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
						qrcode: meta.$multipart.walletQrId
					});

					console.log("generateNftFromExistingQrCode getQrCodeInfo", getQrCodeInfo);

					return getQrCodeInfo[0];
				} catch (error) {
					console.log(error.message);
					throw new MoleculerError("Greška pri generisanju NFT-a", 401, "ERR_PICTURE_DB_INSERTING", {
						message: error.message,
						internalErrorCode: error.internalErrorCode
					});
				}
			}
		},

		generateQrCodeInSystemNoImage: {
			params: {
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] }
			},
			async handler(ctx) {
				try {
					this.logger.info("1. generateQrCodeInSystemNoImage START", ctx.params);
					ctx.params.treePlanted = false;
					let meta = ctx.meta;
					let imageSave = "";

					if (ctx.params.userDesc) {
						const [latitude, longitude] = ctx.params.userDesc.split(",").map(Number);

						ctx.params.latitude = latitude;
						ctx.params.longitude = longitude;
					}
					console.log("generateQrCodeInSystemNoImage ctx.params", ctx.params);
					meta.$multipart = ctx.params;
					console.log("generateQrCodeInSystemNoImage meta.$multipart", meta.$multipart);
					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });

					this.logger.info("2. generateQrCodeInSystemNoImage storedIntoDb", storedIntoDb);

					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);

					this.logger.info("3. generateQrCodeInSystemNoImage reduceNumberOfTransaction");

					let userData = await ctx.call("user.reduceNumberOfTransaction", meta);

					this.logger.info("5. generateQrCodeInSystemNoImage userData", userData);

					this.logger.info("6. generateQrCodeInSystemNoImage meta.$multipart BEFORE", meta.$multipart);

					let dataObject = [
						{
							productName: meta.$multipart.productName,
							walletQrId: meta.$multipart.walletQrId,
							accessCode: storedIntoDb.accessCode,
							storedIntoDb: storedIntoDb.publicQrCode,
							webSiteLocation: process.env.BLOKARIA_WEBSITE,
							webSpublicQrCodeiteLocation: storedIntoDb.publicQrCode
						}
					];
					meta.$multipart.emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					meta.$multipart.accessCode = dataObject;
					meta.$multipart.publicQrCode = storedIntoDb.publicQrCode;
					meta.$multipart.qrCodeImageForStatus = qrCodeImageForStatus;
					meta.$multipart.userLang = ctx.params.userLang;
					meta.$multipart.walletQrId = dataObject;
					meta.$multipart.productName = dataObject;

					this.logger.info("7. generateQrCodeInSystemNoImage meta.$multipart AFTER", meta.$multipart);
					this.logger.info("8. generateQrCodeInSystemNoImage generateQrCodeEmail START");

					let getQrCodeInfo = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", {
						qrcode: meta.$multipart.walletQrId[0].walletQrId
					});

					/******************************* Update Achievement ******************************** */
					// const user = await User.findOne({ userEmail: meta.$multipart.userEmail })

					// let threshold = isNaN(user?._wallets?.length) ? 1 : Number(user?._wallets?.length) + 1

					// if (isNaN(threshold)) {
					// 	threshold = 1;
					// }

					// this.logger.info("25. createItem threshold", threshold);

					// let achievements = await Achievement.find({}).populate({
					// 	path: "_level",
					// 	match: { required_trees: { $lte: threshold } }
					// });

					// this.logger.info("27. createItem achievements ALL", achievements);

					// achievements = achievements.filter((achievement) => achievement._level && achievement._level.required_trees <= threshold);

					// this.logger.info("29. createItem achievements filtered", achievements);

					// // Find and update user level
					// const levels = await Level.findOne({
					// 	required_trees: {
					// 		$lte: threshold
					// 	}
					// }).sort({ required_trees: -1 });
					// const userLevel = levels._id;

					// this.logger.info("30. createItem levels", levels);
					// this.logger.info("32. createItem userLevel", userLevel);

					// let iterationNumber = 0;

					// this.logger.info("\n\n\n ---- ACHIEVEMENTS START ---- \n\n\n");
					// this.logger.info("UserData", user);
					// // Add achievements to user, it will check if its there it won't add with addToSet
					// for (const element of achievements.filter((x) => x._level !== null)) {
					// 	this.logger.info(`35.${iterationNumber} createItem: element`, element);

					// 	if (element._level) {
					// 		this.logger.info(`37.${iterationNumber} createItem element._level`, element._id);
					// 		this.logger.info(`39.${iterationNumber} createItem user._achievements`, user._achievements);

					// 		if (!user._achievements.includes(element._id)) {
					// 			this.logger.info(`42.${iterationNumber} reduceNumberOfTransaction - New Achievement created.`);

					// 			const achievementUpdate = {
					// 				$addToSet: { _achievements: String(element._id) }
					// 			};

					// 			const updatedUser = await User.findOneAndUpdate({ userEmail: user.userEmail }, achievementUpdate, { new: true })
					// 				.populate("_achievements")
					// 				.exec();

					// 			let achPayload = {
					// 				userLang: "en",
					// 				userEmail: updatedUser.userEmail,
					// 				achievement: element
					// 			};
					// 			this.logger.info(`44.${iterationNumber} createItem achPayload`, achPayload);

					// 			let sendEmailAch = await ctx.call("v1.achievement.sendAchievementEmail", achPayload);

					// 			this.logger.info(`46.${iterationNumber} createItem sendEmailAch`, sendEmailAch);
					// 		} else {
					// 			this.logger.info(`48.${iterationNumber} createItem - Achievement already exists for user.`);
					// 		}
					// 	} else {
					// 		this.logger.info(`50.${iterationNumber} createItem - element._level does not exist.`);
					// 	}
					// 	iterationNumber++;

					// 	this.logger.info("\n\n\n");
					// }
					// 			// Update transactional data
					// const data = {
					// 	//$inc: { numberOfTransaction: -1 },
					// 	$set: { _level: String(userLevel) }
					// };

					// this.logger.info("60. createItem Update transactional data", data);

					// await User.findOneAndUpdate({ userEmail: user.userEmail }, data, { new: true }).populate("_achievements");

					/*********************************************************************************** */
					const walletUpdate = {
						$addToSet: { _wallets: String(storedIntoDb._id) }
					};
					let updatedWalletUser = await User.findOneAndUpdate({ userEmail: meta.$multipart.userEmail }, walletUpdate, { new: true })
						.populate("_wallets")
						.exec();

					this.logger.info("10. generateQrCodeInSystemNoImage updatedWalletUser", updatedWalletUser);

					this.logger.info("11. generateQrCodeInSystemNoImage getQrCodeInfo", getQrCodeInfo);

					await ctx.call("v1.email.generateQrCodeEmail", meta.$multipart);

					this.logger.info("12. generateQrCodeInSystemNoImage generateQrCodeEmail --- DONE ---");

					return getQrCodeInfo[0];
				} catch (error) {
					console.error("generateQrCodeInSystemNoImage error ", error);
					return Promise.reject(error);
				}
			}
		},
		
		selfPlanting: {
			params: {
				comments: { type: "string" },
				country: { type: "string" },
				coordinates: { type: "string" },
				plantingDate: { type: "string" },
				treeName: { type: "string" },
				// treePhoto: { type: "string" },
				// treePhotoName: { type: "string" },
				// treePhotoType: { type: "string" },
				// treeSpecies: { type: "string" },
				userEmail: { type: "string" },
				areaId: { type: "string" },
				language: { type: "string", optional: true, default: "en" }
			},
			async handler(ctx) {
				try {
					console.log("selfPlanting START", ctx.params);
					
					const {
						comments,
						country,
						coordinates,
						plantingDate,
						treeName,
						treePhoto,
						// treePhotoName,
						// treePhotoType,
						// treeSpecies,
						userEmail,
						areaId,
						language
					} = ctx.params;
					console.log("selfPlanting ctx.params", ctx.params);
					console.log("selfPlanting ctx.meta", ctx.meta);
					console.log("selfPlanting ctx.meta.user", ctx.meta.user);
					let wallet = {
						walletQrId: uuid(),
						geoLocation: coordinates,
						userFullName: ctx.meta.user.userFullName,
						userEmail: userEmail,
						productName: treeName,
						publicQrCode: true,
						costOfProduct: 1,
						contributorData: "",
						longText: comments,
						hasstory: false,
						treePlanted: false,
						dateOfPlanting: plantingDate,
						// userId: ctx.meta.user.userId,
						area: areaId };
						
					let user = ctx.meta.user;
					console.log("selfPlanting wallet", wallet);
					let storedIntoDb = await ctx.call("wallet.storeWalletInDb", { ctx, user, wallet, image:treePhoto });
					console.log("selfPlanting storedIntoDb", storedIntoDb);
					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);
					await ctx.call("v1.email.generateQrCodeEmail", {emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID),
					walletQrId: [wallet.walletQrId],
					userFullname: ctx.meta.user.userFullName,
					userEmail: userEmail,
					productName: [treeName],
					accessCode: [storedIntoDb.accessCode],
					userLang: language});

					this.logger.info("selfPlanting generateQrCodeEmail --- DONE ---");
					// console.log("selfPlanting treePhoto", treePhoto,wallet,user);
					if (treePhoto) {
								wallet = await ctx.call("image.updateTreeImage", { wallet:storedIntoDb, photo: treePhoto, user });
							}
					
				} catch (error) {
					console.error("selfPlanting error ", error);
					return Promise.reject(error);
				}
			}
		},

		storeProfilePicture: {
			params: {
				photo: { type: "string" } // base64-encoded image
			},
			async handler(ctx) {
				try {
					console.log("storeProfilePicture START");
		
					const { photo } = ctx.params;
					const userEmail = ctx.meta.user.userEmail;
		
					const relativePath = `__uploads/${slugify(userEmail)}/profile`;
					const uploadDirMkDir = path.join(__dirname, `../public/${relativePath}`);
		
					if (!fs.existsSync(uploadDirMkDir)) {
						fs.mkdirSync(uploadDirMkDir, { recursive: true });
					}
		
					const newFileBuffer = Buffer.from(photo, "base64");
		
					const filename = ctx.meta.filename || `${this.randomName()}.jpg`;
					const filePath = path.join(uploadDirMkDir, filename);
		
					fs.writeFileSync(filePath, newFileBuffer);
					console.log("Profile picture saved:", filePath);
		
					const data = {
						$set: { image: `${relativePath}/${filename}` }
					};
		
					const updatedUser = await User.findOneAndUpdate(
						{ userEmail: userEmail },
						data,
						{ new: true }
					);
		
					console.log("Profile picture updated successfully");
					return updatedUser;
		
				} catch (e) {
					console.error("Error storing profile picture", e);
					throw new MoleculerError("STORE_PROFILE_PICTURE_ERROR", 500, "ERROR_STORE_PROFILE_PICTURE", {
						message: e.message
					});
				}
			}
		},		

		testiranje: {
			async handler() {
				return "imageFiles";
			}
		}
	},

	methods: {
		async generateQRCodeStatus(storedIntoDb) {
			try {
				let opts = {
					errorCorrectionLevel: "M",
					type: "png",
					width: "500",
					margin: 1
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
					additionalMetaData: additionalMetaData
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
							assetId: "b044e02d79be53ead0bc7ae3ae40a27ad191e44573c4cf6403319a50.414142424343"
						}
					};
				}
				console.log("generateNftMethod Create Cardano NFT: ", createCardanoNft);
				let nftCardanoDbObj = {
					walletQrId: meta.$multipart.walletQrId,
					cid: cid,
					transactionId: createCardanoNft.mintNFT.txHash,
					assetId: createCardanoNft.mintNFT.assetId
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
					internalErrorCode: error.internalErrorCode
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
							internalErrorCode: "ipfs10"
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
					"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1M2M1NDdmYi01NmE2LTQwYTEtOTFiMC0xYWM1ODNiMThmNDYiLCJlbWFpbCI6Im5lbWFuamFtaWxAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImZkOTNmZGQ3NTdkYzFkY2E5YTc2Iiwic2NvcGVkS2V5U2VjcmV0IjoiMTVhZTI0ODlkZTBkNmZkNGUzMzcxYzBhOTljNGJhMGJiNThhMzdkOTQzOGYyMDlmZDgxZjY5NmQ1OWE4ZGMzNiIsImV4cCI6MTc1MjU5MTk4Nn0.RjEqQhyJrGItPHCQhdf3tK5xdE4Y87U3Jfr9lzsPr5g"
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
					name: file.name.replace(/^\/*/gi, "")
				}
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
				productPicture: imageRelativePath
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
					internalErrorCode: "image10"
				});
			}
		},

		async replaceFile({ oldFilePath, newFileBuffer, newFileName, uploadDir }) {
			try {
				// Remove old file if exists
				if (oldFilePath && fs.existsSync(oldFilePath)) {
					fs.unlinkSync(oldFilePath);
					console.log("Old file removed:", oldFilePath);
				}

				// Ensure the upload directory exists
				if (!fs.existsSync(uploadDir)) {
					fs.mkdirSync(uploadDir, { recursive: true }); // Create parent directories if they don't exist
				}

				const newFilePath = path.join(uploadDir, newFileName);

				fs.writeFileSync(newFilePath, newFileBuffer);
				console.log("New file saved:", newFilePath);
				const relativePath = path.relative(path.join(__dirname, "../public"), newFilePath);
				return relativePath;
			} catch (error) {
				console.error("File management error:", error);
				throw new Error("Failed to replace file");
			}
		},

		async checIfUseCanCreateNft(user) {
			const { numberOfCoupons } = user;

			if (numberOfCoupons < 1) {
				throw new MoleculerError("Nemate dovoljno kupona za gerisanje NFT-a", 501, "ERR_NFT_COUPONS_LIMIT", {
					message: "Nemate dovoljno kupona za gerisanje NFT-a",
					internalErrorCode: "nftCoupons10"
				});
			}
		},

		async decodeBase64Image(base64Data) {
			const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
			if (!matches) {
				throw new Error("Invalid base64 string");
			}

			const buffer = Buffer.from(matches[2], "base64"); // Decode base64 data to buffer
			return buffer;
		},

		randomName() {
			return "unnamed_" + Date.now() + ".png";
		}
	},
	settings: {},
	dependencies: [],
	events: {}
};
