const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const dbConnection = {
	getMongooseAdapter() {
		console.log("mongoose adapter connection to:", process.env.MONGO_URL);
		return new MongooseAdapter(`${process.env.MONGO_URL}/blokariawallet`, {
			// useNewUrlParser: true,
			// useUnifiedTopology: true,
			user: process.env.MONGO_USERNAME,
			pass: process.env.MONGO_PASSWORD,
			keepAlive: true,
		});
	},
};
module.exports = dbConnection;
