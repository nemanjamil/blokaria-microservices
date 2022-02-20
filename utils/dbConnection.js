const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const dbConnection = {
	getMongooseAdapter() {
		return new MongooseAdapter(`${process.env.MONGO_URL}/blokariawallet`, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
		});
	},
};
module.exports = dbConnection;
