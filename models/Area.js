const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema({
	country: String,
	countryCode: String,
	address: String,
	longitude: Number,
	latitude: Number,
	treePrice: { type: Number, default: null},
	defaultArea: {
		type: Boolean,
		default: false
	},
	active: {
		type: Boolean,
		default: true
	},
	areaPoints: [
		{
			lat: Number,
			lng: Number
		}
	],
	name: String
});

module.exports = mongoose.model("Area", areaSchema);
