const { google } = require('googleapis');
const fs = require('fs');

function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }

  return oauth2;
}

async function uploadToYouTube({ filePath, title, description, tags, privacy }) {
  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: 'v3', auth });

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags: tags || [],
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: privacy || 'private',
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: fs.createReadStream(filePath)
    }
  });

  return {
    videoId: response.data.id,
    title: response.data.snippet.title,
    privacy: response.data.status.privacyStatus
  };
}

function getAuthUrl() {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.upload']
  });
}

async function getTokensFromCode(code) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

module.exports = { uploadToYouTube, getAuthUrl, getTokensFromCode };