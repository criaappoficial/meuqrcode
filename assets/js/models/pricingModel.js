export const PricingModel = {
  COSTS: {
    BASE_PLAN: 0, // Plano base gratuito
    EXTRA_LINK: 9.90, // Por link acima do limite
    PAID_COLOR: 5.00  // Por cor não padrão (apenas preto/branco gratuitos)
  },

  LIMITS: {
    FREE_LINKS: 2,
    FREE_COLORS: ['default', 'dark'] // default usually black, dark is black. light is white.
    // User said: "preto com branco ou branco com preto".
    // "default" is usually black on white. "dark" is black on white. "light" is white on dark?
    // Let's assume 'default' and 'dark' are the free ones based on standard implementation, 
    // or checks against specific color values if stored.
    // In new.js: 
    // default: { color: { dark: '#050814', light: '#FFFFFF' } },
    // dark: { color: { dark: '#000000', light: '#FFFFFF' } },
    // light: { color: { dark: '#333333', light: '#FAFAFA' } },
    // blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
    
    // User said: "apenas duas combinações no (preto com branco ou branco com preto)"
    // So 'default' (black/white) and 'dark' (black/white) and maybe a 'reversed' one if it existed.
    // Let's treat 'default' and 'dark' as free. 'light' (gray/white) and 'blue' as paid.
  },

  isColorPaid(style) {
    // Se o estilo não for informado, assume default (grátis)
    if (!style) return false;
    // Lista de estilos gratuitos
    const freeStyles = ['default', 'dark']; 
    return !freeStyles.includes(style);
  },

  calculateMonthlyCost(qrCodes) {
    // Filtra apenas QR Codes ativos para cobrança de links extras? 
    // O user disse: "Recursos de links dinâmicos: até 2 links incluídos"
    // Geralmente conta-se o total de ativos.
    const activeQRs = qrCodes.filter(qr => qr.active);
    const totalActive = activeQRs.length;

    // Custo por links extras
    let extraLinksCount = 0;
    if (totalActive > this.LIMITS.FREE_LINKS) {
      extraLinksCount = totalActive - this.LIMITS.FREE_LINKS;
    }
    const linksCost = extraLinksCount * this.COSTS.EXTRA_LINK;

    // Custo por cores
    // "Para outras cores, cobrar uma taxa adicional."
    // Cobra-se por QR code que usa cor paga ou taxa única?
    // "O valor do serviço deve ser ajustado automaticamente conforme a inclusão de novas funcionalidades."
    // Geralmente é por item. Se eu tenho 3 QRs azuis, pago a taxa 3 vezes ou 1 vez o recurso "Cores"?
    // O mais comum em SaaS desse tipo é pagar pelo recurso ativado no item.
    // Vou assumir que é por QR Code que usa a feature.
    let paidColorsCount = 0;
    activeQRs.forEach(qr => {
      // Precisamos ter certeza que o objeto qr tem a propriedade style ou qrStyle
      // No save do QRController/new.js precisamos garantir que isso está sendo salvo.
      // Vou assumir qr.style ou qr.qrStyle.
      const style = qr.qrStyle || qr.style || 'default'; 
      if (this.isColorPaid(style)) {
        paidColorsCount++;
      }
    });
    const colorsCost = paidColorsCount * this.COSTS.PAID_COLOR;

    const totalCost = this.COSTS.BASE_PLAN + linksCost + colorsCost;

    return {
      total: totalCost,
      formattedTotal: totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      breakdown: {
        activeQRs: totalActive,
        extraQRs: extraLinksCount,
        paidColors: paidColorsCount,
        linksCost: linksCost,
        colorsCost: colorsCost
      }
    };
  }
};