import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useDatabase } from '../../hooks/useDatabase';
import { generateOwnerSettlementPDF } from '../../services/pdf';
import { FileText, Printer, CheckCircle } from 'lucide-react';

export interface SettlementPdfButtonProps {
  ownerId: string;
  dateFrom: string;
  dateTo: string;
  db: ReturnType<typeof useDatabase>;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const SettlementPdfButton: React.FC<SettlementPdfButtonProps> = ({
  ownerId,
  dateFrom,
  dateTo,
  db,
  variant = 'primary',
  size = 'md',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExportPDF = () => {
    if (!ownerId) {
      alert('Seleccione un arrendador para generar la liquidación PDF.');
      return;
    }
    if (!dateFrom || !dateTo) {
      alert('Seleccione la fecha inicial y fecha final del período.');
      return;
    }

    setIsGenerating(true);
    try {
      const settlement = db.getNetSettlementForOwner(ownerId, dateFrom, dateTo);
      if (!settlement) {
        alert('No se encontró información para el arrendador seleccionado.');
        setIsGenerating(false);
        return;
      }

      generateOwnerSettlementPDF(settlement);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error rendering PDF:', err);
      alert('Ocurrió un error al generar la liquidación en PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={success ? 'secondary' : variant}
      size={size}
      isLoading={isGenerating}
      onClick={handleExportPDF}
      icon={success ? <CheckCircle className="w-4 h-4 text-status-success" /> : <Printer className="w-4 h-4" />}
    >
      {success ? 'PDF Generado' : 'Exportar Liquidación PDF (100% Neto)'}
    </Button>
  );
};
