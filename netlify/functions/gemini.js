// netlify/functions/gemini.js

// As versões mais recentes do runtime do Netlify (Node 18+) incluem 'fetch' globalmente.
// Se estiver usando uma versão mais antiga, pode ser necessário instalar 'node-fetch'.

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

    const prompt = `
      Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é analisar o texto do cardápio fornecido, identificar erros gramaticais, de ortografia, e encontrar oportunidades para melhorar as descrições dos pratos, tornando-as mais apetitosas e claras.
      
      Analise o texto a seguir e forneça uma lista de correções e sugestões. Para cada ponto encontrado, identifique o texto original, descreva o problema e forneça a sugestão de melhoria. Se não encontrar nenhum problema, retorne uma lista vazia.

      Texto do Cardápio para Análise:
      ---
      ${menuText}
      ---
    `;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              original: {
                type: "STRING",
                description: "O trecho de texto original do cardápio que contém um problema."
              },
              issue: {
                type: "STRING",
                description: "Uma explicação clara e concisa do problema encontrado (ex: 'Erro de ortografia', 'Concordância verbal incorreta', 'Descrição pouco clara')."
              },
              suggestion: {
                type: "STRING",
                description: "A versão corrigida e/ou melhorada do texto original."
              }
            },
            required: ["original", "issue", "suggestion"]
          }
        }
      }
    };

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const geminiResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.json();
        console.error("Gemini API Error:", JSON.stringify(errorBody, null, 2));
        const errorMessage = errorBody?.error?.message || `Erro na API Gemini: ${geminiResponse.statusText}`;
        return { 
          statusCode: geminiResponse.status, 
          body: JSON.stringify({ error: errorMessage }) 
        };
    }

    const data = await geminiResponse.json();
    
    if (data.promptFeedback?.blockReason) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: `O conteúdo foi bloqueado por razões de segurança: ${data.promptFeedback.blockReason}` }) 
        };
    }
      
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      // Se não houver texto e nenhum bloqueio, assuma que não há correções.
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '[]' };
    }

    try {
        // Analisa o texto da API para um objeto JavaScript.
        const correctionsObject = JSON.parse(jsonText);

        // Converte o objeto de volta para uma string JSON.
        // Isso garante que estamos enviando uma string perfeitamente formatada para o cliente.
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(correctionsObject),
        };
    } catch (e) {
        console.error("Erro ao processar JSON da API Gemini. Resposta bruta:", jsonText);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'A resposta da IA não é um JSON válido. Não foi possível processar as correções no servidor.' })
        };
    }

  } catch (err) {
    console.error("Netlify Function Error:", err);
    let errorMessage = "Ocorreu um erro interno no servidor.";
    // Erro de parsing no corpo da requisição
    if (err instanceof SyntaxError) {
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