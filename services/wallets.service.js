"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const { MoleculerError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/wallet.js");
const Utils = require("../utils/Utils");
require("dotenv").config();

module.exports = {
	name: "wallet",
	logger: true,
	mixins: [DbService, axiosMixin],
	adapter: new MongooseAdapter("mongodb://localhost/blokariawallet", {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true,
	}),
	model: Wallet,

	actions: {
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
					let qrCodeStatus = await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });

					console.log("qrCodeStatus", qrCodeStatus);

					let reducingStatus = await ctx.call("user.reduceUserCoupons", qrCodeStatus);

					console.log("reducingStatus", reducingStatus);

					let { rndBr, cardanoRequest } = await this.sendTransactionFromWalletToWallet(process.env.WALLET_ADDRESS_5, qrCodeStatus);

					console.log("cardanoRequest", cardanoRequest);
					console.log("rndBr", rndBr);

					let redeemStatus = await this.updateRedeemStatus(ctx, cardanoRequest.data, rndBr);

					console.log("redeemStatus", redeemStatus);

					qrCodeStatus[0].emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					let sendEmail = await ctx.call("v1.email.sendTransactionEmail", qrCodeStatus[0]);

					console.log("sendEmail", sendEmail);

					return { qrCodeStatus, cardanoStatus: cardanoRequest.data, reducingStatus, sendEmail, redeemStatus };
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		generateContract: {
			rest: "POST /generateContract",
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
					return listQrCodesByUser;
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


	},

	methods: {
		// 10
		async getQrCodeDataMethod({ ctx, qrRedeemCheck }) {
			try {
				await this.checkIfQrCodeExistIndb(ctx);
				let walletIdData = await this.getQrCodeInfo(ctx);

				switch (true) {
					case (qrRedeemCheck && walletIdData[0].qrCodeRedeemStatus):
						throw new MoleculerError("QR code is already redeemed", 501, "ERR_DB_GETTING", {
							message: "QR code is already redeemed",
							internalErrorCode: "walletredeem10",
						});
						break;
					case (ctx.meta.user.userEmail === walletIdData[0].userEmail):
					case (ctx.params.accessCode === walletIdData[0].accessCode):
						return walletIdData;
						break;
					case (!walletIdData[0].publicQrCode):
						throw new MoleculerError("QR code is not publicly accessible", 501, "ERR_DB_GETTING", {
							message: "QR code is not publicly accessible",
							internalErrorCode: "walletredeem11",
						});
						break;
					case (!qrRedeemCheck):
						return walletIdData;
						break;
					default:
						throw new MoleculerError("Something happened on getQrCodeDataMethod", 501, "ERR_DB_GETTING", {
							message: "Something happened on getQrCodeDataMethod",
							internalErrorCode: "walletredeem12",
						});
						break;
				}




				// let productPicture = await ctx.call("image.getProductPicture", { walletQrId: ctx.params.qrcode });

				// let walletIdDataNew = [...walletIdData];
				// if (productPicture) {
				// 	walletIdDataNew[0].productPicture = productPicture.productPicture;
				// }

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
					string: "MerchantName",
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
					string: "MerchantEmail",
				},
				v: {
					string: qrCodeDbData[0].userEmail,
				},
			};

			let merchantMessage = {
				k: {
					string: "MerchantMessage",
				},
				v: {
					string: qrCodeDbData[0].userDesc,
				},
			};

			let clientName = {
				k: {
					string: "ClientName",
				},
				v: {
					string: qrCodeDbData[0].clientName,
				},
			};

			let clientEmail = {
				k: {
					string: "ClientEmail",
				},
				v: {
					string: qrCodeDbData[0].clientEmail,
				},
			};

			let clientMessage = {
				k: {
					string: "ClientMessage",
				},
				v: {
					string: qrCodeDbData[0].clientMessage,
				},
			};
			let productLink = {
				k: {
					string: "productLink",
				},
				v: {
					string: `/status/${qrCodeDbData[0].walletQrId}`,
				},
			};
			let webSite = {
				k: {
					string: "webSite",
				},
				v: {
					string: process.env.BLOKARIA_WEBSITE
				},
			};

			let finalArray = [];
			finalArray.push(merchantName);
			finalArray.push(productName);
			finalArray.push(merchantEmail);
			finalArray.push(merchantMessage);
			finalArray.push(clientName);
			finalArray.push(clientEmail);
			finalArray.push(clientMessage);
			finalArray.push(productLink);
			finalArray.push(webSite);
			finalArray.push(internalCode);

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
	},
};
