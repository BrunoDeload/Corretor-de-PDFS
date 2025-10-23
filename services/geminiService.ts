import { type Correction } from '../types';

export const correctMenuText = async (text: string): Promise<Correction[]> => {
  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Usa a mensagem de erro da função ou um fallback
      throw new Error(errorData.error || `Erro do servidor: ${response.statusText}`);
    }

    // A função Netlify retorna o array JSON diretamente no corpo da resposta.
    const corrections = await response.json();
    
    if (corrections.length === 0) {
        return [];
    }

    if (!Array.isArray(corrections)) {
      console.error("A função Netlify não retornou um array válido:", corrections);
      throw new Error("A resposta da IA não está no formato esperado (não é uma lista de correções).");
    }

    return corrections as Correction[];
  } catch (error) {
    console.error("Erro ao chamar a função Netlify:", error);
    
    if (error instanceof Error) {
        if (error instanceof SyntaxError) {
            throw new Error("A resposta da IA não é um JSON válido. Não foi possível processar as correções.");
        }
        // Re-lança outros erros específicos com mais contexto
        throw new Error(`Erro ao processar o cardápio: ${error.message}`);
    }
    
    // Fallback genérico para erros desconhecidos
    throw new Error("Não foi possível analisar o cardápio. A API pode estar temporariamente indisponível.");
  }
};
