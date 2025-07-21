const postTemplate = require("../public/templates/en/achievementPost.json");
const axios = require("axios");
const { MoleculerClientError } = require("moleculer").Errors;

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from LinkedIn
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
	const params = new URLSearchParams();
	params.append("grant_type", "authorization_code");
	params.append("code", code);
	params.append("client_id", LINKEDIN_CLIENT_ID);
	params.append("client_secret", LINKEDIN_CLIENT_SECRET);
	params.append("redirect_uri", LINKEDIN_REDIRECT_URI);

	try {
		const response = await axios.post(url, params, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			}
		});
		return response.data;
	} catch (error) {
		throw new MoleculerClientError(
			error.response?.data?.error_description || "Failed to exchange code for token",
			error.response?.status || 400,
			"LINKEDIN_TOKEN_EXCHANGE_FAILED",
			{ details: error.response?.data }
		);
	}
};

/**
 * Get user profile information
 * @param {string} accessToken - LinkedIn access token
 */
const linkedInGetUserProfile = async (accessToken, logger) => {
	const apiUrl = "https://api.linkedin.com/v2/userinfo";

	try {
		logger.info("1. linkedInGetUserProfile apiUrl:", apiUrl);
		logger.info("2. linkedInGetUserProfile sending access token:", accessToken);

		const response = await axios.get(apiUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"X-Restli-Protocol-Version": "2.0.0",
				"LinkedIn-Version": "202401" // Updated to latest version
			}
		});

		logger.info("3. linkedInGetUserProfile response:", response.data);

		// LinkedIn returns a `sub` field which is the user's ID
		const userId = response.data.sub;
		logger.info("5. linkedInGetUserProfile User ID:", userId);

		return response.data;
	} catch (error) {
		logger.error("Error retrieving user ID:", error.response);
		throw new MoleculerClientError(error.message, 404, "LIN_GET_USER_PROFILE", {
			message: error.message,
			internalErrorCode: "LIN_GET_USER_PROFILE"
		});
	}
};

/**
 * Download file as stream
 * @param {string} fileUrl - URL of the file to download
 */
const downloadFileAsStream = async (fileUrl, logger) => {
	logger.info("1. downloadFileAsStream START");
	logger.info("2. downloadFileAsStream fileUrl", fileUrl);
	try {
		const response = await axios({
			method: "get",
			url: fileUrl,
			responseType: "stream"
		});

		logger.info("3. downloadFileAsStream --- DONE ---");

		return response.data;
	} catch (error) {
		logger.error("5. downloadFileAsStream Error downloading the file:", error);
		throw new MoleculerClientError("Failed to downloadFileAsStream", 404, "GET_FILE_AS_A_STREAM", {
			message: "Failed to get image downloadFileAsStream",
			internalErrorCode: "GET_FILE_AS_A_STREAM"
		});
	}
};

/**
 * Register and upload image to LinkedIn
 * @param {string} userId - LinkedIn user ID
 * @param {string} imageUrl - URL of the image to upload
 * @param {string} accessToken - LinkedIn access token
 */
