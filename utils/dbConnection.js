const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const dbConnection = {
	getMongooseAdapter() {
		return new MongooseAdapter("mongodb://localhost/blokariawallet", {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			useCreateIndex: true,
		});
	},
};

module.exports = dbConnection;
