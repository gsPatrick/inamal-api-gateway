// Importa as dependências necessárias
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Carrega as variáveis do arquivo .env
const cors = require('cors'); // <-- 1. IMPORTA O PACOTE CORS

// Inicializa o aplicativo Express
const app = express();
// IMPORTANTE: Para o webhook do Asaas funcionar, precisamos do 'raw body'
// Por isso, a configuração do express.json é feita de forma condicional.

const corsOptions = {
  origin: '*' // PERMITE QUALQUER ORIGEM (bom para desenvolvimento e testes iniciais)
  // Para produção, use: origin: 'https://seu-site-react.com' 
};

app.use(cors(corsOptions)); // <-- 2. APLICA O MIDDLEWARE DO CORS

app.use((req, res, next) => {
  if (req.originalUrl === '/webhook-asaas') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Pega as variáveis de ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const URL_FORMULARIO_GOOGLE = process.env.URL_FORMULARIO_GOOGLE;
const SERVER_DOMAIN = process.env.SERVER_DOMAIN;
const PORT = process.env.PORT || 82;

// URL da API Sandbox do Asaas para o NOVO CHECKOUT
const ASAAS_CHECKOUT_API_URL = 'https://sandbox.asaas.com/api/v3/checkouts';

// ===================================================
// ROTA 1: CRIAR O CHECKOUT PARA O CLIENTE PAGAR
// ===================================================
app.post('/criar-checkout', async (req, res) => {
  console.log('Recebida requisição para /criar-checkout');

  if (!ASAAS_API_KEY || !URL_FORMULARIO_GOOGLE || !SERVER_DOMAIN) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas corretamente no servidor.' });
  }

  // Corpo da requisição para o Asaas Checkout (COM AS CORREÇÕES)
  const payload = {
    chargeTypes: ["DETACHED"],
    billingTypes: ["PIX"], // Mantendo apenas PIX por enquanto para o teste
    minutesToExpire: 120,
    callback: {
      successUrl: URL_FORMULARIO_GOOGLE,
      autoRedirect: true,
      notificationUrl: `${SERVER_DOMAIN}/webhook-asaas`,
      
      // CORREÇÃO: Adicionando a URL de cancelamento obrigatória
      // Podemos redirecionar para o seu domínio principal ou uma página específica
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

  // Headers da requisição
  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    'User-Agent': 'API_Relatorio_Almoxarifado_NodeJS'
  };

  try {
    const asaasResponse = await axios.post(ASAAS_CHECKOUT_API_URL, payload, { headers });

    console.log('Sessão de Checkout criada com sucesso:', asaasResponse.data);

    // Retorna a URL de pagamento para o cliente
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
app.post('/webhook-asaas', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // O Asaas envia os dados no corpo da requisição
    const notification = JSON.parse(req.body.toString());
    console.log('====== NOTIFICAÇÃO DO ASAAS RECEBIDA ======');
    console.log('Evento:', notification.event);
    console.log('ID do Pagamento:', notification.payment.id);
    console.log('Status:', notification.payment.status);
    console.log('=========================================');

    // AQUI VOCÊ COLOCA A LÓGICA PARA FAZER ALGO COM A NOTIFICAÇÃO
    if (notification.event === 'PAYMENT_CONFIRMED' || notification.event === 'PAYMENT_RECEIVED') {
      console.log(`✅ Pagamento ${notification.payment.id} confirmado!`);
      // Exemplo:
      // 1. Pegar o email do cliente: notification.payment.customer.email
      // 2. Marcar no seu banco de dados que o cliente pagou.
      // 3. Enviar um e-mail de confirmação com o link do formulário (se não usar o redirecionamento automático).
    }

    // Responda ao Asaas com status 200 OK para confirmar o recebimento.
    res.status(200).send('Notificação recebida com sucesso.');

  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error);
    // Mesmo em caso de erro, responda 200 para o Asaas não ficar reenviando.
    res.status(200).send('Erro no processamento, mas notificação recebida.');
  }
});


// Endpoint de "saúde" para verificar se a API está no ar
app.get('/', (req, res) => {
  res.send('API Gateway Asaas v2 (com Webhook) está no ar!');
});

// Inicia o servidor na porta especificada
app.listen(PORT, () => {
  console.log(`Servidor rodou na porta ${PORT}`);
});