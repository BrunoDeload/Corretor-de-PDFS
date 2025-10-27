
import React, { useState, useCallback, useMemo } from 'react';
import { type Correction, type ComparisonResult } from './types';
import { correctMenuText, compareMenuWithReference } from './services/geminiService';
import CorrectionCard from './components/CorrectionCard';
import ComparisonCard from './components/ComparisonCard';
import Spinner from './components/Spinner';
import { UploadIcon, CheckCircleIcon, AlertTriangleIcon, DocumentTextIcon } from './components/IconComponents';

// Adiciona mammoth ao escopo global para extração de texto de .docx
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
  }
}
const { pdfjsLib } = window;


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

const extractTextFromDocx = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            try {
                const result = await window.mammoth.extractRawText({ arrayBuffer });
                resolve(result.value);
            } catch (err) {
                reject(new Error("Falha ao processar o arquivo Word (.docx). Certifique-se de que não é um arquivo .doc antigo."));
            }
        };
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsArrayBuffer(file);
    });
};


const App: React.FC = () => {
  // State for PDF
  const [pdfFileText, setPdfFileText] = useState<string>('');
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);
  
  // State for Word file
  const [wordFileText, setWordFileText] = useState<string>('');
  const [wordFileName, setWordFileName] = useState<string>('');
  const [isProcessingWord, setIsProcessingWord] = useState<boolean>(false);

  // State for results and errors
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isCallingAI, setIsCallingAI] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

  const resetState = () => {
      setPdfFileText('');
      setPdfFileName('');
      setWordFileText('');
      setWordFileName('');
      setError(null);
      setCorrections([]);
      setComparisonResults([]);
      setHasAnalyzed(false);
  };

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    // Clear previous PDF state and results
    setPdfFileText('');
    setPdfFileName('');
    setCorrections([]);
    setComparisonResults([]);
    setError(null);
    setHasAnalyzed(false);

    if (file && file.type === 'application/pdf') {
      setIsProcessingPdf(true);
      setPdfFileName(file.name);

      try {
        const text = await extractTextFromPdf(file);
        if (text.trim().length === 0) {
          setError("Não foi possível extrair texto do PDF. O arquivo pode estar vazio ou ser uma imagem.");
        } else {
          setPdfFileText(text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocorreu um erro ao extrair o texto do PDF.");
      } finally {
        setIsProcessingPdf(false);
      }
    } else if (file) {
      setError('Por favor, selecione um arquivo PDF válido.');
    }
  };

  const handleWordFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Clear previous Word state and comparison results
    setWordFileText('');
    setWordFileName('');
    setComparisonResults([]);
    setError(null);
    setHasAnalyzed(false);

    const validWordTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (file && validWordTypes.includes(file.type)) {
      setIsProcessingWord(true);
      setWordFileName(file.name);
      try {
        const text = await extractTextFromDocx(file);
         if (text.trim().length === 0) {
          setError("Não foi possível extrair texto do arquivo Word. O arquivo pode estar vazio.");
        } else {
          setWordFileText(text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocorreu um erro ao extrair o texto do Word.");
      } finally {
        setIsProcessingWord(false);
      }
    } else if (file) {
      setError('Por favor, selecione um arquivo .docx válido.');
    }
  };

  const handleProcessClick = useCallback(async () => {
    if (!pdfFileText) {
      setError('O arquivo PDF do cardápio é obrigatório.');
      return;
    }

    setIsCallingAI(true);
    setError(null);
    setCorrections([]);
    setComparisonResults([]);
    setHasAnalyzed(false);

    try {
      const promises = [];
      // Always run correction
      promises.push(correctMenuText(pdfFileText));
      
      // Run comparison if Word file is also provided
      if (wordFileText) {
        promises.push(compareMenuWithReference(pdfFileText, wordFileText));
      }

      const results = await Promise.allSettled(promises);
      
      const correctionResult = results[0];
      if (correctionResult.status === 'fulfilled') {
        setCorrections(correctionResult.value as Correction[]);
      } else {
        throw correctionResult.reason;
      }

      if (results.length > 1) {
        const comparisonResult = results[1];
        if (comparisonResult.status === 'fulfilled') {
          setComparisonResults(comparisonResult.value as ComparisonResult[]);
        } else {
          throw comparisonResult.reason;
        }
      }
    } catch (err) {
       console.error("API error:", err);
       if (err instanceof Error) {
          setError(err.message);
       } else {
          setError('Ocorreu um erro desconhecido ao chamar a IA.');
       }
    } finally {
      setIsCallingAI(false);
      setHasAnalyzed(true);
    }
  }, [pdfFileText, wordFileText]);

  const { spellingCorrections, improvementSuggestions } = useMemo(() => {
    const spelling = corrections.filter(c => c.type === 'correção');
    const improvements = corrections.filter(c => c.type === 'sugestão');
    return { spellingCorrections: spelling, improvementSuggestions: improvements };
  }, [corrections]);
  
  const isProcessing = isProcessingPdf || isProcessingWord;
  const canProcess = pdfFileText && !isCallingAI && !isProcessing;
  
  const buttonText = isCallingAI
    ? (wordFileText ? 'Processando...' : 'Corrigindo...')
    : (wordFileText ? 'Corrigir e Comparar' : 'Corrigir Cardápio');


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 mb-2">
            Dale Cardápio Corretor
          </h1>
          <p className="text-lg text-gray-400">
            Sua ferramenta de IA para correção e comparação de cardápios.
          </p>
           <p className="text-sm text-gray-500 mt-2">Criado por Bruno Eduardo</p>
        </header>

        <main>
          <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PDF Upload */}
                <label htmlFor="pdf-upload" className="w-full flex flex-col items-center px-6 py-12 bg-gray-900 text-blue-400 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-600 cursor-pointer hover:bg-gray-700 hover:border-teal-400 transition-all duration-300">
                    <UploadIcon className="w-12 h-12 mb-3" />
                    <span className="mt-2 text-base leading-normal font-semibold text-center">1. Cardápio (PDF)</span>
                    <input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={handlePdfFileChange} disabled={isProcessing}/>
                </label>

                {/* Word Upload */}
                <label htmlFor="word-upload" className="w-full flex flex-col items-center px-6 py-12 bg-gray-900 text-purple-400 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-600 cursor-pointer hover:bg-gray-700 hover:border-purple-400 transition-all duration-300">
                    <DocumentTextIcon className="w-12 h-12 mb-3" />
                    <span className="mt-2 text-base leading-normal font-semibold text-center">2. Ficha/Referência (.docx)</span>
                    <span className="text-xs text-gray-500">(Opcional para Comparação)</span>
                    <input id="word-upload" type="file" className="hidden" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleWordFileChange} disabled={isProcessing}/>
                </label>
            </div>

            <div className="mt-6 space-y-3">
                 {pdfFileName && <p className="text-center text-gray-300">Cardápio: <span className="font-semibold text-teal-400">{pdfFileName}</span></p>}
                 {wordFileName && <p className="text-center text-gray-300">Referência: <span className="font-semibold text-purple-400">{wordFileName}</span></p>}
            </div>

            {isProcessing && (
                <div className="flex items-center justify-center mt-4 text-gray-400">
                    <Spinner />
                    <span className="ml-2">Processando arquivos...</span>
                </div>
            )}

            <div className="flex justify-center mt-6">
                 <button onClick={handleProcessClick} disabled={!canProcess} className="px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-300">
                    {buttonText}
                </button>
            </div>
          </div>
          
          {isCallingAI && (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-2xl">
              <Spinner />
              <p className="mt-4 text-lg text-gray-300">Dale IA... Isso pode levar um momento.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
                <AlertTriangleIcon className="w-6 h-6 mr-3"/>
                <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-12">
            {!isCallingAI && comparisonResults.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-yellow-400">Análise Comparativa</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {comparisonResults.map((result, index) => (
                    <ComparisonCard key={`comp-${index}`} result={result} />
                  ))}
                </div>
              </section>
            )}

            {!isCallingAI && spellingCorrections.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-red-400">Correções Ortográficas e Gramaticais</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {spellingCorrections.map((correction, index) => (
                    <CorrectionCard key={`corr-${index}`} correction={correction} />
                  ))}
                </div>
              </section>
            )}

            {!isCallingAI && improvementSuggestions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-green-400">Sugestões de Aprimoramento</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {improvementSuggestions.map((correction, index) => (
                    <CorrectionCard key={`sugg-${index}`} correction={correction} />
                  ))}
                </div>
              </section>
            )}
          </div>


          {!isCallingAI && hasAnalyzed && corrections.length === 0 && comparisonResults.length === 0 && !error && (
            <div className="flex flex-col items-center p-8 bg-green-900/50 border border-green-700 text-green-300 rounded-lg">
                <CheckCircleIcon className="w-12 h-12 mb-4"/>
                <h3 className="text-xl font-bold">Ótimo trabalho!</h3>
                <p>Não encontramos erros ou discrepâncias no seu cardápio.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
