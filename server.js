// Importa as dependências necessárias
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Para carregar variáveis de .env em desenvolvimento

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
const SERVER_DOMAIN = process.env.SERVER_DOMAIN; // Deve ser o domínio do seu backend, ex: https://geral-inamal-gateway.r954jc.easypanel.host
const PORT = process.env.PORT || 82;

const ASAAS_CHECKOUT_API_URL = 'https://api.asaas.com/v3/checkouts';
// ===================================================
// ROTA 1: CRIAR O CHECKOUT PARA O CLIENTE PAGAR
// ===================================================
// Aplicando o parser de JSON diretamente nesta rota
app.post('/criar-checkout', express.json(), async (req, res) => {
  console.log('Recebida requisição para /criar-checkout');

  // Verifica se as variáveis de ambiente essenciais estão configuradas
  if (!ASAAS_API_KEY || !URL_FORMULARIO_GOOGLE || !SERVER_DOMAIN) {
    console.error('ERRO: Variáveis de ambiente não configuradas corretamente no servidor.');
    console.error(`ASAAS_API_KEY: ${ASAAS_API_KEY ? 'Definida' : 'NÃO DEFINIDA'}`);
    console.error(`URL_FORMULARIO_GOOGLE: ${URL_FORMULARIO_GOOGLE ? 'Definida' : 'NÃO DEFINIDA'}`);
    console.error(`SERVER_DOMAIN: ${SERVER_DOMAIN ? 'Definida' : 'NÃO DEFINIDA'}`);
    return res.status(500).json({
      success: false,
      message: 'Erro de configuração interna do servidor. Variáveis de ambiente ausentes.'
    });
  }

  const payload = {
    chargeTypes: ["DETACHED"],
    billingTypes: ["PIX", "CREDIT_CARD"],
    minutesToExpire: 120,
    callback: {
      successUrl: URL_FORMULARIO_GOOGLE,
      autoRedirect: true,
      notificationUrl: `${SERVER_DOMAIN}/webhook-asaas`,
      cancelUrl: SERVER_DOMAIN // Ou uma URL específica de cancelamento no seu frontend
    },
    items: [
      {
        name: "Diagnóstico de Almoxarifado",
        description: "Relatório de maturidade com IA",
        quantity: 1,
        value: 67.90 // Asaas espera valor em reais, não centavos aqui para checkouts.
      }
    ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    'User-Agent': 'API_Relatorio_Almoxarifado_NodeJS' // Bom para identificação nos logs do Asaas
  };

  try {
    console.log('Enviando requisição para o Asaas com o payload:', JSON.stringify(payload, null, 2));
    const asaasResponse = await axios.post(ASAAS_CHECKOUT_API_URL, payload, { headers });
    console.log('Sessão de Checkout criada com sucesso no Asaas:', asaasResponse.data);

    // A resposta do Asaas para criação de checkout usa 'link'
    if (asaasResponse.data && asaasResponse.data.link) {
      res.status(200).json({
        success: true,
        checkoutUrl: asaasResponse.data.link
      });
    } else {
      console.error('Resposta do Asaas não contém o campo "link":', asaasResponse.data);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar a sessão de checkout. Resposta inesperada do provedor de pagamento.'
      });
    }

  } catch (error) {
    console.error('====== ERRO AO CRIAR O CHECKOUT NO ASAAS ======');
    if (error.response) {
      // A requisição foi feita e o servidor do Asaas respondeu com um status code
      // que não é da faixa 2xx
      console.error('Status da Resposta Asaas:', error.response.status);
      console.error('Headers da Resposta Asaas:', JSON.stringify(error.response.headers, null, 2));
      console.error('Dados da Resposta Asaas:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // A requisição foi feita mas nenhuma resposta foi recebida
      // `error.request` é uma instância de XMLHttpRequest no browser e uma instância de
      // http.ClientRequest no node.js
      console.error('Requisição Asaas feita, mas sem resposta:', error.request);
    } else {
      // Algo aconteceu na configuração da requisição que acionou um Erro
      console.error('Erro ao configurar requisição para Asaas:', error.message);
    }
    console.error('Configuração do Axios (parcial):', JSON.stringify(error.config, null, 2));
    console.error('Stack Completo do Erro:', error.stack);
    console.error('================================================');

    res.status(500).json({
      success: false,
      message: 'Erro ao criar a sessão de checkout.',
      // Tenta fornecer detalhes do erro do Asaas, se disponíveis
      details: error.response ? error.response.data : (error.message || 'Erro desconhecido ao comunicar com o Asaas.')
    });
  }
});

