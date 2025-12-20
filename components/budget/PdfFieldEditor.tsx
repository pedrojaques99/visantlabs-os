import React, { useState } from 'react';
import { User, FileText, Building2, Calendar, Hash, MessageSquare, Type, AlignLeft, DollarSign } from 'lucide-react';
import type { PdfFieldMapping, BudgetData } from '../../types';
import { VariableThumbnail } from './VariableThumbnail';
import { VariableConfigModal } from './VariableConfigModal';

interface PdfFieldEditorProps {
  fieldMappings: PdfFieldMapping[];
  onFieldMappingsChange: (mappings: PdfFieldMapping[]) => void;
  onPositioningModeChange?: (fieldId: string | null) => void;
  positioningFieldId?: string | null;
  data: BudgetData;
  onFocusFormField?: (fieldId: string) => void;
}

// Available fields from BudgetData
const AVAILABLE_FIELDS = [
  { id: 'clientName', label: 'Nome do Cliente', icon: User },
  { id: 'projectName', label: 'Nome do Projeto', icon: FileText },
  { id: 'projectDescription', label: 'Descrição do Projeto', icon: FileText },
  { id: 'brandName', label: 'Nome da Marca', icon: Building2 },
  { id: 'startDate', label: 'Data de Início', icon: Calendar },
  { id: 'endDate', label: 'Data de Término', icon: Calendar },
  { id: 'year', label: 'Ano', icon: Hash },
  { id: 'observations', label: 'Observações', icon: MessageSquare },
  { id: 'finalCTAText', label: 'Texto CTA Final', icon: Type },
  { id: 'custom_text', label: 'Campo de Texto', icon: AlignLeft },
  { id: 'custom_currency', label: 'Campo de Valor (Moeda)', icon: DollarSign },
];

export const PdfFieldEditor: React.FC<PdfFieldEditorProps> = ({
  fieldMappings,
  onFieldMappingsChange,
  onPositioningModeChange,
  positioningFieldId,
  data,
  onFocusFormField,
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const getFieldStatus = (fieldId: string): 'available' | 'added' | 'positioned' => {
    const mappings = fieldMappings.filter(m => m.fieldId === fieldId);
    if (mappings.length === 0) return 'available';
    // If any instance is positioned, show as positioned
    if (mappings.some(m => m.x > 0 || m.y > 0)) return 'positioned';
    return 'added';
  };

  // Helper to get field value from BudgetData
  const getFieldValue = (fieldId: string): string | null => {
    switch (fieldId) {
      case 'clientName':
        return data.clientName || null;
      case 'projectName':
        return data.projectName || null;
      case 'projectDescription':
        return data.projectDescription || null;
      case 'brandName':
        return data.brandName || null;
      case 'startDate':
        return data.startDate ? new Date(data.startDate).toLocaleDateString('pt-BR') : null;
      case 'endDate':
        return data.endDate ? new Date(data.endDate).toLocaleDateString('pt-BR') : null;
      case 'year':
        return data.year || new Date().getFullYear().toString();
      case 'observations':
        return data.observations || null;
      case 'finalCTAText':
        return data.finalCTAText || null;
      default:
        // Custom fields always need input
        return null;
    }
  };

  const handleThumbClick = (fieldId: string) => {
    const isCustomField = fieldId.startsWith('custom_');
    const fieldValue = getFieldValue(fieldId);
    
    // If field has value and is not custom, add directly without modal
    if (fieldValue && !isCustomField) {
      const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
      
      const newMapping: PdfFieldMapping = {
        id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fieldId,
        label: field?.label || fieldId,
        x: 0,
        y: 0,
        fontSize: 12,
        color: '#000000',
        align: 'left',
        page: 1,
        fontFamily: 'geist',
        bold: false,
      };
      onFieldMappingsChange([...fieldMappings, newMapping]);
      
      // Activate positioning mode
      if (onPositioningModeChange) {
        onPositioningModeChange(fieldId);
      }
      return;
    }
    
    // For empty fields or custom fields, focus the form field instead of opening modal
    if (onFocusFormField) {
      onFocusFormField(fieldId);
      return;
    }
    
    // Fallback: open modal if onFocusFormField is not provided
    setSelectedFieldId(fieldId);
    setConfigModalOpen(true);
  };

  const handleConfigConfirm = (customValue?: string) => {
    if (!selectedFieldId) return;

    const field = AVAILABLE_FIELDS.find(f => f.id === selectedFieldId);

    // Always create new mapping instance (allow multiple instances)
    const newMapping: PdfFieldMapping = {
      id: `${selectedFieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID for this instance
      fieldId: selectedFieldId,
      label: field?.label || selectedFieldId,
      x: 0,
      y: 0,
      fontSize: 12,
      color: '#000000',
      align: 'left',
      page: 1,
      customValue,
      fontFamily: 'geist',
      bold: false,
    };
    onFieldMappingsChange([...fieldMappings, newMapping]);

    setConfigModalOpen(false);
    
    // Activate positioning mode
    if (onPositioningModeChange) {
      onPositioningModeChange(selectedFieldId);
    }
  };

  const handleConfigCancel = () => {
    setConfigModalOpen(false);
    setSelectedFieldId(null);
  };

  const selectedField = selectedFieldId
    ? AVAILABLE_FIELDS.find(f => f.id === selectedFieldId)
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold font-mono text-zinc-300">
        Variáveis Disponíveis
      </h3>

      {/* Grid de thumbs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {AVAILABLE_FIELDS.map((field) => {
          const Icon = field.icon;
          const mappings = fieldMappings.filter(m => m.fieldId === field.id);
          const status = getFieldStatus(field.id);
          const instanceCount = mappings.length;
          // Get the most recent mapping for display (if any)
          const latestMapping = mappings.length > 0 ? mappings[mappings.length - 1] : undefined;

          return (
            <VariableThumbnail
              key={field.id}
              fieldId={field.id}
              label={field.label}
              icon={<Icon size={24} />}
              status={status}
              onClick={() => handleThumbClick(field.id)}
              mapping={latestMapping}
              instanceCount={instanceCount}
            />
          );
        })}
      </div>

      {/* Modal de configuração */}
      {selectedField && (
        <VariableConfigModal
          isOpen={configModalOpen}
          onClose={handleConfigCancel}
          fieldId={selectedField.id}
          label={selectedField.label}
          data={data}
          currentValue={undefined}
          onConfirm={handleConfigConfirm}
        />
      )}

      {fieldMappings.length === 0 && (
        <p className="text-xs text-zinc-500 font-mono text-center py-4">
          Clique em uma variável para adicionar ao PDF
        </p>
      )}
    </div>
  );
};
