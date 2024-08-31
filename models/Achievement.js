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

const PlantRequirements = {
	Beginner: 1,
	Elementary: 5,
	MidLevel: 10,
	Advanced: 15,
	Intermediate: 20,
	Proficient: 30,
	CarbonNeutral: 40,
};

const hasEnoughPlantsForNextLevel = (currentLevel, plantedTrees) => {
	const levels = Object.keys(PlantRequirements);

	if ((currentLevel=== null || currentLevel === undefined)) return plantedTrees >= PlantRequirements.Beginner;

	const currentIndex = levels.indexOf(currentLevel);
	if (currentIndex === levels.length - 1) {
		return false;
	}
	const nextLevel = levels[currentIndex + 1];
	return plantedTrees >= PlantRequirements[nextLevel];
};

const getNextLevel = (currentLevel, plantedTrees) => {
	const levels = Object.keys(AchievementUID);
	if ((currentLevel=== null || currentLevel === undefined) && hasEnoughPlantsForNextLevel(currentLevel, plantedTrees)) return levels[0];

	const currentIndex = levels.indexOf(currentLevel);

	if (currentIndex === levels.length - 1) {
		return "Completed";
	}

	if (hasEnoughPlantsForNextLevel(currentLevel, plantedTrees)) {
		return levels[currentIndex + 1];
	} else {
		return currentLevel;
	}
};



const achievementSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		description: { type: String, required: true }, // FIXME: markup or html
		completed: { type: Boolean, default: false },
		required_trees : { type: Number, required: true },
		is_email_send: { type: Boolean, default: false },
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
module.exports.getNextLevel = getNextLevel;
