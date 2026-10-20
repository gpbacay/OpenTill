const SYMBOLS: Record<string, string> = {
  EUR: "€",
  GBP: "£",
  PHP: "₱",
  SGD: "$",
  USD: "$",
};

export function money(currency: string, amount: number) {
  const symbol = SYMBOLS[currency] ?? "";
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 && Number(formatted.replace(/,/g, "")) !== 0 ? "-" : "";
  return symbol ? `${sign}${symbol}${formatted}` : `${sign}${currency} ${formatted}`;
}
