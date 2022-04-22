"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const axiosMixin = require("../mixins/axios.mixin");
const Nftcardano = require("../models/Nftcardano");

module.exports = {
    name: "nftcardano",
    mixins: [DbService, axiosMixin], // Cardano
    adapter: dbConnection.getMongooseAdapter(),
    model: Nftcardano,


    actions: {
        createCardanoNft: {
            async handler() {
                let dataObject = {
                    opala: "jedan"
                };
                try {
                    let cardanoNftRequest = await this.axiosPost("172.20.0.1:3333", dataObject);
                    return cardanoNftRequest;
                } catch (error) {
                    return Promise.reject(error);
                }
            },
        }
    },

    methods: {},
    settings: {},
    dependencies: [],
    events: {},
};
