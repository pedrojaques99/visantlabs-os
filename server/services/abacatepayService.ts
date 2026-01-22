import AbacatePayModule from 'abacatepay-nodejs-sdk';
import { getCreditPackage, getAbacateBillId, getCreditsByAmount } from '../../src/utils/creditPackages.js';
import { ObjectId } from 'mongodb';
import { sendCreditsPurchasedEmail, isEmailConfigured } from './emailService.js';
import { validateSafeId } from '../utils/securityValidation.js';

// Support both ABACATEPAY_API_KEY and ABACATE_API_KEY for compatibility
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY || process.env.ABACATE_API_KEY || '';

if (!ABACATEPAY_API_KEY) {
  console.warn('⚠️ ABACATEPAY_API_KEY or ABACATE_API_KEY is not configured. AbacatePay functionality will not work.');
}

// The SDK exports the function as default, handle both CommonJS and ES module formats
const AbacatePay = (AbacatePayModule as any).default || AbacatePayModule;

// Initialize AbacatePay SDK
let abacate: any = null;
if (ABACATEPAY_API_KEY && AbacatePay) {
  try {
    abacate = AbacatePay(ABACATEPAY_API_KEY);
    console.log('✅ AbacatePay SDK initialized:', {
      hasBilling: !!abacate?.billing,
      hasPixQrCode: !!abacate?.pixQrCode,
      sdkKeys: abacate ? Object.keys(abacate) : [],
    });
  } catch (initError: any) {
    console.error('❌ Failed to initialize AbacatePay SDK:', initError);
    abacate = null;
  }
} else {
  console.warn('⚠️ ABACATEPAY_API_KEY/ABACATE_API_KEY or AbacatePay SDK not available');
}

// Helper function to get AbacatePay product ID from environment variables
const getAbacateProductId = (credits: number): string | null => {
  const envKey = `ABACATE_PRODUCT_${credits}`;
  return process.env[envKey] || null;
};

export interface CreateAbacatePaymentRequest {
  credits: number;
  amount: number; // in cents
  customerEmail: string;
  customerName?: string;
  customerCellphone?: string;
  customerTaxId?: string;
  userId: string;
}

export interface AbacatePaymentResponse {
  id: string;
  url: string;
  amount: number;
  status: string;
  methods: string[];
  qrCode?: string;
  pixCode?: string;
  expiresAt?: string;
}

