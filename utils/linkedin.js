const postTemplate = require("../public/templates/en/achievementPost.json");
const axios = require("axios");
const { MoleculerClientError } = require("moleculer").Errors;
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
		redirect_uri: LINKEDIN_REDIRECT_URI
	});

	const url = "https://www.linkedin.com/oauth/v2/accessToken";
	const body = {
		grant_type: "authorization_code",
		client_id: LINKEDIN_CLIENT_ID,
		client_secret: LINKEDIN_CLIENT_SECRET,
		redirect_uri: LINKEDIN_REDIRECT_URI,
		code
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
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202405"
			}
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
	console.log("1. downloadFileAsStream START");
	try {
		const response = await axios({
			method: "get",
			url: fileUrl,
			responseType: "stream" // Important: This tells axios to return the response as a stream
		});

		console.log("2. downloadFileAsStream --- DONE ---");

		return response.data; // This is the stream
	} catch (error) {
		console.error("Error downloading the file:", error);
		throw error;
	}
};

const getLinkedInImage = async (imageUrn, accessToken) => {
	console.log("1. getLinkedInImage START");

	const linkedGetUrl = `https://api.linkedin.com/rest/images/${imageUrn}`;

	console.log("1. getLinkedInImage linkedGetUrl", linkedGetUrl);
	console.log("1. getLinkedInImage accessToken", accessToken);

	try {
		const imageRes = await axios.get(linkedGetUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"LinkedIn-Version": "202405"
			}
		});

		console.log("3. getLinkedInImage imageRes.data", imageRes.data);

		if (!imageRes || !imageRes.data) {
			throw new MoleculerClientError("Failed to get image information from LinkedIn", 404, "GET_LINKEDIN_IMAGE", {
				message: "Failed to get image information from LinkedIn",
				internalErrorCode: "GET_LINKEDIN_IMAGE"
			});
		}

		console.log("3. getLinkedInImage ---- DONE ----");

		return imageRes.data;
	} catch (err) {
		throw new MoleculerClientError(err.message, 404, "GET_LINKEDIN_IMAGE", {
			message: "Error while getting image information from LinkedIn:",
			internalErrorCode: "GET_LINKEDIN_IMAGE"
		});
	}
};

const uploadLinkedInImage = async (userId, imageUrl, accessToken) => {
	console.log("1. uploadLinkedInImage START");

	const linkedInInitUrl = "https://api.linkedin.com/rest/images?action=initializeUpload";

	try {
		const fileStream = await downloadFileAsStream(imageUrl);

		console.log("2. uploadLinkedInImage fileStream");

		const initResponse = await axios.post(
			linkedInInitUrl,
			{
				initializeUploadRequest: {
					owner: `urn:li:person:${userId}`
				}
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"X-Restli-Protocol-Version": "2.0.0",
					"LinkedIn-Version": "202405"
				}
			}
		);

		if (!initResponse || !initResponse.data) {
			throw new Error("Failed to initialize upload for image through LinkedIn");
		}

		console.log("3. uploadLinkedInImage initResponse", initResponse.data.value);

		const imgUpload = await axios.default.put(initResponse.data.value.uploadUrl, fileStream, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				//"Content-Type": "application/json",
				"Content-Type": "application/octet-stream",
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202405"
			}
		});

		console.log("4. uploadLinkedInImage imgUpload");

		if (imgUpload.status !== 201 && imgUpload.status !== 200) {
			//throw new Error("Failed to upload image file stream");
			throw new MoleculerClientError("Failed to upload image file stream", 404, "UPLOAD_LINKEDIN_IMAGE", {
				message: "Failed to upload image file stream",
				internalErrorCode: "UPLOAD_LINKEDIN_IMAGE_13"
			});
		}

		console.log("5. getLinkedInImage initResponse.data.value.image", initResponse.data.value.image);

		const imgInfo = await getLinkedInImage(initResponse.data.value.image, accessToken);

		console.log("6. uploadLinkedInImage ----- DONE -----");

		return imgInfo;
	} catch (err) {
		console.log("10. uploadLinkedInImage Error while uploading image to linkedin:", err.message || err);
		throw new MoleculerClientError(err.message, 404, "UPLOAD_LINKEDIN_IMAGE", {
			message: err.message,
			internalErrorCode: "UPLOAD_LINKEDIN_IMAGE_11"
		});
	}
};

/**
 *
 * @param {string} userId User LinkedIn unique ID
 * @param {string} accessToken Access token LinkedIn APIs
 * @param {import("../models/Achievement")} achievement Achievement
 */
const createLinkedInPost = async (userId, accessToken, achievement, imageUrl) => {
	const LINKEDIN_API_URL = "https://api.linkedin.com/rest/posts";

	console.log("1. createLinkedInPost START");

	try {
		const img = await uploadLinkedInImage(userId, imageUrl, accessToken);

		console.log("2. createLinkedInPost img");

		const { subject, body, body1, tags } = postTemplate;

		const postContent = `${body}\n\n${body1.replace("{{achievement}}", achievement.name)}\n\n${tags}`;

		const postData = {
			author: `urn:li:person:${userId}`,
			commentary: `${subject}\n\n${postContent}`,
			visibility: "PUBLIC",

			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: []
			},
			content: {
				media: {
					title: achievement.name,
					id: img.id
				}
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false
		};

		console.log("3. createLinkedInPost Post Data:", JSON.stringify(postData, null, 2));

		const response = await axios.post(LINKEDIN_API_URL, postData, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202405"
			}
		});

		console.log("4. createLinkedInPost Post created successfully ---- DONE ----:");

		return response.data;
	} catch (error) {
		if (error.response) {
			console.error("Error response data:");
			//console.error("Error response data:", error.response.data);
			//console.error("Error response status:", error.response.status);
			//console.error("Error response headers:", error.response.headers);
		} else if (error) {
			console.error("Error message:", error.message);
		}
		const errorMessage = error ? error.message : null || "Unexpected error";
		return { status: false, error: errorMessage };
	}
};

module.exports = { createLinkedInPost, linkedInExchangeCode, linkedInGetUserProfile };
