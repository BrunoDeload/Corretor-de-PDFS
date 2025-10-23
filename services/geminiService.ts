import { GoogleGenAI, Type } from '@google/genai';
import { type Correction } from '../types';

// Inicializa o cliente GoogleGenAI.
// A chave da API é fornecida automaticamente pelo ambiente.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define o esquema estruturado para a saída JSON do modelo.
// Isso garante que obteremos uma resposta consistente e previsível.
const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        original: {
          type: Type.STRING,
          description: "O texto exato do cardápio que contém o problema.",
        },
        issue: {
          type: Type.STRING,
          description: "Uma descrição clara e concisa do problema encontrado (ex: erro de ortografia, gramática, descrição pouco apetitosa).",
        },
        suggestion: {
          type: Type.STRING,
          description: "A sugestão de texto corrigido ou melhorado para substituir o original.",
        },
      },
      // Garante que todas as propriedades estejam presentes em cada objeto
      required: ["original", "issue", "suggestion"],
    },
};

// Esta função agora chama a API Gemini diretamente do cliente.
// Isso remove o intermediário da função Netlify, evitando timeouts do servidor.
export const correctMenuText = async (text: string): Promise<Correction[]> => {
  const prompt = `
    Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é analisar o texto do cardápio fornecido, identificar erros gramaticais, de ortografia, e encontrar oportunidades para melhorar as descrições dos pratos, tornando-as mais apetitosas e claras.
    
    Analise o texto abaixo e retorne suas correções. Se não encontrar nenhum problema, retorne um array vazio.

    Texto do Cardápio para Análise:
    ---
    ${text}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
        },
    });
    
    // O SDK com um responseSchema deve retornar uma string JSON analisável em response.text
    const jsonText = response.text;
    
    const corrections = JSON.parse(jsonText);

    // Validação final para garantir que a estrutura de dados esteja correta.
    if (!Array.isArray(corrections)) {
        console.error("A resposta da IA não é um array válido:", corrections);
        throw new Error("A resposta da IA não está no formato esperado (não é uma lista de correções).");
    }

    return corrections as Correction[];

  } catch (error) {
    console.error("Erro ao chamar a API Gemini:", error);
    
    if (error instanceof Error) {
        // As mensagens de erro do SDK da Gemini geralmente começam com "[GoogleGenerativeAI Error]:".
        // Vamos extrair a mensagem principal para torná-la mais amigável.
        const message = error.message.replace(/\[.*?\]\s*:/, '').trim();

        if (message.includes('API key not valid')) {
          throw new Error("Chave da API inválida. Verifique se sua chave está configurada corretamente.");
        }
        if (message.includes('400 Bad Request')) {
          throw new Error(`Sua solicitação foi rejeitada pela IA. Isso pode ser devido ao conteúdo do PDF ou a um problema temporário. Detalhes: ${message}`);
        }
         if (message.match(/50\d/)) { // Erros 500, 503, etc.
          throw new Error("O serviço da IA está sobrecarregado ou indisponível no momento. Por favor, tente novamente em alguns minutos.");
        }

        // Para outros erros, mostramos a mensagem limpa.
        throw new Error(`Erro de comunicação com a IA: ${message}`);
    }
    
    throw new Error("Ocorreu um erro desconhecido ao analisar o cardápio.");
  }
};