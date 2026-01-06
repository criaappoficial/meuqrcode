export const PricingModel = {
  COSTS: {
    BASE_PLAN: 0, // Plano base gratuito
    EXTRA_LINK: 9.90, // Por link acima do limite
    PAID_COLOR: 5.00, // Por cor não padrão
    SIZES: {
        200: 0.00, // Pequeno (Grátis)
        500: 0.00, // Médio (Padrão - Grátis)
        1000: 4.00, // Grande
        2000: 6.00  // Extra Grande
    }
  },

  LIMITS: {
    FREE_LINKS: 2,
    FREE_COLORS: ['default', 'dark'],
    FREE_SIZE: 500
  },

  isColorPaid(style) {
    if (!style) return false;
    const freeStyles = ['default', 'dark']; 
    return !freeStyles.includes(style);
  },

  getSizeCost(size) {
      const s = parseInt(size || 200);
      return this.COSTS.SIZES[s] || 0;
  },

  calculateMonthlyCost(qrCodes) {
    const activeQRs = qrCodes.filter(qr => qr.active);
    const totalActive = activeQRs.length;

    // Custo por links extras
    let extraLinksCount = 0;
    if (totalActive > this.LIMITS.FREE_LINKS) {
      extraLinksCount = totalActive - this.LIMITS.FREE_LINKS;
    }
    const linksCost = extraLinksCount * this.COSTS.EXTRA_LINK;

    // Custo por cores e tamanhos
    let paidColorsCount = 0;
    let totalSizeCost = 0;

    activeQRs.forEach(qr => {
      // Cores
      const style = qr.qrStyle || qr.style || 'default'; 
      if (this.isColorPaid(style)) {
        paidColorsCount++;
      }
      
      // Tamanhos
      const size = qr.size || 200;
      totalSizeCost += this.getSizeCost(size);
    });

    const colorsCost = paidColorsCount * this.COSTS.PAID_COLOR;

    const totalCost = this.COSTS.BASE_PLAN + linksCost + colorsCost + totalSizeCost;

    return {
      total: totalCost,
      formattedTotal: totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      breakdown: {
        activeQRs: totalActive,
        extraQRs: extraLinksCount,
        paidColors: paidColorsCount,
        linksCost: linksCost,
        colorsCost: colorsCost,
        sizeCost: totalSizeCost
      }
    };
  }
};