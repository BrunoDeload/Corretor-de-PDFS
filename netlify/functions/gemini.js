// netlify/functions/gemini.js

// This function acts as a simple proxy to the Gemini API.
// It is designed to be called from the frontend with a JSON body: { "prompt": "..." }
// It forwards the prompt to the Gemini API and returns the response text in a JSON body: { "text": "..." }
exports.handler = async (event) => {
  // Only allow POST requests
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
          // Add safety settings to reduce chances of harmful content
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      }
    );
    
    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        console.error("Gemini API Error:", errorData);
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify({ error: errorData.error?.message || `Erro na API Gemini: ${apiResponse.statusText}` })
        };
    }

    const data = await apiResponse.json();

    // Extract text safely, checking for potential blocks or empty responses
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
        // Handle cases where the response might be blocked due to safety settings
        if (data.promptFeedback?.blockReason) {
            console.warn("Prompt blocked:", data.promptFeedback.blockReason);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `A solicitação foi bloqueada por motivos de segurança: ${data.promptFeedback.blockReason}` })
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ text: "[]" }) // Return empty array string if no text
        };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };
  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Ocorreu um erro interno no servidor." }),
    };
  }
};
