const axios = require('axios');
const qs = require('qs');

const {
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_TENANT_ID,
  POWERBI_GROUP_ID,
  POWERBI_REPORT_ID
} = process.env;

const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
const GENERATE_TOKEN_URL = `https://api.powerbi.com/v1.0/myorg/groups/${POWERBI_GROUP_ID}/reports/${POWERBI_REPORT_ID}/GenerateToken`;

exports.getEmbedToken = async (req, res) => {
  try {
    // Etapa 1 - Pega Access Token
    const tokenResponse = await axios.post(
      TOKEN_URL,
      qs.stringify({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        grant_type: 'client_credentials',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Etapa 2 - Gera Embed Token
    const embedResponse = await axios.post(
      GENERATE_TOKEN_URL,
      { accessLevel: 'View' },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { token, expiration } = embedResponse.data;

    return res.json({ embedToken: token, expiration });
  } catch (error) {
    console.error('❌ Erro ao gerar Embed Token:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao gerar Embed Token' });
  }
};
