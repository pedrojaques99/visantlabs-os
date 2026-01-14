import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, AlertCircle } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

interface InlineEditorProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number' | 'textarea';
  className?: string;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
  min?: number;
  max?: number;
  step?: number;
  style?: React.CSSProperties;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export const InlineEditor: React.FC<InlineEditorProps> = ({
  value,
  onChange,
  type = 'text',
  className = '',
  placeholder = '',
  editable = true,
  multiline = false,
  min,
  max,
  step,
  style,
  saveStatus = 'idle',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'textarea') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleClick = () => {
    if (editable && !isEditing) {
      setIsEditing(true);
      // Convert \n literals to actual newlines for editing
      const valueToEdit = String(value).replace(/\\n/g, '\n');
      setEditValue(valueToEdit);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && type !== 'textarea') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(value));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && multiline) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = () => {
    if (!editable) return;

    let newValue: string | number = editValue;

    if (type === 'number') {
      const numValue = parseFloat(editValue);
      if (!isNaN(numValue)) {
        let finalValue = numValue;
        if (min !== undefined && finalValue < min) finalValue = min;
        if (max !== undefined && finalValue > max) finalValue = max;
        newValue = finalValue;
      } else {
        // If invalid, revert to original value
        const valueToEdit = String(value).replace(/\\n/g, '\n');
        setEditValue(valueToEdit);
        setIsEditing(false);
        return;
      }
    } else if (type === 'textarea' || multiline) {
      // For textarea, keep actual newlines (they will be converted back to \n if needed by parent)
      newValue = editValue;
    }

    onChange(newValue);
    setIsEditing(false);
  };

  if (!editable) {
    return <span className={className} style={style}>{value}</span>;
  }

  if (isEditing) {
    const inputClassName = `outline-none border-2 border-[brand-cyan] rounded px-2 py-1 bg-white text-neutral-900 ${className}`;

    if (type === 'textarea' || multiline) {
      // Calculate rows based on content
      const lineCount = editValue.split('\n').length;
      const rows = Math.max(3, Math.min(lineCount + 1, 10));

      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          placeholder={placeholder}
          rows={rows}
          style={{
            ...style,
            minWidth: '200px',
            resize: 'vertical',
          }}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        style={style}
      />
    );
  }

  const getStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <GlitchLoader size={12} color="brand-cyan" className="inline-block ml-1" />;
      case 'saved':
        return <Check size={12} className="inline-block ml-1 text-green-500" />;
      case 'error':
        return <AlertCircle size={12} className="inline-block ml-1 text-red-500" />;
      default:
        return null;
    }
  };

  // Convert \n to actual line breaks for display
  const displayValue = String(value).replace(/\\n/g, '\n');
  const hasLineBreaks = displayValue.includes('\n');

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer group relative ${hasLineBreaks ? 'block' : 'inline-block'} ${className} transition-all hover:bg-brand-cyan/10 hover:rounded px-1 py-0.5`}
      title="Click to edit"
      style={{
        ...style,
        whiteSpace: hasLineBreaks ? 'pre-line' : 'normal',
      }}
    >
      {displayValue}
      {saveStatus !== 'idle' ? (
        getStatusIcon()
      ) : (
        <Edit2
          size={12}
          className="inline-block ml-1 opacity-0 group-hover:opacity-50 text-brand-cyan"
        />
      )}
    </span>
  );
};

