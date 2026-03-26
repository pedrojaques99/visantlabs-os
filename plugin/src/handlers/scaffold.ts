/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

/**
 * Brand info for scaffolding
 */
interface BrandInfo {
  name: string;
  primary: { r: number; g: number; b: number };
  secondary?: { r: number; g: number; b: number };
  background: { r: number; g: number; b: number };
  text: { r: number; g: number; b: number };
  fontFamily: string;
  fontStyle?: string;
}

/**
 * Scaffold agent component library
 */
export async function scaffoldAgentLibrary(brand: BrandInfo) {
  // Load fonts
  const fontFamily = brand.fontFamily || 'Inter';
  const fontStyle = brand.fontStyle || 'Regular';
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    await figma.loadFontAsync({ family: fontFamily, style: 'Bold' });
    await figma.loadFontAsync({ family: fontFamily, style: 'Semi Bold' });
  } catch {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  }

  // Find or create [Agent] Components page
  let agentPage = figma.root.children.find(
    p => p.name.toLowerCase() === '[agent] components'
  );
  if (!agentPage) {
    agentPage = figma.createPage();
    agentPage.name = '[Agent] Components';
  }

  figma.currentPage = agentPage;

  const primary = brand.primary;
  const secondary = brand.secondary || { r: primary.r * 0.8, g: primary.g * 0.8, b: primary.b * 0.8 };
  const background = brand.background;
  const text = brand.text;
  const font = brand.fontFamily || 'Inter';

  let xOffset = 0;
  const SPACING = 100;

  // ═══ PROMOTIONAL POST COMPONENT ═══
  const promoComp = figma.createComponent();
  promoComp.name = '[Component] Post/Promotional';
  promoComp.description = `@agent:intent promotional, sale, discount, offer
@agent:slots title, subtitle, discount, cta
@agent:format instagram-feed, facebook-post`;
  promoComp.resize(1080, 1080);
  promoComp.layoutMode = 'VERTICAL';
  promoComp.primaryAxisAlignItems = 'CENTER';
  promoComp.counterAxisAlignItems = 'CENTER';
  promoComp.itemSpacing = 24;
  promoComp.paddingTop = 100;
  promoComp.paddingBottom = 100;
  promoComp.paddingLeft = 48;
  promoComp.paddingRight = 48;
  promoComp.fills = [{ type: 'SOLID', color: background }];
  promoComp.x = xOffset;

  // Badge
  const badge = figma.createFrame();
  badge.name = 'Badge';
  badge.layoutMode = 'HORIZONTAL';
  badge.primaryAxisAlignItems = 'CENTER';
  badge.counterAxisAlignItems = 'CENTER';
  badge.paddingLeft = 24;
  badge.paddingRight = 24;
  badge.paddingTop = 12;
  badge.paddingBottom = 12;
  badge.fills = [{ type: 'SOLID', color: primary }];
  badge.cornerRadius = 100;
  promoComp.appendChild(badge);

  const discountText = figma.createText();
  discountText.name = 'Discount';
  discountText.characters = '20% OFF';
  discountText.fontName = { family: font, style: 'Bold' };
  discountText.fontSize = 24;
  discountText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  badge.appendChild(discountText);

  // Title
  const promoTitle = figma.createText();
  promoTitle.name = 'Title';
  promoTitle.characters = 'Your Title Here';
  promoTitle.fontName = { family: font, style: 'Bold' };
  promoTitle.fontSize = 72;
  promoTitle.fills = [{ type: 'SOLID', color: text }];
  promoTitle.textAlignHorizontal = 'CENTER';
  promoComp.appendChild(promoTitle);

  // Subtitle
  const promoSubtitle = figma.createText();
  promoSubtitle.name = 'Subtitle';
  promoSubtitle.characters = 'Add your subtitle text here';
  promoSubtitle.fontName = { family: font, style: 'Regular' };
  promoSubtitle.fontSize = 28;
  promoSubtitle.fills = [{ type: 'SOLID', color: { r: text.r * 0.7, g: text.g * 0.7, b: text.b * 0.7 } }];
  promoSubtitle.textAlignHorizontal = 'CENTER';
  promoComp.appendChild(promoSubtitle);

  // CTA Button
  const ctaBtn = figma.createFrame();
  ctaBtn.name = 'CTA';
  ctaBtn.layoutMode = 'HORIZONTAL';
  ctaBtn.primaryAxisAlignItems = 'CENTER';
  ctaBtn.counterAxisAlignItems = 'CENTER';
  ctaBtn.paddingLeft = 48;
  ctaBtn.paddingRight = 48;
  ctaBtn.paddingTop = 20;
  ctaBtn.paddingBottom = 20;
  ctaBtn.fills = [{ type: 'SOLID', color: primary }];
  ctaBtn.cornerRadius = 12;
  promoComp.appendChild(ctaBtn);

  const ctaText = figma.createText();
  ctaText.name = 'CTA Text';
  ctaText.characters = 'Shop Now';
  ctaText.fontName = { family: font, style: 'Semi Bold' };
  ctaText.fontSize = 24;
  ctaText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  ctaBtn.appendChild(ctaText);

  xOffset += 1080 + SPACING;

  // ═══ INFORMATIVE POST COMPONENT ═══
  const infoComp = figma.createComponent();
  infoComp.name = '[Component] Post/Informative';
  infoComp.description = `@agent:intent informative, info, announcement, news, update
@agent:slots title, body, image
@agent:format instagram-feed, linkedin-post`;
  infoComp.resize(1080, 1080);
  infoComp.layoutMode = 'VERTICAL';
  infoComp.itemSpacing = 0;
  infoComp.fills = [{ type: 'SOLID', color: background }];
  infoComp.clipsContent = true;
  infoComp.x = xOffset;

  // Image placeholder
  const imgPlaceholder = figma.createRectangle();
  imgPlaceholder.name = 'Image';
  imgPlaceholder.resize(1080, 540);
  imgPlaceholder.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
  imgPlaceholder.layoutSizingHorizontal = 'FILL';
  infoComp.appendChild(imgPlaceholder);

  // Content area
  const contentArea = figma.createFrame();
  contentArea.name = 'Content';
  contentArea.layoutMode = 'VERTICAL';
  contentArea.itemSpacing = 16;
  contentArea.paddingTop = 32;
  contentArea.paddingBottom = 32;
  contentArea.paddingLeft = 32;
  contentArea.paddingRight = 32;
  contentArea.fills = [{ type: 'SOLID', color: background }];
  contentArea.layoutSizingHorizontal = 'FILL';
  contentArea.layoutSizingVertical = 'FILL';
  infoComp.appendChild(contentArea);

  const infoTitle = figma.createText();
  infoTitle.name = 'Title';
  infoTitle.characters = 'Your Headline Here';
  infoTitle.fontName = { family: font, style: 'Bold' };
  infoTitle.fontSize = 48;
  infoTitle.fills = [{ type: 'SOLID', color: text }];
  infoTitle.layoutSizingHorizontal = 'FILL';
  infoTitle.textAutoResize = 'HEIGHT';
  contentArea.appendChild(infoTitle);

  const infoBody = figma.createText();
  infoBody.name = 'Body';
  infoBody.characters = 'Add your description text here. This component is perfect for announcements, news updates, and informative content.';
  infoBody.fontName = { family: font, style: 'Regular' };
  infoBody.fontSize = 24;
  infoBody.fills = [{ type: 'SOLID', color: { r: text.r * 0.7, g: text.g * 0.7, b: text.b * 0.7 } }];
  infoBody.layoutSizingHorizontal = 'FILL';
  infoBody.textAutoResize = 'HEIGHT';
  contentArea.appendChild(infoBody);

  xOffset += 1080 + SPACING;

  // ═══ FEATURE CARD COMPONENT ═══
  const cardComp = figma.createComponent();
  cardComp.name = '[Component] Card/Feature';
  cardComp.description = `@agent:intent feature, card, benefit, service
@agent:slots title, description, icon
@agent:format any`;
  cardComp.resize(360, 280);
  cardComp.layoutMode = 'VERTICAL';
  cardComp.itemSpacing = 16;
  cardComp.paddingTop = 32;
  cardComp.paddingBottom = 32;
  cardComp.paddingLeft = 24;
  cardComp.paddingRight = 24;
  cardComp.fills = [{ type: 'SOLID', color: background }];
  cardComp.cornerRadius = 16;
  cardComp.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.08 },
    offset: { x: 0, y: 4 },
    radius: 16,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL',
  }];
  cardComp.x = xOffset;

  // Icon circle
  const iconCircle = figma.createEllipse();
  iconCircle.name = 'Icon';
  iconCircle.resize(56, 56);
  iconCircle.fills = [{ type: 'SOLID', color: primary }];
  cardComp.appendChild(iconCircle);

  const cardTitle = figma.createText();
  cardTitle.name = 'Title';
  cardTitle.characters = 'Feature Title';
  cardTitle.fontName = { family: font, style: 'Semi Bold' };
  cardTitle.fontSize = 24;
  cardTitle.fills = [{ type: 'SOLID', color: text }];
  cardComp.appendChild(cardTitle);

  const cardDesc = figma.createText();
  cardDesc.name = 'Description';
  cardDesc.characters = 'Brief description of this feature or benefit.';
  cardDesc.fontName = { family: font, style: 'Regular' };
  cardDesc.fontSize = 16;
  cardDesc.fills = [{ type: 'SOLID', color: { r: text.r * 0.6, g: text.g * 0.6, b: text.b * 0.6 } }];
  cardDesc.layoutSizingHorizontal = 'FILL';
  cardDesc.textAutoResize = 'HEIGHT';
  cardComp.appendChild(cardDesc);

  xOffset += 360 + SPACING;

  // ═══ BUTTON COMPONENT ═══
  const btnComp = figma.createComponent();
  btnComp.name = '[Component] Element/Button';
  btnComp.description = `@agent:intent button, cta, action
@agent:slots label
@agent:format any`;
  btnComp.layoutMode = 'HORIZONTAL';
  btnComp.primaryAxisAlignItems = 'CENTER';
  btnComp.counterAxisAlignItems = 'CENTER';
  btnComp.paddingLeft = 32;
  btnComp.paddingRight = 32;
  btnComp.paddingTop = 16;
  btnComp.paddingBottom = 16;
  btnComp.fills = [{ type: 'SOLID', color: primary }];
  btnComp.cornerRadius = 8;
  btnComp.primaryAxisSizingMode = 'AUTO';
  btnComp.counterAxisSizingMode = 'AUTO';
  btnComp.x = xOffset;

  const btnLabel = figma.createText();
  btnLabel.name = 'Label';
  btnLabel.characters = 'Button';
  btnLabel.fontName = { family: font, style: 'Semi Bold' };
  btnLabel.fontSize = 18;
  btnLabel.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  btnComp.appendChild(btnLabel);

  // Select all created components
  figma.currentPage.selection = [promoComp, infoComp, cardComp, btnComp];
  figma.viewport.scrollAndZoomIntoView([promoComp, infoComp, cardComp, btnComp]);

  postToUI({
    type: 'SCAFFOLD_COMPLETE',
    message: `Created 4 components in [Agent] Components page`,
    components: [
      { name: promoComp.name, key: promoComp.key },
      { name: infoComp.name, key: infoComp.key },
      { name: cardComp.name, key: cardComp.key },
      { name: btnComp.name, key: btnComp.key },
    ],
  });
}
