export function normalizeWhatsapp(number: string): string {
  const digits = number.replace(/^\s*\+/, '').replace(/[\s-]/g, '');
  return /^9[0-9]{8}$/.test(digits) ? '51' + digits : digits;
}

export function whatsappUrl(number: string, title: string): string {
  const message = `Hola, vi tu anuncio «${title}» en ROOMI. ¿La habitación sigue disponible?`;
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(message)}`;
}

export function whatsappReplyUrl(number: string, title: string): string {
  const message = `Hola, te escribo por tu consulta sobre «${title}» en ROOMI.`;
  return `https://wa.me/${normalizeWhatsapp(number)}?text=${encodeURIComponent(message)}`;
}
