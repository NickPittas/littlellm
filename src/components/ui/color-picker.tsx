'use client';

import React, { useState, useRef, useEffect } from 'react';



interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
  supportAlpha?: boolean; // Support transparency/alpha values
}

export function ColorPicker({ value, onChange, label, className, supportAlpha = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleColorChange = (newColor: string) => {
    setInputValue(newColor);
    onChange(newColor);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Validate hex color format or rgba format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue) || /^rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    // If input is invalid, revert to current value
    if (!/^#[0-9A-Fa-f]{6}$/.test(inputValue) && !/^rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)$/.test(inputValue)) {
      setInputValue(value);
    }
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    console.log('🎨 Native color picker changed to:', newColor);
    handleColorChange(newColor);
    setIsOpen(false);
  };

  const presetColors = [
    '#569cd6', '#4fc1ff', '#e04539', '#f44747', '#dcdcaa', '#ce9178',
    '#9cdcfe', '#c586c0', '#4ec9b0', '#b5cea8', '#d7ba7d', '#808080',
    '#181829', '#1d1d33', '#211f32', '#3b3b68', '#d4d4d4', '#ffffff'
  ];

  const transparentColors = supportAlpha ? [
    'rgba(86, 156, 214, 0.8)', 'rgba(79, 193, 255, 0.8)', 'rgba(224, 69, 57, 0.8)',
    'rgba(244, 71, 71, 0.8)', 'rgba(220, 220, 170, 0.8)', 'rgba(206, 145, 120, 0.8)',
    'rgba(255, 255, 255, 0.5)', 'rgba(0, 0, 0, 0.5)', 'rgba(255, 0, 0, 0.3)',
    'rgba(0, 255, 0, 0.3)', 'rgba(0, 0, 255, 0.3)', 'rgba(255, 255, 0, 0.3)'
  ] : [];

  return (
    <div
      className={`space-y-2 relative ${className || ''}`}
      ref={containerRef}
    >
      {label && (
        <label
          className="text-sm font-medium leading-none"
          style={{
            color: 'var(--card-foreground)',
            display: 'block',
            marginBottom: '8px'
          }}
        >
          {label}
        </label>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* Color Preview Button - Opens system color picker */}
        <button
          type="button"
          onClick={() => {
            // Open system color picker
            if (colorInputRef.current) {
              colorInputRef.current.click();
            }
          }}
          title="Click to open system color picker"
          style={{
            width: '48px',
            height: '40px',
            padding: '0',
            margin: '0',
            backgroundColor: value,
            border: '2px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={{ position: 'absolute', left: '-9999px' }}>Open system color picker</span>
        </button>

        {/* Dropdown Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Click to open preset colors"
          style={{
            width: '40px',
            height: '40px',
            padding: '0',
            margin: '0',
            backgroundColor: 'var(--muted)',
            border: '2px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--foreground)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--muted)';
          }}
        >
          ▼
        </button>

        {/* Hex Input - Custom styled */}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={supportAlpha ? "#000000 or rgba(0,0,0,0.5)" : "#000000"}
          maxLength={supportAlpha ? 25 : 7}
          style={{
            flex: '1',
            height: '40px',
            padding: '8px 12px',
            backgroundColor: 'var(--muted)',
            color: 'var(--foreground)',
            border: '2px solid var(--border)',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '14px',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--ring))';
            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--ring) / 0.2)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--border))';
            e.currentTarget.style.boxShadow = 'none';
            handleInputBlur();
          }}
        />

        {/* Native color input for system color picker */}
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(e) => handleColorChange(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
        />
      </div>

      {/* Hidden native color input for system color picker */}
      <input
        ref={colorInputRef}
        type="color"
        value={value}
        onChange={handleNativeColorChange}
        style={{
          position: 'absolute',
          left: '-9999px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Color Picker Dropdown - Completely custom */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 9999,
            top: '100%',
            left: '0',
            marginTop: '8px',
            padding: '16px',
            backgroundColor: 'hsl(var(--card))',
            border: '2px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
            minWidth: '280px',
            color: 'hsl(var(--card-foreground))',
            backdropFilter: 'none',
            opacity: '1'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Preset Colors */}
            <div>
              <label
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  display: 'block',
                  color: 'var(--card-foreground)'
                }}
              >
                Preset Colors
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: '8px'
                }}
              >
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      handleColorChange(color);
                      setIsOpen(false);
                    }}
                    title={color}
                    style={{
                      width: '32px',
                      height: '32px',
                      padding: '0',
                      margin: '0',
                      backgroundColor: color, // Keep hex for direct background color
                      border: `2px solid ${value === color ? 'hsl(var(--ring))' : 'hsl(var(--border))'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: value === color ? '0 0 0 2px hsl(var(--ring) / 0.3)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Transparency Colors (temporarily disabled to fix interface) */}
            {false && supportAlpha && transparentColors.length > 0 && (
              <div>
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px',
                    display: 'block',
                    color: 'var(--card-foreground)'
                  }}
                >
                  Transparent Colors
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '8px'
                  }}
                >
                  {transparentColors.map((color, index) => (
                    <button
                      key={`transparent-${index}`}
                      type="button"
                      onClick={() => {
                        handleColorChange(color);
                        setIsOpen(false);
                      }}
                      title={color}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: '0',
                        margin: '0',
                        background: `linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                        border: `2px solid ${value === color ? 'hsl(var(--ring))' : 'hsl(var(--border))'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: color,
                          borderRadius: '2px'
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Native Color Picker Button */}
            <div>
              <button
                type="button"
                onClick={() => {
                  console.log('🎨 System color picker button clicked');
                  if (colorInputRef.current) {
                    colorInputRef.current.click();
                  }
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--muted)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  outline: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--muted)';
                }}
              >
                Open System Color Picker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
