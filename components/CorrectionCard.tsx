
import React from 'react';
import { type Correction } from '../types';
import { AlertTriangleIcon, CheckCircleIcon, LightbulbIcon } from './IconComponents';

interface CorrectionCardProps {
  correction: Correction;
}

const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction }) => {
  const isCorrection = correction.type === 'correção';

  const theme = {
    cardBorder: isCorrection ? 'border-red-300' : 'border-gray-300',
    hoverShadow: isCorrection ? 'hover:shadow-red-200/50' : 'hover:shadow-gray-200/50',
    originalTextHeader: 'text-gray-500', 
    issueHeader: isCorrection ? 'text-red-600' : 'text-gray-600',
    issueText: isCorrection ? 'text-red-800' : 'text-gray-800',
    suggestionHeader: isCorrection ? 'text-green-600' : 'text-blue-600',
    suggestionBg: isCorrection ? 'bg-green-50' : 'bg-blue-50',
    suggestionText: isCorrection ? 'text-green-800' : 'text-blue-800',
    issueIcon: isCorrection ? <AlertTriangleIcon className="w-5 h-5 mr-2" /> : <LightbulbIcon className="w-5 h-5 mr-2" />
  };

  return (
    <div className={`bg-white border ${theme.cardBorder} rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 ${theme.hoverShadow}`}>
      <div className="p-6">
        <div className="mb-4">
          <h3 className={`flex items-center text-sm font-semibold ${theme.originalTextHeader} mb-2`}>
            Texto Original
          </h3>
          <p className="bg-gray-100 p-3 rounded-md text-gray-700 italic">"{correction.original}"</p>
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