// Importa as dependências necessárias
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Carrega as variáveis do arquivo .env

// Inicializa o aplicativo Express
const app = express();
app.use(express.json()); // Permite que o servidor entenda JSON

// Pega as variáveis de ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const URL_FORMULARIO_GOOGLE = process.env.URL_FORMULARIO_GOOGLE;
const PORT = process.env.PORT || 3000;

// NOVO ENDPOINT da API Sandbox do Asaas para Checkouts
const ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3/checkouts';

// Endpoint principal para criar o checkout
app.post('/criar-checkout', async (req, res) => {
  console.log('Recebida requisição para /criar-checkout com o novo payload.');

  if (!ASAAS_API_KEY || !URL_FORMULARIO_GOOGLE) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas no servidor.' });
  }

  // NOVO PAYLOAD - Estruturado para permitir apenas PIX e BOLETO
  const payload = {
    billingTypes: ["PIX", "BOLETO"], // <-- AQUI ESTÁ A MÁGICA: Apenas os meios de pagamento que você quer
    chargeType: "DETACHED",
    minutesToExpire: 1440, // 24 horas para o link expirar (bom para boleto)
    callback: {
      successUrl: URL_FORMULARIO_GOOGLE, // Redireciona para o forms após o pagamento
      // Opcional: você pode adicionar URLs para cancelamento ou expiração
      // cancelUrl: "https://seusite.com/cancelado",
      // expiredUrl: "https://seusite.com/expirado"
    },
    items: [
      {
        name: "Diagnóstico de Maturidade de Almoxarifado (Teste)",
        description: "Acesso ao formulário para geração de relatório personalizado com IA.",
        quantity: 1,
        value: 1.00 // Preço de teste para o sandbox
      }
    ]
  };

  // Headers da requisição (permanecem os mesmos)
  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    'User-Agent': 'API_Relatorio_Almoxarifado_NodeJS'
  };

  try {
    // Faz a chamada para a API do Asaas usando Axios
    const asaasResponse = await axios.post(ASAAS_API_URL, payload, { headers });

    console.log('Resposta do Asaas (Checkout) recebida com sucesso:', asaasResponse.data);

    // O Asaas retorna um ID. Montamos a URL de checkout com ele.
    const checkoutUrl = `https://sandbox.asaas.com/c/${asaasResponse.data.id}`;
    
    // Retorna a URL de pagamento para o cliente
    res.status(200).json({
      success: true,
      checkoutUrl: checkoutUrl
    });

  } catch (error) {
    console.error('Erro ao chamar a API de Checkouts do Asaas:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar o checkout.',
      details: error.response ? error.response.data : error.message
    });
  }
});

// Endpoint de "saúde" para verificar se a API está no ar
app.get('/', (req, res) => {
  res.send('API Gateway Asaas (v2 - Checkout) está no ar!');
});

// Inicia o servidor na porta especificada
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Pressione CTRL+C para parar o servidor.');
});