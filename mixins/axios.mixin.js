const axiosMain = require("axios").default;


// SET SHARED SOE OPTIONS
const axios = axiosMain.create({
	headers: {
		post: {
			"x-functions-key": "BLA",
			"Content-Type": "application/json",
		},
		get: {
			"x-functions-key": "TRUC",
			"Content-Type": "application/json",
		},
	},
});

module.exports = {
	methods: {
		axiosGet: axios.get,
		axiosPost: axios.post,
		getAxios: function () {
			return axiosMain;
		},
	},
};