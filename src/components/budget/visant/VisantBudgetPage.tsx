import React from 'react';
import type { BudgetData, Deliverable, Signature } from '@/types/types';
import { InlineEditor } from '../InlineEditor';

interface VisantBudgetPageProps {
  data: BudgetData;
  editable?: boolean;
  onDataChange?: (data: Partial<BudgetData>) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

export const VisantBudgetPage: React.FC<VisantBudgetPageProps> = ({
  data,
  editable = false,
  onDataChange,
  saveStatus = 'idle',
}) => {
  const accentColor = data.brandAccentColor || data.brandColors[0] || 'brand-cyan';
  const bgColor = data.brandBackgroundColor || '#ffffff';
  const isDarkBg = bgColor !== '#ffffff' && bgColor !== '#fff' && bgColor !== 'white';
  const textColor = isDarkBg ? '#ffffff' : '#020202';
  const secondaryTextColor = isDarkBg ? '#cccccc' : '#666666';

  const calculateTotal = (deliverable: Deliverable): number => {
    return deliverable.quantity * deliverable.unitValue;
  };

  const calculateGrandTotal = (): number => {
    return data.deliverables.reduce((sum, d) => sum + calculateTotal(d), 0);
  };

  const formatCurrency = (value: number): string => {
    const formatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatted;
  };

  const totalHours = data.paymentInfo?.totalHours || 0;
  const hourlyRate = data.paymentInfo?.hourlyRate || 0;
  const totalFromHours = totalHours * hourlyRate;
  const finalTotal = totalFromHours > 0 ? totalFromHours : calculateGrandTotal();
  const signatures = data.signatures || [];
  const pixKey = data.paymentInfo?.pixKey || '';
  const discountPercent = data.paymentInfo?.cashDiscountPercent || 0;
  const discountAmount = finalTotal * (discountPercent / 100);
  const finalWithDiscount = finalTotal - discountAmount;
  const paymentTerms = data.paymentInfo?.paymentTerms || '50/50 no PIX, ou a vista com desconto';

  // Arrow SVG connecting "Orçamento" to brand name
  const ArrowConnector = () => (
    <svg width="119" height="1" viewBox="0 0 119 1" fill="none" className="flex-shrink-0">
      <line x1="0" y1="0.5" x2="119" y2="0.5" stroke={textColor} strokeWidth="0.5" />
    </svg>
  );

  const contentWidth = data.contentWidth || 800;
  const contentHeight = data.contentHeight;

  return (
    <div
      className="w-full h-full min-h-full overflow-visible"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontFamily: "'Manrope', sans-serif",
        padding: 'clamp(12px, 2vw, 22px)',
        minHeight: '1131px', // A4 height for 800px width (800 * 1.414)
      }}
    >
      <style>
        {`
          @media print {
            body { print-color-adjust: exact; }
          }
          @media (max-width: 1024px) {
            .visant-budget-page {
              max-width: 95% !important;
            }
          }
          @media (max-width: 768px) {
            .visant-budget-page {
              padding: clamp(12px, 2vw, 22px) !important;
              max-width: 100% !important;
            }
            .visant-budget-page .services-banner {
              width: 100% !important;
              max-width: 100% !important;
            }
            .visant-budget-page .header-arrow {
              display: none;
            }
            .visant-budget-page .signatures-grid {
              grid-template-columns: 1fr !important;
              gap: 24px !important;
            }
            .visant-budget-page .footer-grid {
              grid-template-columns: 1fr !important;
            }
            .visant-budget-page .investment-section {
              text-align: left !important;
              margin-top: 24px;
            }
          }
          @media (max-width: 640px) {
            .visant-budget-page {
              font-size: clamp(12px, 2.5vw, 14px);
            }
            .visant-budget-page .service-number {
              font-size: clamp(20px, 4vw, 24px) !important;
            }
            .visant-budget-page .service-name {
              font-size: clamp(12px, 2.5vw, 14px) !important;
            }
            .visant-budget-page .service-description {
              font-size: clamp(9px, 2vw, 10px) !important;
            }
          }
        `}
      </style>

