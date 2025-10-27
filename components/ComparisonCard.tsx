
import React from 'react';
import { type ComparisonResult } from '../types';
import { AlertTriangleIcon } from './IconComponents';

interface ComparisonCardProps {
  result: ComparisonResult;
}

const ComparisonCard: React.FC<ComparisonCardProps> = ({ result }) => {
  const themes = {
    price_mismatch: {
      title: 'Inconsistência de Preço',
      borderColor: 'border-red-400',
      hoverShadow: 'hover:shadow-red-200/50',
      headerText: 'text-red-600',
    },
    missing_in_menu: {
      title: 'Item Faltando no Cardápio',
      borderColor: 'border-gray-400',
      hoverShadow: 'hover:shadow-gray-200/50',
      headerText: 'text-gray-600',
    },
    missing_in_reference: {
      title: 'Item Extra no Cardápio (Não na Referência)',
      borderColor: 'border-yellow-400',
      hoverShadow: 'hover:shadow-yellow-200/50',
      headerText: 'text-yellow-600',
    },
  };

  const theme = themes[result.issue];

  const renderDetails = () => {
    switch (result.issue) {
      case 'price_mismatch':
        return (
          <>
            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md mb-2">
              <span className="text-gray-600">Preço no Cardápio:</span>
              <span className="font-bold text-red-600">{result.details.menuPrice || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md">
              <span className="text-gray-600">Preço na Referência:</span>
              <span className="font-bold text-green-600">{result.details.referencePrice || 'N/A'}</span>
            </div>
          </>
        );
      case 'missing_in_menu':
        return (
          <p className="bg-gray-100 p-3 rounded-md text-gray-800">
            Este item foi encontrado na referência com o preço de <span className="font-semibold text-green-700">{result.details.referencePrice || 'N/A'}</span>, mas não foi encontrado no cardápio.
          </p>
        );
      case 'missing_in_reference':
        return (
          <p className="bg-gray-100 p-3 rounded-md text-gray-800">
            Este item foi encontrado no cardápio com o preço de <span className="font-semibold text-red-700">{result.details.menuPrice || 'N/A'}</span>, mas não consta na referência.
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white border ${theme.borderColor} rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-105 ${theme.hoverShadow}`}>
      <div className="p-6">
        <h3 className={`flex items-center text-lg font-bold ${theme.headerText} mb-4`}>
          <AlertTriangleIcon className="w-6 h-6 mr-3" />
          {theme.title}
        </h3>
        <p className="text-xl font-semibold text-gray-900 mb-4">
          {result.item}
        </p>
        {renderDetails()}
      </div>
    </div>
  );
};

export default ComparisonCard;