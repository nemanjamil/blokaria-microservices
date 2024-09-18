const mongoose = require("mongoose");

const levelSchema = new mongoose.Schema({
	name: { type: String, required: true },
	required_trees : {type: Number, required: true },
});

module.exports = mongoose.model("Level", levelSchema);
