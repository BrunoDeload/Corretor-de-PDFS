import { type Correction } from '../types';

// This function now expects the server to return the final JSON array of corrections directly.
// All cleaning and parsing is handled by the Netlify function.
export const correctMenuText = async (text: string): Promise<Correction[]> => {
  const prompt = `
    Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é analisar o texto do cardápio fornecido, identificar erros gramaticais, de ortografia, e encontrar oportunidades para melhorar as descrições dos pratos, tornando-as mais apetitosas e claras.
    
    Sua resposta DEVE ser um array JSON válido de objetos, seguindo estritamente este formato:
    [
      { 
        "original": "O texto exato com o problema", 
        "issue": "Uma descrição clara e concisa do problema encontrado", 
        "suggestion": "A sugestão de melhoria para o texto" 
      }
    ]

    Se não encontrar nenhum problema, retorne um array JSON vazio [].
    NÃO inclua texto explicativo antes ou depois do array JSON.
    NÃO inclua a formatação markdown \`\`\`json. Sua resposta deve começar com '[' e terminar com ']'.

    Texto do Cardápio para Análise:
    ---
    ${text}
    ---
  `;

  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    // The response body is now expected to be the final JSON data (or an error object).
    const responseData = await response.json();

    if (!response.ok) {
      // The body of a non-ok response is { error: '...', details: '...' }
      throw new Error(responseData.error || `Erro do servidor: ${response.statusText}`);
    }
    
    // On success, the body should be the array of corrections.
    if (!Array.isArray(responseData)) {
        console.error("A resposta do servidor não é um array válido:", responseData);
        throw new Error("A resposta do servidor não está no formato esperado (não é uma lista de correções).");
    }

    return responseData as Correction[];

  } catch (error) {
    console.error("Erro na comunicação ou processamento:", error);
    if (error instanceof SyntaxError) {
        // This likely means the server function crashed or timed out, returning a non-JSON response (e.g., empty).
        throw new Error("Erro de comunicação com o servidor. A análise pode ter demorado demais. Por favor, tente novamente.");
    }
    if (error instanceof Error) {
        throw new Error(error.message || "Não foi possível analisar o cardápio.");
    }
    throw new Error("Ocorreu um erro desconhecido ao chamar a API.");
  }
};
