import { ConfidentialClientApplication } from '@azure/msal-node';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env.local

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: process.env.OUTLOOK_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}`,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

// Handle authentication for Outlook
export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.action === 'auth') {
    // Generate the auth URL for Outlook OAuth
    try {
      const authUrl = await cca.getAuthCodeUrl({
        scopes: ['Calendars.ReadWrite', 'offline_access'],
        redirectUri: process.env.OUTLOOK_REDIRECT_URI,
      });

      // Redirect user to Microsoft login
      res.redirect(authUrl);
    } catch (error) {
      res.status(500).json({ error: 'Error generating auth URL', details: error });
    }
  } else if (req.method === 'GET' && req.query.code) {
    const { code } = req.query;

    try {
      // Exchange the authorization code for an access token
      const tokenResponse = await cca.acquireTokenByCode({
        code,
        scopes: ['Calendars.ReadWrite'],
        redirectUri: process.env.OUTLOOK_REDIRECT_URI,
      });

      // Store the token for future requests (e.g., in session, database, or cookie)
      res.status(200).json({
        message: 'Outlook authentication successful!',
        token: tokenResponse,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error during token exchange', details: error });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