      <div
        className="visant-budget-page mx-auto relative"
        style={{
          height: contentHeight ? `${contentHeight}px` : 'auto',
          minHeight: contentHeight ? `${contentHeight}px` : '100%',
          width: '100%',
          maxWidth: `${contentWidth}px`,
          paddingLeft: 'clamp(12px, 2vw, 22px)',
          paddingRight: 'clamp(12px, 2vw, 22px)',
        }}
      >
        {/* Header with Orçamento + Arrow + Brand Name */}
        <div className="flex items-center justify-between mb-6" style={{ marginTop: '60px' }}>
          <div className="flex items-center gap-3">
            <span
              className="font-bold"
              style={{
                fontSize: '18.07px',
                color: textColor,
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <InlineEditor
                value="Orçamento"
                onChange={() => { }}
                editable={false}
                style={{ fontSize: '18.07px', fontWeight: 'bold' }}
                saveStatus={saveStatus}
              />
            </span>
            <span className="header-arrow">
              <ArrowConnector />
            </span>
          </div>
          <div
            className="px-4 py-2 border-2 rounded-md"
            style={{
              borderColor: accentColor,
              color: textColor,
              fontSize: '17.018px',
              fontWeight: 'bold',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <InlineEditor
              value={data.brandName}
              onChange={(newName) => onDataChange?.({ brandName: String(newName) })}
              editable={editable}
              style={{ fontSize: '17.018px', fontWeight: 'bold' }}
              saveStatus={saveStatus}
            />
          </div>
        </div>

        {/* Project Title */}
        <div
          className="mb-6 text-center"
          style={{
            fontSize: '16px',
            color: textColor,
            fontFamily: "'Manrope', sans-serif",
            marginTop: '47.5px',
            letterSpacing: '0.16px',
          }}
        >
          {editable ? (
            <InlineEditor
              value={data.projectName || 'Projeto de Branding Completo - Logo, ID Visual e Extras'}
              onChange={(newName) => onDataChange?.({ projectName: String(newName) })}
              editable={editable}
              style={{ fontSize: '16px' }}
              saveStatus={saveStatus}
            />
          ) : (
            <>
              <span style={{ fontWeight: 'bold' }}>Projeto de Branding Completo </span>
              <span style={{ fontWeight: 'normal' }}>- Logo, ID Visual e Extras</span>
            </>
          )}
        </div>

        {/* Services Section */}
        <div className="mb-8" style={{ marginTop: '12.5px' }}>
          {/* Services Banner */}
          <div className="flex items-center justify-between mb-6">
            <div
              className="services-banner relative inline-block"
              style={{
                backgroundColor: accentColor,
                clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 100%, 20px 100%)',
                padding: '12px 24px',
              }}
            >
              <h3
                className="font-bold text-white"
                style={{
                  fontSize: '21px',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Serviços
              </h3>
            </div>
            <span
              style={{
                fontSize: '17px',
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '300',
                color: textColor,
              }}
            >
              Qtd.
            </span>
          </div>

          {/* Services List */}
          <div className="space-y-0" style={{ borderTop: `1px solid ${secondaryTextColor}` }}>
            {data.deliverables.map((deliverable, index) => (
              <div
                key={index}
                className="flex items-start justify-between"
                style={{
                  borderBottom: `1px solid ${secondaryTextColor}`,
                  paddingTop: '20px',
                  paddingBottom: '20px',
                }}
              >
                <div className="flex items-start" style={{ flex: 1, gap: '12px' }}>
                  {/* Large Number */}
                  <span
                    className="service-number font-bold"
                    style={{
                      fontSize: '29px',
                      color: textColor,
                      fontFamily: "'Manrope', sans-serif",
                      lineHeight: '1.56',
                      minWidth: '50px',
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </span>
                  {/* Service Name and Description */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="service-name font-bold mb-1"
                      style={{
                        fontSize: '16px',
                        color: textColor,
                        fontFamily: "'Manrope', sans-serif",
                        lineHeight: '1.56',
                      }}
                    >
                      <InlineEditor
                        value={deliverable.name}
                        onChange={(newName) => {
                          const updatedDeliverables = [...data.deliverables];
                          updatedDeliverables[index] = { ...deliverable, name: String(newName) };
                          onDataChange?.({ deliverables: updatedDeliverables });
                        }}
                        editable={editable}
                        style={{ fontSize: '16px', fontWeight: 'bold' }}
                        saveStatus={saveStatus}
                      />
                    </h4>
                    {deliverable.description && (
                      <p
                        className="service-description"
                        style={{
                          fontSize: '11.5px',
                          color: textColor,
                          fontFamily: "'Manrope', sans-serif",
                          fontWeight: 'normal',
                          lineHeight: '1.56',
                        }}
                      >
                        <InlineEditor
                          value={deliverable.description}
                          onChange={(newDesc) => {
                            const updatedDeliverables = [...data.deliverables];
                            updatedDeliverables[index] = { ...deliverable, description: String(newDesc) };
                            onDataChange?.({ deliverables: updatedDeliverables });
                          }}
                          editable={editable}
                          type="textarea"
                          multiline
                          style={{ fontSize: '11.5px' }}
                          saveStatus={saveStatus}
                        />
                      </p>
                    )}
                  </div>
                </div>
                {/* Quantity */}
                <div style={{ textAlign: 'right', minWidth: '58px', flexShrink: 0 }}>
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '18px',
                      color: textColor,
                      fontFamily: "'Manrope', sans-serif",
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <InlineEditor
                      value={deliverable.quantity}
                      onChange={(newQty) => {
                        const updatedDeliverables = [...data.deliverables];
                        updatedDeliverables[index] = { ...deliverable, quantity: Number(newQty) };
                        onDataChange?.({ deliverables: updatedDeliverables });
                      }}
                      editable={editable}
                      type="number"
                      min={1}
                      style={{ fontSize: '18px', fontWeight: 'bold' }}
                      saveStatus={saveStatus}
                    />
                    x
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Total Hours */}
          {totalHours > 0 && (
            <div
              style={{
                marginTop: '20px',
                textAlign: 'right',
                paddingRight: '45px',
              }}
            >
              <p
                style={{
                  fontSize: '15px',
                  color: textColor,
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: '300',
                  opacity: 0.6,
                  lineHeight: '1.56',
                }}
              >
                Total Horas de Trabalho: <span style={{ fontWeight: '500' }}>
                  <InlineEditor
                    value={totalHours.toString()}
                    onChange={(newValue) => {
                      onDataChange?.({
                        paymentInfo: {
                          ...data.paymentInfo,
                          totalHours: Number(newValue),
                        },
                      });
                    }}
                    editable={editable}
                    type="number"
                    min={0}
                    style={{ fontSize: '15px', fontWeight: '500' }}
                    saveStatus={saveStatus}
                  />h
                </span>
              </p>
            </div>
          )}

          {/* Observations */}
          {data.observations && (
            <div
              style={{
                marginTop: '20px',
                fontSize: '11px',
                color: textColor,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '300',
                opacity: 0.5,
                lineHeight: '1.25',
                textAlign: 'center',
              }}
            >
              *<InlineEditor
                value={data.observations}
                onChange={(newObs) => onDataChange?.({ observations: String(newObs) })}
                editable={editable}
                type="textarea"
                multiline
                style={{ fontSize: '11px', opacity: 0.5 }}
                saveStatus={saveStatus}
              />
            </div>
          )}
        </div>

        {/* Footer with Investment, Total, Signatures, and Payment Info */}
        <div
          className="mt-12 pt-8"
          style={{
            borderTop: `2px solid ${secondaryTextColor}`,
            marginTop: '80px',
            paddingTop: '48px',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Signatures */}
            <div className="md:col-span-2">
              {signatures.length > 0 ? (
                <div className={`signatures-grid grid gap-8 ${signatures.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={signatures.length === 1 ? { maxWidth: '50%', margin: '0 auto' } : {}}>
                  {signatures.map((sig: Signature, index: number) => (
                    <div key={index}>
                      <div className="mb-1" style={{ textAlign: 'center', marginBottom: '-40px' }}>
                        <InlineEditor
                          value={sig.name}
                          onChange={(newName) => {
                            const updatedSignatures = [...signatures];
                            updatedSignatures[index] = { ...sig, name: String(newName) };
                            onDataChange?.({ signatures: updatedSignatures });
                          }}
                          editable={editable}
                          style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: "'Dancing Script', cursive", color: textColor }}
                          saveStatus={saveStatus}
                        />
                      </div>
                      <div
                        className="mt-8 mb-2"
                        style={{
                          borderTop: `1px solid ${secondaryTextColor}`,
                          marginTop: '48px',
                          marginBottom: '12px',
                        }}
                      />
                      <p
                        style={{
                          fontSize: '11px',
                          color: textColor,
                          fontFamily: "'Manrope', sans-serif",
                          fontWeight: '300',
                          fontStyle: 'italic',
                          textAlign: 'center',
                          lineHeight: '1.56',
                        }}
                      >
                        <InlineEditor
                          value={sig.role}
                          onChange={(newRole) => {
                            const updatedSignatures = [...signatures];
                            updatedSignatures[index] = { ...sig, role: String(newRole) };
                            onDataChange?.({ signatures: updatedSignatures });
                          }}
                          editable={editable}
                          style={{ fontSize: '11px', fontStyle: 'italic', fontWeight: '300' }}
                          saveStatus={saveStatus}
                        />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p
                      className="mb-1"
                      style={{
                        fontSize: '30px',
                        color: textColor,
                        fontFamily: "'Dancing Script', cursive",
                        fontWeight: 'bold',
                        textAlign: 'center',
                        marginBottom: '-40px',
                      }}
                    >
                      Pedro Xavier
                    </p>
                    <div
                      className="mt-8 mb-2"
                      style={{
                        borderTop: `1px solid ${secondaryTextColor}`,
                        marginTop: '48px',
                        marginBottom: '12px',
                      }}
                    />
                    <p
                      style={{
                        fontSize: '11px',
                        color: textColor,
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: '300',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        lineHeight: '1.56',
                      }}
                    >
                      Designer / Diretor
                    </p>
                  </div>
                  <div>
                    <p
                      className="mb-1"
                      style={{
                        fontSize: '30px',
                        color: textColor,
                        fontFamily: "'Dancing Script', cursive",
                        fontWeight: 'bold',
                        textAlign: 'center',
                        marginBottom: '-40px',
                      }}
                    >
                      Pedro Jaques
                    </p>
                    <div
                      className="mt-8 mb-2"
                      style={{
                        borderTop: `1px solid ${secondaryTextColor}`,
                        marginTop: '48px',
                        marginBottom: '12px',
                      }}
                    />
                    <p
                      style={{
                        fontSize: '11px',
                        color: textColor,
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: '300',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        lineHeight: '1.56',
                      }}
                    >
                      Designer / Diretor
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Investment */}
            <div className="investment-section text-right">
              {totalHours > 0 && hourlyRate > 0 && (
                <div className="mb-4">
                  <p
                    style={{
                      fontSize: '16px',
                      color: textColor,
                      fontFamily: "'Manrope', sans-serif",
                      fontWeight: 'normal',
                      lineHeight: '1.56',
                    }}
                  >
                    Investimento:
                  </p>
                  <div
                    style={{
                      fontSize: '16px',
                      color: textColor,
                      fontFamily: "'Manrope', sans-serif",
                      lineHeight: '1.56',
                      textAlign: 'right',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        border: `1px solid ${accentColor}`,
                        borderRadius: 'var(--radius)',
                        padding: '4px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '16px',
                      }}
                    >
                      <InlineEditor
                        value={totalHours.toString()}
                        onChange={(newValue) => {
                          onDataChange?.({
                            paymentInfo: {
                              ...data.paymentInfo,
                              totalHours: Number(newValue),
                            },
                          });
                        }}
                        editable={editable}
                        type="number"
                        min={0}
                        style={{ fontSize: '16px', textAlign: 'center' }}
                        saveStatus={saveStatus}
                      />h
                    </span>
                    <span
                      style={{
                        border: `1px solid ${accentColor}`,
                        borderRadius: 'var(--radius)',
                        padding: '4px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '16px',
                      }}
                    >
                      <span style={{ fontSize: '12px', marginRight: '2px' }}>R$</span>
                      <InlineEditor
                        value={hourlyRate.toString()}
                        onChange={(newValue) => {
                          onDataChange?.({
                            paymentInfo: {
                              ...data.paymentInfo,
                              hourlyRate: Number(newValue),
                            },
                          });
                        }}
                        editable={editable}
                        type="number"
                        min={0}
                        style={{ fontSize: '16px', textAlign: 'center' }}
                        saveStatus={saveStatus}
                      />/h
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Total Banner with Arrow */}
          <div className="mt-8 flex justify-end">
            <div
              className="relative inline-block"
              style={{
                backgroundColor: accentColor,
                clipPath: 'polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%)',
                padding: '16px 32px',
              }}
            >
              <div className="flex items-center gap-2">
                <p
                  className="font-bold text-white"
                  style={{
                    fontSize: '16.069px',
                    fontFamily: "'Manrope', sans-serif",
                    lineHeight: '1.56',
                  }}
                >
                  TOTAL: R$<span style={{ fontSize: '22px' }}>{formatCurrency(finalTotal)}</span>
                </p>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div
            className="mt-8"
            style={{
              marginTop: '40px',
              textAlign: 'right',
              paddingLeft: '45px',
            }}
          >
            <InlineEditor
              value={paymentTerms}
              onChange={(newValue) => {
                onDataChange?.({
                  paymentInfo: {
                    ...data.paymentInfo,
                    paymentTerms: String(newValue),
                  },
                });
              }}
              editable={editable}
              style={{
                fontSize: '11px',
                color: textColor,
                fontFamily: "'Manrope', sans-serif",
                fontWeight: '300',
                lineHeight: '2',
                textAlign: 'right',
                letterSpacing: '0.11px',
              }}
              saveStatus={saveStatus}
            />
          </div>
        </div>

        {/* Footer with PIX and Discount */}
        <div
          className="mt-12 pt-6"
          style={{
            borderTop: `1px solid ${secondaryTextColor}`,
            marginTop: '48px',
            paddingTop: '24px',
          }}
        >
          <div className="footer-grid grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: '16px',
                  color: textColor,
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 'bold',
                }}
              >
                PIX: <InlineEditor
                  value={pixKey || '00000000000'}
                  onChange={(newKey) => {
                    onDataChange?.({
                      paymentInfo: {
                        ...data.paymentInfo,
                        pixKey: String(newKey),
                      },
                    });
                  }}
                  editable={editable}
                  style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.16px', fontFamily: "'Manrope', sans-serif" }}
                  saveStatus={saveStatus}
                />
              </p>
            </div>
            <div className="text-right">
              {discountPercent > 0 && (
                <p
                  style={{
                    fontSize: '16px',
                    color: textColor,
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: '300',
                    lineHeight: '1.56',
                    textAlign: 'center',
                  }}
                >
                  <span>Desconto de </span>
                  <span style={{ fontWeight: 'bold' }}>{discountPercent}%</span>
                  <span> à vista no PIX! </span>
                  <span style={{ fontSize: '16px' }}>(</span>
                  <span style={{ fontSize: '9px' }}>R$</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(finalWithDiscount)}</span>
                  <span style={{ fontSize: '16px' }}>)</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Line */}
        <div
          style={{
            position: 'relative',
            marginTop: '40px',
          }}
        >
          <div
            style={{
              height: '6px',
              backgroundColor: accentColor,
            }}
          />
        </div>
      </div>
    </div>
  );
};

