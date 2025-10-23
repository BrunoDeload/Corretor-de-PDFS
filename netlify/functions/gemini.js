// netlify/functions/gemini.js

// This function now handles cleaning and parsing the AI's response.
// It returns a fully validated JSON array of corrections or a structured error object.
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
        const errorMessage = data.error?.message || `Erro na API Gemini: ${apiResponse.statusText}`;
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify({ error: errorMessage })
        };
    }

    if (data.promptFeedback?.blockReason) {
        const reason = data.promptFeedback.blockReason;
        console.warn("Prompt blocked:", reason);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `A solicitação foi bloqueada por motivos de segurança: ${reason}` })
        };
    }

    const aiTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiTextResponse) {
        // AI returned no text, which is a valid scenario (e.g., no corrections found).
        // The prompt asks for [], so we return that.
        return {
            statusCode: 200,
            body: JSON.stringify([]),
        };
    }
    
    try {
        // The server now takes responsibility for cleaning and parsing the AI's response.
        const cleanedJsonText = aiTextResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        
        if (cleanedJsonText === '') {
          return { statusCode: 200, body: JSON.stringify([]) };
        }

        const corrections = JSON.parse(cleanedJsonText);
        
        return {
          statusCode: 200,
          body: JSON.stringify(corrections), // Send the already parsed and validated data
        };
    } catch (parseError) {
        console.error("Failed to parse Gemini response on server:", parseError);
        console.error("Original AI response was:", aiTextResponse);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: "A resposta da IA não é um JSON válido. Não foi possível processar as correções.",
                details: aiTextResponse // Send the faulty text back for debugging
            }),
        };
    }

  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Erro interno no servidor ao processar a solicitação.",
        details: error.message 
      }),
    };
  }
};
