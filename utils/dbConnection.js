const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const dbConnection = {
	getMongooseAdapter() {
		return new MongooseAdapter(`mongodb://${process.env.MONGO_URL}:27017/blokariawallet`, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
		});
	},
};
module.exports = dbConnection;
