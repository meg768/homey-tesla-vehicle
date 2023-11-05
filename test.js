


const number = 123456.789;

function formatNumber(number) {
    return new Intl.NumberFormat().format(number)
}

console.log(
  new Intl.NumberFormat('en-IN', { maximumSignificantDigits: 3 }).format(
    number,
  ),
);

console.log(
    new Intl.NumberFormat().format(
      number,
    ),
  );
  

console.log(formatNumber(number));
// Expected output: "1,23,000"