// netlify/functions/gemini.js

// This function acts as a simple proxy to the Gemini API.
// It returns the raw text response from the AI inside a JSON object: { "text": "..." }
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

    const apiResponse = await fetch(url, {
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
      }
    );
    
    const data = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error("Gemini API Error:", data);
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify({ error: data.error?.message || `Erro na API Gemini: ${apiResponse.statusText}` })
        };
    }

    if (data.promptFeedback?.blockReason) {
        console.warn("Prompt blocked:", data.promptFeedback.blockReason);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `A solicitação foi bloqueada por motivos de segurança: ${data.promptFeedback.blockReason}` })
        };
    }

    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'; // Default to an empty array as a string

    return {
      statusCode: 200,
      body: JSON.stringify({ text: output }),
    };

  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Erro ao processar a resposta da IA no servidor.",
        details: error.message 
      }),
    };
  }
};