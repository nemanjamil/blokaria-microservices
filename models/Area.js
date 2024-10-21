const mongoose = require("mongoose");

const treeSpeciesEnum = ['Oak', 'Maple', 'Pine', 'Birch', 'Willow']; 
const monthsEnum = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

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
	plantingTimeline: {
		type: [String],
		enum: monthsEnum,
	},
	treeSpecies: {
		type: [String],
		enum: treeSpeciesEnum,
	},
	plantingOrganization: {
		type: String,
	},
	availablePlantingSpots: {
		type: Number,
		min: 0,
	},
name: String
});

module.exports = mongoose.model("Area", areaSchema);
