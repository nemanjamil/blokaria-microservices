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
            async handler() {
                try {
                    let dataObject = {
                        test: "Test Obj"
                    };
                    let cardanoRequest = await this.axiosPost("172.20.0.1:3333", dataObject);
                    return cardanoRequest;
                } catch (error) {
                    return Promise.reject(error);
                }
            },
        }
    }
};
