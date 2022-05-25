"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const { MoleculerError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/Wallet.js");
const Utils = require("../utils/utils");
require("dotenv").config();

module.exports = {
	name: "wallet",
	logger: true,
	mixins: [DbService, axiosMixin],
	adapter: dbConnection.getMongooseAdapter(),
	model: Wallet,

	actions: {

		getListQrCodesOwners: {
			async handler() {
				try {
					return await this.getListQrCodesOwnersModel();
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		deleteQrCode: {
			rest: "POST /deleteQrCode",
			params: {
				walletQrId: { type: "string" },
			},
			async handler(ctx) {
				try {
					let allowedToDelete = await this.allowedToDeleteModel(ctx);
					let deleteQrCode = await this.deleteQrCodeModel(ctx);
					let responseDeleteImage = await ctx.call("image.deleteQrCodeImage", { allowedToDelete });
					return { allowedToDelete, deleteQrCode, responseDeleteImage };

				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		generateQrCodeInSystem: {
			rest: "POST /generateQrCodeInSystem",
			async handler(ctx) {
				try {
					return await this.plainInsertDataIntoDb({ ctx, user: ctx.params.data.user, wallet: ctx.params.data.$multipart, image: ctx.params.imageSave });
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		initiateTransactionToClientWallet: {
			rest: "POST /initiateTransactionToClientWallet",
			async handler(ctx) {
				try {
					console.log("Wallet Initiation Has Started");

					let qrCodeStatus = await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });

					console.log("Wallet qrCodeStatus", qrCodeStatus);

					let reducingStatus = await ctx.call("user.reduceUserCoupons", qrCodeStatus);

					console.log("Wallet ReducingStatus", reducingStatus);

					let { rndBr, cardanoRequest } = await this.sendTransactionFromWalletToWallet(process.env.WALLET_ADDRESS_5, qrCodeStatus);

					console.log("Wallet RndBr", rndBr);

					let redeemStatus = await this.updateRedeemStatus(ctx, cardanoRequest.data, rndBr);

					console.log("Wallet RedeemStatus", redeemStatus);

					let mintNftAndAssignToWallet, updateNftTransaction;
					// process.env.LOCALENV
					if (qrCodeStatus[0].cbnftimage && qrCodeStatus[0].nftimage) {

						console.log("\n\n ================ \n\n");
						console.log("WalletMinting Start \n");
						console.log("WalletMinting and wallet assigining has started \n");

						let mathRnd = Math.floor(Math.random() * 1000000);
						let nftParams = {
							"imageIPFS": qrCodeStatus[0].nftimage,
							"assetName": qrCodeStatus[0].userDesc.replace(/\s/g, " ").trim() + "#" + mathRnd,
							"description": "BlokariaNFT " + mathRnd,
							"authors": ["Blokaria", "V1"],
							"addressWallet": qrCodeStatus[0].nftsendaddress,
							"copyright": "Copyright by Blokaria",
							"walletName": "NFT_TEST",
							"dalayCallToWalletAsset": 60000
						};

						console.log("WalletMinting NftParams", nftParams);
						console.log("WalletMinting process.env.LOCALENV", process.env.LOCALENV);

						if (process.env.LOCALENV === "false") {


							console.log("	>>> WalletMinting SERVER ENV - krecemo na nftcardano.createCardanoNftWithAssignWallet \n");

							mintNftAndAssignToWallet = await ctx.call("nftcardano.createCardanoNftWithAssignWallet", nftParams);

							console.log("	>>> WalletMinting Has Finished \n");
							console.log("	>>> WalletMinting MintNftAndAssignToWallet", mintNftAndAssignToWallet);
							console.log("\n");
							console.log("	>>> WalletMinting and wallet assigining has finished \n");


							updateNftTransaction = await this.findOneAndUpdate({
								walletQrId: qrCodeStatus[0].walletQrId,
								dataIn: {
									nftSenderWalletName: mintNftAndAssignToWallet.payloadToWallet.walletName,
									nftReceiverAddressWallet: mintNftAndAssignToWallet.payloadToWallet.addressWallet,
									nftAssetId: mintNftAndAssignToWallet.payloadToWallet.assetId,
									nftMintTxHash: mintNftAndAssignToWallet.mintNFT.txHash,
									nftAssetToWalletTxHash: mintNftAndAssignToWallet.sendAssetToWallet.txHash
								}
							});

							console.log("\n");
							console.log(">>> WalletMinting updateNftTransaction ", updateNftTransaction);
						} else {

							console.log("WalletMinting LOCAL  ENV \n");

							mintNftAndAssignToWallet = {
								"payloadToWallet": {
									"addressWallet": "addr_test1qpmn8z5ath2kzmg6qff7sa8dz5hezf7lv9xw4va66j50uz8u63fededm3erzv32e56g5dp33tvcu8jpsxcanz75wzw7qtln9ml",
									"walletName": "NFT_TEST",
									"assetId": "b044e02d79be53ead0bc7ae3ae40a27ad191e44573c4cf6403319a50.53686f727423393935393339"
								},
								"mintNFT": {
									"txHash": "a4125b55fcb01e099bb44378c12f4e7d5c78e5935c79db952184cf452b706627",
									"assetId": "b044e02d79be53ead0bc7ae3ae40a27ad191e44573c4cf6403319a50.53686f727423393935393339"
								},
								"sendAssetToWallet": {
									"txHash": "9152c947efb93421bc07b1554ef55f8e4b6dc3274c626ad5376c48b47f5420da"
								}
							};

							updateNftTransaction = await this.findOneAndUpdate({
								walletQrId: qrCodeStatus[0].walletQrId,
								dataIn: {
									nftSenderWalletName: mintNftAndAssignToWallet.payloadToWallet.walletName,
									nftReceiverAddressWallet: mintNftAndAssignToWallet.payloadToWallet.addressWallet,
									nftAssetId: mintNftAndAssignToWallet.payloadToWallet.assetId,
									nftMintTxHash: mintNftAndAssignToWallet.mintNFT.txHash,
									nftAssetToWalletTxHash: mintNftAndAssignToWallet.sendAssetToWallet.txHash
								}
							});

							console.log("\n");
							console.log("WalletMinting LOCAL ENV TEST updateNftTransaction ", updateNftTransaction);

						}

					} else {
						console.log("WalletMinting  Skipped \n");
					}


					qrCodeStatus[0].emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					let sendEmail = await ctx.call("v1.email.sendTransactionEmail", qrCodeStatus[0]);

					console.log("Wallet SendEmail", sendEmail);

					return {
						qrCodeStatus,
						mintNftAndAssignToWallet,
						cardanoStatus: cardanoRequest.data,
						reducingStatus,
						sendEmail,
						redeemStatus
					};
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		generateContract: {
			params: {
				clientName: { type: "string" },
				clientEmail: { type: "email" },
				clientMessage: { type: "string" },
				qrcode: { type: "string" },
				nftsendaddress: { type: "string", optional: true },
				nftimage: { type: "string", optional: true },
				cbnftimage: { type: "boolean", default: false },
				clientemailcb: { type: "boolean", default: true },
				ownernamecb: { type: "boolean", default: true },
			},
			async handler(ctx) {
				try {
					await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });
					return await this.generateContractUpdateDataWithMessages(ctx);
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		getQrCodeData: {
			rest: "POST /getQrCodeData",
			async handler(ctx) {
				try {
					return await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		getQrCodeDataNoRedeem: {
			//rest: "POST /getQrCodeDataNoRedeem",
			async handler(ctx) {
				try {
					return await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: false });
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		createWallet: {
			// rest: "POST /getQrCodeData", not allowed
			async handler() {
				try {
					let walletAddresses = await this.getWalletAddresses();
					let unusedAddress = this.parseAddressesForUnused(walletAddresses.data);
					let transactionData = await this.sendTransactionFromWalletToWallet(unusedAddress);

					return { unusedAddress, txId: transactionData.data };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		getListQrCodesByUserPrivate: {
			rest: "POST /getListQrCodesByUserPrivate",
			meta: {
				user: {
					userEmail: { type: "email" },
				}
			},
			async handler(ctx) {
				ctx.params.userEmail = ctx.meta.user.userEmail;
				try {
					let listQrCodesByUser = await this.getListQrCodesByUserMethod(ctx);
					let listQrCodesOwnedByUser = await this.getlistQrCodesOwnedByUserMethod(ctx);
					return { listQrCodesByUser, listQrCodesOwnedByUser };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		getListQrCodesByUser: {
			// rest: "POST /getListQrCodesByUser",
			params: {
				userEmail: { type: "email" },
			},
			async handler(ctx) {
				try {
					let listQrCodesByUser = await this.getListQrCodesByUserMethod(ctx);
					return listQrCodesByUser;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		getListQrCodesGeneral: {
			async handler(ctx) {
				try {
					let listQrCodesByUser = await this.getListQrCodesGeneral(ctx);
					return listQrCodesByUser;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		sendContractEmail: {
			params: {
				qrcode: { type: "string" },
				clientEmail: { type: "string" },
			},
			async handler(ctx) {
				try {
					let walletIdData = await this.getQrCodeInfo(ctx);
					let sendContractEmailRes = await ctx.call("v1.email.sendContractEmail", { ctx, walletIdData });
					return sendContractEmailRes;

				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		sendApprovalToClient: {
			params: {
				clientEmail: { type: "email" },
				qrcode: { type: "string" },
				clientName: { type: "string" }
			},
			async handler(ctx) {
				const { clientEmail, clientName } = ctx.params;

				let walletIdData = await this.getQrCodeInfo(ctx);
				let sendApprovalToClientRes = await ctx.call("v1.email.sendApprovalToClient", { ctx, walletIdData, clientEmail, clientName });

				return sendApprovalToClientRes;


			}
		}

	},

	methods: {
		// 10
		async getQrCodeDataMethod({ ctx, qrRedeemCheck }) {
			try {
				await this.checkIfQrCodeExistIndb(ctx);
				let walletIdData = await this.getQrCodeInfo(ctx);

				switch (true) {
					case (!qrRedeemCheck):

						return walletIdData;
					case (qrRedeemCheck && walletIdData[0].qrCodeRedeemStatus > 0):

						throw new MoleculerError("QR code is already redeemed", 501, "ERR_DB_GETTING", {
							message: "QR code is already redeemed",
							internalErrorCode: "walletredeem10",
						});
					case (ctx.meta.user.userEmail === walletIdData[0].userEmail):
					case (ctx.params.accessCode && (ctx.params.accessCode === walletIdData[0].accessCode)):

						return walletIdData;
					case (walletIdData[0].publicQrCode === false):

						throw new MoleculerError("QR code is not publicly accessible", 501, "ERR_DB_GETTING", {
							message: "QR code is not publicly accessible",
							internalErrorCode: "walletredeem11",
						});
					default:
						return walletIdData;
					// throw new MoleculerError("Something happened on getQrCodeDataMethod", 501, "ERR_DB_GETTING", {
					// 	message: "Something happened on getQrCodeDataMethod",
					// 	internalErrorCode: "walletredeem12",
					// });
				}

			} catch (error) {
				return Promise.reject(error);
			}
		},

		parseAddressesForUnused(queryAddresses) {
			return queryAddresses
				.filter((el) => {
					return el.state === "unused";
				})
				.shift().id;
		},

		// 30
		async generateContractUpdateDataWithMessages(ctx) {
			let entity = { walletQrId: ctx.params.qrcode };

			let data = {
				clientMessage: ctx.params.clientMessage,
				clientEmail: ctx.params.clientEmail,
				clientName: ctx.params.clientName,

				nftsendaddress: ctx.params.nftsendaddress ? ctx.params.nftsendaddress : null,
				nftimage: ctx.params.nftimage ? ctx.params.nftimage : null,
				cbnftimage: ctx.params.cbnftimage,
				clientemailcb: ctx.params.clientemailcb,
				ownernamecb: ctx.params.ownernamecb
			};

			try {
				return await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
			} catch (error) {
				throw new MoleculerError("Updating Data Error", 501, "ERR_GENERATING_CONTRACT", { message: error.message, internalErrorCode: "wallet30" });
			}
		},

		// 40
		async updateRedeemStatus(ctx, transaction, metaDataRandomNumber) {
			let entity = {
				walletQrId: ctx.params.qrcode,
			};
			let data = {
				qrCodeRedeemStatus: 1,
				transactionId: transaction.id,
				metaDataRandomNumber: metaDataRandomNumber,
			};

			try {
				let wallet = await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
				return wallet;
			} catch (error) {
				throw new MoleculerError("Updating Redeem Status Error", 501, "ERROR_UPDATE_REEDEEM_STATUS", { message: error.message, internalErrorCode: "wallet40" });
			}
		},

		// 50
		async getQrCodeInfo(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.find(entity).populate("_image", { productPicture: 1 });
				return wallet;
			} catch (error) {
				throw new MoleculerError("Error in Reading Qr Code", 501, "ERROR_GET_QR_CODE_DATA", { message: error.message, internalErrorCode: "wallet50" });
			}
		},

		// 60
		async checkIfQrCodeExistIndb(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.exists(entity);
				if (!wallet)
					throw new MoleculerError("Code do not exist into db", 501, "ERROR_GET_QR_CODE_DATA", {
						message: "Code do not exist into db",
						internalErrorCode: "wallet60",
					});
				return wallet;
			} catch (error) {
				throw new MoleculerError("Error reading exists Qr Code", 501, "ERROR_GET_QR_CODE_DATA", { message: "Code do not exist into db", internalErrorCode: "wallet61" });
			}
		},

		// 70
		async insertDataIntoDb(ctx, Address, transactionId) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				userDesc: ctx.params.userDesc,
				userFullname: ctx.params.userFullname,
				productName: ctx.params.productName,
				userEmail: ctx.params.userEmail,
				usedAddress: Address,
				transactionId: transactionId,
			};
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				throw new MoleculerError("Insering Data into DB Error", 501, "ERROR_INSERT_INTO_DB", { message: error.message, internalErrorCode: "wallet70" });
			}
		},

		// 80
		async plainInsertDataIntoDb({ ctx, user, wallet, image }) {
			const entity = {
				walletQrId: wallet.walletQrId,
				userDesc: wallet.userDesc,
				userFullname: wallet.userFullname,
				userEmail: wallet.userEmail,
				productName: wallet.productName,
				publicQrCode: wallet.publicQrCode,
				costOfProduct: wallet.costOfProduct,
				contributorData: wallet.contributorData,
				accessCode: Utils.generatePass(),
				_creator: user.userId,
				_image: image._id
			};

			if (wallet.productVideo) entity.productVideo = wallet.productVideo;

			try {
				let wallet = new Wallet(entity);
				await wallet.save();
				await wallet.populate("_creator").populate(String(user.userId)).execPopulate();
				await wallet.populate("_image").populate(String(image._id)).execPopulate();
				await ctx.call("user.populateUserTable", wallet);

				return wallet;
			} catch (error) {
				throw new MoleculerError("Plain Inerting Data into DB Error", 501, "ERROR_PLAIN_INSERT_INTO_DB", { message: error.message, internalErrorCode: "wallet80" });
			}
		},

		// 90
		async getWalletAddresses() {
			let wallet_url = `${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/addresses`;
			try {
				return await this.axiosGet(wallet_url);
			} catch (error) {
				throw new MoleculerError("Get Wallet Adress Error", 501, "ERROR_GET_WALLET_ADDRESS", { message: error.message, internalErrorCode: "wallet90" });
			}
		},

		// 100
		async sendTransactionFromWalletToWallet(Address, qrCodeDbData) {
			let rndBr = "888000999" + Math.floor(Math.random() * 1000000);

			let internalCode = {
				k: {
					string: "internalCode",
				},
				v: {
					string: qrCodeDbData[0].walletQrId,
				},
			};
			let merchantName = {
				k: {
					string: "CreatorName",
				},
				v: {
					string: qrCodeDbData[0].userFullname,
				},
			};
			let productName = {
				k: {
					string: "ProductName",
				},
				v: {
					string: qrCodeDbData[0].productName,
				},
			};

			let merchantEmail = {
				k: {
					string: "CreatorEmail",
				},
				v: {
					string: qrCodeDbData[0].userEmail,
				},
			};

			let merchantMessage = {
				k: {
					string: "CreatorMessage",
				},
				v: {
					string: qrCodeDbData[0].userDesc,
				},
			};

			let clientName = {
				k: {
					string: "OwnerName",
				},
				v: {
					string: qrCodeDbData[0].clientName,
				},
			};

			let clientEmail = {
				k: {
					string: "OwnerEmail",
				},
				v: {
					string: qrCodeDbData[0].clientEmail,
				},
			};

			let clientMessage = {
				k: {
					string: "OwnerMessage",
				},
				v: {
					string: qrCodeDbData[0].clientMessage,
				},
			};
			let productLink = {
				k: {
					string: "WebSiteParams",
				},
				v: {
					string: `/status/${qrCodeDbData[0].walletQrId}`,
				},
			};
			let webSite = {
				k: {
					string: "WebSiteDomain",
				},
				v: {
					string: process.env.BLOKARIA_WEBSITE
				},
			};

			let nftimage = {
				k: {
					string: "NftImageHash",
				},
				v: {
					string: qrCodeDbData[0].nftimage,
				},
			};
			// let nftsendaddress = {
			// 	k: {
			// 		string: "NftWalletAddress",
			// 	},
			// 	v: {
			// 		string: qrCodeDbData[0].nftsendaddress,
			// 	},
			// };

			let contributorData = {
				k: {
					string: "Contributor",
				},
				v: {
					string: qrCodeDbData[0].contributorData,
				},
			};

			let finalArray = [];
			finalArray.push(productName);

			finalArray.push(merchantName);
			finalArray.push(merchantEmail);
			finalArray.push(merchantMessage);


			(qrCodeDbData[0].ownernamecb) ? finalArray.push(clientName) : "";
			(qrCodeDbData[0].clientemailcb) ? finalArray.push(clientEmail) : "";

			finalArray.push(clientMessage);

			finalArray.push(productLink);
			finalArray.push(webSite);
			finalArray.push(internalCode);
			(qrCodeDbData[0].nftimage) ? finalArray.push(nftimage) : "";
			// (qrCodeDbData[0].nftsendaddress) ? finalArray.push(nftsendaddress) : "";

			(qrCodeDbData[0].contributorData) ? finalArray.push(contributorData) : "";

			let metaDataObj = {
				[rndBr]: {
					map: finalArray,
				},
			};

			let dataObject = {
				passphrase: `${process.env.WALLET_PASSPHRASE_1}`,
				payments: [
					{
						address: Address,
						amount: {
							quantity: 1000000,
							unit: "lovelace",
						},
					},
				],
				withdrawal: "self",
				metadata: metaDataObj,
			};

			console.dir(dataObject, { depth: null });

			try {
				let cardanoRequest = await this.axiosPost(`${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/transactions`, dataObject);
				return { rndBr, cardanoRequest };
			} catch (error) {
				console.dir(error, { depth: null });
				throw new MoleculerError("Inserting Transaction into BlockChain Error", 501, "ERROR_SEND_TRANSACTION_TO_CARDANO_BC", { message: error.message, internalErrorCode: "wallet202" });
			}
		},

		// wallet110
		async getListQrCodesByUserMethod(ctx) {

			const entity = {
				userEmail: ctx.params.userEmail,
			};
			try {
				return await Wallet.find(entity).sort("-createdAt")
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 });
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet110" });
			}
			// let query = [{ $match: { userEmail: userEmail } }];
			// try {
			// 	let user = await Wallet.aggregate(query).exec();
			// 	return user;
			// } catch (error) {
			// 	throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet110" });
			// }
		},

		// wallet120
		async getListQrCodesGeneral(ctx) {
			const entity = {};
			try {
				return await Wallet.find(entity).skip(ctx.params.skip).limit(ctx.params.limit).sort({ createdAt: -1 })
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 });
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet120" });
			}
		},

		// wallet130
		async getlistQrCodesOwnedByUserMethod(ctx) {

			const entity = {
				clientEmail: ctx.params.userEmail,
			};
			try {
				return await Wallet.find(entity).sort("-createdAt")
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 });
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet130" });
			}
		},

		// wallet140
		async getListQrCodesOwnersModel() {
			try {
				return await Wallet.aggregate()
					.group({ _id: "$userEmail", count: { $sum: 1 } })
					.lookup({ from: "users", localField: "_id", foreignField: "userEmail", as: "userInfo" })
					.match({ "userInfo": { "$exists": true, "$not": { $size: 0 } } })
					.project({ _id: 0, count: "$count", userFullName: "$userInfo.userFullName", userEmail: "$userInfo.userEmail" })
					.exec();
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet140" });
			}
		},

		// wallet150
		async deleteQrCodeModel(ctx) {
			let data = {
				walletQrId: ctx.params.walletQrId
			};
			try {
				return await Wallet.deleteOne(data);
			} catch (error) {
				throw new MoleculerError("Error Delete Qr codes", 501, "ERROR_DELETE_QR_CODES", { message: error.message, internalErrorCode: "wallet150" });
			}
		},

		// wallet160
		async allowedToDeleteModel(ctx) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
			};
			try {
				let qrCodeData = await Wallet.find(entity).populate("_image", { productPicture: 1 });
				if (qrCodeData[0].userEmail === ctx.meta.user.userEmail) {
					return qrCodeData;
				} else {
					throw new MoleculerError("Error Delete Qr codes check Parmissions", 501, "ERROR_DELETE_QR_CODES_PERMISSIONS", { message: "Data do not match", internalErrorCode: "wallet161" });
				}
			} catch (error) {
				throw new MoleculerError("Error Delete Qr codes check Parmissions", 501, "ERROR_DELETE_QR_CODES_PERMISSIONS", { message: error.message, internalErrorCode: "wallet160" });
			}
		},

		// wallet170
		async findOneAndUpdate({ walletQrId, dataIn }) {
			let entity = { walletQrId: walletQrId };

			console.log("Wallet findOneAndUpdate ", dataIn);
			console.log("Wallet walletQrId ", walletQrId);

			try {
				return await Wallet.findOneAndUpdate(entity, { $set: dataIn }, { new: true });
			} catch (error) {
				throw new MoleculerError("Updating Data Error", 501, "ERR_UPDATING_DB", { message: error.message, internalErrorCode: "wallet170" });
			}
		},
	},
};
