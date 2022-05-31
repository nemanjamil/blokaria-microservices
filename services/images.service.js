"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const Image = require("../models/Image");
const slugify = require("slugify");
const { MoleculerError } = require("moleculer").Errors;

const fs = require("fs");
const path = require("path");
const mkdir = require("mkdirp").sync;

const { Web3Storage, getFilesFromPath } = require("web3.storage");
const Nftcardano = require("../models/Nftcardano");
const Wallet = require("../models/Wallet");

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
					let { meta, relativePath, filename, uploadDirMkDir } = await this.storeImage(ctx);

					let cid = await this.uploadImagetoIPFS(uploadDirMkDir);
					console.log("saveImageAndData cid: ", cid);

					let { imageSave } = await this.insertProductPicture(meta, relativePath, filename);

					console.log(" saveImageAndData imageSave :", imageSave);

					let storedIntoDb = await ctx.call("wallet.generateQrCodeInSystem", { data: meta, imageSave });
					console.log("saveImageAndData storedIntoDb", storedIntoDb);

					let reducedNumberOfTransaction = await ctx.call("user.reduceNumberOfTransaction", meta);
					console.log("saveImageAndData reducedNumberOfTransaction", reducedNumberOfTransaction);

					let nftObj = {
						imageIPFS: cid,
						assetName: "Pera" + Math.floor(Math.random() * 1000000),
						description: "OpisOpis Bla",
						authors: ["Author", "Mihajlo"],
						copyright: "Copyright Bla Bla",
						walletName: "NFT_TEST",
					};
					console.log("saveImageAndData NFT Object: ", nftObj);

					let createCardanoNft = await ctx.call("nftcardano.createCardanoNft", nftObj);
					console.log("createCardano nft: ", createCardanoNft);
					// let createCardanoNft = {
					// 	mintNFT: {
					// 		txHash: "a4589358f5bb431becd35c166d591dee0a4495f7b0bc4c895f7f936cb7d2b4ff",
					// 		assetId: "b044e02d79be53ead0bc7ae3ae40a27ad191e44573c4cf6403319a50.414142424343",
					// 	},
					// };

					console.log("saveImageAndData Create Cardano NFT: ", createCardanoNft);
					console.log("meta: ", meta);
					let nftCardanoDbObj = {
						walletQrId: meta.$multipart.walletQrId,
						cid: cid,
						transactionId: createCardanoNft.mintNFT.txHash,
						assetId: createCardanoNft.mintNFT.assetId,
					};
					console.log("prepare nft cardano object: ", nftCardanoDbObj);
					let saveToDb = await ctx.call("nftcardano.storeToDb", nftCardanoDbObj);
					console.log("save nft to db: ", saveToDb);

					// Update Wallet Coll with Id from NftCardanos
					// Mint NFT
					// {{site_url}}api/nftcardano/createCardanoNft
					// parametre "imageIPFS" : "blaBlaBlaBla" + Plus ostali po volji ,
					// Update DB NftCardanos
					// 	txHash	 assetId

					meta.$multipart.emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					meta.$multipart.accessCode = storedIntoDb.accessCode;
					meta.$multipart.publicQrCode = storedIntoDb.publicQrCode;

					console.log("meta.$multipart", meta.$multipart);

					await ctx.call("v1.email.generateQrCodeEmail", meta.$multipart);

					return storedIntoDb;
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
		async uploadImagetoIPFS(imageDir) {
			const web3Storage = this.createIPFSWeb3Storage();
			if (web3Storage != false) {
				try {
					const web3Storage = new Web3Storage({ token: process.env.WEB3_TOKEN });
					let file = await getFilesFromPath(imageDir);
					console.log("uploadImagetoIPFS file: ", file, "\n");
					const cid = await web3Storage.put(file, { wrapWithDirectory: false });
					console.log(`Root cid: ${cid}`);
					return cid;
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
				throw new MoleculerError("Error in Inserting Picture link into DB", 501, "ERR_PICTURE_DB_INSERTING", {
					message: error.message,
					internalErrorCode: "image10",
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
