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
      Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é corrigir erros gramaticais, de ortografia e sugerir melhorias nas descrições dos pratos.
      Para o texto do cardápio a seguir, identifique problemas e forneça sugestões.
      A saída DEVE ser um array JSON válido de objetos. Cada objeto deve ter três propriedades: "original" (o trecho de texto problemático original), "issue" (uma breve explicação do problema, por exemplo, "Erro de ortografia" ou "Descrição pouco apetitosa") e "suggestion" (o texto corrigido ou melhorado).
      Se não houver erros ou pontos de melhoria, retorne um array vazio [].
      NÃO inclua nenhum texto, explicação, markdown ou a tag \`\`\`json\`\`\` antes ou depois do array JSON. A resposta deve ser apenas o array.

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
        // Força a saída a ser um JSON válido (camelCase é o correto)
        responseMimeType: "application/json",
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
        // Limpa a resposta para remover o markdown que a IA pode adicionar por engano
        const cleanedJsonText = jsonText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();

        // Valida o JSON no servidor antes de enviar para o cliente para evitar erros de parsing no frontend
        JSON.parse(cleanedJsonText);

        // Retorna o JSON limpo e validado
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: cleanedJsonText,
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
