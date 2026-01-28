import * as React from "react"
import { cn } from "@/lib/utils"

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChange: (value: number) => void;
  currency?: 'BRL' | 'USD';
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, currency = 'BRL', ...props }, ref) => {
    const currencySymbol = currency === 'BRL' ? 'R$' : '$';
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';

    // Converter valor numérico para string formatada para exibição
    const formatValue = (val: number | string): string => {
      if (val === '' || val === null || val === undefined) return `${currencySymbol} `;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num === 0) return `${currencySymbol} `;

      // Formatar com separador de milhar e 2 casas decimais
      const formatted = num.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Adicionar símbolo da moeda
      return `${currencySymbol} ${formatted}`;
    };

    // Converter string formatada de volta para número
    const parseValue = (val: string): number => {
      if (!val) return 0;
      // Remove símbolo da moeda e tudo exceto números e ponto/vírgula
      const cleaned = val
        .replace(currencySymbol, '')
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.')
        .trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const [displayValue, setDisplayValue] = React.useState(() => formatValue(value));

    React.useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value, locale, currencySymbol]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;

      // Se o usuário apagar tudo, mantém apenas o símbolo
      if (inputValue === '' || inputValue === currencySymbol) {
        setDisplayValue(`${currencySymbol} `);
        onChange(0);
        return;
      }

      // Se não começar com o símbolo, adiciona
      if (!inputValue.startsWith(currencySymbol)) {
        // Se for apenas números, adiciona o símbolo
        if (/^[\d,.\s]*$/.test(inputValue.trim())) {
          inputValue = `${currencySymbol} ${inputValue.trim()}`;
        } else {
          // Se não for válido, mantém o valor anterior
          return;
        }
      }

      // Remove o símbolo temporariamente para processar
      const withoutSymbol = inputValue.replace(currencySymbol, '').trim();

      // Permite apenas números, vírgula, ponto e espaços
      if (/^[\d,.\s]*$/.test(withoutSymbol)) {
        // Adiciona o símbolo de volta no início
        const formatted = `${currencySymbol} ${withoutSymbol}`;
        setDisplayValue(formatted);
        const parsed = parseValue(formatted);
        onChange(parsed);
      }
    };

    const handleBlur = () => {
      // Ao sair do campo, formata o valor novamente com símbolo
      const num = parseValue(displayValue);
      setDisplayValue(formatValue(num));
      onChange(num);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Ao focar, se o campo estiver vazio ou só tiver o símbolo, permite edição
      if (displayValue === '' || displayValue === currencySymbol || displayValue === `${currencySymbol} `) {
        setDisplayValue(`${currencySymbol} `);
      }
    };

    return (
      <input
        type="text"
        className={cn(
          "w-full px-4 py-3 bg-neutral-950/70 border border-neutral-800 rounded-xl text-neutral-200 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/70 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-neutral-500",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        {...props}
      />
    )
  }
)
CurrencyInput.displayName = "CurrencyInput"

export { CurrencyInput }

