export interface Price {
  l: string;
  xl: string;
  xxl: string;
  xxxl: string;
}

interface Product {
  title: string;
  /** Short pitch shown under the version name, per language. */
  tagline?: Record<"cs" | "en", string>;
  prices: Price;
  price?: string; // Optional property to hold the selected price
  features: Record<string, boolean>;
}

export interface PricesData {
  products: Product[];
}