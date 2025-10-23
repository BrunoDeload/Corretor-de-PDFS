// netlify/functions/gemini.js
const { GoogleGenAI } = require("@google/genai");

exports.handler = async function (event) {
  // Garante que apenas requisições POST sejam aceitas
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Método não permitido.' }) 
    };
  }

  try {
    const { text: menuText } = JSON.parse(event.body);

    if (!menuText || typeof menuText !== 'string' || menuText.trim() === '') {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Nenhum texto válido foi fornecido para análise.' }) 
      };
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Chave da API não configurada no servidor. Configure a variável de ambiente GEMINI_API_KEY.' }) 
      };
    }

    // Inicializa o cliente do SDK oficial
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const systemInstruction = `
      Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é analisar o texto do cardápio fornecido, identificar erros gramaticais, de ortografia, e encontrar oportunidades para melhorar as descrições dos pratos, tornando-as mais apetitosas e claras.
      
      Forneça uma lista de correções e sugestões. Para cada ponto encontrado, identifique o texto original, descreva o problema e forneça a sugestão de melhoria. Se não encontrar nenhum problema, retorne uma lista vazia.
    `;
    
    // Faz a chamada à API usando o SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Texto do Cardápio para Análise:\n---\n${menuText}\n---`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              original: { type: "STRING" },
              issue: { type: "STRING" },
              suggestion: { type: "STRING" }
            },
            required: ["original", "issue", "suggestion"]
          }
        }
      }
    });
    
    // O SDK simplifica a extração do texto da resposta
    const jsonText = response.text;

    if (!jsonText) {
      // Se não houver texto e nenhum bloqueio, assuma que não há correções.
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '[]' };
    }

    // Etapa de segurança: analisa e re-stringifica o JSON para garantir que está limpo.
    try {
        const correctionsObject = JSON.parse(jsonText);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(correctionsObject),
        };
    } catch (e) {
        console.error("Erro ao processar JSON da API Gemini (via SDK). Resposta bruta:", jsonText);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'A resposta da IA não é um JSON válido. Não foi possível processar as correções no servidor.' })
        };
    }

  } catch (err) {
    console.error("Netlify Function Error:", err);
    let errorMessage = "Ocorreu um erro interno no servidor.";
    
    if (err.response) { // Erro específico da API Gemini via SDK
        console.error("Gemini API Error Body:", err.response.data);
        errorMessage = err.response.data?.error?.message || "Erro ao se comunicar com a API Gemini.";
    } else if (err instanceof SyntaxError) {
      errorMessage = "O corpo da requisição é inválido. Esperava-se um JSON.";
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: errorMessage }) 
    };
  }
};
