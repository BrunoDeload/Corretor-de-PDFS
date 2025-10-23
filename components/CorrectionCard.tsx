
import React from 'react';
import { type Correction } from '../types';
import { AlertTriangleIcon, CheckCircleIcon, LightbulbIcon } from './IconComponents';

interface CorrectionCardProps {
  correction: Correction;
}

const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 hover:shadow-teal-500/20">
      <div className="p-6">
        <div className="mb-4">
          <h3 className="flex items-center text-sm font-semibold text-red-400 mb-2">
            <AlertTriangleIcon className="w-5 h-5 mr-2" />
            Texto Original
          </h3>
          <p className="bg-gray-900/50 p-3 rounded-md text-gray-300 italic">"{correction.original}"</p>
        </div>

        <div className="mb-4">
            <h3 className="flex items-center text-sm font-semibold text-yellow-400 mb-2">
                <LightbulbIcon className="w-5 h-5 mr-2" />
                Ponto de Melhoria
            </h3>
            <p className="text-yellow-200">{correction.issue}</p>
        </div>

        <div>
          <h3 className="flex items-center text-sm font-semibold text-teal-400 mb-2">
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            Sugestão Corrigida
          </h3>
          <p className="bg-teal-900/30 p-3 rounded-md text-teal-200">"{correction.suggestion}"</p>
        </div>
      </div>
    </div>
  );
};

export default CorrectionCard;
