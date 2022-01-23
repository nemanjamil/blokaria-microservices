"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const { ValidationError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/wallet.js");
const { MoleculerError } = require("moleculer").Errors;
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
		wallets: {
			async handler() {
				let response = await this.axiosGet("https://wallet-testnet.blokaria.com/v2/wallets");
				this.logger.warn(response);
				return response.data;
			},
		},

		generateQrCodeInSystem: {
			// params: {
			// 	walletQrId: "string",
			// },

			async handler(ctx) {
				try {
					return await this.plainInsertDataIntoDb(ctx.meta.$multipart);
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		initiateTransactionToClientWallet: {
			async handler(ctx) {
				try {
					let qrCodeStatus = await this.getQrCodeInfo(ctx);
					let parseObject = qrCodeStatus[0].qrCodeRedeemStatus;
					if (parseObject) throw new MoleculerError("REDEEM_STATUS", 501, "ERR_DB_INSERTING", { message: "redeemed", internalErrorCode: "wallet10" });
					let { rndBr, cardanoRequest } = await this.sendTransactionFromWalletToWallet(process.env.WALLET_ADDRESS_5, qrCodeStatus);
					await this.updateRedeemStatus(ctx, cardanoRequest.data, rndBr);

					return cardanoRequest.data;
				} catch (error) {
					return Promise.reject(error);
				}
			},
		},

		// this will combine to Messages and store under one QR code
		generateContract: {
			async handler(ctx) {
				try {
					let qrCodeStatus = await this.getQrCodeInfo(ctx);
					let parseObject = qrCodeStatus[0].qrCodeRedeemStatus;
					if (parseObject) return Promise.resolve({ rqcoderedeemstatus: "redeemed" });
					return await this.generateContractUpdateDataWithMessages(ctx);
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		getQrCodeData: {
			async handler(ctx) {
				try {
					await this.checkIfQrCodeExistIndb(ctx);
					let productPicture = await ctx.call("image.getProductPicture", { walletQrId: ctx.params.qrcode });
					let walletIdData = await this.getQrCodeInfo(ctx);

					console.log("walletIdData", walletIdData);
					console.log("productPicture", productPicture);

					let walletIdDataNew = [...walletIdData];
					if (productPicture) {
						walletIdDataNew[0].productPicture = productPicture.productPicture;
					}
					console.log("walletIdDataNew", walletIdDataNew);

					return walletIdDataNew;
				} catch (error) {
					throw new ValidationError(error);
				}
			},
		},

		createWallet: {
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
	},

	methods: {
		parseAddressesForUnused(queryAddresses) {
			return queryAddresses
				.filter((el) => {
					return el.state === "unused";
				})
				.shift().id;
		},

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
				return Promise.reject(error);
			}
		},

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
				return Promise.reject(error);
			}
		},

		async getQrCodeInfo(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.find(entity);
				return wallet;
			} catch (error) {
				return Promise.reject(error);
			}
		},
		async checkIfQrCodeExistIndb(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode,
			};
			try {
				let wallet = await Wallet.exists(entity);
				if (!wallet) throw { message: "QR code doesn't exist in our system", internalErrorCode: 21 };
				return wallet;
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async insertDataIntoDb(ctx, Address, transactionId) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				userDesc: ctx.params.userDesc,
				userFullname: ctx.params.userFullname,
				userEmail: ctx.params.userEmail,
				usedAddress: Address,
				transactionId: transactionId,
			};
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async plainInsertDataIntoDb(ctx) {
			const entity = {
				walletQrId: ctx.walletQrId,
				userDesc: ctx.userDesc,
				userFullname: ctx.userFullname,
				userEmail: ctx.userEmail,
			};

			// if (ctx.params.productPicture) entity.productPicture = ctx.params.walletQrId;
			if (ctx.productVideo) entity.productVideo = ctx.productVideo;
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async getWalletAddresses() {
			let wallet_url = `${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/addresses`;
			try {
				return await this.axiosGet(wallet_url);
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async sendTransactionFromWalletToWallet(Address, qrCodeDbData) {
			let rndBr = "888000999" + Math.floor(Math.random() * 1000000);

			let merchantName = {
				k: {
					string: "MerchantName",
				},
				v: {
					string: qrCodeDbData[0].userFullname,
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

			let productPicture = {
				k: {
					string: "ProductPicture",
				},
				v: {
					string: "Place For URL PICTURE",
				},
			};

			let productVideo = {
				k: {
					string: "ProductVideo",
				},
				v: {
					string: "https://aaaaa.be/aEYlVBbb6GI",
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

			let finalArray = [];
			finalArray.push(merchantName);
			finalArray.push(merchantEmail);
			finalArray.push(merchantMessage);
			finalArray.push(clientName);
			finalArray.push(clientEmail);
			finalArray.push(clientMessage);
			finalArray.push(productPicture);
			finalArray.push(productVideo);

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

			// console.dir(dataObject, { depth: null });

			try {
				let cardanoRequest = await this.axiosPost(`${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/transactions`, dataObject);
				return { rndBr, cardanoRequest };
			} catch (error) {
				return Promise.reject(error);
			}
		},
	},
};
