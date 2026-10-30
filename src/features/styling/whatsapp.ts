/** Pooja's styling WhatsApp; wa.me wants the country code and digits only. */
export function stylingWhatsAppUrl(message: string): string {
  return `https://wa.me/919971572036?text=${encodeURIComponent(message)}`;
}
