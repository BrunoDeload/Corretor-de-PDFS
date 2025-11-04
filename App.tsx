
import React, { useState, useCallback, useMemo } from 'react';
import { type Correction, type ComparisonResult } from './types';
import { correctMenuText, compareMenuWithReference, correctImageText } from './services/geminiService';
import CorrectionCard from './components/CorrectionCard';
import ComparisonCard from './components/ComparisonCard';
import Spinner from './components/Spinner';
import { UploadIcon, CheckCircleIcon, AlertTriangleIcon, DocumentTextIcon } from './components/IconComponents';

// Adiciona mammoth e xlsx (SheetJS) ao escopo global
declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
    XLSX: any;
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

const extractTextFromXlsx = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = window.XLSX.read(data, { type: 'array' });
        let fullText = '';
        workbook.SheetNames.forEach((sheetName: string) => {
          const worksheet = workbook.Sheets[sheetName];
          // Converte a planilha para texto, o que é eficaz para a IA processar.
          const text = window.XLSX.utils.sheet_to_txt(worksheet);
          fullText += text + '\n\n'; // Adiciona espaço entre as planilhas
        });
        resolve(fullText);
      } catch (err) {
        reject(new Error("Falha ao processar o arquivo Excel (.xlsx)."));
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
  
  // State for Reference file (Word or Excel)
  const [referenceFileText, setReferenceFileText] = useState<string>('');
  const [referenceFileName, setReferenceFileName] = useState<string>('');
  const [isProcessingReference, setIsProcessingReference] = useState<boolean>(false);

  // State for Image file
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMimeType, setImageMimeType] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  // State for results and errors
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [imageCorrections, setImageCorrections] = useState<Correction[]>([]);
  
  const [isCallingAI, setIsCallingAI] = useState<boolean>(false);
  const [isCallingAIForImage, setIsCallingAIForImage] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [hasAnalyzedImage, setHasAnalyzedImage] = useState<boolean>(false);

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
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
          setError(null);
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

  const handleReferenceFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setReferenceFileText('');
    setReferenceFileName('');
    setComparisonResults([]);
    setError(null);
    setHasAnalyzed(false);

    if (!file) return;

    const docxType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if ([docxType, xlsxType].includes(file.type)) {
      setIsProcessingReference(true);
      setReferenceFileName(file.name);
      try {
        let text = '';
        if (file.type === docxType) {
          text = await extractTextFromDocx(file);
        } else if (file.type === xlsxType) {
          text = await extractTextFromXlsx(file);
        }

        if (text.trim().length === 0) {
          setError("Não foi possível extrair texto do arquivo de referência. O arquivo pode estar vazio.");
        } else {
          setReferenceFileText(text);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocorreu um erro ao extrair o texto do arquivo de referência.");
      } finally {
        setIsProcessingReference(false);
      }
    } else {
      setError('Por favor, selecione um arquivo .docx ou .xlsx válido.');
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setImageBase64('');
    setImageMimeType('');
    setImageFileName('');
    setImageCorrections([]);
    setImageError(null);
    setHasAnalyzedImage(false);

    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png'];
    if (validTypes.includes(file.type)) {
      setIsProcessingImage(true);
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageBase64(result.split(',')[1]); // Remove the data URL prefix
        setImageMimeType(file.type);
        setImageError(null);
        setIsProcessingImage(false);
      };
      reader.onerror = () => {
        setImageError("Falha ao ler o arquivo de imagem.");
        setIsProcessingImage(false);
      };
      reader.readAsDataURL(file);
    } else {
      setImageError('Por favor, selecione um arquivo de imagem .png ou .jpeg válido.');
    }
  };

  const handleProcessMenuClick = useCallback(async () => {
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
      promises.push(correctMenuText(pdfFileText));
      
      if (referenceFileText) {
        promises.push(compareMenuWithReference(pdfFileText, referenceFileText));
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
  }, [pdfFileText, referenceFileText]);

  const handleProcessImageClick = useCallback(async () => {
    if (!imageBase64) {
      setImageError('Nenhuma imagem selecionada para análise.');
      return;
    }
    
    setIsCallingAIForImage(true);
    setImageError(null);
    setImageCorrections([]);
    setHasAnalyzedImage(false);

    try {
      const result = await correctImageText(imageBase64, imageMimeType);
      setImageCorrections(result);
    } catch (err) {
      console.error("Image API error:", err);
      if (err instanceof Error) {
        setImageError(err.message);
      } else {
        setImageError('Ocorreu um erro desconhecido ao analisar a imagem.');
      }
    } finally {
      setIsCallingAIForImage(false);
      setHasAnalyzedImage(true);
    }
  }, [imageBase64, imageMimeType]);

  const { spellingCorrections, improvementSuggestions } = useMemo(() => {
    const spelling = corrections.filter(c => c.type === 'correção');
    const improvements = corrections.filter(c => c.type === 'sugestão');
    return { spellingCorrections: spelling, improvementSuggestions: improvements };
  }, [corrections]);
  
  const isProcessingAnyFile = isProcessingPdf || isProcessingReference || isProcessingImage;
  const canProcessMenu = pdfFileText && !isCallingAI && !isProcessingAnyFile;
  const canProcessImage = imageBase64 && !isCallingAIForImage && !isProcessingAnyFile;
  
  const menuButtonText = isCallingAI
    ? (referenceFileText ? 'Processando...' : 'Corrigindo...')
    : (referenceFileText ? 'Corrigir e Comparar' : 'Corrigir Cardápio');


  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-black mb-2">
            Dale Corretor
          </h1>
          <p className="text-lg text-gray-600">
            Sua ferramenta de IA para correção de cardapio e artes.
          </p>
           <p className="text-sm text-gray-500 mt-2">Criado por Bruno Eduardo</p>
        </header>

        <main>
          {/* Menu Corrector */}
          <div className="bg-gray-50 p-8 rounded-2xl shadow-2xl border border-gray-200 mb-12">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Corretor de Cardápio</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label htmlFor="pdf-upload" className="w-full flex flex-col items-center px-6 py-12 bg-white text-red-600 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-300 cursor-pointer hover:bg-red-50 hover:border-red-600 transition-all duration-300">
                    <UploadIcon className="w-12 h-12 mb-3" />
                    <span className="mt-2 text-base leading-normal font-semibold text-center">1. Cardápio (PDF)</span>
                    <input id="pdf-upload" type="file" className="hidden" accept="application/pdf" onChange={handlePdfFileChange} disabled={isProcessingAnyFile}/>
                </label>
                <label htmlFor="reference-upload" className="w-full flex flex-col items-center px-6 py-12 bg-white text-gray-700 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100 hover:border-black transition-all duration-300">
                    <DocumentTextIcon className="w-12 h-12 mb-3" />
                    <span className="mt-2 text-base leading-normal font-semibold text-center">2. Ficha/Referência (.docx, .xlsx)</span>
                    <span className="text-xs text-gray-500">(Opcional para Comparação)</span>
                    <input id="reference-upload" type="file" className="hidden" accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleReferenceFileChange} disabled={isProcessingAnyFile}/>
                </label>
            </div>
            <div className="mt-6 space-y-3">
                 {pdfFileName && <p className="text-center text-gray-700">Cardápio: <span className="font-semibold text-red-700">{pdfFileName}</span></p>}
                 {referenceFileName && <p className="text-center text-gray-700">Referência: <span className="font-semibold text-black">{referenceFileName}</span></p>}
            </div>
            <div className="flex justify-center mt-6">
                 <button onClick={handleProcessMenuClick} disabled={!canProcessMenu} className="px-8 py-3 bg-gradient-to-r from-red-600 to-black text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-300">
                    {menuButtonText}
                </button>
            </div>
          </div>
          
          {/* Image Corrector */}
          <div className="bg-gray-50 p-8 rounded-2xl shadow-2xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Corretor de Arte (Imagem)</h2>
             <div className="grid grid-cols-1 gap-6">
               <label htmlFor="image-upload" className="w-full flex flex-col items-center px-6 py-12 bg-white text-red-600 rounded-lg shadow-lg tracking-wide border-2 border-dashed border-gray-300 cursor-pointer hover:bg-red-50 hover:border-red-600 transition-all duration-300">
                  <UploadIcon className="w-12 h-12 mb-3" />
                  <span className="mt-2 text-base leading-normal font-semibold text-center">Carregar Arte (.png, .jpeg)</span>
                  <input id="image-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleImageFileChange} disabled={isProcessingAnyFile}/>
              </label>
             </div>
             <div className="mt-6 space-y-3">
                 {imageFileName && <p className="text-center text-gray-700">Arte: <span className="font-semibold text-red-700">{imageFileName}</span></p>}
             </div>
             <div className="flex justify-center mt-6">
                 <button onClick={handleProcessImageClick} disabled={!canProcessImage} className="px-8 py-3 bg-gradient-to-r from-red-600 to-black text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-300">
                    Corrigir Arte
                </button>
            </div>
          </div>

          {(isProcessingAnyFile) && (
              <div className="flex items-center justify-center mt-4 text-gray-600">
                  <Spinner />
                  <span className="ml-2">Processando arquivos...</span>
              </div>
          )}

          {isCallingAI && (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl">
              <Spinner />
              <p className="mt-4 text-lg text-gray-700">Analisando cardápio... Isso pode levar um momento.</p>
            </div>
          )}

          {isCallingAIForImage && (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl">
              <Spinner />
              <p className="mt-4 text-lg text-gray-700">Analisando imagem... Isso pode levar um momento.</p>
            </div>
          )}

          {error && (
            <div className="my-4 flex items-center p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <AlertTriangleIcon className="w-6 h-6 mr-3"/>
                <span>{error}</span>
            </div>
          )}

          {imageError && (
            <div className="my-4 flex items-center p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                <AlertTriangleIcon className="w-6 h-6 mr-3"/>
                <span>{imageError}</span>
            </div>
          )}
          
          <div className="space-y-12 mt-12">
            {!isCallingAI && comparisonResults.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-red-700">Análise Comparativa do Cardápio</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {comparisonResults.map((result, index) => (
                    <ComparisonCard key={`comp-${index}`} result={result} />
                  ))}
                </div>
              </section>
            )}

            {!isCallingAI && spellingCorrections.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-red-700">Correções Ortográficas (Cardápio)</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {spellingCorrections.map((correction, index) => (
                    <CorrectionCard key={`corr-${index}`} correction={correction} />
                  ))}
                </div>
              </section>
            )}
            
            {!isCallingAIForImage && imageCorrections.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-red-700">Correções Ortográficas (Arte)</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {imageCorrections.map((correction, index) => (
                    <CorrectionCard key={`img-corr-${index}`} correction={correction} />
                  ))}
                </div>
              </section>
            )}

            {!isCallingAI && improvementSuggestions.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold text-center mb-6 text-gray-800">Sugestões de Aprimoramento (Cardápio)</h2>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {improvementSuggestions.map((correction, index) => (
                    <CorrectionCard key={`sugg-${index}`} correction={correction} />
                  ))}
                </div>
              </section>
            )}
          </div>


          {!isCallingAI && hasAnalyzed && corrections.length === 0 && comparisonResults.length === 0 && !error && (
            <div className="mt-6 flex flex-col items-center p-8 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                <CheckCircleIcon className="w-12 h-12 mb-4"/>
                <h3 className="text-xl font-bold">Ótimo trabalho no cardápio!</h3>
                <p>Não encontramos erros ou discrepâncias.</p>
            </div>
          )}
          {!isCallingAIForImage && hasAnalyzedImage && imageCorrections.length === 0 && !imageError && (
             <div className="mt-6 flex flex-col items-center p-8 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                <CheckCircleIcon className="w-12 h-12 mb-4"/>
                <h3 className="text-xl font-bold">Arte impecável!</h3>
                <p>Não encontramos erros na imagem.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;