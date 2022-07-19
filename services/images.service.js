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

const { Web3Storage, getFilesFromPath } = require("web3.storage");

const uploadDir = path.join(__dirname, "../public/__uploads");
mkdir(uploadDir);

module.exports = {
	name: "image",
	mixins: [DbService],
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

					const { user } = ctx.meta; // $multipart: qrCodeData

					await this.checIfUseCanCreateNft(user);

					const { generatenft } = ctx.meta.$multipart;

					let { meta, relativePath, filename, uploadDirMkDir } = await this.storeImage(ctx);

					let { imageSave } = await this.insertProductPicture(meta, relativePath, filename);

					console.log("saveImageAndData imageSave :", imageSave);

					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });

					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);

					await ctx.call("user.reduceNumberOfTransaction", meta);

					let saveToDbResNft,
						createCardanoNftRes,
						cidRes = "";
					if (generatenft === "true") {
						let { saveToDb, createCardanoNft, cid } = await this.generateNftMethod(uploadDirMkDir, meta, ctx);
						saveToDbResNft = saveToDb;
						createCardanoNftRes = createCardanoNft;
						cidRes = cid;
					}

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

					throw new MoleculerError("SAVE_IMAGE_AND_DATA", 501, "ERROR_SAVE_IMAGE", {
						message: error.message,
						internalErrorCode: "internal5055",
					});
				}
			},
		},
		generateQrCodeInSystemNoImage: {
			// params: {
			// 	article: { type: "string" },
			// 	user: { type: "string" },
			// },
			async handler(ctx) {
				try {

					let meta = ctx.meta;
					let imageSave = "";
					meta.$multipart = ctx.params;
					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });

					console.log("generateQRCodeStatus", storedIntoDb);
					let qrCodeImageForStatus = await this.generateQRCodeStatus(storedIntoDb);

					console.log("reduceNumberOfTransaction");
					await ctx.call("user.reduceNumberOfTransaction", meta);

					meta.$multipart.emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					meta.$multipart.accessCode = storedIntoDb.accessCode;
					meta.$multipart.publicQrCode = storedIntoDb.publicQrCode;
					meta.$multipart.qrCodeImageForStatus = qrCodeImageForStatus;

					console.log("meta.$multipart", meta.$multipart);
					console.log("\n\n Send Email Started \n\n");

					await ctx.call("v1.email.generateQrCodeEmail", meta.$multipart);

					console.log("\n\n Send Email FINISHED \n\n");

					let getQrCodeInfo = await ctx.call("wallet.getQrCodeDataOnlyLocalCall", {
						qrcode: meta.$multipart.walletQrId,
					});

					console.log("\n getQrCodeInfo \n", getQrCodeInfo);

					return getQrCodeInfo[0];
				} catch (error) {
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
					margin: 1
				};
				let QrCodeText = `${process.env.BLOKARIA_WEBSITE}/status/${storedIntoDb.walletQrId}`;
				return QRCode.toDataURL(QrCodeText, opts);
			} catch (error) {
				console.log("QrCode Pic Error: ", error);
				return Promise.reject(error);
			}
		},
		async generateNftMethod(uploadDirMkDir, meta, ctx) {
			try {
				console.log("\n\n ---- generateNftMethod STARTED ----- \n\n ");

				let cid = await this.uploadImagetoIPFS(uploadDirMkDir);

				console.log("\n\n");
				console.log("generateNftMethod cid: ", cid);

				let nftObj = {
					imageIPFS: cid,
					assetName: meta.$multipart.productName + "#" + Date.now(),
					description: meta.$multipart.userDesc,
					authors: [meta.$multipart.userFullname],
					copyright: "Copyright Blokaria",
					walletName: process.env.WALLET_NAME,
					//contributorData: meta.$multipart.contributorData,
					//productVideo: meta.$multipart.productVideo,
				};
				console.log("generateNftMethod NFT Object: ", nftObj, "\n");
				console.log("generateNftMethod process.env.LOCALENV", process.env.LOCALENV, "\n");

				let createCardanoNft;
				if (process.env.LOCALENV === "false") {
					console.log("START generateNftMethod createCardanoNft SERVER \n\n");
					createCardanoNft = await ctx.call("nftcardano.createCardanoNft", nftObj);

					console.log("\n\n");
					console.log("SUCCESSFULL generateNftMethod createCardano nft: ", createCardanoNft);
				} else {
					console.log("generateNftMethod createCardanoNft Local Dummy Data : \n\n");
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
				console.log("generateNft generateNft Error: ", error);
				return Promise.reject(error);
			}
		},
		async uploadImagetoIPFS(imageDir) {
			const web3Storage = this.createIPFSWeb3Storage();
			if (web3Storage != false) {
				try {
					const web3Storage = new Web3Storage({ token: process.env.WEB3_TOKEN });

					let file = await getFilesFromPath(imageDir);
					console.log("UploadImagetoIPFS file: ", file, "\n");

					const cid = await web3Storage.put(file, { wrapWithDirectory: false });
					console.log(`UploadImagetoIPFS Root cid: ${cid}`);

					console.log("UploadImagetoIPFS Received data from ipfs: ");
					const res = await web3Storage.get(cid);
					console.log(`UploadImagetoIPFS IPFS web3 response! [${res.status}] ${res.statusText}`);
					if (res.status !== 200) {
						throw new MoleculerError("Došlo je do greške pri otpremanju NFT-a", 501, "ERR_IPFS", {
							message: "Došlo je do greške pri otpremanju NFT-a",
							internalErrorCode: "ipfs10",
						});
					}

					console.log("\n UploadImagetoIPFS Unpack File objects from the response: ");
					const responseFiles = await res.files();

					console.log("UploadImagetoIPFS responseFiles", responseFiles);

					console.log(`UploadImagetoIPFS ${responseFiles[0].cid} -- ${responseFiles[0].path} -- ${responseFiles[0].size}`);
					console.log(`UploadImagetoIPFS Image url: https://${responseFiles[0].cid}.ipfs.dweb.link`);

					return responseFiles[0].cid;
				} catch (error) {
					console.log("Error occured while storing image to IPFS: " + error);
					return Promise.reject(error);
				}
			}
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
				let relativePath = `__uploads/${slugify(ctx.meta.$multipart.userEmail)}/${ctx.meta.$multipart.walletQrId}`;
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
				let image = new Image(entity);
				let imageSave = await image.save();
				return { imageSave, imageRelativePath };
			} catch (error) {
				throw new MoleculerError("Greška pri ubacivanju linka slike u bazu podataka", 501, "ERR_PICTURE_DB_INSERTING", {
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
