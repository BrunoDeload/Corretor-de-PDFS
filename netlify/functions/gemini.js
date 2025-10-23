// netlify/functions/gemini.js

// This function acts as a robust proxy to the Gemini API.
// It validates and parses the AI's JSON response on the server
// before sending clean, structured data to the client.
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
    
    if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        console.error("Gemini API Error:", errorData);
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify({ error: errorData.error?.message || `Erro na API Gemini: ${apiResponse.statusText}` })
        };
    }

    const data = await apiResponse.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText || rawText.trim() === '') {
        if (data.promptFeedback?.blockReason) {
            console.warn("Prompt blocked:", data.promptFeedback.blockReason);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `A solicitação foi bloqueada por motivos de segurança: ${data.promptFeedback.blockReason}` })
            };
        }
        // If no text and not blocked, assume no corrections. Send back a valid, stringified empty array.
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([]) 
        };
    }
    
    try {
        // Clean and parse the JSON *on the server*. This is the critical step.
        const cleanedJsonText = rawText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const corrections = JSON.parse(cleanedJsonText);
        
        // If parsing succeeds, send the structured data back.
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corrections)
        };
    } catch (parseError) {
        // If JSON parsing fails here, we know the AI response was invalid.
        console.error("Falha ao analisar a resposta da Gemini como JSON. Resposta bruta:", rawText);
        return {
            statusCode: 500,
            // Return a helpful error message to the client.
            body: JSON.stringify({ error: "A resposta da IA não é um JSON válido e não pôde ser processada no servidor." })
        };
    }

  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Ocorreu um erro interno no servidor." }),
    };
  }
};