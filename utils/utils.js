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
	
	cipher(salt){
		const textToChars = text => text.split('').map(c => c.charCodeAt(0));
		const byteHex = n => ("0" + Number(n).toString(16)).substr(-2);
		const applySaltToChar = code => textToChars(salt).reduce((a,b) => a ^ b, code);
	
		return text => text.split('')
		.map(textToChars)
		.map(applySaltToChar)
		.map(byteHex)
		.join('');
	},
		
	decipher(salt) {
		const textToChars = text => text.split('').map(c => c.charCodeAt(0));
		const applySaltToChar = code => textToChars(salt).reduce((a,b) => a ^ b, code);
		return encoded => encoded.match(/.{1,2}/g)
		.map(hex => parseInt(hex, 16))
		.map(applySaltToChar)
		.map(charCode => String.fromCharCode(charCode))
		.join('');
	},

	maskEmail(email){
		if (!email) return "anonymous";
		const [username, domain] = email.split('@');
		const maskedUsername = username.charAt(0) + '*****';
		return `${maskedUsername}@${domain}`;
	},
	
	maskFullName(fullName){
		if (!fullName) return "anonymous";
		const parts = fullName.split(' ');
		const maskedName = parts.map(part => part.charAt(0) + '*****').join(' ');
		return maskedName;
	}
	
};

module.exports = utils;
