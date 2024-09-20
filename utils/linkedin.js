const postTemplate = require("../public/templates/en/achievementPost.json");
const axios = require("axios");

/**
 *
 * @param {string} code
 */
const linkedInExchangeCode = async (code) => {
	const LINKEDIN_CLIENT_ID = process.env["LINKEDIN_CLIENT_ID"];
	const LINKEDIN_CLIENT_SECRET = process.env["LINKEDIN_CLIENT_SECRET"];
	const LINKEDIN_REDIRECT_URI = process.env["LINKEDIN_REDIRECT_URI"];

	console.log({
		client_id: LINKEDIN_CLIENT_ID,
		client_secret: LINKEDIN_CLIENT_SECRET,
		redirect_uri: LINKEDIN_REDIRECT_URI,
	});

	const url = "https://www.linkedin.com/oauth/v2/accessToken";
	const body = {
		grant_type: "authorization_code",
		client_id: LINKEDIN_CLIENT_ID,
		client_secret: LINKEDIN_CLIENT_SECRET,
		redirect_uri: LINKEDIN_REDIRECT_URI,
		code,
	};

	const response = await axios.post(url, new URLSearchParams(body));

	return response.data;
};

/**
 *
 * @param {string} accessToken
 */
const linkedInGetUserProfile = async (accessToken) => {
	const apiUrl = "https://api.linkedin.com/v2/userinfo";

	try {
		console.log("linkedin get user profile. sending access token:", accessToken);

		const response = await axios.get(apiUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		console.log("linkedin get user profile response:", response.data);

		// LinkedIn returns a `sub` field which is the user's ID
		const userId = response.data.sub;
		console.log("User ID:", userId);

		return response.data;
	} catch (error) {
		console.error("Error retrieving user ID:", error.response ? error.response.data : error.message);
	}
};

const downloadFileAsStream = async (fileUrl) => {
	try {
		const response = await axios({
			method: "get",
			url: fileUrl,
			responseType: "stream", // Important: This tells axios to return the response as a stream
		});

		return response.data; // This is the stream
	} catch (error) {
		console.error("Error downloading the file:", error);
		throw error;
	}
};

const getLinkedInImage = async (imageUrn) => {
	const linkedGetUrl = `https://api.linkedin.com/rest/images/${imageUrn}`;

	try {
		const imageRes = await axios.get(linkedGetUrl);

		if (!imageRes || !imageRes.data) {
			throw new Error("Failed to get image information from LinkedIn");
		}

		return imageRes.data;
	} catch (err) {
		console.log("Error while getting image information from LinkedIn:", err.message || err);
		throw err;
	}
};

const uploadLinkedInImage = async (userId, imageUrl, accessToken) => {
	const linkedInInitUrl = "https://api.linkedin.com/rest/images?action=initializeUpload";

	try {
		const fileStream = await downloadFileAsStream(imageUrl);

		const initResponse = await axios.post(linkedInInitUrl, {
			initializeUploadRequest: {
				owner: `urn:li:person:${userId}`,
			},
		});

		if (!initResponse || !initResponse.data) {
			throw new Error("Failed to initialize upload for image through LinkedIn");
		}

		const imgUpload = await axios.default.put(initResponse.data.value.uploadUrl, fileStream, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202405",
			},
		});

		if (imgUpload.status !== 201 && imgUpload.status !== 200) {
			throw new Error("Failed to upload image file stream");
		}

		const imgInfo = await getLinkedInImage(initResponse.data.value.image);

		return imgInfo;
	} catch (err) {
		console.log("Error while uploading image to linkedin:", err.message || err);
		throw err;
	}
};

/**
 *
 * @param {string} userId User LinkedIn unique ID
 * @param {string} accessToken Access token LinkedIn APIs
 * @param {import("../models/Achievement")} achievement Achievement
 */
const createLinkedInPost = async (userId, accessToken, achievement, imageUrl) => {
	const LINKEDIN_API_URL = "https://api.linkedin.com/v2/ugcPosts";

	console.log("createLinkedInPost START");

	try {
		const img = await uploadLinkedInImage(userId, imageUrl, accessToken);

		const { subject, body } = postTemplate;

		const postData = {
			author: `urn:li:person:${userId}`,
			lifecycleState: "PUBLISHED",
			specificContent: {
				"com.linkedin.ugc.ShareContent": {
					shareCommentary: {
						text: `${subject}\n\n${body.replace("{{achievement}}", achievement.name)}`,
					},
					// shareMediaCategory: imageAsset !== null ? 'IMAGE' : 'NONE',
					shareMediaCategory: "ARTICLE",
					media: [
						// {
						// 	status: "READY",
						// 	description: {
						// 		text: achievement.description,
						// 	},
						// 	// media: imageAsset,
						// 	originalUrl: imageUrl,
						// 	title: {
						// 		text: achievement.name,
						// 	},
						// },
						{
							altText: achievement.description,
							id: img.id,
						},
					],
				},
			},
			visibility: {
				"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
			},
		};

		console.log("createLinkedInPost Post Data:", JSON.stringify(postData, null, 2));

		const response = await axios.post(LINKEDIN_API_URL, postData, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202405",
			},
		});

		console.log("createLinkedInPost Post created successfully ---- DONE ----:", response.data);

		return response.data;
	} catch (error) {
		if (error.response) {
			console.error("Error response data:", error.response.data);
			console.error("Error response status:", error.response.status);
			console.error("Error response headers:", error.response.headers);
		} else if (error) {
			console.error("Error message:", error.message);
		}
		const errorMessage = error ? error.message : null || "Unexpected error";
		return { status: false, error: errorMessage };
	}
};

module.exports = { createLinkedInPost, linkedInExchangeCode, linkedInGetUserProfile };
