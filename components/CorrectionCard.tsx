
import React from 'react';
import { type Correction } from '../types';
import { AlertTriangleIcon, CheckCircleIcon, LightbulbIcon } from './IconComponents';

interface CorrectionCardProps {
  correction: Correction;
}

const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction }) => {
  const isCorrection = correction.type === 'correção';

  const theme = {
    cardBorder: isCorrection ? 'border-red-700' : 'border-green-700',
    hoverShadow: isCorrection ? 'hover:shadow-red-500/20' : 'hover:shadow-green-500/20',
    originalTextHeader: 'text-gray-400', 
    issueHeader: isCorrection ? 'text-red-400' : 'text-yellow-400',
    issueText: isCorrection ? 'text-red-300' : 'text-yellow-200',
    suggestionHeader: isCorrection ? 'text-red-300' : 'text-green-400',
    suggestionBg: isCorrection ? 'bg-red-900/30' : 'bg-green-900/30',
    suggestionText: isCorrection ? 'text-red-200' : 'text-green-200',
    issueIcon: isCorrection ? <AlertTriangleIcon className="w-5 h-5 mr-2" /> : <LightbulbIcon className="w-5 h-5 mr-2" />
  };

  return (
    <div className={`bg-gray-800 border ${theme.cardBorder} rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 ${theme.hoverShadow}`}>
      <div className="p-6">
        <div className="mb-4">
          <h3 className={`flex items-center text-sm font-semibold ${theme.originalTextHeader} mb-2`}>
            Texto Original
          </h3>
          <p className="bg-gray-900/50 p-3 rounded-md text-gray-300 italic">"{correction.original}"</p>
        </div>

        <div className="mb-4">
            <h3 className={`flex items-center text-sm font-semibold ${theme.issueHeader} mb-2`}>
                {theme.issueIcon}
                {isCorrection ? 'Erro Encontrado' : 'Ponto de Melhoria'}
            </h3>
            <p className={theme.issueText}>{correction.issue}</p>
        </div>

        <div>
          <h3 className={`flex items-center text-sm font-semibold ${theme.suggestionHeader} mb-2`}>
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            {isCorrection ? 'Correção Sugerida' : 'Sugestão de Aprimoramento'}
          </h3>
          <p className={`${theme.suggestionBg} p-3 rounded-md ${theme.suggestionText}`}>"{correction.suggestion}"</p>
        </div>
      </div>
    </div>
  );
};

export default CorrectionCard;