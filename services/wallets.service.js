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
					return await this.plainInsertDataIntoDb({
						ctx,
						user: ctx.params.data.user,
						wallet: ctx.params.data.$multipart,
						image: ctx.params.imageSave,
					});
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		initiateTransactionToClientWallet: {
			rest: "POST /initiateTransactionToClientWallet",
			async handler(ctx) {
				try {
					console.log("\n\n Wallet Initiation Has Started");

					let qrCodeStatus = await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });

					qrCodeStatus[0].walletName = process.env.WALLET_NAME;
					qrCodeStatus[0].amountValue = 1;
					delete qrCodeStatus[0].nftimage;
					console.log("Wallet qrCodeStatus", qrCodeStatus);

					let reducingStatus = await ctx.call("user.reduceUserCoupons", qrCodeStatus);
					console.log("Wallet ReducingStatus", reducingStatus);
					let { rndBr, cardanoRequest } = await this.sendTransactionFromWalletToWallet(qrCodeStatus);
					console.log("Wallet RndBr", rndBr);
					let redeemStatus = await this.updateRedeemStatus(ctx, cardanoRequest.data, rndBr);
					console.log("Wallet RedeemStatus", redeemStatus);

					let sendAssetToWallet, updateDbSendingAssetDbRes;

					console.log("Wallet >  qrCodeStatus", qrCodeStatus);
					console.log("Wallet >  qrCodeStatus[0].cbnftimage", qrCodeStatus[0].cbnftimage);
					console.log("Wallet >  qrCodeStatus[0]._nfts[0].length", qrCodeStatus[0]._nfts.length);

					if (qrCodeStatus[0].cbnftimage && qrCodeStatus[0]._nfts.length > 0) {
						console.log("\n\n ================ \n\n");
						console.log("Wallet >  WalletMinting Start \n");
						console.log("Wallet >  WalletMinting and wallet assigining has started \n");

						let nftParams = {
							assetId: qrCodeStatus[0]._nfts[0].assetId,
							addressWallet: qrCodeStatus[0].nftsendaddress,
							walletName: "NFT_TEST",
							amountValue: 1.7,
						};

						console.log("Wallet > WalletMinting NftParams", nftParams);
						console.log("Wallet > WalletMinting process.env.LOCALENV", process.env.LOCALENV);

						if (process.env.LOCALENV === "false") {
							console.log(" \n\n\n\n	>>> WalletMinting SERVER - STARTED sendAssetToWallet \n");

							sendAssetToWallet = await ctx.call("nftcardano.sendAssetToWallet", nftParams);
							console.log("\n\n	>>> SUCCESSFULL sendAssetToWallet Has Finished \n");
							console.log("	>>> sendAssetToWallet ", sendAssetToWallet);

							updateDbSendingAssetDbRes = await ctx.call("nftcardano.updateDbSendingAssetDb", { sendAssetToWallet, qrCodeStatus, nftParams });

							console.log("\n\n updateDbSendingAssetDbRes  \n");
							console.log("updateDbSendingAssetDbRes ", updateDbSendingAssetDbRes);
						} else {
							console.log("WalletMinting LOCAL  ENV \n");
							sendAssetToWallet = {
								sendAssetToWallet: {
									txHash: "dabc75e9b333dc728729fbb5c1ba68fcd1f24ad0cc4f164216cd086d66e76db0",
								},
							};

							updateDbSendingAssetDbRes = await ctx.call("nftcardano.updateDbSendingAssetDb", { sendAssetToWallet, qrCodeStatus, nftParams });
						}
					} else {
						console.log("WalletMinting  Skipped \n");
					}

					qrCodeStatus[0].emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					let sendEmail = await ctx.call("v1.email.sendTransactionEmail", qrCodeStatus[0]);

					console.log("\n\n Wallet SendEmail", sendEmail);

					return {
						qrCodeStatus,
						sendAssetToWallet,
						cardanoStatus: cardanoRequest.data,
						reducingStatus,
						sendEmail,
						updateDbSendingAssetDbRes,
						redeemStatus,
					};
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		populateWalletTable: {
			async handler(ctx) {
				let entity = {
					walletQrId: ctx.params.walletQrId,
				};

				let data = {
					$push: { _nfts: String(ctx.params._id) },
				};

				try {
					return await Wallet.findOneAndUpdate(entity, data, { new: true }).populate("_wallets");
				} catch (error) {
					throw new MoleculerError("Can not populate Wallet table with NFT ids", 401, "POPULATE_BUG", {
						message: "Wallet Not Found",
						internalErrorCode: "wallet303_populate",
					});
				}
			},
		},

		addProjectToWallet: {
			async handler(ctx) {
				let entity = { _id: ctx.params.itemId };

				let data = {
					_project: ctx.params.projectId === "noproject" ? null : ctx.params.projectId,
				};

				console.log("wallet addProjectToWallet entity ", entity);
				console.log("wallet addProjectToWallet data ", data);

				try {
					return await Wallet.findOneAndUpdate(entity, data, { new: true });
					// return await Wallet.find(data);
				} catch (error) {
					console.log("\n\n wallet addProjectToWallet Error ", error);
					throw new MoleculerError("Can not populate Wallet table with Project ids", 401, "POPULATE_BUG", {
						message: "Project Not Found",
						internalErrorCode: "wallet403_populate",
					});
				}
			},
		},

		getProjectIdFromQrCode: {
			async handler(ctx) {
				let data = {
					_id: ctx.params.itemId,
				};
				try {
					return await Wallet.find(data);
				} catch (error) {
					throw new MoleculerError("Get Project From QrCode ", 401, "GET_BUG", {
						message: "Not Found",
						internalErrorCode: "wallet407_populate",
					});
				}
			},
		},
		getAllQrCodesFromProject: {
			async handler(ctx) {
				let data = {
					_project: ctx.params.projectIdOld,
				};
				console.log("Wallet getAllQrCodesFromProject data : ", data);

				try {
					return await Wallet.find(data);
				} catch (error) {
					throw new MoleculerError("Get All Qr Codes from Project ", 401, "GET_BUG", {
						message: "Not Found",
						internalErrorCode: "wallet409",
					});
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

		getQrCodeDataOnlyLocalCall: {
			async handler(ctx) {
				try {
					return await this.getQrCodeInfo(ctx);
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
				},
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
				clientName: { type: "string" },
			},
			async handler(ctx) {
				const { clientEmail, clientName } = ctx.params;

				let walletIdData = await this.getQrCodeInfo(ctx);
				let sendApprovalToClientRes = await ctx.call("v1.email.sendApprovalToClient", { ctx, walletIdData, clientEmail, clientName });

				return sendApprovalToClientRes;
			},
		},
	},

	methods: {
		// 10
		async getQrCodeDataMethod({ ctx, qrRedeemCheck }) {
			try {
				await this.checkIfQrCodeExistIndb(ctx);
				let walletIdData = await this.getQrCodeInfo(ctx);

				switch (true) {
					case !qrRedeemCheck:
						return walletIdData;
					case qrRedeemCheck && walletIdData[0].qrCodeRedeemStatus > 0:
						throw new MoleculerError("QR kod je već iskorišćen", 501, "ERR_DB_GETTING", {
							message: "QR kod je već iskorišćen",
							internalErrorCode: "walletredeem10",
						});
					case ctx.meta.user.userEmail === walletIdData[0].userEmail:
					case ctx.params.accessCode && ctx.params.accessCode === walletIdData[0].accessCode:
						return walletIdData;
					case walletIdData[0].publicQrCode === false:
						throw new MoleculerError("QR kod nije javno dostupan", 501, "ERR_DB_GETTING", {
							message: "QR kod nije javno dostupan",
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
				nftimage: ctx.params.nftimage ? ctx.params.nftimage : "",
				cbnftimage: ctx.params.cbnftimage,
				clientemailcb: ctx.params.clientemailcb,
				ownernamecb: ctx.params.ownernamecb,
			};

			try {
				return await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
			} catch (error) {
				throw new MoleculerError("Greška u ažuriranju podataka", 501, "ERR_GENERATING_CONTRACT", {
					message: error.message,
					internalErrorCode: "wallet30",
				});
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
				throw new MoleculerError("Updating Redeem Status Error", 501, "ERROR_UPDATE_REEDEEM_STATUS", {
					message: error.message,
					internalErrorCode: "wallet40",
				});
			}
		},

		// 50
		async getQrCodeInfo(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.find(entity).populate("_image", { productPicture: 1 }).populate("_nfts");
				return wallet;
			} catch (error) {
				throw new MoleculerError("Greška pri čitanju QR koda", 501, "ERROR_GET_QR_CODE_DATA", {
					message: error.message,
					internalErrorCode: "wallet50",
				});
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
					throw new MoleculerError("Kod ne postoji u bazi podataka", 501, "ERROR_GET_QR_CODE_DATA", {
						message: "Code do not exist into db",
						internalErrorCode: "wallet60",
					});
				return wallet;
			} catch (error) {
				throw new MoleculerError("Greška pri šitanju postojećeg QR koda", 501, "ERROR_GET_QR_CODE_DATA", {
					message: "rror reading exists Qr Code",
					internalErrorCode: "wallet61",
				});
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
				throw new MoleculerError("Greška u ubacivanju podataka u bazu podataka", 501, "ERROR_INSERT_INTO_DB", {
					message: error.message,
					internalErrorCode: "wallet70",
				});
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
				_image: image._id,
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
				throw new MoleculerError("Plain Inerting Data into DB Error", 501, "ERROR_PLAIN_INSERT_INTO_DB", {
					message: error.message,
					internalErrorCode: "wallet80",
				});
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
		async sendTransactionFromWalletToWallet(qrCodeDbData) {

			console.log("sendTransactionFromWalletToWallet qrCodeDbData : ", qrCodeDbData);
			console.log("sendTransactionFromWalletToWallet DOCKER_INTERNAL_URL : ", process.env.DOCKER_INTERNAL_URL);

			try {
				//let cardanoRequest = await this.axiosPost(`${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/transactions`, dataObject);
				let requestForTransaction = await this.axiosPost(`${process.env.DOCKER_INTERNAL_URL}generateTransaction`, qrCodeDbData);

				return { requestForTransaction };
				//return { rndBr, cardanoRequest };
			} catch (error) {
				//console.dir(error, { depth: null });
				throw new MoleculerError("Inserting Transaction into BlockChain Error", 501, "ERROR_SEND_TRANSACTION_TO_CARDANO_BC", {
					message: error.message,
					internalErrorCode: "wallet202",
				});
			}
		},

		// wallet110
		async getListQrCodesByUserMethod(ctx) {
			const entity = {
				userEmail: ctx.params.userEmail,
			};
			try {
				return await Wallet.find(entity)
					.sort("-createdAt")
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
				return await Wallet.find(entity)
					.skip(ctx.params.skip)
					.limit(ctx.params.limit)
					.sort({ createdAt: -1 })
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
				return await Wallet.find(entity)
					.sort("-createdAt")
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
					.match({ userInfo: { $exists: true, $not: { $size: 0 } } })
					.project({ _id: 0, count: "$count", userFullName: "$userInfo.userFullName", userEmail: "$userInfo.userEmail" })
					.exec();
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 501, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet140" });
			}
		},

		// wallet150
		async deleteQrCodeModel(ctx) {
			let data = {
				walletQrId: ctx.params.walletQrId,
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
					throw new MoleculerError("Error Delete Qr codes check Parmissions", 501, "ERROR_DELETE_QR_CODES_PERMISSIONS", {
						message: "Data do not match",
						internalErrorCode: "wallet161",
					});
				}
			} catch (error) {
				throw new MoleculerError("Error Delete Qr codes check Parmissions", 501, "ERROR_DELETE_QR_CODES_PERMISSIONS", {
					message: error.message,
					internalErrorCode: "wallet160",
				});
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
