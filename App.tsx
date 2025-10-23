import React, { useState, useCallback, useEffect } from 'react';
import { type Correction } from './types';
import { correctMenuText } from './services/geminiService';
import CorrectionCard from './components/CorrectionCard';
import Spinner from './components/Spinner';
import { UploadIcon, CheckCircleIcon, AlertTriangleIcon } from './components/IconComponents';

// This is required for pdfjs-dist
declare const pdfjsLib: any;

const extractTextFromPdf = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileBuffer = reader.result as ArrayBuffer;
        const typedarray = new Uint8Array(fileBuffer);
        
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        resolve(fullText);
      } catch (err) {
        reject(new Error("Falha ao processar o arquivo PDF."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
};

const ApiKeyStatus: React.FC = () => {
    const [status, setStatus] = useState<{message: string; color: string} | null>(null);

    useEffect(() => {
        // This check runs only in the client-side after mounting
        // In production builds, process.env variables are replaced at build time.
        if (process.env.API_KEY && process.env.API_KEY.length > 5) {
            setStatus({ message: "Diagnóstico: Chave de API detectada pelo ambiente.", color: 'text-green-400' });
        } else {
            setStatus({ message: "Diagnóstico: Chave de API NÃO detectada. Verifique as variáveis de ambiente no seu serviço de hospedagem (Netlify).", color: 'text-yellow-400' });
        }
    }, []);

    if (!status) return null;

    return (
        <div className={`text-center text-sm p-2 mb-4 rounded-lg bg-gray-800 border border-gray-700 ${status.color}`}>
            {status.message}
        </div>
    );
};


const App: React.FC = () => {
  const [extractedText, setExtractedText] = useState<string>('');
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Reset everything
    setFileName('');
    setError(null);
    setCorrections([]);
    setHasAnalyzed(false);
    setExtractedText('');

    if (file && file.type === 'application/pdf') {
      setIsExtracting(true);
      setError(null);
      setFileName(file.name);

      try {
        const text = await extractTextFromPdf(file);
        if (text.trim().length === 0) {
          setError("Não foi possível extrair texto do PDF. O arquivo pode estar vazio ou ser uma imagem.");
          setExtractedText('');
        } else {
          setExtractedText(text);
        }
      } catch (err) {
        console.error("PDF extraction error:", err);
        setError(err instanceof Error ? err.message : "Ocorreu um erro ao extrair o texto do PDF.");
        setExtractedText('');
      } finally {
        setIsExtracting(false);
      }

    } else if (file) {
      setError('Por favor, selecione um arquivo PDF válido.');
    }
  };

  const handleAnalyzeClick = useCallback(async () => {
    if (!extractedText) {
      setError('Não há texto para analisar.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCorrections([]);
    setHasAnalyzed(false);

    try {
        const result = await correctMenuText(extractedText);
        setCorrections(result);
    } catch (err) {
       console.error("API error:", err);
       if (err instanceof Error) {
          setError(err.message);
       } else {
          setError('Ocorreu um erro desconhecido ao chamar a IA.');
       }
    } finally {
      setIsAnalyzing(false);
      setHasAnalyzed(true);
    }
  }, [extractedText]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <ApiKeyStatus />

        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 mb-2">
            Corretor de Cardápio com IA
          </h1>
          <p className="text-lg text-gray-400">
            Envie o PDF do seu cardápio e deixe a IA da Gemini aprimorá-lo para você.
          </p>
        </header>

        <main>
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 mb-8">
            <div className="flex flex-col items-center">
              <label htmlFor="pdf-upload" className="w-full flex flex-col items-center px-6 py-12 bg-gray-900 text-blue-400 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-600 cursor-pointer hover:bg-gray-700 hover:border-teal-400 transition-all duration-300">
                <UploadIcon className="w-12 h-12 mb-3" />
                <span className="mt-2 text-base leading-normal font-semibold">Selecione o PDF do cardápio</span>
                <input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} />
              </label>

              {fileName && (
                <p className="mt-4 text-center text-gray-300">
                  Arquivo selecionado: <span className="font-semibold text-teal-400">{fileName}</span>
                </p>
              )}
              
              {isExtracting && (
                <div className="flex items-center mt-4 text-gray-400">
                    <Spinner />
                    <span className="ml-2">Extraindo texto do PDF...</span>
                </div>
              )}

              {extractedText && !isExtracting && (
                  <details className="w-full mt-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <summary className="p-3 cursor-pointer font-semibold text-gray-300 hover:text-white list-none">
                      Prévia do Texto Extraído
                    </summary>
                    <pre className="p-4 text-sm text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto bg-gray-900 rounded-b-lg">
                      {extractedText}
                    </pre>
                  </details>
              )}

              <button
                onClick={handleAnalyzeClick}
                disabled={!extractedText || isAnalyzing || isExtracting}
                className="mt-6 w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-300"
              >
                {isAnalyzing ? 'Analisando...' : 'Corrigir Cardápio'}
              </button>
            </div>
          </div>

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-2xl">
              <Spinner />
              <p className="mt-4 text-lg text-gray-300">Analisando seu cardápio com a IA... Isso pode levar um momento.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                <AlertTriangleIcon className="w-6 h-6 mr-3"/>
                <span>{error}</span>
            </div>
          )}

          {!isAnalyzing && corrections.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-center mb-6 text-teal-400">Sugestões de Melhoria</h2>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {corrections.map((correction, index) => (
                  <CorrectionCard key={index} correction={correction} />
                ))}
              </div>
            </div>
          )}

          {!isAnalyzing && hasAnalyzed && corrections.length === 0 && !error && (
            <div className="flex flex-col items-center p-8 bg-green-900/50 border border-green-700 text-green-300 rounded-lg">
                <CheckCircleIcon className="w-12 h-12 mb-4"/>
                <h3 className="text-xl font-bold">Ótimo trabalho!</h3>
                <p>Não encontramos erros ou pontos de melhoria no seu cardápio.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;