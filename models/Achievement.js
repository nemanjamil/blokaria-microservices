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

/**
 *
 * @param {string} currentLevelUID
 * @returns {string | null} the next level uid if exists and null otherwise
 */
const getNextLevelUID = (currentLevelUID) => {
	const sortedLevels = Object.values(AchievementUID)
		.map((uid) => ({ level: Number(uid.split("-").pop()), uid }))
		.sort((a, b) => a.level - b.level);
	const currentIndex = sortedLevels.findIndex(({ uid }) => currentLevelUID === uid);
	if (currentIndex === -1 || currentIndex + 1 >= sortedLevels.length) return null;
	return sortedLevels[currentIndex + 1].uid;
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
module.exports.getNextLevelUID = getNextLevelUID;
