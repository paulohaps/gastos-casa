const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export const formatCurrency = (value: number) => currency.format(value);
