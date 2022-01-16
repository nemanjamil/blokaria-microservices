"use strict";
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const { ValidationError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/wallet.js");
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

		createTransaction: {
			async handler(ctx) {
				try {
					let insertedData = await this.insertDataIntoDb(ctx);
					let walletAddresses = await this.getWalletAddresses();
					let unusedAddress = this.parseAddressesForUnused(walletAddresses.data);
					let transactionData = await this.sendTransactionFromWalletToWallet(unusedAddress);

					return { insertedData, unusedAddress, txId: transactionData.data };
				} catch (error) {
					this.logger.error("createTransaction ERROR: ", error.message);
					throw new ValidationError(error.message);
				}
			},
		},

		createWallet: {
			async handler() {
				this.logger.warn("CreateWallet");

				try {
					let walletAddresses = await this.getWalletAddresses();
					let unusedAddress = this.parseAddressesForUnused(walletAddresses.data);
					let transactionData = await this.sendTransactionFromWalletToWallet(unusedAddress);

					return { unusedAddress, transactionData };
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

		async insertDataIntoDb(ctx) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				walletDesc: ctx.params.walletDesc,
				userFullname: ctx.params.userFullname,
				userEmail: ctx.params.userEmail,
			};
			this.logger.warn("== 1 == insertDataIntoDb ENTITY: ", entity);

			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async getWalletAddresses() {
			let wallet_url = `${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/addresses`;
			this.logger.warn("== 2 == getWalletAddresses wallet_url ", wallet_url);

			try {
				return await this.axiosGet(wallet_url);
			} catch (error) {
				return Promise.reject(error);
			}
		},

		async sendTransactionFromWalletToWallet(unusedAddress) {
			this.logger.warn("== 3 == sendTransactionFromWalletToWallet");
			try {
				return await this.axiosPost(`${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/transactions`, {
					passphrase: `${process.env.WALLET_PASSPHRASE_1}`,
					payments: [
						{
							address: `${unusedAddress}`,
							amount: {
								quantity: 1000000,
								unit: "lovelace",
							},
						},
					],
					withdrawal: "self",
				});
			} catch (error) {
				return Promise.reject(error);
			}
		},
	},
};
