
import { GoogleGenAI, Type } from '@google/genai';
import { type Correction, type ComparisonResult } from '../types';

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
          description: "Uma descrição clara e concisa do problema encontrado.",
        },
        suggestion: {
          type: Type.STRING,
          description: "A sugestão de texto corrigido ou melhorado para substituir o original.",
        },
        type: {
            type: Type.STRING,
            description: "A classificação do problema. Deve ser 'correção' para erros de ortografia/gramática ou 'sugestão' para melhorias de clareza, estilo ou persuasão."
        }
      },
      // Garante que todas as propriedades estejam presentes em cada objeto
      required: ["original", "issue", "suggestion", "type"],
    },
};

// Novo schema para os resultados da comparação
const comparisonSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        item: {
          type: Type.STRING,
          description: "O nome do item com a discrepância. Tente normalizar nomes parecidos (ex: 'Batata Frita' e 'Batatas Fritas').",
        },
        issue: {
          type: Type.STRING,
          description: "O tipo de discrepância: 'price_mismatch' para preços diferentes, 'missing_in_menu' para item que falta no cardápio, ou 'missing_in_reference' para item que falta na ficha de referência.",
        },
        details: {
          type: Type.OBJECT,
          properties: {
            menuPrice: { type: Type.STRING, description: "O preço encontrado no texto do cardápio. Opcional." },
            referencePrice: { type: Type.STRING, description: "O preço encontrado no texto de referência. Opcional." },
            menuName: { type: Type.STRING, description: "O nome exato como aparece no cardápio. Opcional." },
            referenceName: { type: Type.STRING, description: "O nome exato como aparece na referência. Opcional." },
          },
          required: [],
        },
      },
      required: ["item", "issue", "details"],
    },
};


// Esta função agora chama a API Gemini diretamente do cliente.
// Isso remove o intermediário da função Netlify, evitando timeouts do servidor.
export const correctMenuText = async (text: string): Promise<Correction[]> => {
  const prompt = `
    Você é um especialista em revisão de cardápios de restaurantes. Sua tarefa é analisar o texto do cardápio fornecido, identificar dois tipos de problemas:
    1.  **Correções:** Erros gramaticais e de ortografia.
    2.  **Sugestões:** Oportunidades para melhorar as descrições dos pratos, tornando-as mais apetitosas, claras ou persuasivas.

    Analise o texto abaixo. Para cada item encontrado, classifique-o como 'correção' ou 'sugestão'. Se não encontrar nenhum problema, retorne um array vazio.

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

export const compareMenuWithReference = async (menuText: string, referenceText: string): Promise<ComparisonResult[]> => {
    const prompt = `
      Você é um auditor de cardápios de restaurante meticuloso. Sua tarefa é comparar um cardápio (extraído de um PDF) com um documento de referência (como uma lista de preços ou ficha técnica). Identifique todas as discrepâncias entre os dois em relação a nomes de itens e preços.

      Seus objetivos principais são encontrar:
      1.  **Price Mismatches (Inconsistências de Preço):** Itens que aparecem em ambos os documentos, mas com preços diferentes. Tente corresponder itens mesmo que os nomes sejam ligeiramente diferentes (ex: "Batata Frita" vs "Batatas Fritas").
      2.  **Missing in Menu (Faltando no Cardápio):** Itens que estão no documento de referência, mas não no cardápio.
      3.  **Missing in Reference (Faltando na Referência):** Itens que estão no cardápio, mas não no documento de referência.

      Analise os dois textos fornecidos abaixo. Para cada discrepância encontrada, classifique-a de acordo. Se não houver discrepâncias, retorne um array vazio.

      Texto do Cardápio:
      ---
      ${menuText}
      ---

      Texto de Referência:
      ---
      ${referenceText}
      ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: comparisonSchema,
            },
        });
        
        const jsonText = response.text;
        const comparisonResults = JSON.parse(jsonText);

        if (!Array.isArray(comparisonResults)) {
            console.error("A resposta da IA para comparação não é um array válido:", comparisonResults);
            throw new Error("A resposta da IA não está no formato esperado (não é uma lista de comparações).");
        }

        return comparisonResults as ComparisonResult[];

    } catch (error) {
        console.error("Erro ao chamar a API Gemini para comparação:", error);
        
        if (error instanceof Error) {
            const message = error.message.replace(/\[.*?\]\s*:/, '').trim();
             if (message.includes('API key not valid')) {
              throw new Error("Chave da API inválida. Verifique se sua chave está configurada corretamente.");
            }
            if (message.includes('400 Bad Request')) {
              throw new Error(`Sua solicitação de comparação foi rejeitada pela IA. Detalhes: ${message}`);
            }
             if (message.match(/50\d/)) {
              throw new Error("O serviço da IA está sobrecarregado ou indisponível no momento. Por favor, tente novamente em alguns minutos.");
            }
            throw new Error(`Erro na comparação com IA: ${message}`);
        }
        
        throw new Error("Ocorreu um erro desconhecido ao comparar os documentos.");
    }
};
