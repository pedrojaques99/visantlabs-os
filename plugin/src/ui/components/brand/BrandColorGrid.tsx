import React, { useRef } from 'react';
import { usePluginStore } from '../../store';
import { Button } from '@/components/ui/button';

const COLOR_ROLES = [
  { role: 'primary', label: 'Primary' },
  { role: 'secondary', label: 'Secondary' },
  { role: 'accent', label: 'Accent' },
  { role: 'background', label: 'Background' },
  { role: 'surface', label: 'Surface' },
  { role: 'text', label: 'Text' }
];

export function BrandColorGrid() {
  const { selectedColors, addSelectedColor } = usePluginStore();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [selectedRole, setSelectedRole] = React.useState<string | null>(null);

  const handleColorClick = (role: string) => {
    setSelectedRole(role);
    colorInputRef.current?.click();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedRole && e.target.value) {
      addSelectedColor(selectedRole, {
        role: selectedRole,
        hex: e.target.value
      });
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Brand Colors</h3>
      <div className="grid grid-cols-3 gap-2">
        {COLOR_ROLES.map((item) => {
          const color = selectedColors.get(item.role);
          return (
            <Button
              key={item.role}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center"
              onClick={() => handleColorClick(item.role)}
              style={color ? { backgroundColor: color.hex, color: color.hex } : {}}
            >
              <div className="text-xs font-mono">{item.label}</div>
              {color && <div className="text-[10px] mt-1">{color.hex}</div>}
            </Button>
          );
        })}
      </div>
      <input
        ref={colorInputRef}
        type="color"
        onChange={handleColorChange}
        className="hidden"
      />
    </div>
  );
}
