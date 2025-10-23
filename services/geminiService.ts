import { GoogleGenAI, Type } from "@google/genai";
import { type Correction } from '../types';

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      original: {
        type: Type.STRING,
        description: "O trecho de texto original do cardápio que contém um erro ou pode ser melhorado.",
      },
      issue: {
        type: Type.STRING,
        description: "Uma descrição clara e concisa do problema encontrado (ex: 'Erro de digitação', 'Gramática incorreta', 'Descrição pouco apetitosa').",
      },
      suggestion: {
        type: Type.STRING,
        description: "A versão corrigida e melhorada do texto.",
      },
    },
    required: ["original", "issue", "suggestion"],
  },
};

export const correctMenuText = async (text: string): Promise<Correction[]> => {
  const API_KEY = process.env.API_KEY;

  if (!API_KEY) {
    throw new Error(
      "Chave de API não configurada. Se você publicou este app em serviços como Netlify ou Vercel, certifique-se de adicionar a variável de ambiente 'API_KEY' nas configurações do seu site."
    );
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analise o texto deste cardápio e forneça correções e sugestões. CARDÁPIO: """${text}"""`,
      config: {
        systemInstruction: "Você é um especialista em redação gastronômica e marketing para restaurantes. Sua tarefa é revisar textos de cardápios para corrigir erros ortográficos e gramaticais, e, mais importante, reescrever as descrições dos pratos para que soem mais atraentes, profissionais e deliciosas. Seja claro, conciso e use uma linguagem que desperte o apetite. Foque na qualidade dos ingredientes e na experiência que o prato oferece.",
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      },
    });

    const jsonString = response.text.trim();
    
    if (!jsonString) {
        // The model might return an empty string if it can't find issues.
        // Treat this as "no corrections found".
        return [];
    }

    const corrections = JSON.parse(jsonString);

    if (!Array.isArray(corrections)) {
      console.error("A API Gemini não retornou um array válido:", corrections);
      throw new Error("A resposta da IA não está no formato esperado (não é uma lista de correções).");
    }

    return corrections as Correction[];
  } catch (error) {
    console.error("Erro no serviço da Gemini:", error);
    
    if (error instanceof Error) {
        if (error.message.toLowerCase().includes("api key not valid")) {
            throw new Error("A chave da API (API_KEY) é inválida. Verifique a chave e tente novamente.");
        }
        if (error instanceof SyntaxError) {
            throw new Error("A resposta da IA não é um JSON válido. Não foi possível processar as correções.");
        }
        // Re-throw other specific errors with more context
        throw new Error(`Erro ao processar o cardápio: ${error.message}`);
    }
    
    // Generic fallback for unknown errors
    throw new Error("Não foi possível analisar o cardápio. A API pode estar temporariamente indisponível.");
  }
};