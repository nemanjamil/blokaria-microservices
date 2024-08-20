const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;

const AchievementUID = {
	Beginner: "beginner-1",
	Elementary: "elementary-5",
	MidLevel: "mid-level-10",
	Advanced: "advanced-15",
	Intermediate: "intermediate-20",
	Proficient: "proficient-30",
	CarbonNeutral: "carbon-neutral-40",
};

const achievementSchema = new mongoose.Schema(
	{
		uid: { type: String, required: true }, // AchievementUID
		name: { type: String, required: true },
		description: { type: String, required: true }, // FIXME: markup or html
		user: {
			type: ObjectId,
			ref: "User",
			required: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Achievement", achievementSchema);

module.exports.AchievementUID = AchievementUID;
