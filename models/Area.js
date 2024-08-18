const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema({
	country: String,
	countryCode: String,
	address: String,
	longitude: Number,
	latitude: Number,
	// points: Array<{ lon, lat, name, id }>
	// radius: Number, //
	name: String,
});

module.exports = mongoose.model("Area", areaSchema);
