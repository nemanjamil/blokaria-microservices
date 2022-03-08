const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const dbConnection = {
	getMongooseAdapter() {
		return new MongooseAdapter(`${process.env.MONGO_URL}/blokariawallet`, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
			user: process.env.MONGO_USERNAME,
			pass: process.env.MONGO_PASSWORD,
			keepAlive: true
		});
	},
};
module.exports = dbConnection;
