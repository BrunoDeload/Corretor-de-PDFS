
import { GoogleGenAI, Type } from "@google/genai";
import { type Correction } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analise o texto deste cardápio e forneça correções e sugestões para torná-lo mais profissional e apetitoso. Identifique erros de digitação, gramática e descrições que podem ser melhoradas. CARDÁPIO: """${text}"""`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.5,
      },
    });

    const jsonString = response.text.trim();
    const corrections = JSON.parse(jsonString);

    if (!Array.isArray(corrections)) {
      console.error("Gemini did not return a valid array:", corrections);
      throw new Error("A resposta da IA não está no formato esperado.");
    }

    return corrections as Correction[];
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Não foi possível analisar o cardápio. Tente novamente.");
  }
};
