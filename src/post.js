"use strict";

const { ServiceBroker } = require("moleculer");
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const mongoose = require("mongoose");

const broker = new ServiceBroker();

// Create a Mongoose service for `post` entities
broker.createService({
	name: "posts",
	mixins: [DbService],
	adapter: new MongooseAdapter("mongodb://localhost/blabla"),
	model: mongoose.model(
		"Post",
		mongoose.Schema({
			title: { type: String },
			content: { type: String },
			votes: { type: Number, default: 0 },
		})
	),
});

broker
	.start()
	// Create a new post
	.then(() =>
		broker.call("posts.create", {
			title: "My first post",
			content: "Lorem ipsum...",
			votes: 0,
		})
	)

	// Get all posts
	.then(() => broker.call("posts.find").then(console.log));
