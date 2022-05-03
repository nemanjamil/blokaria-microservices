"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const axiosMixin = require("../mixins/axios.mixin");
const Nftcardano = require("../models/Nftcardano");

module.exports = {
    name: "nftcardano",
    mixins: [DbService, axiosMixin],
    adapter: dbConnection.getMongooseAdapter(),
    model: Nftcardano,

    actions: {
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

        createCardanoNftWithAssigWallet: {
            params: {
                imageIPFS: { type: "string" },
                assetName: { type: "string" },
                description: { type: "string" },
                authors: { type: "array", optional: true },
                addressWallet: { type: "string", optional: true },
                copyright: { type: "string", optional: true },
                walletName: { type: "string" }
            },

            async handler(ctx) {
                try {
                    console.log("ctx.params", ctx.params);
                    let addressWallet = (ctx.params.addressWallet) ? ctx.params.addressWallet : "";
                    let mintNft = await this.axiosPost("http://172.20.0.1:3333", ctx.params);

                    let payloadToWallet = {
                        addressWallet,
                        walletName: ctx.params.walletName,
                        assetId: mintNft.data.assetId
                    };
                    console.log("payloadToWallet", payloadToWallet);

                    let sendAssetToWallet = await this.axiosPost("http://172.20.0.1:3333/mintNFT", payloadToWallet);

                    return { mintNFT: mintNft.data, sendAssetToWallet: sendAssetToWallet.data };
                } catch (error) {
                    return Promise.reject(error);
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
    }
};
