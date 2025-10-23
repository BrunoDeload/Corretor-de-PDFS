
import React, { useState, useCallback } from 'react';
import { type Correction } from './types';
import { correctMenuText } from './services/geminiService';
import CorrectionCard from './components/CorrectionCard';
import Spinner from './components/Spinner';
import { UploadIcon, CheckCircleIcon, AlertTriangleIcon } from './components/IconComponents';

// This is required for pdfjs-dist
declare const pdfjsLib: any;

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setFileName(file.name);
      setError(null);
      setCorrections([]);
    } else {
      setError('Por favor, selecione um arquivo PDF válido.');
      setPdfFile(null);
      setFileName('');
    }
  };

  const processPdf = useCallback(async () => {
    if (!pdfFile) {
      setError('Nenhum arquivo PDF selecionado.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCorrections([]);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          const typedarray = new Uint8Array(e.target.result as ArrayBuffer);
          
          try {
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
            }
            
            if (fullText.trim().length === 0) {
              setError("Não foi possível extrair texto do PDF. O arquivo pode estar vazio ou ser uma imagem.");
              setIsLoading(false);
              return;
            }

            const result = await correctMenuText(fullText);
            setCorrections(result);
          } catch (pdfError) {
             console.error("PDF processing or API error:", pdfError);
             if (pdfError instanceof Error) {
                setError(pdfError.message);
             } else {
                setError('Ocorreu um erro desconhecido ao processar o PDF ou chamar a IA.');
             }
          } finally {
            setIsLoading(false);
          }
        }
      };
      reader.onerror = () => {
          setError('Falha ao ler o arquivo.');
          setIsLoading(false);
      }
      reader.readAsArrayBuffer(pdfFile);

    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocorreu um erro inesperado.');
      }
      setIsLoading(false);
    }
  }, [pdfFile]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
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

              <button
                onClick={processPdf}
                disabled={!pdfFile || isLoading}
                className="mt-6 w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-300"
              >
                {isLoading ? 'Analisando...' : 'Corrigir Cardápio'}
              </button>
            </div>
          </div>

          {isLoading && (
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

          {!isLoading && corrections.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-center mb-6 text-teal-400">Sugestões de Melhoria</h2>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {corrections.map((correction, index) => (
                  <CorrectionCard key={index} correction={correction} />
                ))}
              </div>
            </div>
          )}

          {!isLoading && corrections.length === 0 && pdfFile && !error && (
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
