import { type Correction } from '../types';

// This function now expects the server to return a clean JSON array of corrections.
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

    // The response body from Netlify should now be the JSON array itself, or an error object.
    const responseData = await response.json();

    if (!response.ok) {
      // The error object from the server will be structured like { error: "..." }
      throw new Error(responseData.error || `Erro do servidor: ${response.statusText}`);
    }

    // No more parsing or cleaning needed here! `responseData` is already the array.
    const corrections = responseData; 

    if (!Array.isArray(corrections)) {
      console.error("A resposta do servidor não é um array válido:", corrections);
      throw new Error("A resposta do servidor não está no formato esperado (não é uma lista de correções).");
    }

    return corrections as Correction[];
  } catch (error) {
    console.error("Erro ao chamar ou processar a resposta da função Netlify:", error);
    if (error instanceof Error) {
        throw new Error(error.message || "Não foi possível analisar o cardápio.");
    }
    throw new Error("Ocorreu um erro desconhecido ao chamar a API.");
  }
};