"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const { MoleculerError } = require("moleculer").Errors;
const axiosMixin = require("../mixins/axios.mixin");
const Wallet = require("../models/Wallet.js");
const User = require("../models/User.js");
const Utils = require("../utils/utils");
const random = require("lodash/random");
const { log } = require("handlebars");

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
			}
		},

		deleteQrCode: {
			rest: "POST /deleteQrCode",
			params: {
				walletQrId: { type: "string" }
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
			}
		},

		addImageToQrCode: {
			async handler(ctx) {
				this.logger.info("addImageToQrCode ctx.params", ctx.params);
				const { imageSave, cbnftimage } = ctx.params;

				let data = {
					_image: imageSave._id,
					cbnftimage: cbnftimage
				};

				let entity = {
					walletQrId: imageSave.walletQrId
				};

				try {
					return await Wallet.findOneAndUpdate(entity, data, { new: true });
				} catch (error) {
					throw new MoleculerError("Can not populate Wallet table with Image ids", 401, "POPULATE_BUG", {
						message: "Wallet Not Found",
						internalErrorCode: "wallet303_populate"
					});
				}
			}
		},

		generateQrCodeInSystem: {
			//rest: "POST /generateQrCodeInSystem",
			async handler(ctx) {
				try {
					console.log("generateQrCodeInSystem ctx.params", ctx.params);
					let plainInsertObject = {
						ctx,
						user: ctx.params.data.user,
						wallet: ctx.params.data.$multipart,
						image: ctx.params.imageSave
					};

					return await this.plainInsertDataIntoDb(plainInsertObject);
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		initiateTransactionToClientWallet: {
			params: {
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] },
				qrcode: { type: "string", min: 1, max: 50 }
			},
			//rest: "POST /initiateTransactionToClientWallet",
			async handler(ctx) {
				try {
					const { userLang } = ctx.params;
					console.log("\n\n Wallet Initiation Has Started : initiateTransactionToClientWallet", ctx.params);

					let qrCodeStatus = await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });
					console.log("Wallet qrCodeStatus BEFORE ", qrCodeStatus);

					console.log("Wallet checkTimeForSendingAsset START");
					await ctx.call("nftcardano.checkTimeForSendingAsset", { qrCodeStatus });
					console.log("Wallet checkTimeForSendingAsset FINISH");

					let numberOfSeconds = 5;
					console.log(`Wallet addDelay ${numberOfSeconds}sec - START `, Date.now());
					await this.addDelay(numberOfSeconds * 1000);
					console.log(`Wallet addDelay ${numberOfSeconds}sec - END`, Date.now());

					let updateDbSendingAssetDb, sendAssetToWallet, txHash, redeemStatus;

					console.log("\n\n WATCH \n\n");

					console.log("qrCodeStatus", qrCodeStatus);
					console.log("qrCodeStatus[0].cbnftimage", qrCodeStatus[0].cbnftimage);
					console.log("qrCodeStatus[0]._nfts", qrCodeStatus[0]._nfts);
					console.log("qrCodeStatus[0]._nfts.length", qrCodeStatus[0]._nfts.length);

					if (qrCodeStatus[0].cbnftimage && qrCodeStatus[0]._nfts.length > 0) {
						console.log("\n\n\n ---- NFT START SERVER ---- \n\n\n");

						console.log("Wallet >  NFT > SEND ASSET TO WALLET -  START");
						console.log("Wallet >  DATA", ctx.params);
						let { updateDbSendingAssetDbRes, sendAssetToWalletRes } = await ctx.call("nftcardano.sendNftAssetToClient", ctx.params);
						console.log("Wallet >  NFT > SEND ASSET TO WALLET  FINISH");
						sendAssetToWallet = sendAssetToWalletRes;
						updateDbSendingAssetDb = updateDbSendingAssetDbRes;

						console.log("Wallet RedeemStatus NFT START");
						redeemStatus = await this.updateRedeemStatus(ctx);
						console.log("Wallet RedeemStatus NFT END", redeemStatus);
					} else {
						console.log("\n\n\n ---- BASIC START ---- \n\n\n");

						console.log("Wallet sendTransactionFromWalletToWallet BASIC START");
						let { rndBr, txHash } = await this.sendTransactionFromWalletToWallet(qrCodeStatus);
						console.log("Wallet BASIC sendTransactionFromWalletToWallet BASIC FINISH");

						console.log("Wallet RedeemStatus START");
						redeemStatus = await this.updateRedeemStatus(ctx, txHash, rndBr);
						console.log("Wallet RedeemStatus END", redeemStatus);
					}

					qrCodeStatus[0].emailVerificationId = parseInt(process.env.EMAIL_VERIFICATION_ID);
					qrCodeStatus[0].userLang = userLang;

					console.log("Wallet RedeemStatus userLang", userLang);

					console.log("Wallet RedeemStatus Dayload for Email", qrCodeStatus[0]);

					let sendEmail = await ctx.call("v1.email.sendTransactionEmail", qrCodeStatus[0]);

					console.log("\n\n Wallet SendEmail", sendEmail);

					return {
						qrCodeStatus,
						sendAssetToWallet,
						cardanoStatus: txHash,
						sendEmail,
						updateDbSendingAssetDb,
						redeemStatus
					};
				} catch (error) {
					console.log("error FINAL", error);

					throw new MoleculerError(error.message, 401, "TRANSACTION_ERROR", {
						message: error.message,
						internalErrorCode: error.internalErrorCode
					});
				}
			}
		},

		populateWalletTable: {
			async handler(ctx) {
				let entity = {
					walletQrId: ctx.params.walletQrId
				};

				let data = {
					$push: { _nfts: String(ctx.params._id) }
				};

				try {
					return await Wallet.findOneAndUpdate(entity, data, { new: true }); // .populate("_wallets");
				} catch (error) {
					throw new MoleculerError("Can not populate Wallet table with NFT ids", 401, "POPULATE_BUG", {
						message: "Wallet Not Found",
						internalErrorCode: "wallet303_populate"
					});
				}
			}
		},

		addProjectToWallet: {
			async handler(ctx) {
				let entity = { _id: ctx.params.itemId };

				let data = {
					_project: ctx.params.projectId === "noproject" ? null : ctx.params.projectId
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
						internalErrorCode: "wallet403_populate"
					});
				}
			}
		},

		getProjectIdFromQrCode: {
			async handler(ctx) {
				let data = {
					_id: ctx.params.itemId
				};
				try {
					return await Wallet.find(data);
				} catch (error) {
					throw new MoleculerError("Get Project From QrCode ", 401, "GET_BUG", {
						message: "Not Found",
						internalErrorCode: "wallet407_populate"
					});
				}
			}
		},

		getAllQrCodesFromProject: {
			async handler(ctx) {
				let data = {
					_project: ctx.params.projectIdOld
				};
				console.log("Wallet getAllQrCodesFromProject data : ", data);

				try {
					return await Wallet.find(data);
				} catch (error) {
					throw new MoleculerError("Get All Qr Codes from Project ", 401, "GET_BUG", {
						message: "Not Found",
						internalErrorCode: "wallet409"
					});
				}
			}
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
				ownernamecb: { type: "boolean", default: true }
			},
			async handler(ctx) {
				try {
					console.log("generateContract", ctx.params);

					await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });
					return await this.generateContractUpdateDataWithMessages(ctx);
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getQrCodeData: {
			async handler(ctx) {
				try {
					return await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: true });
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getQrCodeDataOnlyLocalCall: {
			async handler(ctx) {
				try {
					return await this.getQrCodeInfo(ctx);
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getQrCodeDataNoRedeem: {
			//rest: "POST /getQrCodeDataNoRedeem",
			async handler(ctx) {
				try {
					let rnd = random(100);
					this.logger.info("getQrCodeDataNoRedeem ctx.requestID", ctx.params);
					this.logger.info("getQrCodeDataNoRedeem ctx.requestID", ctx.requestID, rnd);

					return await this.getQrCodeDataMethod({ ctx, qrRedeemCheck: false });
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getQrCodeFromId: {
			params: {
				idcode: { type: "string", max: "30" }
			},
			async handler(ctx) {
				try {
					this.logger.info("getQrCodeFromId", ctx.params);

					let getWalletFromId = await Wallet.findOne({ _id: ctx.params.idcode });
					if (!getWalletFromId) {
						throw new MoleculerError("No WALLET ID", 401, "ERR_GET_WALLET_ID", {
							message: "No Data",
							internalErrorCode: "wallet544"
						});
					} else {
						let qrcode = getWalletFromId.walletQrId;
						return await this.actions.getQrCodeDataNoRedeem({ qrcode });
					}
				} catch (error) {
					throw new MoleculerError("Greška - GET DATA", 401, "ERR_GET_WALLET_ID", {
						message: error.message,
						internalErrorCode: "wallet543"
					});
				}
			}
		},

		// createWallet: {
		// 	// rest: "POST /getQrCodeData", not allowed
		// 	async handler() {
		// 		try {
		// 			let walletAddresses = await this.getWalletAddresses();
		// 			let unusedAddress = this.parseAddressesForUnused(walletAddresses.data);
		// 			let transactionData = await this.sendTransactionFromWalletToWallet(unusedAddress);

		// 			return { unusedAddress, txId: transactionData.data };
		// 		} catch (error) {
		// 			return Promise.reject(error);
		// 		}
		// 	},
		// },

		getListQrCodesByUserPrivate: {
			rest: "POST /getListQrCodesByUserPrivate",
			meta: {
				user: {
					userEmail: { type: "email" },
					generated: { type: "boolean" }
				}
			},
			async handler(ctx) {
				const { userEmail } = ctx.meta.user;
				const { generated } = ctx.params;

				try {
					let listQrCodesByUser;

					this.logger.info("getListQrCodesByUserPrivate", ctx.params);
					this.logger.info("getListQrCodesByUserPrivate meta", ctx.meta);

					if (generated) {
						this.logger.info("getListQrCodesByUserPrivate generated TRUE", generated);

						listQrCodesByUser = await this.getListQrCodesByUserMethod({ userEmail, qrCodeRedeemStatus: 0, publicQrCode: false, ctx });
					} else {
						this.logger.info("getListQrCodesByUserPrivate generated false", generated);

						listQrCodesByUser = await this.getlistQrCodesOwnedByUserMethod({ userEmail, qrCodeRedeemStatus: 1, publicQrCode: false, ctx });
					}

					return listQrCodesByUser;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getListQrCodesByUser: {
			// rest: "POST /getListQrCodesByUser",
			params: {
				userEmail: { type: "email" }
			},
			async handler(ctx) {
				try {
					this.logger.info("getListQrCodesByUser", ctx.params);

					const { userEmail } = ctx.params;

					let listQrCodesByUser = await this.getListQrCodesByUserMethod({ userEmail, qrCodeRedeemStatus: 0, publicQrCode: true, ctx });
					return listQrCodesByUser;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		getListQrCodesGeneral: {
			async handler(ctx) {
				try {
					this.logger.info("1. getListQrCodesGeneral", ctx.params);
					this.logger.info("2. time", new Date());

					let listQrCodesByUser = await this.getListQrCodesGeneral(ctx);
					return listQrCodesByUser;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendContractEmail: {
			params: {
				qrcode: { type: "string" },
				clientEmail: { type: "string" },
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] }
			},
			async handler(ctx) {
				try {
					console.log("sendContractEmail CONSOLE.LOG", ctx.params);

					const { userLang } = ctx.params;

					let walletIdData = await this.getQrCodeInfo(ctx);

					console.log("sendContractEmail walletIdData", walletIdData);

					let sendContractEmailRes = await ctx.call("v1.email.sendContractEmailToOwner", { walletIdData, meta: ctx.meta.user, userLang });

					console.log("sendContractEmail sendContractEmailRes", sendContractEmailRes);

					return sendContractEmailRes;
				} catch (error) {
					return Promise.reject(error);
				}
			}
		},

		sendApprovalToClient: {
			params: {
				clientEmail: { type: "email" },
				qrcode: { type: "string" },
				clientName: { type: "string" },
				userLang: { type: "string", min: 1, max: 5, default: "en", values: ["sr", "en"] }
			},
			async handler(ctx) {
				const { clientEmail, clientName, userLang } = ctx.params;

				let walletIdData = await this.getQrCodeInfo(ctx);
				let sendApprovalToClientRes = await ctx.call("v1.email.sendApprovalToClient", { walletIdData, clientEmail, clientName, userLang });

				return sendApprovalToClientRes;
			}
		},

		changeStatusOfQrCode: {
			params: {
				qrcode: { type: "string" },
				status: { type: "boolean", default: true }
			},
			async handler(ctx) {
				const { qrcode, status } = ctx.params;

				let entity = { walletQrId: qrcode };

				let data = {
					publicQrCode: status
				};

				try {
					return await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
				} catch (error) {
					throw new MoleculerError("Greška u ažuriranju podataka : ChangeStatusOfQrCode", 401, "ERR_GENERATING_CONTRACT", {
						message: error.message,
						internalErrorCode: "wallet330"
					});
				}
			}
		},

		modifyAccessibleLocation: {
			params: {
				walletId: { type: "string", required: true },
				latitude: { type: "number", required: true },
				longitude: { type: "number", required: true },
				longText: { type: "string", required: true, max: 200 },
				photo: { type: "string", optional: true }
			},
			async handler(ctx) {
				const { walletId, latitude, longitude, longText, photo } = ctx.params;
				const user = ctx.meta.user;

				try {
					const planter = await User.findOne({ _id: user.userId }).populate("accessibleAreas");
					if (!planter) {
						throw new MoleculerError("User not found", 404, "USER_NOT_FOUND");
					}

					let walletUpdated = false;
					for (const area of planter.accessibleAreas) {
						const wallets = await Wallet.find({ _area: area._id });
						let wallet = wallets.find((wallet) => wallet._id.toString() === walletId);
						if (wallet) {
							wallet = await Wallet.findById(wallet._id);
							wallet.geoLocation = `${latitude},${longitude}`;
							wallet.longText = longText;
							console.log(`Updated wallet location for walletId: ${walletId}`);

							if (photo) {
								wallet = await ctx.call("image.updateTreeImage", { wallet, photo, user });
							}
							await wallet.save();

							ctx.call("v1.email.sendTreePlantingConfirmationEmail", {
								userLang: "en",
								userEmails: [user.userEmail, wallet.userEmail],
								plantingDetails: {
									latitude: latitude,
									longitude: longitude,
									area: area.name,
									photo: photo
								}
							});

							walletUpdated = true;
							break;
						}
					}

					if (walletUpdated) {
						return {
							message: "Wallet location updated successfully in accessible areas."
						};
					} else {
						return {
							message: "Failed to update wallet location: Wallet not found in any accessible area."
						};
					}
				} catch (error) {
					console.error("Error in modifyAccessibleLocation:", error);
					throw new MoleculerError(error.message || "Internal Server Error", 500);
				}
			}
		},

		updateQrCodeText: {
			params: {
				qrcode: { type: "string" },
				longText: { type: "string", optional: true, empty: true, max: 150000 },
				productName: { type: "string", optional: true, empty: true, max: 50 },
				geoLocation: { type: "string", optional: true, empty: true, max: 100 }
			},
			async handler(ctx) {
				const { qrcode, longText, productName, geoLocation } = ctx.params;

				let entity = { walletQrId: qrcode };

				let data = {
					longText: longText,
					productName: productName,
					geoLocation: geoLocation
				};

				this.logger.info("2. updateQrCodeText data", data);
				try {
					let getData = await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
					if (!getData) {
						throw new MoleculerError("Greška u ažuriranju podataka. updateQrCodeText", 401, "ERR_UPDATE_STORY", {
							message: "No Data",
							internalErrorCode: "wallet432"
						});
					} else {
						return await this.actions.getQrCodeDataNoRedeem({ qrcode });
					}
				} catch (error) {
					throw new MoleculerError("Greška u ažuriranju podataka : updateQrCodeText ERROR", 401, "updateQrCodeText", {
						message: error.message,
						internalErrorCode: "wallet430"
					});
				}
			}
		},

		updateStory: {
			params: {
				qrCode: { type: "string" },
				state: { type: "boolean" }
			},
			async handler(ctx) {
				let updateDataPayload = {
					searchBy: ctx.params.qrCode,
					what: "hasstory",
					howmany: ctx.params.state,
					emailVerificationId: parseInt(process.env.EMAIL_VERIFICATION_ID)
				};
				try {
					return this.actions.updateDataInDb(updateDataPayload);
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_UPDATING_DATA", {
						message: error.message,
						internalErrorCode: "user822"
					});
				}
			}
		},

		getWalletsByArea: {
			params: {
				areaId: { type: "string" }
			},
			async handler(ctx) {
				const { areaId } = ctx.params;

				try {
					const wallets = await Wallet.find({ _area: areaId });
					return wallets.map((wallet) => wallet.toJSON());
				} catch (err) {
					console.error("Error retrieving wallets by area:", err);
					throw new MoleculerError("Wallet Retrieval Failed", 500, "WALLET_RETRIEVAL_FAILED", {
						message: "An error occurred while retrieving wallets from the db."
					});
				}
			}
		},

		getWalletById: {
			params: {
				walletId: { type: "string" }
			},
			async handler(ctx) {
				const { walletId } = ctx.params;

				const wallet = await Wallet.findById(walletId).lean();

				if (!wallet) {
					throw new MoleculerError("Wallet not found", 404, "WALLET_NOT_FOUND");
				}

				return wallet;
			}
		},

		updateDataInDb: {
			params: {
				searchBy: { type: "string" },
				what: { type: "string" },
				howmany: { type: "any" },
				emailVerificationId: { type: "number" }
			},
			async handler(ctx) {
				this.logger.info("updateDataInDb START", ctx.params);

				if (ctx.params.emailVerificationId !== parseInt(process.env.EMAIL_VERIFICATION_ID))
					throw new MoleculerError("Verification ID is not correct", 501, "ERR_VERIFICATION_ID", {
						message: "Verification email failed",
						internalErrorCode: "walletError808"
					});

				let searchBy = ctx.params.searchBy;
				let what = ctx.params.what;
				let howmany = ctx.params.howmany;

				const entity = {
					walletQrId: searchBy
				};

				let data = {};
				data[what] = howmany;

				this.logger.info("updateDataInDb data", data);

				try {
					let resultFromReducting = await Wallet.findOneAndUpdate(entity, data, { new: true });

					if (!resultFromReducting) {
						throw new MoleculerError("Data not exist", 401, "WALLET ID DO NOT EXIST", {
							message: "Data not exist in the system",
							internalErrorCode: "user81"
						});
					}
					return resultFromReducting;
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_UPDATING_DATA", {
						message: error.message,
						internalErrorCode: "user80"
					});
				}
			}
		},
		generateGift: {
			params: {
				qrcode: { type: "uuid" },
				accessCode: { type: "string" },
				clientName: { type: "string" },
				clientEmail: { type: "email" }
			},
			async handler(ctx) {
				this.logger.info("1. generateGift updateDataInDb START", ctx.params);

				const { qrcode, accessCode, clientName, clientEmail } = ctx.params;
				const { userId } = ctx.meta.user;

				this.logger.info("2. generateGift updateDataInDb userId", userId);
				this.logger.info("3. generateGift updateDataInDb accessCode", accessCode);

				try {
					let resultUpdating = await Wallet.findOneAndUpdate(
						{
							walletQrId: qrcode,
							accessCode
						},
						{
							userFullname: clientName,
							userEmail: clientEmail,
							_creator: userId
						},
						{ new: true }
					);

					this.logger.info("5. generateGift resultUpdating", resultUpdating);

					if (!resultUpdating) {
						throw new MoleculerError("Data not exist", 401, "WALLET ID DO NOT EXIST", {
							message: "Data not exist in the system",
							internalErrorCode: "wallet167"
						});
					}

					this.logger.info("7. generateGift resultUpdating", resultUpdating);
					let itemId = resultUpdating._id;
					this.logger.info("9. generateGift itemId: resultUpdating._id", itemId);

					const userIdWhoHoldItem = await ctx.call("user.getUserByItemId", { itemId });
					this.logger.info("10. generateGift userIdWhoHoldItem", userIdWhoHoldItem);

					const removeItemFromUserId = await ctx.call("user.removeItemFromUserId", { userId: userIdWhoHoldItem._id, itemId });
					this.logger.info("12. generateGift removeItemFromUserId", removeItemFromUserId);
					this.logger.info("15. generateGift userId", userId);
					this.logger.info("17. generateGift itemId", itemId);

					const addItemFromUserId = await ctx.call("user.addItemToUserId", { userId, itemId });
					this.logger.info("20. generateGift addItemFromUserId", addItemFromUserId);

					if (!resultUpdating) {
						throw new MoleculerError("Data not exist", 401, "WALLET ID DO NOT EXIST", {
							message: "Data not exist in the system",
							internalErrorCode: "wallet104"
						});
					}

					let removeAccessCode = await Wallet.findOneAndUpdate(
						{
							walletQrId: qrcode
						},
						{
							accessCode: ""
						},
						{ new: true }
					);

					this.logger.info("22. generateGift removeAccessCode", removeAccessCode);

					return true;
				} catch (error) {
					throw new MoleculerError(error.message, 401, "ERROR_UPDATING_DATA", {
						message: error.message,
						internalErrorCode: "wallet36677"
					});
				}
			}
		},
		getPublicWalletsByAreaId: {
			params: {
				areaId: { type: "string" }
			},
			async handler(ctx) {
				const { areaId } = ctx.params;

				try {
					const wallets = await Wallet.find(
						{ _area: areaId, publicQrCode: true },
						{ geoLocation: 1, productName: 1, userFullname: 1, userEmail: 1, walletQrId: 1 }
					);
					const area = await ctx.call("v1.area.getAreaById", { id: areaId });
					const filteredWallets = wallets.filter((wallet) => wallet.geoLocation && wallet.geoLocation !== "");

					filteredWallets.forEach((wallet) => {
						wallet.userFullname = wallet.userFullname
							.split(" ")
							.map((namePart) => {
								return namePart.length > 3 ? namePart.slice(0, 3) + "****" : namePart;
							})
							.join(" ");

						wallet.userEmail = wallet.userEmail ? wallet.userEmail[0] + "****@" + wallet.userEmail.split("@")[1] : "****@****";
					});

					return {
						areaName: area.name,
						areaPoints: area.areaPoints,
						wallets: filteredWallets
					};
				} catch (err) {
					console.error("Error retrieving wallets by area:", err);
					throw new MoleculerError("Wallet Retrieval Failed", 500, "WALLET_RETRIEVAL_FAILED", {
						message: "An error occurred while retrieving wallets from the db."
					});
				}
			}
		}
	},

	methods: {
		// 10
		async getQrCodeDataMethod({ ctx, qrRedeemCheck }) {
			try {
				await this.checkIfQrCodeExistIndb(ctx.params.qrcode);

				let walletIdData = await this.getQrCodeInfo(ctx);

				this.logger.info("getQrCodeDataMethod ctx", ctx);
				this.logger.info("getQrCodeDataMethod qrRedeemCheck", qrRedeemCheck);

				switch (true) {
					case !qrRedeemCheck:
						return walletIdData;
					case qrRedeemCheck && walletIdData[0].qrCodeRedeemStatus > 0:
						throw new MoleculerError("QR kod je već iskorišćen", 401, "ERR_DB_GETTING", {
							message: "QR kod je već iskorišćen",
							internalErrorCode: "walletredeem10"
						});
					case ctx.meta.user.userEmail === walletIdData[0].userEmail:
					case ctx.params.accessCode && ctx.params.accessCode === walletIdData[0].accessCode:
						return walletIdData;
					case walletIdData[0].publicQrCode === false:
						throw new MoleculerError("QR kod nije javno dostupan", 401, "ERR_DB_GETTING", {
							message: "QR kod nije javno dostupan",
							internalErrorCode: "walletredeem11"
						});
					default:
						return walletIdData;
					// throw new MoleculerError("Something happened on getQrCodeDataMethod", 401, "ERR_DB_GETTING", {
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
				ownernamecb: ctx.params.ownernamecb
			};

			try {
				return await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
			} catch (error) {
				throw new MoleculerError("Greška u ažuriranju podataka : generateContractUpdateDataWithMessages", 401, "ERR_GENERATING_CONTRACT", {
					message: error.message,
					internalErrorCode: "wallet30"
				});
			}
		},

		// 40
		async updateRedeemStatus(ctx, txHash = false, metaDataRandomNumber = false) {
			let entity = {
				walletQrId: ctx.params.qrcode
			};
			let data = {
				qrCodeRedeemStatus: 1
			};

			if (txHash) data.transactionId = txHash;
			if (metaDataRandomNumber) data.metaDataRandomNumber = metaDataRandomNumber;

			try {
				console.log("Wallet updateRedeemStatus entity ", entity);
				console.log("Wallet updateRedeemStatus data ", data);
				let wallet = await Wallet.findOneAndUpdate(entity, { $set: data }, { new: true });
				return wallet;
			} catch (error) {
				throw new MoleculerError("Updating Redeem Status Error", 401, "ERROR_UPDATE_REEDEEM_STATUS", {
					message: error.message,
					internalErrorCode: "wallet40"
				});
			}
		},

		// 50
		async getQrCodeInfo(ctx) {
			const entity = {
				walletQrId: ctx.params.qrcode
			};
			try {
				let wallet = await Wallet.find(entity).populate("_image", { productPicture: 1 }).populate("_nfts").populate("_project").populate("_area");

				console.log("getQrCodeInfo wallet ", wallet);
				console.log("getQrCodeInfo wallet _image ", wallet._image);
				return wallet;
			} catch (error) {
				throw new MoleculerError("Greška pri čitanju QR koda", 401, "ERROR_GET_QR_CODE_DATA", {
					message: error.message,
					internalErrorCode: "wallet50"
				});
			}
		},

		// 60
		async checkIfQrCodeExistIndb(qrcode) {
			try {
				const wallet = await Wallet.exists({ walletQrId: qrcode });
				if (!wallet)
					throw new MoleculerError("Kod ne postoji u bazi podataka", 401, "ERROR_GET_QR_CODE_DATA", {
						message: "Code do not exist into db",
						internalErrorCode: "wallet60"
					});

				return wallet;
			} catch (error) {
				throw new MoleculerError("Greška pri citanju postojećeg QR koda", 401, "ERROR_GET_QR_CODE_DATA", {
					message: "Error reading exists Qr Code",
					internalErrorCode: "wallet61"
				});
			}
		},

		// 70
		async insertDataIntoDb(ctx, Address, transactionId) {
			const entity = {
				walletQrId: ctx.params.walletQrId,
				geoLocation: ctx.params.geoLocation,
				userFullname: ctx.params.userFullname,
				productName: ctx.params.productName,
				userEmail: ctx.params.userEmail,
				usedAddress: Address,
				transactionId: transactionId
			};
			try {
				let wallet = new Wallet(entity);
				return await wallet.save();
			} catch (error) {
				throw new MoleculerError("Greška u ubacivanju podataka u bazu podataka", 401, "ERROR_INSERT_INTO_DB", {
					message: error.message,
					internalErrorCode: "wallet70"
				});
			}
		},

		// 80
		async plainInsertDataIntoDb({ ctx, user, wallet, image }) {
			const entity = {
				walletQrId: wallet.walletQrId,
				geoLocation: wallet.geoLocation,
				userFullname: wallet.userFullname,
				userEmail: wallet.userEmail,
				productName: wallet.productName,
				publicQrCode: wallet.publicQrCode,
				costOfProduct: wallet.costOfProduct,
				contributorData: wallet.contributorData,
				longText: wallet.longText,
				hasstory: wallet.hasstory,
				accessCode: Utils.generatePass(),
				_area: wallet.area,
				_creator: user.userId
			};

			image ? (entity._image = image._id) : "";

			if (wallet.productVideo) entity.productVideo = wallet.productVideo;

			try {
				let wallet = new Wallet(entity);
				await wallet.save();
				//await wallet.populate("_creator").populate(String(user.userId)).execPopulate();
				//await wallet.populate("_image").populate(String(image._id)).execPopulate();
				await ctx.call("user.populateUserTable", wallet);

				return wallet;
			} catch (error) {
				throw new MoleculerError("Plain Inerting Data into DB Error", 401, "ERROR_PLAIN_INSERT_INTO_DB", {
					message: error.message,
					internalErrorCode: "wallet80"
				});
			}
		},

		// 90
		async getWalletAddresses() {
			let wallet_url = `${process.env.WALLET_SERVER}wallets/${process.env.WALLET_ID_1}/addresses`;
			try {
				return await this.axiosGet(wallet_url);
			} catch (error) {
				throw new MoleculerError("Get Wallet Adress Error", 401, "ERROR_GET_WALLET_ADDRESS", { message: error.message, internalErrorCode: "wallet90" });
			}
		},

		// 100
		async sendTransactionFromWalletToWallet(qrCodeDbData) {
			let newData = {
				geoLocation: qrCodeDbData[0].geoLocation,
				user: qrCodeDbData[0].clientemailcb ? qrCodeDbData[0].userFullname : "-",
				email: qrCodeDbData[0].clientemailcb ? qrCodeDbData[0].userEmail : "-",
				itemName: qrCodeDbData[0].productName,
				qrCodeId: qrCodeDbData[0].walletQrId,
				clientMessage: qrCodeDbData[0].clientMessage,
				walletName: process.env.WALLET_NAME,
				amountValue: 1,
				plantedBy: "NameOfPlanter"

				// clientEmail: qrCodeDbData[0].clientEmail,
				// clientMessage: qrCodeDbData[0].clientMessage,
				// clientName: qrCodeDbData[0].clientName,

				// contributorData: qrCodeDbData[0].contributorData,
				// clientemailcb: qrCodeDbData[0].clientemailcb,
				// ownernamecb: qrCodeDbData[0].clientemailcb,
			};

			console.log("START sendTransactionFromWalletToWallet qrCodeDbData : ", qrCodeDbData);
			console.log("START sendTransactionFromWalletToWallet newData : ", newData);
			console.log("sendTransactionFromWalletToWallet DOCKER_INTERNAL_URL : ", process.env.DOCKER_INTERNAL_URL);

			try {
				let payLoadResponse;
				if (process.env.LOCALENV === "true") {
					console.log("Local ENV sendTransactionFromWalletToWallet");
					payLoadResponse = {
						data: {
							rndBr: Math.floor(Math.random() * 1000),
							txHash: "bla bla txHash"
						}
					};
				} else {
					console.log("sendTransactionFromWalletToWallet Server ENV");
					payLoadResponse = await this.axiosPost(`${process.env.DOCKER_INTERNAL_URL}generateTransaction`, newData);
				}

				console.log("END sendTransactionFromWalletToWallet payLoadResponse rndBr : ", payLoadResponse.data.rndBr);
				console.log("END sendTransactionFromWalletToWallet payLoadResponse txHash : ", payLoadResponse.data.txHash);

				return { rndBr: payLoadResponse.data.rndBr, txHash: payLoadResponse.data.txHash };
				//return { rndBr, cardanoRequest };
			} catch (error) {
				console.error("sendTransactionFromWalletToWallet error 4 error.response.data.error", error.response.data.error);

				throw new MoleculerError(
					"Došlo je do greške pri slanju podataka na BlockChain : sendTransactionFromWalletToWallet",
					401,
					"ERROR_SEND_TRANSACTION_TO_CARDANO_BC",
					{
						message: "Došlo je do greške pri slanju podataka na BlockChain",
						internalErrorCode: "wallet202"
					}
				);
			}
		},

		// wallet110
		async getListQrCodesByUserMethod({ userEmail, qrCodeRedeemStatus, publicQrCode, ctx }) {
			const entity = {
				userEmail
				//qrCodeRedeemStatus,
			};

			if (publicQrCode) entity.publicQrCode = publicQrCode;

			try {
				this.logger.info("1. getListQrCodesByUserMethod entity", entity);

				const listWallet = await Wallet.find(entity)
					.sort("-createdAt")
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 })
					.populate("_area")
					.lean();

				for (let wallet of listWallet) {
					this.logger.info("3. getListQrCodesByUserMethod Wallet wallet", wallet);
					this.logger.info("3. getListQrCodesByUserMethod Wallet area", wallet._area);

					if (wallet.area) {
						const areaData = await ctx.call("v1.area.getAreaById", { id: wallet._area, showConnectedItems: false });
						wallet.areaName = areaData.name;
						wallet.lat = areaData.latitude;
						wallet.lon = areaData.longitude;
						wallet.areaPoints = areaData.areaPoints;
					}
				}

				return listWallet;
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 401, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet110" });
			}
			// let query = [{ $match: { userEmail: userEmail } }];
			// try {
			// 	let user = await Wallet.aggregate(query).exec();
			// 	return user;
			// } catch (error) {
			// 	throw new MoleculerError("Error Listing Qr codes", 401, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet110" });
			// }
		},

		// wallet120
		async getListQrCodesGeneral(ctx) {
			const entity = {
				publicQrCode: true,
				...(ctx.params.planted && { geoLocation: { $exists: true, $ne: "" } })
			};
			try {
				this.logger.info("1. getListQrCodesGeneral ", ctx.params);

				const listWallet = await Wallet.find(entity)
					.skip(ctx.params.skip)
					.limit(ctx.params.limit)
					.sort({ createdAt: -1 })
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 })
					.populate("_area")
					.lean();

				this.logger.info("2. getListQrCodesGeneral listWallet", listWallet);

				this.logger.info("5. getListQrCodesGeneral dateTime  listWallet", listWallet);

				return listWallet;
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 401, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet120" });
			}
		},

		// wallet130
		async getlistQrCodesOwnedByUserMethod({ userEmail, qrCodeRedeemStatus, publicQrCode }) {
			try {
				this.logger.info("getlistQrCodesOwnedByUserMethod params", {
					clientEmail: { $exists: true, $eq: userEmail },
					qrCodeRedeemStatus,
					...(publicQrCode === true ? { publicQrCode } : {})
				});

				// const query = Wallet.where('clientEmail').exists(true).equals(userEmail).where('qrCodeRedeemStatus').equals(qrCodeRedeemStatus);
				// if (publicQrCode === true) {
				// 	query.where('publicQrCode').equals(true);
				// }
				// const items = query.exec();

				return await Wallet.find({
					clientEmail: { $exists: true, $eq: userEmail },
					qrCodeRedeemStatus: 1,
					...(publicQrCode === true ? { publicQrCode } : {})
				})
					.sort("-createdAt")
					.populate("_creator", { userFullName: 1, userEmail: 1 })
					.populate("_image", { productPicture: 1 })
					.populate("_nfts")
					.exec();
			} catch (error) {
				this.logger.debug("failed to fetch user owned qrcodes", error);
				throw new MoleculerError("Error Listing Qr codes", 401, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet130" });
			}
		},

		// wallet140
		async getListQrCodesOwnersModel() {
			try {
				let results = await Wallet.aggregate()
					.group({ _id: "$userEmail", count: { $sum: 1 } })
					.lookup({ from: "users", localField: "_id", foreignField: "userEmail", as: "userInfo" })
					.match({ userInfo: { $exists: true, $not: { $size: 0 } } })
					.project({
						_id: 0,
						count: "$count",
						userFullName: {
							$concat: [
								{ $substr: [{ $arrayElemAt: ["$userInfo.userFullName", 0] }, 0, 3] }, // First 3 letters of full name
								"***** ",
								{ $substr: [{ $arrayElemAt: [{ $split: [{ $arrayElemAt: ["$userInfo.userFullName", 0] }, " "] }, 1] }, 0, 3] }, // First 3 letters of last name
								"*****"
							]
						},
						userEmailOrg: { $arrayElemAt: ["$userInfo.userEmail", 0] },
						userEmail: {
							$concat: [
								{ $substr: [{ $arrayElemAt: ["$userInfo.userEmail", 0] }, 0, 1] }, // First letter of email
								"*****@",
								{ $arrayElemAt: [{ $split: [{ $arrayElemAt: ["$userInfo.userEmail", 0] }, "@"] }, 1] } // Domain part
							]
						}
					})
					.exec();

				results.forEach((result) => {
					result.userEmailOrg = Buffer.from(result.userEmailOrg).toString("base64");
				});

				return results;
			} catch (error) {
				throw new MoleculerError("Error Listing Qr codes", 401, "ERROR_LISTING_QR_CODES", { message: error.message, internalErrorCode: "wallet140" });
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
				throw new MoleculerError("Error Delete Qr codes", 401, "ERROR_DELETE_QR_CODES", { message: error.message, internalErrorCode: "wallet150" });
			}
		},

		// wallet160
		async allowedToDeleteModel(ctx) {
			const entity = {
				walletQrId: ctx.params.walletQrId
			};
			try {
				let qrCodeData = await Wallet.find(entity).populate("_image", { productPicture: 1 });
				if (qrCodeData[0].userEmail === ctx.meta.user.userEmail) {
					return qrCodeData;
				} else {
					throw new MoleculerError("Error Delete Qr codes check Parmissions", 401, "ERROR_DELETE_QR_CODES_PERMISSIONS", {
						message: "Data do not match",
						internalErrorCode: "wallet161"
					});
				}
			} catch (error) {
				throw new MoleculerError("Error Delete Qr codes check Parmissions", 401, "ERROR_DELETE_QR_CODES_PERMISSIONS", {
					message: error.message,
					internalErrorCode: "wallet160"
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
				throw new MoleculerError("Updating Data Error", 401, "ERR_UPDATING_DB", { message: error.message, internalErrorCode: "wallet170" });
			}
		},

		// async getAreaNameById(areaId) {
		// 	const area = await ctx.call("v1.area.getAreaById", { areaId });
		// 	console.log("Wallet getAreaNameById area ", area);
		// 	return area ? area.name : "Unknown Area";
		// },

		async addDelay(time) {
			return new Promise((res) => setTimeout(res, time));
		}
	}
};