const uploadLinkedInImage = async (userId, imageUrl, accessToken, logger) => {
	logger.info("1. uploadLinkedInImage START");
	logger.info("2. uploadLinkedInImage userId", userId);
	logger.info("3. uploadLinkedInImage imageUrl", imageUrl);
	logger.info("4. uploadLinkedInImage accessToken", accessToken);

	const registerUploadUrl = "https://api.linkedin.com/rest/assets?action=registerUpload";

	try {
		logger.info("5. uploadLinkedInImage Registering upload...");
		const registerResponse = await axios.post(
			registerUploadUrl,
			{
				registerUploadRequest: {
					owner: `urn:li:person:${userId}`,
					recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
					serviceRelationships: [
						{
							relationshipType: "OWNER",
							identifier: "urn:li:userGeneratedContent"
						}
					],
					supportedUploadMechanism: ["SYNCHRONOUS_UPLOAD"]
				}
			},
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"LinkedIn-Version": "202401", // Updated to latest version
					"X-Restli-Protocol-Version": "2.0.0"
				}
			}
		);

		if (!registerResponse.data?.value?.uploadMechanism?.com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest?.uploadUrl) {
			throw new Error("Invalid response from LinkedIn image registration");
		}

		const uploadUrl = registerResponse.data.value.uploadMechanism.com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest.uploadUrl;
		const asset = registerResponse.data.value.asset;

		logger.info("6. uploadLinkedInImage fileStream");
		logger.info("7. uploadLinkedInImage uploadUrl", uploadUrl);

		const fileStream = await downloadFileAsStream(imageUrl, logger);

		logger.info("8. uploadLinkedInImage Uploading file...");
		const uploadResponse = await axios.put(uploadUrl, fileStream, {
			headers: {
				"Content-Type": "application/octet-stream"
			}
		});

		if (uploadResponse.status !== 201 && uploadResponse.status !== 200) {
			throw new MoleculerClientError("Failed to upload image file stream", 404, "UPLOAD_LINKEDIN_IMAGE", {
				message: "Failed to upload image file stream",
				internalErrorCode: "UPLOAD_LINKEDIN_IMAGE_13"
			});
		}

		logger.info("9. uploadLinkedInImage Upload successful");
		logger.info("10. uploadLinkedInImage asset URN:", asset);

		return {
			urn: asset,
			uploadUrl: uploadUrl
		};
	} catch (err) {
		logger.error("16. uploadLinkedInImage Error while uploading image to linkedin:", err.message || err);
		throw new MoleculerClientError(err.message, 404, "UPLOAD_LINKEDIN_IMAGE", {
			message: err.message,
			internalErrorCode: "UPLOAD_LINKEDIN_IMAGE_11"
		});
	}
};

/**
 * Create a LinkedIn post with the correct structure
 * @param {string} userId - LinkedIn user ID
 * @param {string} accessToken - LinkedIn access token
 * @param {object} achievement - Achievement data
 * @param {string} achievementUrl - URL to the achievement
 * @param {string} imageUrl - URL of the image to include in the post
 */
const createLinkedInPost = async (userId, accessToken, achievement, achievementUrl, imageUrl, logger) => {
	const LINKEDIN_API_URL = "https://api.linkedin.com/rest/posts";

	logger.info("1. createLinkedInPost START");
	logger.info("2. createLinkedInPost imageUrl", imageUrl);

	try {
		const { urn } = await uploadLinkedInImage(userId, imageUrl, accessToken, logger);
		logger.info("4. createLinkedInPost urn", urn);

		const { subject, body, body1, body2, tags } = postTemplate;
		const postContent = `${body}\n\n${body1.replace("{{achievement}}", achievement.name)}\n\n${body2.replace(
			"{{achievementUrl}}",
			achievementUrl
		)}\n\n${tags}`;

		const postData = {
			author: `urn:li:person:${userId}`,
			lifecycleState: "PUBLISHED",
			specificContent: {
				"com.linkedin.ugc.ShareContent": {
					shareCommentary: {
						text: postContent,
						attributes: []
					},
					shareMediaCategory: "ARTICLE",
					media: [
						{
							status: "READY",
							description: {
								text: subject
							},
							media: urn,
							title: {
								text: achievement.name
							}
						}
					]
				}
			},
			visibility: {
				"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
			}
		};

		logger.info("6. createLinkedInPost Post Data:", JSON.stringify(postData, null, 2));

		const response = await axios.post(LINKEDIN_API_URL, postData, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				"LinkedIn-Version": "202401", // Updated to latest version
				"X-Restli-Protocol-Version": "2.0.0"
			}
		});

		logger.info("8. createLinkedInPost Post created successfully ---- DONE ----:");
		return response.data;
	} catch (error) {
		logger.error("12. createLinkedInPost ERROR", error.message);
		throw new MoleculerClientError(error.message, 404, error.internalErrorCode, {
			message: error.message
		});
	}
};

module.exports = {
	createLinkedInPost,
	linkedInExchangeCode,
	linkedInGetUserProfile
};
