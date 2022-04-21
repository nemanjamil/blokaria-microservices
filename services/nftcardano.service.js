"use strict";
const DbService = require("moleculer-db");
const dbConnection = require("../utils/dbConnection");
const Nftcardano = require("../models/Nftcardano");
const Cardano = require("../mixins/cardano.mixin");


module.exports = {
    name: "nftcardano",
    mixins: [DbService, Cardano],
    adapter: dbConnection.getMongooseAdapter(),
    model: Nftcardano,

    actions: {
        createCardanoNft: {
            async handler(ctx) {
                try {
                    return "aaa";
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
