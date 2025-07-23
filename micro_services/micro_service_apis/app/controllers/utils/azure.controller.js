const axios = require('axios');
const qs = require('qs');
require('dotenv').config();
const db = require("../../../../../models");
const User = db.user;

const {
  AZURE_CLIENT_ID,
  AZURE_TENANT_ID,
  AZURE_USERNAME,
  AZURE_PASSWORD
} = process.env;

const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

exports.getAccessTokenWithPassword = async (req, res) => {
  try {
    // 1. Buscar usuário pelo ID recebido na URL
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // 2. Solicitar Access Token com username/senha
    const tokenResponse = await axios.post(
      TOKEN_URL,
      qs.stringify({
        client_id: AZURE_CLIENT_ID,
        username: AZURE_USERNAME,
        password: AZURE_PASSWORD,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        grant_type: 'password',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // 3. Verificar se existe JSON com múltiplos relatórios
    if (user.reports_json && user.reports_json !== 'null' && user.reports_json !== '') {
      return res.json({
        token: access_token,
        expiresIn: expires_in,
        is_report_json: true,
        reports_json: user.reports_json,
      });
    }

    // Caso não exista JSON
    return res.json({
      token: access_token,
      expiresIn: expires_in,
      is_report_json: false,
      reportIdBI: user.reportIdBI,
      groupIdBI: user.groupIdBI,
      filtersBI: user.filtersBI,
    });

  } catch (error) {
    console.error('❌ Erro ao gerar token com usuário e senha:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Erro ao gerar token',
      details: error.response?.data || error.message
    });
  }
};