export const abacatepayService = {
  /**
   * Check if AbacatePay is configured
   */
  isConfigured(): boolean {
    return !!abacate && !!ABACATEPAY_API_KEY;
  },

  /**
   * Create a PIX payment using AbacatePay
   */
  async createPayment(data: CreateAbacatePaymentRequest): Promise<AbacatePaymentResponse> {
    if (!abacate) {
      throw new Error('AbacatePay is not configured. Please set ABACATEPAY_API_KEY in your environment variables.');
    }

    // Verify SDK is properly initialized
    if (!abacate.billing || typeof abacate.billing.create !== 'function') {
      console.error('❌ AbacatePay SDK billing API not available:', {
        hasAbacate: !!abacate,
        hasBilling: !!abacate.billing,
        hasCreate: !!abacate.billing?.create,
        abacateKeys: abacate ? Object.keys(abacate) : [],
      });
      throw new Error('AbacatePay SDK billing API is not available. Please check SDK initialization.');
    }

    // Helper function to get the first valid frontend URL (handles comma-separated URLs)
    const getFrontendUrl = (): string => {
      const rawUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const urls = rawUrl.split(',').map(url => url.trim()).filter(url => url.length > 0);
      const firstUrl = urls[0] || 'http://localhost:3000';

      try {
        const url = new URL(firstUrl);
        return url.toString().replace(/\/+$/, '');
      } catch (error) {
        console.warn('⚠️ Invalid FRONTEND_URL format, using default:', firstUrl);
        return 'http://localhost:3000';
      }
    };

    const normalizedFrontendUrl = getFrontendUrl();

    // Get credit package to ensure we use the correct price (supports coupons)
    const creditPackage = getCreditPackage(data.credits);
    if (!creditPackage) {
      throw new Error(`Credit package not found for ${data.credits} credits`);
    }

    // Get AbacatePay product ID from environment or credit package
    const abacateProductId = getAbacateProductId(data.credits) || creditPackage.abacateProductId;

    // Use the package price (in cents) - this ensures correct credit calculation even with coupons
    // The amount passed should be the full package price, not the discounted amount
    const packagePriceInCents = Math.round(creditPackage.price.BRL * 100);

    try {
      // Build products array - use product ID if available, otherwise create inline
      const products: any[] = [];

      if (abacateProductId) {
        // Use existing product from AbacatePay
        products.push({
          productId: abacateProductId,
          quantity: 1,
        });
      } else {
        // Fallback: create product inline
        products.push({
          externalId: `CREDITS-${data.credits}`,
          name: `${data.credits} Credits`,
          quantity: 1,
          price: packagePriceInCents,
        });
      }

      // Build customer object - according to AbacatePay docs, if we send customer object,
      // ALL fields (name, email, cellphone, taxId) are required
      // So we only include customer if we have all required fields
      const customerData: any = {};
      if (data.customerName && data.customerEmail && data.customerTaxId) {
        customerData.customer = {
          name: data.customerName,
          email: data.customerEmail,
          cellphone: data.customerCellphone || '',
          taxId: data.customerTaxId.replace(/\D/g, ''), // Remove formatting, keep only numbers
        };
      } else if (data.customerEmail) {
        // If we don't have all fields, at least send email for identification
        // But AbacatePay requires all fields if customer object is sent, so we'll skip it
        console.warn('⚠️ Missing required customer fields. Skipping customer object.');
      }

      // Log request data for debugging
      const billingRequest: any = {
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products,
        returnUrl: `${normalizedFrontendUrl}/pricing`,
        completionUrl: `${normalizedFrontendUrl}/pricing?success=true&bill_id={BILL_ID}`,
        metadata: {
          userId: data.userId,
          credits: data.credits.toString(),
          type: 'credit_purchase',
          packagePrice: packagePriceInCents.toString(),
        },
      };

      // Only add customer if we have all required fields
      if (customerData.customer) {
        billingRequest.customer = customerData.customer;
      }

      console.log('📤 AbacatePay billing request:', JSON.stringify(billingRequest, null, 2));
      console.log('🔑 AbacatePay API Key configured:', !!ABACATEPAY_API_KEY, ABACATEPAY_API_KEY ? `${ABACATEPAY_API_KEY.substring(0, 10)}...` : 'NOT SET');

      let billing;
      try {
        console.log('📞 Calling abacate.billing.create()...');
        console.log('🔍 SDK methods available:', {
          hasBilling: !!abacate.billing,
          billingMethods: abacate.billing ? Object.keys(abacate.billing) : [],
          hasCreate: typeof abacate.billing?.create === 'function',
          hasCreateLink: typeof abacate.billing?.createLink === 'function',
        });

        // Try to wrap the call to catch any potential issues
        // Wrap in a try-catch to handle both sync and async errors
        let createPromise: Promise<any>;
        try {
          createPromise = Promise.resolve(abacate.billing.create(billingRequest));
        } catch (syncError: any) {
          console.error('❌ Synchronous error calling abacate.billing.create():', syncError);
          throw new Error(`AbacatePay SDK error: ${syncError?.message || 'Unknown synchronous error'}`);
        }

        // Add timeout to detect if the promise hangs
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbacatePay API call timed out after 30 seconds')), 30000);
        });

        billing = await Promise.race([createPromise, timeoutPromise]);
        console.log('📥 Received response from abacate.billing.create()');

        // According to AbacatePay documentation, responses follow this structure:
        // { data: {...}, error: null } for success
        // { data: null, error: {...} } for errors
        // Let's check the response structure first
        console.log('🔍 Response structure check:', {
          type: typeof billing,
          isNull: billing === null,
          isUndefined: billing === undefined,
          hasData: 'data' in (billing || {}),
          hasError: 'error' in (billing || {}),
          dataValue: billing?.data,
          errorValue: billing?.error,
          ownKeys: Object.keys(billing || {}),
          stringified: JSON.stringify(billing),
        });

        // Check if response follows AbacatePay's documented structure
        if (billing && typeof billing === 'object') {
          // Deep inspection of the response object
          const responseKeys = Object.keys(billing);
          const allPropertyNames = Object.getOwnPropertyNames(billing);
          const descriptors = Object.getOwnPropertyDescriptors(billing);

          console.log('🔍 Deep response inspection:', {
            responseKeys,
            allPropertyNames,
            descriptors: Object.keys(descriptors).reduce((acc, key) => {
              const desc = descriptors[key];
              acc[key] = {
                enumerable: desc.enumerable,
                configurable: desc.configurable,
                writable: desc.writable,
                hasGetter: !!desc.get,
                hasSetter: !!desc.set,
                value: desc.value,
                valueType: typeof desc.value,
              };
              return acc;
            }, {} as any),
            errorProperty: billing.error,
            errorType: typeof billing.error,
            errorIsNull: billing.error === null,
            errorIsUndefined: billing.error === undefined,
            hasData: 'data' in billing,
            dataValue: billing.data,
          });

          // Check if response has only 'error' property with undefined value
          // This indicates the SDK returned an error object but didn't populate it
          // This MUST be checked BEFORE we check for error !== null/undefined
          if (responseKeys.length === 1 && responseKeys[0] === 'error' && billing.error === undefined) {
            console.error('❌ AbacatePay SDK returned error object with undefined error property');
            console.error('❌ This usually indicates:');
            console.error('   1. API authentication issue (check API key)');
            console.error('   2. Invalid request format (check customer fields)');
            console.error('   3. SDK version incompatibility');
            console.error('❌ Request details:', {
              hasCustomer: !!billingRequest.customer,
              customerFields: billingRequest.customer ? Object.keys(billingRequest.customer) : [],
              productId: products[0]?.productId || 'inline product',
              apiKeyPrefix: ABACATEPAY_API_KEY.substring(0, 10),
            });
            console.error('❌ Response object:', billing);

            // Try createLink as fallback before throwing
            if (abacate.billing?.createLink) {
              console.log('🔄 Attempting fallback with createLink...');
              try {
                const linkResponse = await abacate.billing.createLink(billingRequest);
                console.log('📦 createLink response type:', typeof linkResponse);
                console.log('📦 createLink response:', linkResponse);

                // Handle response structure
                if (linkResponse && typeof linkResponse === 'object') {
                  if ('error' in linkResponse) {
                    if (linkResponse.error !== null && linkResponse.error !== undefined) {
                      throw new Error(`AbacatePay createLink error: ${typeof linkResponse.error === 'string' ? linkResponse.error : JSON.stringify(linkResponse.error)}`);
                    }
                    if (linkResponse.data) {
                      billing = linkResponse.data;
                      console.log('✅ Successfully created billing using createLink fallback');
                      // Break out of error handling and continue with billing data
                    } else {
                      throw new Error('createLink also returned invalid response');
                    }
                  } else if (!('error' in linkResponse)) {
                    // Direct response without error wrapper
                    billing = linkResponse;
                    console.log('✅ Successfully created billing using createLink fallback (direct)');
                  } else {
                    throw new Error('createLink returned unexpected response structure');
                  }
                } else {
                  throw new Error('createLink returned non-object response');
                }
              } catch (linkError: any) {
                console.error('❌ createLink fallback also failed:', linkError);

                // Try SDK's pixQrCode method as another fallback
                if (abacate.pixQrCode && typeof abacate.pixQrCode === 'function') {
                  console.log('🔄 Attempting SDK pixQrCode method as fallback...');
                  try {
                    const pixQrCodeRequest: any = {
                      amount: packagePriceInCents,
                      expiresIn: 3600,
                      description: `${data.credits} Credits`,
                      metadata: {
                        userId: data.userId,
                        credits: data.credits.toString(),
                        type: 'credit_purchase',
                        packagePrice: packagePriceInCents.toString(),
                        externalId: `CREDITS-${data.credits}-${data.userId}`,
                      },
                    };

                    // Only add customer if we have all required fields
                    if (data.customerName && data.customerEmail && data.customerTaxId) {
                      pixQrCodeRequest.customer = {
                        name: data.customerName,
                        email: data.customerEmail,
                        cellphone: data.customerCellphone || '',
                        taxId: data.customerTaxId.replace(/\D/g, ''),
                      };
                    }

                    const pixQrCodeResponse = await abacate.pixQrCode(pixQrCodeRequest);
                    console.log('📦 SDK pixQrCode response:', pixQrCodeResponse);

                    // Handle response structure
                    if (pixQrCodeResponse && typeof pixQrCodeResponse === 'object') {
                      let pixData = pixQrCodeResponse;
                      if ('error' in pixQrCodeResponse) {
                        if (pixQrCodeResponse.error !== null && pixQrCodeResponse.error !== undefined) {
                          throw new Error(`AbacatePay pixQrCode error: ${typeof pixQrCodeResponse.error === 'string' ? pixQrCodeResponse.error : JSON.stringify(pixQrCodeResponse.error)}`);
                        }
                        if (pixQrCodeResponse.data) {
                          pixData = pixQrCodeResponse.data;
                        }
                      }

                      // Convert to billing-like format
                      billing = {
                        id: pixData.id,
                        url: `https://www.abacatepay.com/pay/${pixData.id}`,
                        amount: pixData.amount,
                        status: pixData.status || 'PENDING',
                        methods: ['PIX'],
                        qrCode: pixData.brCodeBase64 || pixData.qrCode,
                        pixCode: pixData.brCode || pixData.code,
                        expiresAt: pixData.expiresAt,
                      };
                      console.log('✅ Successfully created PIX QRCode using SDK pixQrCode method');
                    }
                  } catch (pixSdkError: any) {
                    console.error('❌ SDK pixQrCode method also failed:', pixSdkError);
                  }
                }
              }
            }

            // If fallback didn't work, try direct PIX QRCode endpoint as final fallback (simpler, doesn't require billing)
            if (!billing || (typeof billing === 'object' && Object.keys(billing).length === 1 && billing.error === undefined)) {
              console.log('🔄 Attempting direct PIX QRCode endpoint as final fallback...');
              try {
                // Use global fetch (available in Node.js 18+)
                const pixQrCodeUrl = 'https://api.abacatepay.com/v1/pixQrCode/create';

                // Build PIX QRCode request (simpler format)
                const pixQrCodeRequest: any = {
                  amount: packagePriceInCents,
                  expiresIn: 3600, // 1 hour default
                  description: `${data.credits} Credits`,
                  metadata: {
                    userId: data.userId,
                    credits: data.credits.toString(),
                    type: 'credit_purchase',
                    packagePrice: packagePriceInCents.toString(),
                    externalId: `CREDITS-${data.credits}-${data.userId}`,
                  },
                };

                // Only add customer if we have all required fields
                if (data.customerName && data.customerEmail && data.customerTaxId) {
                  pixQrCodeRequest.customer = {
                    name: data.customerName,
                    email: data.customerEmail,
                    cellphone: data.customerCellphone || '',
                    taxId: data.customerTaxId.replace(/\D/g, ''),
                  };
                }

                console.log('📤 Direct PIX QRCode request:', JSON.stringify(pixQrCodeRequest, null, 2));

                const pixResponse = await fetch(pixQrCodeUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
                  },
                  body: JSON.stringify(pixQrCodeRequest),
                });

                const pixResponseData = await pixResponse.json();
                console.log('📡 Direct PIX QRCode response status:', pixResponse.status);
                console.log('📡 Direct PIX QRCode response:', pixResponseData);

                if (pixResponse.ok && pixResponseData && pixResponseData.data) {
                  // Convert PIX QRCode response to billing-like format for compatibility
                  const pixData = pixResponseData.data;
                  billing = {
                    id: pixData.id,
                    url: `https://www.abacatepay.com/pay/${pixData.id}`,
                    amount: pixData.amount,
                    status: pixData.status || 'PENDING',
                    methods: ['PIX'],
                    qrCode: pixData.brCodeBase64 || pixData.qrCode,
                    pixCode: pixData.brCode || pixData.code,
                    expiresAt: pixData.expiresAt,
                  };
                  console.log('✅ Successfully created PIX QRCode using direct endpoint');
                } else {
                  console.error('❌ Direct PIX QRCode endpoint also failed:', {
                    status: pixResponse.status,
                    statusText: pixResponse.statusText,
                    data: pixResponseData,
                  });
                }
              } catch (pixError: any) {
                console.error('❌ Direct PIX QRCode endpoint failed:', pixError);
              }
            }

            // If we still don't have valid billing, throw detailed error
            if (!billing || (typeof billing === 'object' && Object.keys(billing).length === 1 && billing.error === undefined)) {
              const customerEmail = billingRequest.customer?.email || data.customerEmail || 'N/A';
              const errorMessage = 'AbacatePay SDK returned an error response with no error details. ' +
                'This typically indicates:\n' +
                '1. Invalid or expired API key (verify in AbacatePay dashboard)\n' +
                '2. Product ID does not exist or is incorrect in your AbacatePay dashboard\n' +
                '3. Missing required customer fields (name, email, taxId are all required)\n' +
                '4. API endpoint is unreachable or returning unexpected response\n' +
                '5. SDK version incompatibility or bug\n' +
                '6. Account permissions issue (check AbacatePay dashboard)\n\n' +
                `API Key prefix: ${ABACATEPAY_API_KEY.substring(0, 10)}...\n` +
                `API Key length: ${ABACATEPAY_API_KEY.length}\n` +
                `Product ID: ${products[0]?.productId || 'N/A'}\n` +
                `Customer Email: ${customerEmail}\n` +
                `Has Customer Object: ${!!billingRequest.customer}\n` +
                `Customer Fields: ${billingRequest.customer ? Object.keys(billingRequest.customer).join(', ') : 'none'}\n` +
                `Amount: ${packagePriceInCents} cents (${packagePriceInCents / 100} BRL)\n\n` +
                `Troubleshooting:\n` +
                `- Check AbacatePay dashboard for API key status\n` +
                `- Verify product ID exists and is active\n` +
                `- Ensure all customer fields (name, email, taxId) are provided\n` +
                `- Check if your account has billing permissions\n` +
                `- Try regenerating your API key`;

              throw new Error(errorMessage);
            }
          }

          // Check for error in the response (according to docs, error can be null or an object)
          if (billing.error !== null && billing.error !== undefined) {
            const errorInfo = billing.error;
            console.error('❌ AbacatePay API returned an error:', {
              error: errorInfo,
              errorType: typeof errorInfo,
              errorString: typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo),
              hasData: !!billing.data,
              fullResponse: billing,
            });

            // Extract error message
            let errorMessage = 'AbacatePay API error';
            if (typeof errorInfo === 'string') {
              errorMessage = errorInfo;
            } else if (errorInfo && typeof errorInfo === 'object') {
              errorMessage = errorInfo.message || errorInfo.error || JSON.stringify(errorInfo);
            }

            throw new Error(`AbacatePay API error: ${errorMessage}`);
          }

          // Extract data from response (according to docs, data contains the actual response)
          if (billing.data !== null && billing.data !== undefined) {
            billing = billing.data; // Use the data property as the actual response
            console.log('✅ Extracted data from AbacatePay response structure');
          } else if (billing.error === null && !billing.data) {
            // If error is explicitly null but no data, this might be an issue
            console.warn('⚠️ AbacatePay response has error: null but no data property');
          }
        }

        // Additional check for Error instances
        if (billing instanceof Error) {
          console.error('❌ AbacatePay SDK returned Error instance:', {
            message: billing.message,
            name: billing.name,
            stack: billing.stack,
          });
          throw billing;
        }
      } catch (createError: any) {
        console.error('❌ AbacatePay billing.create() error:', createError);
        console.error('❌ Error details:', {
          message: createError?.message,
          stack: createError?.stack,
          response: createError?.response,
          data: createError?.data,
          error: createError?.error,
          code: createError?.code,
          statusCode: createError?.statusCode,
        });

        // If error has a message, throw it; otherwise provide a more helpful message
        if (createError?.message) {
          throw createError;
        } else {
          throw new Error(`AbacatePay API error: ${JSON.stringify(createError)}`);
        }
      }

      // Log full response for debugging (after extracting data if needed)
      console.log('📦 AbacatePay billing response type:', typeof billing);
      console.log('📦 AbacatePay billing response:', billing);

      // Try to stringify, but handle circular references
      let stringifiedResponse: string;
      try {
        stringifiedResponse = JSON.stringify(billing, null, 2);
        console.log('📦 AbacatePay billing response (stringified):', stringifiedResponse);
      } catch (stringifyError) {
        console.log('📦 AbacatePay billing response (could not stringify):', billing);
        stringifiedResponse = '';
      }

      // Check if response is empty or invalid
      if (!billing) {
        console.error('❌ AbacatePay returned null/undefined response');
        throw new Error('AbacatePay returned an empty response. Please check your API key and configuration.');
      }

      // Check if response is an empty object or has only error: undefined
      const responseKeys = Object.keys(billing);
      const hasOnlyErrorUndefined = responseKeys.length === 1 &&
        responseKeys[0] === 'error' &&
        billing.error === undefined;
      const isEmptyObject = responseKeys.length === 0 || stringifiedResponse === '{}';

      if (isEmptyObject || hasOnlyErrorUndefined) {
        console.error('❌ AbacatePay returned invalid response:', {
          responseKeys,
          isEmptyObject,
          hasOnlyErrorUndefined,
          stringified: stringifiedResponse,
          request: {
            productId: products[0]?.productId,
            customerEmail: billingRequest.customer.email,
            amount: packagePriceInCents,
            methods: billingRequest.methods,
          },
        });

        // Try createLink as fallback if create failed
        if (abacate.billing?.createLink && !hasOnlyErrorUndefined) {
          console.log('🔄 Trying createLink as fallback...');
          try {
            const linkResponse = await abacate.billing.createLink(billingRequest);
            console.log('📦 createLink response:', linkResponse);

            // Handle response structure
            if (linkResponse && typeof linkResponse === 'object' && 'error' in linkResponse) {
              if (linkResponse.error !== null && linkResponse.error !== undefined) {
                throw new Error(`AbacatePay createLink error: ${typeof linkResponse.error === 'string' ? linkResponse.error : JSON.stringify(linkResponse.error)}`);
              }
              if (linkResponse.data) {
                billing = linkResponse.data;
                console.log('✅ Successfully created billing using createLink');
              }
            } else if (linkResponse && !('error' in linkResponse)) {
              billing = linkResponse;
              console.log('✅ Successfully created billing using createLink (direct response)');
            }
          } catch (linkError: any) {
            console.error('❌ createLink also failed:', linkError);
            // Continue with original error
          }
        }

        // If we still don't have valid billing data, throw error
        const finalResponseKeys = billing ? Object.keys(billing) : [];
        const finalStringified = billing ? JSON.stringify(billing) : '{}';
        if (!billing || finalResponseKeys.length === 0 || finalStringified === '{}' ||
          (finalResponseKeys.length === 1 && finalResponseKeys[0] === 'error' && billing.error === undefined)) {
          // Validate API key format (AbacatePay keys typically start with abc_)
          const apiKeyPrefix = ABACATEPAY_API_KEY.substring(0, 4);
          const apiKeyValidFormat = ABACATEPAY_API_KEY.startsWith('abc_');

          let errorMessage = 'AbacatePay API returned an invalid response. Please verify:\n';
          if (!apiKeyValidFormat) {
            errorMessage += `⚠️ Invalid API key format (expected to start with 'abc_', got '${apiKeyPrefix}...')\n`;
          }
          errorMessage += '1. Your API key is correct and active (check ABACATEPAY_API_KEY or ABACATEPAY_API_KEY)\n' +
            '2. The product ID exists in your AbacatePay dashboard\n' +
            '3. Your network connection is working\n' +
            '4. Check AbacatePay dashboard for any account issues\n' +
            `5. Verify the product ID is correct: ${products[0]?.productId || 'N/A'}\n` +
            '6. Check if your AbacatePay account is active and has proper permissions';

          throw new Error(errorMessage);
        }
      }

      // Try to extract billing ID from various possible locations
      const possibleIdPaths = [
        billing?.id,
        billing?.data?.id,
        billing?.billing?.id,
        billing?.result?.id,
        billing?.response?.id,
        billing?.body?.id,
      ].filter(Boolean);

      console.log('✅ AbacatePay billing created:', {
        id: billing?.id || billing?.data?.id,
        amount: billing?.amount || billing?.data?.amount,
        status: billing?.status || billing?.data?.status,
        url: billing?.url || billing?.data?.url,
        hasData: !!billing?.data,
        keys: Object.keys(billing || {}),
        possibleIds: possibleIdPaths,
      });

      // Extract PIX details from the billing response
      // Handle both direct response and nested data structure
      // Try multiple possible structures
      const billingData = billing?.data || billing?.billing || billing?.result || billing?.response || billing?.body || billing;
      const billingId = billingData?.id || billing?.id || possibleIdPaths[0];

      console.log('🔍 Extracting billing data:', {
        hasBilling: !!billing,
        hasBillingData: !!billingData,
        billingId,
        billingKeys: billing ? Object.keys(billing) : [],
        billingDataKeys: billingData ? Object.keys(billingData) : [],
        billingDataType: typeof billingData,
      });

      if (!billingId) {
        console.error('❌ No billing ID found in response');
        console.error('❌ Full response structure:', {
          type: typeof billing,
          isArray: Array.isArray(billing),
          keys: billing ? Object.keys(billing) : [],
          sample: billing ? JSON.stringify(billing, null, 2).substring(0, 500) : 'null',
        });
        throw new Error('AbacatePay did not return a valid billing ID. Please check the API response structure.');
      }

      let qrCode: string | undefined;
      let pixCode: string | undefined;
      let expiresAt: string | undefined;

      // Check multiple possible locations for PIX details
      console.log('🔍 Searching for PIX details...');

      // First, check if qrCode and pixCode are directly in billing object (from direct endpoint fallback)
      if (billing?.qrCode) {
        qrCode = billing.qrCode;
        console.log('✅ Found qrCode directly in billing object');
      }
      if (billing?.pixCode) {
        pixCode = billing.pixCode;
        console.log('✅ Found pixCode directly in billing object');
      }

      // Try different response structures
      if (billingData?.paymentMethod?.pix) {
        if (!qrCode) qrCode = billingData.paymentMethod.pix.qrCode;
        if (!pixCode) pixCode = billingData.paymentMethod.pix.code;
        console.log('✅ Found PIX in paymentMethod.pix');
      } else if (billingData?.pix) {
        if (!qrCode) qrCode = billingData.pix.qrCode || billingData.pix.qrcode;
        if (!pixCode) pixCode = billingData.pix.code || billingData.pix.pixCode;
        console.log('✅ Found PIX in billingData.pix');
      } else if (billing?.pix) {
        if (!qrCode) qrCode = billing.pix.qrCode || billing.pix.qrcode;
        if (!pixCode) pixCode = billing.pix.code || billing.pix.pixCode;
        console.log('✅ Found PIX in billing.pix');
      }

      // Also check billingData directly for qrCode and pixCode (from direct endpoint)
      if (!qrCode && billingData?.qrCode) {
        qrCode = billingData.qrCode;
        console.log('✅ Found qrCode in billingData');
      }
      if (!pixCode && billingData?.pixCode) {
        pixCode = billingData.pixCode;
        console.log('✅ Found pixCode in billingData');
      }

      // Also check if there's a separate pixQrCode method (according to docs: POST /pix-qrcode)
      // Try to get QR code if not found in initial response
      if ((!pixCode || !qrCode) && abacate.pixQrCode && billingId) {
        console.log('🔍 QR code not found in initial response, trying pixQrCode method with billingId:', billingId);
        try {
          let qrCodeResponse = await abacate.pixQrCode(billingId);
          console.log('📦 pixQrCode response:', qrCodeResponse);

          // Handle AbacatePay response structure: { data: {...}, error: null }
          if (qrCodeResponse && typeof qrCodeResponse === 'object' && 'error' in qrCodeResponse) {
            if (qrCodeResponse.error !== null && qrCodeResponse.error !== undefined) {
              console.warn('⚠️ AbacatePay pixQrCode returned error:', qrCodeResponse.error);
            } else if (qrCodeResponse.data !== null && qrCodeResponse.data !== undefined) {
              qrCodeResponse = qrCodeResponse.data;
            }
          }

          if (qrCodeResponse) {
            if (!qrCode) {
              qrCode = qrCodeResponse.qrCode || qrCodeResponse.qrcode || qrCodeResponse.brCodeBase64;
            }
            if (!pixCode) {
              pixCode = qrCodeResponse.code || qrCodeResponse.pixCode || qrCodeResponse.pix_code || qrCodeResponse.brCode;
            }
            // Update expiration if provided
            if (qrCodeResponse.expiresAt && !expiresAt) {
              expiresAt = typeof qrCodeResponse.expiresAt === 'string'
                ? qrCodeResponse.expiresAt
                : new Date(qrCodeResponse.expiresAt).toISOString();
            }
            console.log('✅ Got PIX from pixQrCode method:', { hasQrCode: !!qrCode, hasPixCode: !!pixCode });
          }
        } catch (qrError: any) {
          console.warn('⚠️ Could not get PIX QR code via pixQrCode method:', qrError.message);
          console.warn('⚠️ QR code error details:', qrError);
          // Don't throw - we'll try to continue without QR code
        }
      }

      if (!pixCode && !qrCode) {
        console.warn('⚠️ No PIX code or QR code found in response');
      } else {
        console.log('✅ PIX details extracted:', { hasPixCode: !!pixCode, hasQrCode: !!qrCode });
      }

      // Check expiration - default to 1 hour if not provided
      const expiresAtValue = billingData?.expiresAt || billing?.expiresAt;
      if (expiresAtValue) {
        expiresAt = typeof expiresAtValue === 'string'
          ? expiresAtValue
          : new Date(expiresAtValue).toISOString();
      } else {
        // Default expiration: 1 hour from now (PIX payments typically expire in 1 hour)
        const defaultExpiration = new Date();
        defaultExpiration.setHours(defaultExpiration.getHours() + 1);
        expiresAt = defaultExpiration.toISOString();
        console.log('⚠️ No expiration date provided, using default: 1 hour from now');
      }

      // Build response object with all possible data sources
      // Construct payment URL in AbacatePay format: https://www.abacatepay.com/pay/{billId}
      // Sempre usar o billingId retornado pela API (não usar mais abacateBillId estático)
      let paymentUrl: string;
      let billIdForUrl: string | null = null;

      // Usar sempre o billingId retornado pela API como identificador principal
      if (billingId) {
        billIdForUrl = billingId;
      }

      if (billIdForUrl) {
        // Always construct URL in the correct format: https://www.abacatepay.com/pay/{billId}
        paymentUrl = `https://www.abacatepay.com/pay/${billIdForUrl}`;
        console.log('✅ Constructed AbacatePay payment URL:', paymentUrl);
      } else {
        // If no valid billId, try to extract from existing URL if it's already in correct format
        const existingUrl = billingData?.url || billing?.url || billingData?.checkoutUrl || billing?.checkout_url;
        if (existingUrl && existingUrl.includes('abacatepay.com/pay/')) {
          paymentUrl = existingUrl;
        } else {
          console.warn('⚠️ No valid billing ID found for payment URL construction');
          paymentUrl = '';
        }
      }

      const response: AbacatePaymentResponse = {
        id: billingId,
        url: paymentUrl,
        amount: billingData?.amount || billing?.amount || billingData?.total || billing?.total || packagePriceInCents,
        status: (billingData?.status || billing?.status || 'PENDING').toUpperCase(),
        methods: billingData?.methods || billing?.methods || billingData?.paymentMethods || ['PIX'],
        qrCode,
        pixCode,
        expiresAt,
      };

      console.log('✅ Final AbacatePay response:', {
        id: response.id,
        hasUrl: !!response.url,
        amount: response.amount,
        status: response.status,
        hasQrCode: !!response.qrCode,
        hasPixCode: !!response.pixCode,
        hasExpiresAt: !!response.expiresAt,
      });

      return response;
    } catch (error: any) {
      console.error('❌ Error creating AbacatePay payment:', error);
      throw new Error(error.message || 'Failed to create AbacatePay payment');
    }
  },

  /**
   * Get payment status
   */
  async getPaymentStatus(billId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    qrCode?: string;
    pixCode?: string;
    expiresAt?: string;
    paidAt?: string;
  }> {
    if (!abacate) {
      throw new Error('AbacatePay is not configured');
    }

    try {
      // Validate billId format to prevent path traversal/SSRF attacks
      const billIdValidation = validateSafeId(billId);
      if (!billIdValidation.valid) {
        throw new Error(`Invalid bill ID format: ${billIdValidation.error}`);
      }

      // Check if this is a PIX QRCode ID (created via direct endpoint)
      // PIX QRCode IDs start with "pix_char_"
      const isPixQrCodeId = billId.startsWith('pix_char_');

      if (isPixQrCodeId) {
        // Use direct API endpoint to get PIX QRCode status
        console.log('🔍 Detected PIX QRCode ID, using direct endpoint...');
        try {
          const pixQrCodeUrl = `https://api.abacatepay.com/v1/pixQrCode/${encodeURIComponent(billId)}`;
          const pixResponse = await fetch(pixQrCodeUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
            },
          });

          if (pixResponse.ok) {
            const pixResponseData = await pixResponse.json();
            const pixData = pixResponseData.data || pixResponseData;

            console.log('✅ Successfully retrieved PIX QRCode status:', {
              id: pixData.id,
              status: pixData.status,
              hasQrCode: !!pixData.brCodeBase64,
              hasPixCode: !!pixData.brCode,
            });

            return {
              id: pixData.id || billId,
              status: pixData.status || 'PENDING',
              amount: pixData.amount || 0,
              qrCode: pixData.brCodeBase64 || pixData.qrCode,
              pixCode: pixData.brCode || pixData.code || pixData.pixCode,
              expiresAt: pixData.expiresAt
                ? (typeof pixData.expiresAt === 'string' ? pixData.expiresAt : new Date(pixData.expiresAt).toISOString())
                : undefined,
              paidAt: pixData.paidAt
                ? (typeof pixData.paidAt === 'string' ? pixData.paidAt : new Date(pixData.paidAt).toISOString())
                : undefined,
            };
          } else {
            const errorData = await pixResponse.json().catch(() => ({}));
            // Use structured logging to avoid format string vulnerability
            console.warn('⚠️ PIX QRCode not found via direct endpoint:', {
              billId: String(billId),
              status: String(pixResponse.status),
              errorData,
            });
            // Fall through to return expired status
          }
        } catch (pixError: any) {
          // Use structured logging to avoid format string vulnerability
          console.warn('⚠️ Error fetching PIX QRCode status:', {
            error: pixError?.message || String(pixError),
          });
          // Fall through to return expired status
        }
      } else {
        // This is a billing ID, use billing.list() as before
        let listResponse = await abacate.billing.list({ id: billId });

        // Handle AbacatePay response structure: { data: {...}, error: null }
        if (listResponse && typeof listResponse === 'object' && 'error' in listResponse) {
          if (listResponse.error !== null && listResponse.error !== undefined) {
            throw new Error(`AbacatePay API error: ${typeof listResponse.error === 'string' ? listResponse.error : JSON.stringify(listResponse.error)}`);
          }
          // Extract data from response structure
          if (listResponse.data !== null && listResponse.data !== undefined) {
            listResponse = listResponse.data;
          }
        }

        const billings = Array.isArray(listResponse) ? listResponse : (listResponse?.data || [listResponse]).filter(Boolean);
        const billing = billings[0];

        if (billing) {
          let qrCode: string | undefined;
          let pixCode: string | undefined;

          // Try to get PIX details if payment is still pending
          if (billing.status === 'PENDING' || billing.status === 'WAITING_PAYMENT') {
            // Check if PIX details are in the billing object
            if (billing.paymentMethod?.pix) {
              qrCode = billing.paymentMethod.pix.qrCode;
              pixCode = billing.paymentMethod.pix.code;
            }

            // Try pixQrCode method if available (according to docs: POST /pix-qrcode)
            if (!pixCode && abacate.pixQrCode) {
              try {
                let qrCodeResponse = await abacate.pixQrCode(billId);

                // Handle AbacatePay response structure
                if (qrCodeResponse && typeof qrCodeResponse === 'object' && 'error' in qrCodeResponse) {
                  if (qrCodeResponse.error !== null && qrCodeResponse.error !== undefined) {
                    console.warn('⚠️ AbacatePay pixQrCode returned error:', qrCodeResponse.error);
                  } else if (qrCodeResponse.data !== null && qrCodeResponse.data !== undefined) {
                    qrCodeResponse = qrCodeResponse.data;
                  }
                }

                if (qrCodeResponse) {
                  qrCode = qrCodeResponse.qrCode || qrCodeResponse.qrcode;
                  pixCode = qrCodeResponse.code || qrCodeResponse.pixCode || qrCodeResponse.pix_code;
                }
              } catch (qrError: any) {
                console.warn('⚠️ Could not get PIX QR code:', qrError.message);
              }
            }
          }

          return {
            id: billing.id,
            status: billing.status,
            amount: billing.amount,
            qrCode,
            pixCode,
            expiresAt: billing.expiresAt
              ? (typeof billing.expiresAt === 'string' ? billing.expiresAt : new Date(billing.expiresAt).toISOString())
              : undefined,
            paidAt: billing.paidAt
              ? (typeof billing.paidAt === 'string' ? billing.paidAt : new Date(billing.paidAt).toISOString())
              : undefined,
          };
        }
      }

      // If we get here, the payment was not found
      // Use structured logging to avoid format string vulnerability
      console.warn('⚠️ Payment not found - may have expired or been deleted:', {
        billId: String(billId),
      });
      return {
        id: billId,
        status: 'expired',
        amount: 0,
        qrCode: undefined,
        pixCode: undefined,
        expiresAt: undefined,
        paidAt: undefined,
      };
    } catch (error: any) {
      // If it's a "not found" error, return expired status instead of throwing
      if (error.message && error.message.includes('not found')) {
        // Use structured logging to avoid format string vulnerability
        console.warn('⚠️ Payment not found - returning expired status:', {
          billId: String(billId),
        });
        return {
          id: billId,
          status: 'expired',
          amount: 0,
          qrCode: undefined,
          pixCode: undefined,
          expiresAt: undefined,
          paidAt: undefined,
        };
      }
      console.error('❌ Error getting AbacatePay payment status:', error);
      throw new Error(error.message || 'Failed to get payment status');
    }
  },

  /**
   * Process AbacatePay webhook
   */
  async processWebhook(body: any, db: any): Promise<{ success: boolean; message: string }> {
    try {
      const { event, data } = body;

      console.log('📥 AbacatePay webhook received in service:', { event, billId: data?.id });

      if (event === 'billing.paid' || event === 'billing.payment_received') {
        const billId = data?.id;
        if (!billId) {
          return { success: false, message: 'Bill ID is missing' };
        }

        // Validate billId format to prevent NoSQL injection
        const billIdValidation = validateSafeId(billId);
        if (!billIdValidation.valid) {
          return { success: false, message: `Invalid bill ID format: ${billIdValidation.error}` };
        }

        // Find payment in database (billId is now validated)
        let payment = await db.collection('payments').findOne({ billId });

        // Get billing details from AbacatePay to get actual amount paid (supports coupons)
        const billingStatus = await this.getPaymentStatus(billId);

        if (billingStatus.status === 'PAID' || billingStatus.status === 'CONFIRMED') {
          // Extract actual amount paid (in cents) - this handles coupons correctly
          const amountPaidInCents = billingStatus.amount || 0;

          // Use getCreditsByAmount to identify the correct package (supports coupons)
          let credits = 0;

          if (payment && payment.credits) {
            credits = payment.credits;
            console.log('📦 Using credits from payment record:', credits);
          } else {
            credits = getCreditsByAmount(amountPaidInCents, 'BRL');
            console.log('📦 Calculated credits from amount paid:', { amountPaidInCents, credits });
          }

          if (credits <= 0) {
            console.error('❌ Invalid credits amount:', { billId, amountPaidInCents, credits });
            return { success: false, message: 'Invalid credits amount' };
          }

          // Find user - be robust in discovery
          let user = null;
          let userId: ObjectId | null = null;

          // 1. Try metadata from webhook first (most reliable)
          const metadataUserId = data?.metadata?.userId || data?.billing?.metadata?.userId;
          if (metadataUserId) {
            try {
              userId = new ObjectId(metadataUserId);
              user = await db.collection('users').findOne({ _id: userId });
              if (user) console.log('👤 Found user by metadata userId:', metadataUserId);
            } catch (idError) {
              console.warn('⚠️ Invalid userId in metadata:', metadataUserId);
            }
          }

          // 2. Fallback to payment record
          if (!user && payment && payment.userId) {
            userId = payment.userId instanceof ObjectId ? payment.userId : new ObjectId(payment.userId);
            user = await db.collection('users').findOne({ _id: userId });
            if (user) console.log('👤 Found user by payment record userId');
          }

          // 3. Fallback to email from customer data
          const customerEmail = data?.customer?.email || data?.billing?.customer?.email || data?.pixQrCode?.customer?.email;
          if (!user && customerEmail) {
            user = await db.collection('users').findOne({ email: customerEmail });
            if (user) {
              userId = user._id;
              console.log('👤 Found user by email:', customerEmail);
            }
          }

          if (!user || !userId) {
            console.error('❌ User not found for AbacatePay payment:', {
              billId,
              metadataUserId,
              paymentUserId: payment?.userId,
              email: customerEmail
            });
            return { success: false, message: 'User not found' };
          }

          // Get or create abacateCustomerId
          let abacateCustomerId = user.abacateCustomerId;
          if (!abacateCustomerId && data?.customer?.email) {
            abacateCustomerId = data.customer.email;
          }

          // Add credits to user
          const updateResult = await db.collection('users').updateOne(
            { _id: userId },
            {
              $inc: { totalCreditsEarned: credits },
              ...(abacateCustomerId && !user.abacateCustomerId ? { $set: { abacateCustomerId } } : {}),
            }
          );

          if (updateResult.modifiedCount > 0) {
            console.log('✅ Credits added via AbacatePay webhook service:', {
              userId: userId.toString(),
              credits,
              billId,
            });

            // Status update for payment record
            if (!payment) {
              await db.collection('payments').insertOne({
                userId,
                billId,
                provider: 'abacatepay',
                type: 'credit_purchase',
                credits,
                amount: amountPaidInCents,
                currency: 'BRL',
                status: 'paid',
                createdAt: new Date(),
                paidAt: new Date(),
              });
            } else {
              await db.collection('payments').updateOne(
                { billId },
                {
                  $set: {
                    status: 'paid',
                    paidAt: new Date(),
                    updatedAt: new Date(),
                    credits,
                    amount: amountPaidInCents,
                  },
                }
              );
            }

            // Record transaction
            const recordTransaction = async (
              db: any,
              transaction: any
            ) => {
              try {
                const now = new Date();
                const payload = {
                  userId: transaction.userId,
                  type: transaction.type,
                  status: (transaction.status || 'pending'),
                  credits: transaction.credits,
                  amount: transaction.amount ?? 0,
                  currency: (transaction.currency || 'USD').toUpperCase(),
                  description: transaction.description,
                  stripeSessionId: transaction.stripeSessionId,
                  stripePaymentIntentId: transaction.stripePaymentIntentId,
                  stripeCustomerId: transaction.stripeCustomerId,
                  updatedAt: now,
                  createdAt: now,
                };

                await db.collection('transactions').insertOne(payload);
              } catch (transactionError: any) {
                console.error('❌ Failed to record transaction in webhook service:', transactionError.message);
              }
            };

            await recordTransaction(db, {
              userId,
              type: 'purchase',
              status: 'paid',
              credits,
              amount: amountPaidInCents,
              currency: 'BRL',
              description: `Credit package - ${credits} credits (AbacatePay)`,
              stripeSessionId: null,
              stripePaymentIntentId: null,
              stripeCustomerId: null,
            });

            // Send credits purchased email
            try {
              if (isEmailConfigured()) {
                // Get updated user to calculate total credits
                const updatedUser = await db.collection('users').findOne({ _id: userId });
                if (updatedUser) {
                  const currentCredits = (updatedUser.totalCreditsEarned || 0) +
                    Math.max(0, (updatedUser.monthlyCredits || 0) - (updatedUser.creditsUsed || 0));

                  await sendCreditsPurchasedEmail({
                    email: user.email,
                    name: user.name || undefined,
                    credits,
                    totalCredits: currentCredits,
                    amount: amountPaidInCents,
                    currency: 'BRL',
                  });
                  console.log('📧 Credits purchased email sent to:', user.email);
                }
              }
            } catch (emailError) {
              console.error('❌ Error sending credits purchased email:', emailError);
              // Don't fail the webhook processing if email fails
            }

            return { success: true, message: `Successfully credited ${credits} credits to user ${userId}` };
          }
        }
      }

      return { success: true, message: 'Event successfully received but no action required' };
    } catch (error: any) {
      console.error('❌ Error in abacatepayService.processWebhook:', error);
      return { success: false, message: error.message || 'Internal error processing webhook' };
    }
  },
};

