const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema({
	country: String,
	countryCode: String,
	address: String,
	longitude: Number,
	latitude: Number,
	areaPoints: [{                            
		lat: Number,                   
		lng: Number                        
	  }],
	name: String,
});

module.exports = mongoose.model("Area", areaSchema);
