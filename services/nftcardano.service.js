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
                walletName: { type: "string" }
            },

            async handler(ctx) {
                try {
                    console.log('ctx.params', ctx.params);
                    let cardanoRequest = await this.axiosPost("http://172.20.0.1:3333", ctx.params);
                    return cardanoRequest.data;
                } catch (error) {
                    return Promise.reject(error);
                }
            },
        }
    }
};
