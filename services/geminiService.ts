import { type Correction } from '../types';

// This function now constructs the full prompt and handles the response from the simple proxy.
export const correctMenuText = async (text: string): Promise<Correction[]> => {
  // Detailed prompt moved from the serverless function to here.
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
      // The serverless function now expects a 'prompt' property.
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Erro do servidor: ${response.statusText}`);
    }

    // The serverless function returns a JSON object like { text: "..." }
    const responseData = await response.json();
    const aiResponseText = responseData.text;

    if (!aiResponseText) {
      // If the text is empty, it could mean no corrections were found.
      return [];
    }

    // Defensively clean the response to handle cases where the AI might still add markdown fences.
    const cleanedJsonText = aiResponseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

    // Parse the cleaned text to get the array of corrections.
    const corrections = JSON.parse(cleanedJsonText);
    
    if (corrections.length === 0) {
        return [];
    }

    if (!Array.isArray(corrections)) {
      console.error("A resposta da IA não é um array válido:", corrections);
      throw new Error("A resposta da IA não está no formato esperado (não é uma lista de correções).");
    }

    return corrections as Correction[];
  } catch (error) {
    console.error("Erro ao chamar ou processar a resposta da função Netlify:", error);
    
    if (error instanceof SyntaxError) {
        throw new Error("A resposta da IA não é um JSON válido. Não foi possível processar as correções.");
    }
    if (error instanceof Error) {
        throw new Error(`Erro ao processar o cardápio: ${error.message}`);
    }
    
    throw new Error("Não foi possível analisar o cardápio. A API pode estar temporariamente indisponível.");
  }
};
