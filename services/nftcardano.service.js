"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const axiosMixin = require("../mixins/axios.mixin");
const Nftcardano = require("../models/Nftcardano");
const { MoleculerError } = require("moleculer").Errors;

module.exports = {
    name: "nftcardano",
    mixins: [DbService, axiosMixin],
    adapter: dbConnection.getMongooseAdapter(),
    model: Nftcardano,

    actions: {

        checkWallet: {
            params: {
                walletName: { type: "string" },
            },

            async handler(ctx) {
                try {
                    console.log("ctx.params", ctx.params);
                    let checkWallet = await this.axiosPost("http://172.20.0.1:3333/checkWallet", ctx.params);
                    return checkWallet.data;
                } catch (error) {
                    return Promise.reject(error);
                }
            },
        },

        createCardanoNft: {
            params: {
                imageIPFS: { type: "string" },
                assetName: { type: "string" },
                description: { type: "string" },
                authors: { type: "array", optional: true },
                copyright: { type: "string", optional: true },
                walletName: { type: "string" },
            },

            async handler(ctx) {
                try {
                    console.log("ctx.params", ctx.params);
                    let mintNft = await this.axiosPost("http://172.20.0.1:3333/generateNFT", ctx.params);
                    return { mintNFT: mintNft.data };
                } catch (error) {
                    return Promise.reject(error);
                }
            },
        },

        createCardanoNftWithAssignWallet: {
            params: {
                imageIPFS: { type: "string" },
                assetName: { type: "string" },
                description: { type: "string" },
                authors: { type: "array", optional: true },
                addressWallet: { type: "string", optional: true },
                copyright: { type: "string", optional: true },
                walletName: { type: "string" },
                dalayCallToWalletAsset: { type: "number" }
            },

            async handler(ctx) {
                try {

                    console.log("createCardanoNftWithAssignWallet START \n\n");

                    let defaultAddressWallet = "addr_test1qrjvha8weh6uknz5mv4s8m8hjzvv2nmc9hap3mk9ddfgptl5nrlujs9z7afw0cguvjuzzxq6dtmhjhcz8auach6p7s7q8pur88";

                    console.log("createCardanoNftWithAssignWallet ctx.params", ctx.params);
                    let generateNftParams = { ...ctx.params };

                    delete generateNftParams.addressWallet;
                    let addressWallet = (ctx.params.addressWallet) ? ctx.params.addressWallet : defaultAddressWallet;

                    console.log("createCardanoNftWithAssignWallet AddressWallet", addressWallet);
                    console.log("createCardanoNftWithAssignWallet GenerateNftParams", generateNftParams);

                    console.log("  ==== createCardanoNftWithAssignWallet START MINT CALL NATIVE FUNCTION \n\n");

                    let mintNft = await this.axiosPost("http://172.20.0.1:3333/generateNFT", generateNftParams);

                    console.log("createCardanoNftWithAssignWallet USAO");
                    console.log("createCardanoNftWithAssignWallet", mintNft.data);

                    let payloadToWallet = {
                        addressWallet,
                        walletName: ctx.params.walletName,
                        assetId: mintNft.data.assetId
                    };

                    console.log("createCardanoNftWithAssignWallet PayloadToWallet", payloadToWallet);

                    console.log("createCardanoNftWithAssignWallet Start Delay", Date.now());

                    await this.addDelay(ctx.params.dalayCallToWalletAsset);

                    console.log("createCardanoNftWithAssignWallet After Delay GO TO sendAssetToWallet NATIVE ", Date.now(), "\n\n");

                    let sendAssetToWallet = await this.axiosPost("http://172.20.0.1:3333/sendAssetToWallet", payloadToWallet);

                    console.log("createCardanoNftWithAssignWallet Finished SendAssetToWallet", Date.now());

                    return {
                        payloadToWallet,
                        mintNFT: mintNft.data,
                        sendAssetToWallet: sendAssetToWallet.data
                    };
                } catch (error) {
                    console.log("createCardanoNftWithAssignWallet error");
                    console.dir(error);
                    console.log("Error MESSAGE : ", error.message);

                    throw new MoleculerError("Error With NFT Generating", 401, "NFT_GENERATING_BUG", {
                        message: error.message
                    });


                    //return Promise.reject("error.toString()");
                }
            },
        },

        sendAssetToWallet: {
            params: {
                walletName: { type: "string" },
                addressWallet: { type: "string" },
                assetId: { type: "string" }
            },

            async handler(ctx) {
                try {
                    console.log("ctx.params", ctx.params);

                    let payloadToWallet = {
                        addressWallet: ctx.params.addressWallet,
                        walletName: ctx.params.walletName,
                        assetId: ctx.params.assetId
                    };
                    console.log("payloadToWallet", payloadToWallet);
                    let sendAssetToWallet = await this.axiosPost("http://172.20.0.1:3333/sendAssetToWallet", payloadToWallet);
                    return { sendAssetToWallet: sendAssetToWallet.data };

                } catch (error) {
                    return Promise.reject(error);
                }
            },
        }
    },

    methods: {
        async addDelay(time) {
            return new Promise(res => setTimeout(res, time));
        }
    },
};


