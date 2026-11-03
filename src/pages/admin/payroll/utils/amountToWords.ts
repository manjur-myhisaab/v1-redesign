export function amountToWords(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return ''

  const n = Number(num)
  if (isNaN(n)) return ''

  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  const number = Math.floor(n)
  const decimal = Math.round((n - number) * 100)

  function inWords(val: number): string {
    if (val < 20) return a[val]
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 ? ' ' + a[val % 10] : '')
    if (val < 1000)
      return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 ? ' and ' + inWords(val % 100) : '')
    if (val < 100000)
      return inWords(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 ? ' ' + inWords(val % 1000) : '')
    if (val < 10000000)
      return inWords(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 ? ' ' + inWords(val % 100000) : '')
    return inWords(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 ? ' ' + inWords(val % 10000000) : '')
  }

  let result = `${inWords(number)} Rupees`

  if (decimal > 0) {
    result += ` and ${inWords(decimal)} Paise`
  }

  return result + ' Only'
}