// ===================================================
// ROTA 2: WEBHOOK PARA RECEBER NOTIFICAÇÕES DO ASAAS
// ===================================================
// Aplicando o parser de corpo bruto (raw) diretamente nesta rota
// É importante usar o parser raw para webhooks, pois o Asaas pode enviar
// assinaturas que dependem do corpo original. No entanto, para JSON simples,
// o parse manual como feito aqui funciona. Se houver verificação de assinatura,
// o corpo bruto (req.body como Buffer) seria necessário.
app.post('/webhook-asaas', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    // req.body é um Buffer aqui, precisamos convertê-lo para string e depois para JSON
    const notification = JSON.parse(req.body.toString());
    console.log('====== NOTIFICAÇÃO DO ASAAS RECEBIDA ======');
    console.log('Headers da Requisição:', req.headers); // Pode ser útil para depurar
    console.log('Corpo Bruto (string):', req.body.toString());
    console.log('Evento:', notification.event);
    console.log('ID do Pagamento (se existir):', notification.payment ? notification.payment.id : 'N/A');
    console.log('Status do Pagamento (se existir):', notification.payment ? notification.payment.status : 'N/A');
    console.log('Dados completos da notificação:', JSON.stringify(notification, null, 2));
    console.log('=========================================');

    // Exemplo de lógica baseada no evento
    if (notification.payment && (notification.event === 'PAYMENT_CONFIRMED' || notification.event === 'PAYMENT_RECEIVED')) {
      console.log(`✅ Pagamento ${notification.payment.id} confirmado/recebido! Status: ${notification.payment.status}`);
      // Aqui você adicionaria a lógica para atualizar seu banco de dados, liberar acesso, etc.
    } else if (notification.payment && notification.event === 'PAYMENT_UPDATED') {
      console.log(`🔄 Pagamento ${notification.payment.id} atualizado! Novo Status: ${notification.payment.status}`);
      // Lógica para atualizações de status
    }
    // Adicione mais 'else if' para outros eventos que você queira tratar

    res.status(200).send('Notificação recebida com sucesso.');
  } catch (error) {
    console.error('Erro ao processar webhook do Asaas:', error.message);
    console.error('Stack do Erro no Webhook:', error.stack);
    console.error('Corpo recebido que causou erro no parse (se aplicável):', req.body.toString());
    // Responde 200 para o Asaas mesmo em caso de erro no processamento,
    // para evitar que o Asaas continue reenviando a notificação indefinidamente.
    // Você deve monitorar seus logs para esses erros.
    res.status(200).send('Erro no processamento interno, mas notificação recebida.');
  }
});

// Endpoint de "saúde" para verificar se a API está no ar
app.get('/', (req, res) => {
  res.send('API Gateway Asaas v3 (CORS Habilitado / Estrutura Refatorada / Logging Aprimorado) está no ar!');
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando requisições em ${SERVER_DOMAIN || `http://localhost:${PORT}`}`);
  if (!ASAAS_API_KEY || !URL_FORMULARIO_GOOGLE || !SERVER_DOMAIN) {
    console.warn('AVISO: Uma ou mais variáveis de ambiente essenciais (ASAAS_API_KEY, URL_FORMULARIO_GOOGLE, SERVER_DOMAIN) não estão definidas. A API pode não funcionar corretamente.');
  }
});