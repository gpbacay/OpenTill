const SYMBOLS: Record<string, string> = {
  EUR: "€",
  GBP: "£",
  PHP: "₱",
  SGD: "$",
  USD: "$",
};

export function money(currency: string, amount: number) {
  const symbol = SYMBOLS[currency] ?? "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${currency} ${formatted}`;
}
