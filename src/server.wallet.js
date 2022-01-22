"use strict";

const { ServiceBroker } = require("moleculer");
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const mongoose = require("mongoose");

const broker = new ServiceBroker({ hotReload: true });

// Create a Mongoose service for `post` entities
broker.createService({
	name: "wallets",
	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb://localhost/tralala"),
	model: mongoose.model(
		"Wallet",
		mongoose.Schema({
			walletQrId: { type: String, unique: true, required: true },
			userDesc: { type: String },
			userFullname: { type: String },
			userEmail: { type: String },
		})
	),
});

// broker
// 	.start()
// 	// Create a new post
// 	.then(() =>
// 		broker.call("wallets.create", {
// 			walletQrId: "gggrrrdsdd",
// 		})
// 	)

// 	// Get all posts
// 	.then(() => broker.call("wallets.find").then(console.log));
