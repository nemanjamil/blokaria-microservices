const bcrypt = require("bcrypt");

const utils = {
	salt(password) {
		let toHash = password;
		let salt = bcrypt.genSaltSync(10);
		let hash = bcrypt.hashSync(toHash, salt);
		return hash;
	},
	async compare(password, hash) {
		return await bcrypt.compare(password, hash);
	},
	generatePass() {
		let length = 12,
			charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", // +-*/%.
			retVal = "";
		for (let i = 0, n = charset.length; i < length; ++i) {
			retVal += charset.charAt(Math.floor(Math.random() * n));
		}
		return retVal;
	},
	validateEmail(email) {
		const re =
			/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return re.test(email);
	},
};

module.exports = utils;
