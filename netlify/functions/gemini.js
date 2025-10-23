// netlify/functions/gemini.js

/**
 * Tenta chamar a API Gemini com uma lógica de repetição para erros de servidor.
 * @param {string} url O URL da API.
 * @param {object} options As opções para a chamada fetch.
 * @param {number} maxRetries O número máximo de tentativas.
 * @returns {Promise<Response>} A resposta da API.
 */
const callGeminiWithRetry = async (url, options, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Tenta novamente em erros específicos do servidor que podem ser temporários.
      if ([429, 500, 503].includes(response.status)) {
        if (attempt === maxRetries) {
          // Na última tentativa, retorna a resposta de erro para ser tratada.
          return response;
        }
        // Espera exponencial com um fator aleatório (jitter) para evitar picos de novas tentativas.
        const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000;
        console.warn(`API Gemini retornou ${response.status}. Tentando novamente em ${Math.round(delay/1000)}s... (Tentativa ${attempt}/${maxRetries})`);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      return response; // Sucesso ou erro não recuperável.
    } catch (error) {
      console.error(`Erro de rede na tentativa ${attempt}:`, error);
      if (attempt === maxRetries) {
        throw error; // Lança o erro de rede após a última tentativa.
      }
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 1000;
      await new Promise(res => setTimeout(res, delay));
    }
  }
  // Se todas as tentativas falharem, lança um erro.
  throw new Error("Falha na comunicação com a API Gemini após múltiplas tentativas.");
};


// Função principal do Netlify
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Método não permitido.' }) 
    };
  }

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Chave da API não configurada no servidor.' }) 
      };
    }

    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Nenhum prompt foi fornecido.' }) 
      };
    }

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    const fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
    };

    const apiResponse = await callGeminiWithRetry(url, fetchOptions);
    
    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error("Gemini API Error:", data);
        const errorMessage = data?.error?.message || `Erro na API Gemini: ${apiResponse.statusText}`;
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify({ error: `Falha ao comunicar com a IA. ${errorMessage}` })
        };
    }

    if (data.promptFeedback?.blockReason) {
        const reason = data.promptFeedback.blockReason;
        console.warn("Prompt bloqueado:", reason);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `A solicitação foi bloqueada por motivos de segurança: ${reason}` })
        };
    }

    const aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiTextResponse) {
        return {
            statusCode: 200,
            body: JSON.stringify([]),
        };
    }
    
    try {
        const cleanedJsonText = aiTextResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        if (cleanedJsonText === '') {
          return { statusCode: 200, body: JSON.stringify([]) };
        }

        const corrections = JSON.parse(cleanedJsonText);
        
        return {
          statusCode: 200,
          body: JSON.stringify(corrections),
        };
    } catch (parseError) {
        console.error("Falha ao analisar a resposta da Gemini no servidor:", parseError);
        console.error("Resposta original da IA:", aiTextResponse);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "A resposta da IA não é um JSON válido. Não foi possível processar as correções.",
                details: aiTextResponse
            }),
        };
    }

  } catch (error) {
    console.error("Erro na Função Netlify:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Erro interno no servidor ao processar a solicitação.",
        details: error.message 
      }),
    };
  }
};
