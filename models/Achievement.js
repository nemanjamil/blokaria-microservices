const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;


// TODO: Description needs to support markup or html
const achievementSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String, required: true },
		image: { type: Object },
		_level: {
			type: ObjectId,
			ref: "Level"
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Achievement", achievementSchema);
