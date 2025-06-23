// Importa as dependências necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Inicializa o aplicativo Express
const app = express();

// ===================================================
// 1. CONFIGURAÇÃO GLOBAL DO CORS
// ===================================================
// Permite requisições de qualquer origem.
app.use(cors());

// ===================================================

// Pega as variáveis de ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const URL_FORMULARIO_GOOGLE = process.env.URL_FORMULARIO_GOOGLE;
const SERVER_DOMAIN = process.env.SERVER_DOMAIN;
const PORT = process.env.PORT || 82;

const ASAAS_CHECKOUT_API_URL = 'https://sandbox.asaas.com/api/v3/checkouts';

// ===================================================
// ROTA 1: CRIAR O CHECKOUT PARA O CLIENTE PAGAR
// ===================================================
// 2. APLICANDO O PARSER DE JSON DIRETAMENTE NESTA ROTA
app.post('/criar-checkout', express.json(), async (req, res) => {
  console.log('Recebida requisição para /criar-checkout');

  if (!ASAAS_API_KEY || !URL_FORMULARIO_GOOGLE || !SERVER_DOMAIN) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas corretamente no servidor.' });
  }

  const payload = {
    chargeTypes: ["DETACHED"],
    // Vamos tentar com PIX e Boleto juntos. Se der erro, volte para ["PIX"].
    billingTypes: ["PIX"], 
    minutesToExpire: 120,
    callback: {
      successUrl: URL_FORMULARIO_GOOGLE,
      autoRedirect: true,
      notificationUrl: `${SERVER_DOMAIN}/webhook-asaas`,
      cancelUrl: SERVER_DOMAIN
    },
    items: [
      {
        name: "Diagnóstico de Almoxarifado",
        description: "Relatório de maturidade com IA",
        quantity: 1,
        value: 67.90
      }
    ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    'User-Agent': 'API_Relatorio_Almoxarifado_NodeJS'
  };

  try {
    const asaasResponse = await axios.post(ASAAS_CHECKOUT_API_URL, payload, { headers });
    console.log('Sessão de Checkout criada com sucesso:', asaasResponse.data);
    res.status(200).json({
      success: true,
      checkoutUrl: asaasResponse.data.url
    });
  } catch (error) {
    console.error('Erro ao criar o Checkout no Asaas:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar a sessão de checkout.',
      details: error.response ? error.response.data : error.message
    });
  }
});

// ===================================================
// ROTA 2: WEBHOOK PARA RECEBER NOTIFICAÇÕES DO ASAAS
// ===================================================
// 3. APLICANDO O PARSER DE CORPO BRUTO (RAW) DIRETAMENTE NESTA ROTA
app.post('/webhook-asaas', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const notification = JSON.parse(req.body.toString());
    console.log('====== NOTIFICAÇÃO DO ASAAS RECEBIDA ======');
    console.log('Evento:', notification.event);
    console.log('ID do Pagamento:', notification.payment.id);
    console.log('Status:', notification.payment.status);
    console.log('=========================================');

    if (notification.event === 'PAYMENT_CONFIRMED' || notification.event === 'PAYMENT_RECEIVED') {
      console.log(`✅ Pagamento ${notification.payment.id} confirmado!`);
    }
    res.status(200).send('Notificação recebida com sucesso.');
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    res.status(200).send('Erro no processamento, mas notificação recebida.');
  }
});

// Endpoint de "saúde"
app.get('/', (req, res) => {
  res.send('API Gateway Asaas v3 (CORS Habilitado / Estrutura Refatorada) está no ar!');
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});